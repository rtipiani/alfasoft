"use client";

import { useState, useEffect } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc, getDocFromCache, getDocFromServer, DocumentData, runTransaction } from "firebase/firestore";
import Swal from "sweetalert2";
import { format } from "date-fns";
import ProductionMetrics from "../components/ProductionMetrics";

type TrituracionRecord = {
    id: string;
    fecha: Date;
    turno: "DIA" | "NOCHE";
    clienteNombre: string;
    clienteTipoDoc: string;
    clienteNumDoc: string;
    capacidadHora: number;
    horasEfectivas: number;
    totalProduccion: number;
    timestamp: Date;
};

export default function TrituracionPage() {
    const [records, setRecords] = useState<TrituracionRecord[]>([]);
    const [showDialog, setShowDialog] = useState(false);
    const [formData, setFormData] = useState({
        fecha: format(new Date(), "yyyy-MM-dd"),
        turno: "DIA",
        clienteTipoDoc: "DNI",
        clienteNumDoc: "",
        clienteNombre: "",
        capacidadHora: 0,
        horasEfectivas: 8
    });
    const [isSearchingClient, setIsSearchingClient] = useState(false);
    const [clientFound, setClientFound] = useState<boolean | null>(null);
    const [tolvaStock, setTolvaStock] = useState(0);

    // Subscribe to Tolva Stock
    useEffect(() => {
        const unsub = onSnapshot(doc(db, "produccion_stats", "tolva_gruesos"), (doc) => {
            if (doc.exists()) {
                setTolvaStock(doc.data().stock || 0);
            } else {
                setTolvaStock(0);
            }
        });
        return () => unsub();
    }, []);

    // Subscribe to Records
    useEffect(() => {
        const q = query(collection(db, "produccion_trituracion"), orderBy("timestamp", "desc"), limit(20));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                fecha: doc.data().fecha?.toDate(),
                timestamp: doc.data().timestamp?.toDate()
            })) as TrituracionRecord[];
            setRecords(data);
        });
        return () => unsub();
    }, []);

    // Debounced Search Effect
    useEffect(() => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            if (formData.clienteNumDoc) {
                handleClientSearch(formData.clienteNumDoc, formData.clienteTipoDoc, controller.signal);
            }
        }, 500);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [formData.clienteNumDoc, formData.clienteTipoDoc]);

    const handleClientSearch = async (numDoc: string, typeDoc: string, signal: AbortSignal) => {
        if (!numDoc) return;

        const expectedLength = typeDoc === "DNI" ? 8 : 11;
        if (numDoc.length !== expectedLength) {
            setClientFound(null);
            setIsSearchingClient(false);
            return;
        }

        setIsSearchingClient(true);
        try {
            const clientRef = doc(db, "clientes", numDoc);
            let clientData: DocumentData | undefined | null = null;
            let foundInFirestore = false;

            // 1. Try Cache
            try {
                const cacheSnap = await getDocFromCache(clientRef);
                if (cacheSnap.exists()) {
                    clientData = cacheSnap.data();
                    foundInFirestore = true;
                }
            } catch { }

            // 2. Try Server if not in cache
            if (!foundInFirestore) {
                try {
                    const serverSnap = await getDocFromServer(clientRef);
                    if (serverSnap.exists()) {
                        clientData = serverSnap.data();
                        foundInFirestore = true;
                    }
                } catch { }
            }

            if (foundInFirestore && clientData) {
                setFormData(prev => ({
                    ...prev,
                    clienteNombre: clientData?.razonSocial || clientData?.nombre || "",
                    clienteNumDoc: numDoc,
                    capacidadHora: clientData?.capacidadCarga || 0
                }));
                setClientFound(true);
            } else {
                // If not found in Firestore, we could try API, but for now let's assume client must exist or be created first
                // Or we can just let them enter name manually if we want, but better to enforce existing clients for capacity logic
                setClientFound(false);
                setFormData(prev => ({ ...prev, clienteNombre: "", capacidadHora: 0 }));
            }
        } catch (error) {
            console.error("Search error:", error);
            setClientFound(false);
        } finally {
            setIsSearchingClient(false);
        }
    };

    const handleSave = async () => {
        if (!formData.clienteNombre || !formData.clienteNumDoc) {
            Swal.fire("Error", "Debe seleccionar un cliente válido", "error");
            return;
        }
    };

    return (
        <div className="space-y-6">

            {/* Records Table */}
            {/* Production Metrics */}
            <ProductionMetrics defaultJornada={12} />

            {/* Records Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Turno</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Capacidad/H</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">H. Efectivas</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total (TN)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {records.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">No hay registros de producción</td>
                            </tr>
                        ) : (
                            records.map((record) => (
                                <tr key={record.id}>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {record.fecha ? format(record.fecha, "dd/MM/yyyy") : "-"}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${record.turno === 'DIA'
                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
                                            }`}>
                                            {record.turno}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                                        {record.clienteNombre}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {record.capacidadHora} TN
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {record.horasEfectivas} hrs
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-blue-600 dark:text-blue-400">
                                        {record.totalProduccion.toFixed(2)} TN
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div >

            {/* Dialog */}
            {
                showDialog && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md">
                            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    Registrar Producción
                                </h3>
                                <button
                                    onClick={() => setShowDialog(false)}
                                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                                >
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Fecha
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.fecha}
                                            onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Turno
                                        </label>
                                        <select
                                            value={formData.turno}
                                            onChange={(e) => setFormData({ ...formData, turno: e.target.value as "DIA" | "NOCHE" })}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        >
                                            <option value="DIA">Día</option>
                                            <option value="NOCHE">Noche</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Client Search */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Tipo Doc
                                        </label>
                                        <select
                                            value={formData.clienteTipoDoc}
                                            onChange={(e) => setFormData({ ...formData, clienteTipoDoc: e.target.value, clienteNumDoc: '', clienteNombre: '', capacidadHora: 0 })}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        >
                                            <option value="DNI">DNI</option>
                                            <option value="RUC">RUC</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Número
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={formData.clienteNumDoc}
                                                onChange={(e) => {
                                                    const val = e.target.value.replace(/\D/g, '');
                                                    const maxLen = formData.clienteTipoDoc === 'DNI' ? 8 : 11;
                                                    if (val.length <= maxLen) {
                                                        setFormData({ ...formData, clienteNumDoc: val });
                                                    }
                                                }}
                                                className={`w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${clientFound === false ? 'border-red-300 focus:border-red-500' :
                                                    clientFound === true ? 'border-green-300 focus:border-green-500' :
                                                        'border-gray-200 dark:border-zinc-700'
                                                    }`}
                                                placeholder={`Ingrese ${formData.clienteTipoDoc}`}
                                            />
                                            {isSearchingClient && (
                                                <div className="absolute right-3 top-2.5">
                                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Cliente
                                    </label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={formData.clienteNombre}
                                        className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-600 dark:text-gray-400 cursor-not-allowed"
                                        placeholder="Se completará automáticamente"
                                    />
                                </div>

                                {/* Formula Fields */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Capacidad (TN/H)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={formData.capacidadHora}
                                            onChange={(e) => setFormData({ ...formData, capacidadHora: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Horas Efectivas
                                        </label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={formData.horasEfectivas}
                                            onChange={(e) => setFormData({ ...formData, horasEfectivas: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Stock Info */}
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">Stock en Tolva:</span>
                                    <span className={`font-medium ${tolvaStock < (formData.capacidadHora * formData.horasEfectivas)
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-gray-900 dark:text-white'
                                        }`}>
                                        {tolvaStock.toFixed(2)} TN
                                    </span>
                                </div>

                                {/* Total Calculation Preview */}
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Total Producción:</span>
                                        <span className="text-xl font-bold text-blue-700 dark:text-blue-400">
                                            {(formData.capacidadHora * formData.horasEfectivas).toFixed(2)} TN
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                                <button
                                    onClick={() => setShowDialog(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-lg shadow-blue-600/20"
                                >
                                    Guardar Registro
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
