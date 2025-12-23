"use client";

import { useState, useEffect } from "react";
import {
    FunnelIcon,
    Cog6ToothIcon,
    BeakerIcon,
    ArrowTrendingUpIcon,
    PlusIcon,
    CalendarIcon,
    ClockIcon,
    XMarkIcon,
    ArrowPathIcon,
    MagnifyingGlassIcon,
    ChevronDownIcon
} from "@heroicons/react/24/outline";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, orderBy, getDocs, setDoc, getDoc } from "firebase/firestore";
import { createProductionBatch } from "./actions";
import Dialog from "@/app/components/Dialog";
import FormField from "@/app/components/FormField";

export default function ProduccionDashboard() {
    const [stats, setStats] = useState({
        tolvaGruesos: 0,
        tolvaFinos: 0,
        molienda: { potencia: 0, alimentacion: 0, estado: "detenido" },
        flotacion: { recuperacion: 0, leyConcentrado: 0 }
    });
    const [batches, setBatches] = useState<any[]>([]);
    const [minerals, setMinerals] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form State
    const [composition, setComposition] = useState<{ mineralId: string; quantity: number }[]>([]);
    const [selectedMineral, setSelectedMineral] = useState("");
    const [quantity, setQuantity] = useState("");
    const [startTime, setStartTime] = useState("");

    // Client Data
    const [clientType, setClientType] = useState("DNI");
    const [clientDoc, setClientDoc] = useState("");
    const [clientName, setClientName] = useState("");
    const [isSearchingClient, setIsSearchingClient] = useState(false);

    const handleClientSearch = async () => {
        if (!clientDoc) return;
        setIsSearchingClient(true);

        try {
            // 1. Try Cache/Firestore first
            const clientRef = doc(db, "clientes", clientDoc);
            let found = false;

            const snap = await getDoc(clientRef);
            if (snap.exists()) {
                setClientName(snap.data().nombre || snap.data().razonSocial || "");
                found = true;
            }

            if (!found) {
                // 2. API Fallback
                const endpoint = clientType === "DNI" ? `/api/sunat/dni?dni=${clientDoc}` : `/api/sunat/ruc?ruc=${clientDoc}`;
                const res = await fetch(endpoint);
                const data = await res.json();

                if (data.nombres || data.razonSocial) {
                    const name = data.nombres ? `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}` : data.razonSocial;
                    setClientName(name);

                    // Background Save
                    setDoc(clientRef, {
                        tipoDocumento: clientType,
                        numeroDocumento: clientDoc,
                        nombre: name,
                        razonSocial: name, // generic
                        updatedAt: new Date()
                    }, { merge: true });
                } else {
                    alert("Cliente no encontrado");
                }
            }
        } catch (error) {
            console.error(error);
            alert("Error buscando cliente");
        } finally {
            setIsSearchingClient(false);
        }
    };

    const handleCreateBatchLocal = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const result = await createProductionBatch(composition, startTime, {
            tipoDoc: clientType,
            numDoc: clientDoc,
            nombre: clientName
        });
        setLoading(false);
        if (result.success) {
            setIsModalOpen(false);
            setComposition([]);
            setStartTime("");
            setClientDoc("");
            setClientName("");
            alert("Lote creado correctamente");
        } else {
            alert(result.message);
        }
    };

    useEffect(() => {
        // Real-time Stats
        const unsubTG = onSnapshot(doc(db, "produccion_stats", "tolva_gruesos"), (d) => {
            if (d.exists()) setStats(prev => ({ ...prev, tolvaGruesos: d.data().stock || 0 }));
        });
        const unsubTF = onSnapshot(doc(db, "produccion_stats", "tolva_finos"), (d) => {
            if (d.exists()) setStats(prev => ({ ...prev, tolvaFinos: d.data().stock || 0 }));
        });
        const unsubMol = onSnapshot(doc(db, "produccion_stats", "molino_1"), (d) => {
            if (d.exists()) setStats(prev => ({ ...prev, molienda: d.data() as any }));
        });
        const unsubFlot = onSnapshot(doc(db, "produccion_stats", "flotacion"), (d) => {
            if (d.exists()) setStats(prev => ({ ...prev, flotacion: d.data() as any }));
        });

        // Real-time Batches
        const q = query(collection(db, "production_batches"), orderBy("createdAt", "desc"));
        const unsubBatches = onSnapshot(q, (snapshot) => {
            setBatches(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Fetch Minerals (One-time)
        const fetchMinerals = async () => {
            const qMin = query(collection(db, "productos"), where("categoria", "==", "Mineral"));
            const snap = await getDocs(qMin);
            setMinerals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchMinerals();

        return () => { unsubTG(); unsubTF(); unsubMol(); unsubFlot(); unsubBatches(); };
    }, []);

    const handleAddMineral = () => {
        if (!selectedMineral || !quantity) return;
        setComposition([...composition, { mineralId: selectedMineral, quantity: Number(quantity) }]);
        setSelectedMineral("");
        setQuantity("");
    };

    const handleRemoveMineral = (index: number) => {
        const newComp = [...composition];
        newComp.splice(index, 1);
        setComposition(newComp);
    };

    const handleCreateBatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (composition.length === 0) {
            alert("Debe agregar al menos un mineral al blend.");
            return;
        }
        setLoading(true);
        try {
            const result = await createProductionBatch(composition, startTime);
            if (result.success) {
                setIsModalOpen(false);
                setComposition([]);
                setStartTime("");
                alert("Lote (Blend) programado exitosamente");
            } else {
                alert("Error: " + result.message);
            }
        } catch (error) {
            console.error(error);
            alert("Error al crear el lote");
        } finally {
            setLoading(false);
        }
    };

    const getMineralName = (id: string) => minerals.find(m => m.id === id)?.nombre || "Desconocido";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard de Producción</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <PlusIcon className="w-5 h-5" />
                    Programar Producción
                </button>
            </div>

            {/* KPI Cards Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Tolva Gruesos</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {stats.tolvaGruesos.toFixed(2)} <span className="text-sm font-normal text-gray-500">TM</span>
                            </h3>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                            <FunnelIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-green-600 dark:text-green-400">
                        <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
                        <span>En operación</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Tolva Finos</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {stats.tolvaFinos.toFixed(2)} <span className="text-sm font-normal text-gray-500">TM</span>
                            </h3>
                        </div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                            <FunnelIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <span>Stock disponible</span>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Molienda (M1)</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {stats.molienda.alimentacion} <span className="text-sm font-normal text-gray-500">TPH</span>
                            </h3>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <Cog6ToothIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stats.molienda.estado === 'operando' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                            {stats.molienda.estado.toUpperCase()}
                        </span>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Recuperación</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {stats.flotacion.recuperacion.toFixed(2)} <span className="text-sm font-normal text-gray-500">%</span>
                            </h3>
                        </div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <BeakerIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center text-sm text-green-600 dark:text-green-400">
                        <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
                        <span>Estable</span>
                    </div>
                </div>
            </div>

            {/* Active Batches List */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Lotes de Producción Activos</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-zinc-800 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-3">Mineral / Blend</th>
                                <th className="px-6 py-3">Cantidad Total (TM)</th>
                                <th className="px-6 py-3">Inicio</th>
                                <th className="px-6 py-3">Estado</th>
                                <th className="px-6 py-3">Etapa Actual</th>
                            </tr>
                        </thead>
                        <tbody>
                            {batches.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                        No hay lotes activos
                                    </td>
                                </tr>
                            ) : (
                                batches.map((batch) => (
                                    <tr key={batch.id} className="bg-white border-b dark:bg-zinc-900 dark:border-zinc-800">
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {batch.mineralName}
                                        </td>
                                        <td className="px-6 py-4">{batch.quantity}</td>
                                        <td className="px-6 py-4">
                                            {batch.startTime?.seconds ? new Date(batch.startTime.seconds * 1000).toLocaleString() : batch.startTime}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${batch.status === 'programado' ? 'bg-blue-100 text-blue-700' :
                                                batch.status === 'en_proceso' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-green-100 text-green-700'
                                                }`}>
                                                {batch.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {batch.currentStage.replace('_', ' ').toUpperCase()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Batch Modal */}
            {/* Create Batch Modal */}
            <Dialog
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Programar Nuevo Lote (Blending)"
                maxWidth="max-w-3xl"
            >
                <form onSubmit={handleCreateBatchLocal} className="space-y-8">

                    {/* Section 1: Datos del Cliente */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-zinc-700 pb-2">
                            1. Datos del Cliente
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Tipo de Documento">
                                <div className="relative">
                                    <select
                                        value={clientType}
                                        onChange={(e) => setClientType(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                                    >
                                        <option value="DNI">DNI</option>
                                        <option value="RUC">RUC</option>
                                    </select>
                                    <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                                </div>
                            </FormField>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Número de Documento
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={clientDoc}
                                        onChange={(e) => setClientDoc(e.target.value)}
                                        placeholder="Ingrese número"
                                        className="w-full pl-4 pr-12 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleClientSearch}
                                        disabled={isSearchingClient || !clientDoc}
                                        className="absolute right-0 top-0 bottom-0 aspect-square bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center border border-l-0 border-blue-600"
                                        title="Buscar cliente"
                                    >
                                        {isSearchingClient ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <MagnifyingGlassIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <FormField label="Razón Social / Nombre">
                                    <input
                                        type="text"
                                        value={clientName}
                                        readOnly
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-500 shadow-sm"
                                    />
                                </FormField>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Composición */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-zinc-700 pb-2">
                            2. Composición del Blend
                        </h4>

                        <div className="flex gap-4 mb-4">
                            <div className="flex-1">
                                <FormField label="Mineral">
                                    <div className="relative">
                                        <select
                                            value={selectedMineral}
                                            onChange={(e) => setSelectedMineral(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                                        >
                                            <option value="">Seleccionar mineral...</option>
                                            {minerals.map(m => (
                                                <option key={m.id} value={m.id}>{m.nombre}</option>
                                            ))}
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 text-gray-400 absolute right-3 top-3 pointer-events-none" />
                                    </div>
                                </FormField>
                            </div>
                            <div className="w-32">
                                <FormField label="TM">
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </FormField>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-transparent mb-1">
                                    Acción
                                </label>
                                <button
                                    type="button"
                                    onClick={handleAddMineral}
                                    className="px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors border border-gray-200 dark:border-zinc-700 shadow-sm"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 dark:bg-zinc-800 text-xs uppercase text-gray-500">
                                    <tr>
                                        <th className="px-4 py-2">Mineral</th>
                                        <th className="px-4 py-2 text-right">Cantidad (TM)</th>
                                        <th className="px-4 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {composition.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                                                No hay minerales agregados
                                            </td>
                                        </tr>
                                    ) : (
                                        composition.map((item, idx) => (
                                            <tr key={idx} className="border-t border-gray-100 dark:border-zinc-800">
                                                <td className="px-4 py-2">{getMineralName(item.mineralId)}</td>
                                                <td className="px-4 py-2 text-right">{item.quantity.toFixed(2)}</td>
                                                <td className="px-4 py-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveMineral(idx)}
                                                        className="text-red-500 hover:text-red-700"
                                                    >
                                                        <XMarkIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-50 dark:bg-zinc-800/50 font-medium">
                                    <tr>
                                        <td className="px-4 py-2">Total</td>
                                        <td className="px-4 py-2 text-right">
                                            {composition.reduce((acc, curr) => acc + curr.quantity, 0).toFixed(2)} TM
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Section 4: Programming */}
                    < div >
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-4 border-b border-gray-200 dark:border-zinc-700 pb-2">
                            4. Programación
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800/30">
                            <div>
                                <FormField label="Fecha de Inicio">
                                    <div className="relative">
                                        <input
                                            type="date"
                                            required
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="w-full px-4 py-2.5 pl-10 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-white placeholder-gray-400"
                                        />
                                        <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                                    </div>
                                </FormField>
                            </div>
                            <div className="flex items-end">
                                <div className="text-xs text-blue-600 dark:text-blue-400 p-2">
                                    <p className="font-semibold mb-1">Nota:</p>
                                    <p>El lote se creará en estado "Programado". El sistema asignará la hora actual al iniciar.</p>
                                </div>
                            </div>
                        </div>
                    </div >

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors shadow-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || composition.length === 0 || !clientName}
                            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/20 transition-all transform active:scale-95"
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Procesando...
                                </span>
                            ) : (
                                "Confirmar Programación"
                            )}
                        </button>
                    </div>
                </form >
            </Dialog >
        </div >
    );
}
