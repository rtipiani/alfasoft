"use client";

import { useState, useEffect } from "react";
import { PlusIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, limit, doc, setDoc, getDoc, runTransaction, getDocFromCache, getDocFromServer, DocumentData } from "firebase/firestore";
import Swal from "sweetalert2";
import { format } from "date-fns";
import ProductionMetrics from "../components/ProductionMetrics";

type Movimiento = {
    id: string;
    tipo: "entrada" | "salida";
    cantidad: number;
    origenDestino: string;
    timestamp: Date;
    clienteNombre?: string;
    clienteTipoDoc?: string;
    clienteNumDoc?: string;
};

export default function TolvaGruesosPage() {
    const [stock, setStock] = useState(0);
    const [capacidad, setCapacidad] = useState(2000); // Default fallback
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [showDialog, setShowDialog] = useState(false);
    const [dialogType, setDialogType] = useState<"entrada" | "salida">("entrada");
    const [formData, setFormData] = useState({
        cantidad: 0,
        origenDestino: "",
        clienteTipoDoc: "DNI",
        clienteNumDoc: "",
        clienteNombre: ""
    });
    const [isSearchingClient, setIsSearchingClient] = useState(false);
    const [clientFound, setClientFound] = useState<boolean | null>(null);

    // Debounced Search Effect
    useEffect(() => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            if (formData.clienteNumDoc && dialogType === 'entrada') {
                handleClientSearch(formData.clienteNumDoc, formData.clienteTipoDoc, controller.signal);
            }
        }, 500);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [formData.clienteNumDoc, formData.clienteTipoDoc, dialogType]);

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

            if (foundInFirestore && clientData) {
                setFormData(prev => ({
                    ...prev,
                    clienteNombre: clientData?.razonSocial || clientData?.nombre || "",
                    clienteNumDoc: numDoc
                }));
                setClientFound(true);
                setIsSearchingClient(false);
                return;
            }

            // 2. Race: Server vs API
            const endpoint = typeDoc === "DNI"
                ? `/api/sunat/dni?dni=${numDoc}`
                : `/api/sunat/ruc?ruc=${numDoc}`;

            const fetchController = new AbortController();
            const timeoutId = setTimeout(() => fetchController.abort(), 10000);
            signal.addEventListener('abort', () => fetchController.abort());

            const apiPromise = fetch(endpoint, { signal: fetchController.signal })
                .then(async res => {
                    clearTimeout(timeoutId);
                    if (!res.ok) throw new Error('API Error');
                    const result = await res.json();
                    if (result.success && result.data) return { source: 'api', data: result.data };
                    throw new Error('Not found in API');
                });

            const serverPromise = getDocFromServer(clientRef)
                .then(snap => {
                    if (snap.exists()) return { source: 'firestore', data: snap.data() };
                    throw new Error('Not found in Firestore');
                });

            const winner = await Promise.any([apiPromise, serverPromise]);

            if (winner.source === 'firestore') {
                const data = winner.data;
                setFormData(prev => ({
                    ...prev,
                    clienteNombre: data.razonSocial || data.nombre || "",
                    clienteNumDoc: numDoc
                }));
                setClientFound(true);
            } else {
                const data = winner.data;
                const name = typeDoc === "DNI" ? data.nombre_completo : data.nombre_o_razon_social;
                setFormData(prev => ({
                    ...prev,
                    clienteNombre: name || "",
                    clienteNumDoc: numDoc
                }));

                // Save to Firestore silently
                const clientDataToSave = {
                    nombre: name || "",
                    razonSocial: name || "",
                    direccion: data.direccion_completa || data.direccion || "",
                    estado: data.estado || "",
                    condicion: data.condicion || "",
                    departamento: data.departamento || "",
                    provincia: data.provincia || "",
                    distrito: data.distrito || "",
                    tipoDocumento: typeDoc,
                    numeroDocumento: numDoc,
                    updatedAt: new Date()
                };
                setDoc(clientRef, clientDataToSave, { merge: true }).catch(console.error);

                setClientFound(true);
            }
        } catch (error) {
            console.error("Search error:", error);
            setClientFound(false);
            setFormData(prev => ({ ...prev, clienteNombre: "" }));
        } finally {
            setIsSearchingClient(false);
        }
    };

    // Subscribe to Config
    useEffect(() => {
        const unsub = onSnapshot(doc(db, "configuracion", "tolva_gruesos"), (doc) => {
            if (doc.exists()) {
                setCapacidad(Number(doc.data().capacidad) || 2000);
            }
        });
        return () => unsub();
    }, []);

    // Subscribe to Stock
    useEffect(() => {
        const unsub = onSnapshot(doc(db, "produccion_stats", "tolva_gruesos"), (doc) => {
            if (doc.exists()) {
                setStock(doc.data().stock || 0);
            } else {
                setStock(0);
            }
        });
        return () => unsub();
    }, []);

    // Subscribe to Movements
    useEffect(() => {
        const q = query(collection(db, "produccion_tolva_gruesos"), orderBy("timestamp", "desc"), limit(10));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate()
            })) as Movimiento[];
            setMovimientos(data);
        });
        return () => unsub();
    }, []);

    const openDialog = (type: "entrada" | "salida") => {
        setDialogType(type);
        setDialogType(type);
        setFormData({
            cantidad: 0,
            origenDestino: type === "entrada" ? "Mina" : "Chancado",
            clienteTipoDoc: "DNI",
            clienteNumDoc: "",
            clienteNombre: ""
        });
        setClientFound(null);
        setShowDialog(true);
    };

    const handleSave = async () => {
        if (formData.cantidad <= 0) {
            Swal.fire("Error", "La cantidad debe ser mayor a 0", "error");
            return;
        }
        if (!formData.origenDestino) {
            Swal.fire("Error", "El origen/destino es requerido", "error");
            return;
        }

        if (dialogType === "salida" && formData.cantidad > stock) {
            Swal.fire("Error", "No hay suficiente stock", "error");
            return;
        }

        if (dialogType === "entrada" && (stock + formData.cantidad) > capacidad) {
            Swal.fire("Error", `La cantidad excede la capacidad máxima (${capacidad} TM)`, "error");
            return;
        }

        try {
            await runTransaction(db, async (transaction) => {
                // 1. READS
                const statsRef = doc(db, "produccion_stats", "tolva_gruesos");
                const statsDoc = await transaction.get(statsRef);

                // 2. CALCULATIONS
                let currentStock = 0;
                if (statsDoc.exists()) {
                    currentStock = statsDoc.data().stock || 0;
                }

                const newStock = dialogType === "entrada"
                    ? currentStock + formData.cantidad
                    : currentStock - formData.cantidad;

                // 3. WRITES
                // Create Log
                const newLogRef = doc(collection(db, "produccion_tolva_gruesos"));
                transaction.set(newLogRef, {
                    tipo: dialogType,
                    cantidad: formData.cantidad,
                    origenDestino: formData.origenDestino,
                    clienteTipoDoc: dialogType === 'entrada' ? formData.clienteTipoDoc : null,
                    clienteNumDoc: dialogType === 'entrada' ? formData.clienteNumDoc : null,
                    clienteNombre: dialogType === 'entrada' ? formData.clienteNombre : null,
                    timestamp: new Date()
                });

                // Update Stock
                transaction.set(statsRef, { stock: newStock }, { merge: true });
            });

            setShowDialog(false);
            Swal.fire("Éxito", "Movimiento registrado correctamente", "success");
        } catch (error) {
            console.error("Error saving movement:", error);
            Swal.fire("Error", "No se pudo registrar el movimiento", "error");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tolva de Gruesos</h2>
                    <p className="text-gray-500 dark:text-gray-400">Recepción y almacenamiento de mineral ROM</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => openDialog("entrada")}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                    >
                        <ArrowDownTrayIcon className="w-5 h-5" />
                        Alimentar
                    </button>
                    <button
                        onClick={() => openDialog("salida")}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        <ArrowUpTrayIcon className="w-5 h-5" />
                        Descargar
                    </button>
                </div>
            </div>

            {/* Stock Visualization */}
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 flex flex-col items-center justify-center">
                <div className="relative w-64 h-64">
                    {/* Mock Hopper Visualization */}
                    <div className="absolute inset-0 border-4 border-gray-300 dark:border-zinc-700 rounded-b-full border-t-0 flex items-end justify-center overflow-hidden">
                        <div
                            className={`w-full transition-all duration-1000 ${(stock / capacidad) > 0.9 ? 'bg-red-600' :
                                (stock / capacidad) > 0.75 ? 'bg-orange-500' :
                                    'bg-stone-500 dark:bg-stone-600'
                                }`}
                            style={{ height: `${Math.min((stock / capacidad) * 100, 100)}%` }}
                        ></div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                            <span className={`text-4xl font-bold transition-colors duration-300 ${(stock / capacidad) > 0.75 ? 'text-white' : 'text-gray-900 dark:text-white'
                                }`}>
                                {stock.toFixed(2)}
                            </span>
                            <p className={`text-sm transition-colors duration-300 ${(stock / capacidad) > 0.75 ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                Toneladas (TM)
                            </p>
                        </div>
                    </div>
                </div>
                <p className="mt-4 text-sm text-gray-500">Capacidad Total: {capacidad.toLocaleString()} TM</p>
            </div>

            {/* Production Metrics */}
            <ProductionMetrics defaultCapacidad={capacidad} defaultJornada={12} />

            {/* Recent Movements Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Movimientos Recientes</h3>
                </div>
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha/Hora</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cantidad</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Origen/Destino</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {movimientos.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No hay movimientos registrados</td>
                            </tr>
                        ) : (
                            movimientos.map((mov) => (
                                <tr key={mov.id}>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {mov.timestamp ? format(mov.timestamp, "dd/MM/yyyy HH:mm") : "-"}
                                    </td>
                                    <td className={`px-6 py-4 text-sm font-medium ${mov.tipo === 'entrada' ? 'text-green-600' : 'text-blue-600'}`}>
                                        {mov.tipo === 'entrada' ? 'Entrada' : 'Salida'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                        {mov.cantidad.toFixed(2)} TM
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {mov.origenDestino}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {mov.clienteNombre ? (
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{mov.clienteNombre}</p>
                                                <p className="text-xs text-gray-500">{mov.clienteTipoDoc}: {mov.clienteNumDoc}</p>
                                            </div>
                                        ) : (
                                            "-"
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Dialog */}
            {showDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {dialogType === 'entrada' ? 'Registrar Alimentación' : 'Registrar Descarga'}
                            </h3>
                            <button
                                onClick={() => setShowDialog(false)}
                                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Cantidad (TM)
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.cantidad}
                                    onChange={(e) => setFormData({ ...formData, cantidad: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {dialogType === 'entrada' ? 'Origen' : 'Destino'}
                                </label>
                                <input
                                    type="text"
                                    value={formData.origenDestino}
                                    onChange={(e) => setFormData({ ...formData, origenDestino: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>

                            {dialogType === 'entrada' && (
                                <>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="col-span-1">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                Tipo Doc
                                            </label>
                                            <select
                                                value={formData.clienteTipoDoc}
                                                onChange={(e) => setFormData({ ...formData, clienteTipoDoc: e.target.value, clienteNumDoc: '', clienteNombre: '' })}
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
                                </>
                            )}
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
                                className={`px-4 py-2 text-white rounded-lg transition font-medium shadow-lg ${dialogType === 'entrada'
                                    ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                                    }`}
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
