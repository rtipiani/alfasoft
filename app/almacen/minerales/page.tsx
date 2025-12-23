"use client";

import { useState, useEffect } from "react";
import {
    CubeIcon,
    PlusIcon,
    ArrowRightIcon,
    MapPinIcon,
    TrashIcon
} from "@heroicons/react/24/outline";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, runTransaction, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Dialog from "@/app/components/Dialog";
import FormField from "@/app/components/FormField";
import Select from "@/app/components/Select";
import Swal from "sweetalert2";
import { registrarMovimiento } from "@/lib/almacen";

export default function MineralesPage() {
    const [minerals, setMinerals] = useState<any[]>([]);
    const [canchas, setCanchas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Dialog States
    const [isEntryOpen, setIsEntryOpen] = useState(false);
    const [isMoveOpen, setIsMoveOpen] = useState(false);

    // Forms
    const [entryForm, setEntryForm] = useState({
        nombre: "",
        ubicacion: "",
        cantidad: "",
        origen: ""
    });

    const [moveForm, setMoveForm] = useState({
        mineralId: "",
        destino: "",
        cantidad: ""
    });

    // Subscribe to Items
    useEffect(() => {
        const q = query(collection(db, "almacen_items"), where("tipo", "==", "MINERAL"));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                stockActual: Number(d.data().stockActual) || 0,
                createdAt: d.data().createdAt?.toDate?.() || new Date()
            }));
            list.sort((a: any, b: any) => b.createdAt - a.createdAt);
            setMinerals(list);
        });
        return () => unsub();
    }, []);

    // Subscribe to Canchas
    useEffect(() => {
        const q = query(collection(db, "canchas"));
        const unsub = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a: any, b: any) => (a.nombre || "").localeCompare(b.nombre || ""));
            setCanchas(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleEntry = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!entryForm.ubicacion) {
            Swal.fire("Error", "Seleccione una ubicación", "error");
            return;
        }
        try {
            const docRef = await addDoc(collection(db, "almacen_items"), {
                nombre: entryForm.nombre,
                tipo: "MINERAL",
                categoria: "MINERAL",
                unidad: "TM",
                stockActual: Number(entryForm.cantidad),
                ubicacion: entryForm.ubicacion,
                origen: entryForm.origen,
                stockMinimo: 0,
                createdAt: serverTimestamp()
            });

            await registrarMovimiento({
                itemId: docRef.id,
                tipo: "ENTRADA",
                subtipo: "PRODUCCION",
                cantidad: Number(entryForm.cantidad),
                area: entryForm.ubicacion,
                observacion: `Ingreso a ${entryForm.ubicacion} - Origen: ${entryForm.origen}`,
                responsable: "Sistema"
            });

            setIsEntryOpen(false);
            setEntryForm({ nombre: "", ubicacion: "", cantidad: "", origen: "" });
            Swal.fire({
                icon: 'success',
                title: 'Ingreso Registrado',
                text: 'El mineral ha sido ingresado correctamente.',
                confirmButtonColor: '#d97706'
            });
        } catch (error: any) {
            Swal.fire("Error", error.message, "error");
        }
    };

    const handleDelete = async (id: string, nombre: string) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: `Se eliminará el lote "${nombre}". Esta acción no se puede deshacer.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "almacen_items", id));
                Swal.fire(
                    'Eliminado',
                    'El lote ha sido eliminado.',
                    'success'
                );
            } catch (error: any) {
                console.error("Error deleting document: ", error);
                Swal.fire("Error", "No se pudo eliminar el item.", "error");
            }
        }
    };

    const handleMove = async (e: React.FormEvent) => {
        e.preventDefault();
        const mineral = minerals.find(m => m.id === moveForm.mineralId);
        if (!mineral) return;

        if (Number(moveForm.cantidad) > (mineral.stockActual || 0)) {
            Swal.fire("Error", "Stock insuficiente", "error");
            return;
        }

        try {
            await runTransaction(db, async (transaction) => {
                // 1. Get fresh data for the source mineral
                const sourceRef = doc(db, "almacen_items", mineral.id);
                const sourceDoc = await transaction.get(sourceRef);

                if (!sourceDoc.exists()) {
                    throw new Error("El mineral de origen no existe.");
                }

                const sourceData = sourceDoc.data();
                const currentStock = sourceData.stockActual || 0;
                const moveQty = Number(moveForm.cantidad);
                const destination = moveForm.destino.trim(); // Normalize

                if (moveQty > currentStock) {
                    throw new Error("Stock insuficiente (cambió durante la operación).");
                }

                const newSourceStock = currentStock - moveQty;

                // 2. Reduce stock from source
                transaction.update(sourceRef, {
                    stockActual: newSourceStock,
                    updatedAt: serverTimestamp()
                });

                // 3. Create new document for destination
                const newDocRef = doc(collection(db, "almacen_items"));

                // Explicitly construct destination object to ensure it appears in queries
                const destinationValues = {
                    nombre: sourceData.nombre || "Mineral Sin Nombre",
                    tipo: "MINERAL", // CRITICAL: Force this for filter query
                    categoria: sourceData.categoria || "MINERAL",
                    unidad: sourceData.unidad || "TM",
                    origen: sourceData.origen || "",
                    stockMinimo: sourceData.stockMinimo || 0,

                    stockActual: moveQty,
                    ubicacion: destination,
                    oldId: mineral.id,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                };

                console.log("Creating Destination Doc:", destinationValues); // Debug

                transaction.set(newDocRef, destinationValues);

                // 4. Create Movement Records
                // Record 1: OUT from Source
                const movOutRef = doc(collection(db, "almacen_movimientos"));
                transaction.set(movOutRef, {
                    itemId: mineral.id,
                    tipo: "SALIDA",
                    subtipo: "TRANSFERENCIA",
                    cantidad: moveQty,
                    saldoAnterior: currentStock,
                    saldoNuevo: newSourceStock,
                    fecha: serverTimestamp(),
                    area: mineral.ubicacion,
                    observacion: `Traslado a ${destination}`,
                    responsable: "Sistema",
                    usuario: "Sistema"
                });

                // Record 2: IN to Destination
                const movInRef = doc(collection(db, "almacen_movimientos"));
                transaction.set(movInRef, {
                    itemId: newDocRef.id,
                    tipo: "ENTRADA",
                    subtipo: "TRANSFERENCIA",
                    cantidad: moveQty,
                    saldoAnterior: 0,
                    saldoNuevo: moveQty,
                    fecha: serverTimestamp(),
                    area: destination,
                    observacion: `Traslado desde ${mineral.ubicacion}`,
                    responsable: "Sistema",
                    usuario: "Sistema"
                });
            });

            setIsMoveOpen(false);
            setMoveForm({ mineralId: "", destino: "", cantidad: "" });
            Swal.fire({
                icon: 'success',
                title: 'Traslado Exitoso',
                text: 'El movimiento entre canchas se realizó correctamente.',
                confirmButtonColor: '#2563eb'
            });
        } catch (error: any) {
            console.error(error);
            Swal.fire("Error", "Error de transacción: " + error.message, "error");
        }
    };

    const getPileColor = (canchaName: string) => {
        const name = (canchaName || "").toLowerCase();
        if (name.includes("1") || name.includes("recep"))
            return "from-orange-500/10 to-amber-500/10 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400";
        if (name.includes("2") || name.includes("blend"))
            return "from-blue-500/10 to-cyan-500/10 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400";
        if (name.includes("3") || name.includes("stock"))
            return "from-emerald-500/10 to-green-500/10 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400";
        if (name.includes("4"))
            return "from-violet-500/10 to-purple-500/10 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400";

        return "from-gray-500/10 to-zinc-500/10 border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-300";
    };

    const getIconColor = (canchaName: string) => {
        const name = (canchaName || "").toLowerCase();
        if (name.includes("1") || name.includes("recep")) return "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30";
        if (name.includes("2") || name.includes("blend")) return "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30";
        if (name.includes("3") || name.includes("stock")) return "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30";
        return "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800";
    };

    // Helper to get selected mineral for filtering
    const selectedMineral = minerals.find(m => m.id === moveForm.mineralId);

    // Filter minerals for table
    const filteredMinerals = minerals.filter(m =>
        (m.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.origen || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.ubicacion || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen space-y-8 pb-10 font-sans">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-gray-200 dark:border-zinc-800">
                <div>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-500 tracking-wider uppercase mb-1 block">Gestión de Inventario</span>
                    <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                        Almacén de Minerales
                    </h1>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setIsMoveOpen(true)}
                        className="px-6 py-2.5 bg-white dark:bg-zinc-900 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-zinc-700 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 hover:border-gray-300 dark:hover:border-zinc-600 transition-all flex items-center gap-2 shadow-sm font-semibold text-sm group"
                    >
                        <ArrowRightIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                        Mover Mineral
                    </button>
                    <button
                        onClick={() => setIsEntryOpen(true)}
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 transition-all flex items-center gap-2 shadow-lg shadow-amber-600/20 font-semibold text-sm transform hover:-translate-y-0.5"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Registrar Ingreso
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-amber-600"></div>
                    <p className="text-gray-500 text-sm font-medium animate-pulse">Cargando inventario...</p>
                </div>
            ) : (
                <>
                    {/* Summary Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {canchas.map(cancha => {
                            const itemsInCancha = minerals.filter(m => m.ubicacion === cancha.nombre);
                            const totalTM = itemsInCancha.reduce((acc, curr) => acc + (curr.stockActual || 0), 0);
                            const bgGradient = getPileColor(cancha.nombre);
                            const iconStyle = getIconColor(cancha.nombre);

                            return (
                                <div key={cancha.id} className={`relative overflow-hidden p-6 rounded-3xl border bg-gradient-to-br ${bgGradient} transition-all hover:shadow-xl hover:scale-[1.02] group`}>
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`p-3 rounded-2xl ${iconStyle} shadow-sm group-hover:scale-110 transition-transform`}>
                                            <MapPinIcon className="w-5 h-5" />
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-1 bg-white/50 dark:bg-black/20 rounded-full backdrop-blur-md border border-white/20 uppercase tracking-widest">
                                            {itemsInCancha.length} Lotes
                                        </span>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1 tracking-wide uppercase">{cancha.nombre}</h3>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                                {totalTM.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400">TM</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Total Summary Card */}
                        <div className="relative overflow-hidden p-6 rounded-3xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm transition-all hover:shadow-xl hover:scale-[1.02] group">
                            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-gray-100 dark:bg-zinc-800 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity"></div>

                            <div className="flex justify-between items-start mb-6 relative">
                                <div className="p-3 rounded-2xl bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white shadow-sm">
                                    <CubeIcon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded-full text-gray-600 dark:text-gray-300 uppercase tracking-widest">
                                    Total Global
                                </span>
                            </div>

                            <div className="relative">
                                <h3 className="text-sm font-bold text-gray-500 mb-1 tracking-wide uppercase">Inventario Total</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                                        {minerals.reduce((acc, curr) => acc + (curr.stockActual || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">TM</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Inventory Table Section */}
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                        {/* Table Header / Toolbar */}
                        <div className="p-5 border-b border-gray-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Detalle de Existencias</h2>
                                <p className="text-xs text-gray-500 mt-1">
                                    Mostrando <span className="font-semibold text-gray-900 dark:text-white">{filteredMinerals.length}</span> registros
                                </p>
                            </div>
                            <div className="relative w-full md:w-64">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar por lote, origen..."
                                    className="pl-9 pr-4 py-2 w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-xs"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Responsive Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                                        <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lote / ID</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Origen</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ubicación</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Stock (TM)</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Estado</th>
                                        <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                    {filteredMinerals.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <CubeIcon className="w-8 h-8 text-gray-300" />
                                                    <p className="text-xs">No se encontraron resultados</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredMinerals.map((item) => (
                                            <tr key={item.id} className="group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center">
                                                        <div>
                                                            <div className="font-bold text-gray-900 dark:text-white text-xs">{item.nombre}</div>
                                                            <div className="text-[10px] text-gray-400 font-mono mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                #{item.id.slice(0, 8)}...
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center text-gray-600 dark:text-gray-300 text-xs font-medium">
                                                        {item.origen || "—"}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border bg-opacity-50 ${getPileColor(item.ubicacion).replace('rounded-3xl', '')}`}>
                                                        <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                                        {item.ubicacion}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <div className="font-bold text-gray-900 dark:text-white tabular-nums text-xs">
                                                        {item.stockActual?.toFixed(2)} <span className="text-gray-400 text-[10px] font-normal">TM</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    {item.stockActual > 0 ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800">
                                                            Disponible
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-600 dark:bg-zinc-800 dark:text-gray-400 border border-gray-100 dark:border-zinc-700">
                                                            Agotado
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-center">
                                                    <button
                                                        onClick={() => handleDelete(item.id, item.nombre)}
                                                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Eliminar registro"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Entry Modal */}
            <Dialog isOpen={isEntryOpen} onClose={() => setIsEntryOpen(false)} title="Ingreso de Mineral" maxWidth="max-w-md">
                <form onSubmit={handleEntry} className="space-y-5">
                    <FormField label="Nombre del Mineral / Lote">
                        <input
                            type="text"
                            required
                            value={entryForm.nombre}
                            onChange={(e) => setEntryForm({ ...entryForm, nombre: e.target.value })}
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none"
                            placeholder="Ej. Mineral Aurífero L-101"
                        />
                    </FormField>
                    <FormField label="Ubicación de Destino">
                        <Select
                            value={entryForm.ubicacion}
                            onChange={(e) => setEntryForm({ ...entryForm, ubicacion: e.target.value })}
                        >
                            <option value="">Seleccione Cancha...</option>
                            {canchas.map(c => (
                                <option key={c.id} value={c.nombre}>{c.nombre}</option>
                            ))}
                        </Select>
                    </FormField>
                    <div className="grid grid-cols-2 gap-5">
                        <FormField label="Cantidad (TM)">
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={entryForm.cantidad}
                                onChange={(e) => setEntryForm({ ...entryForm, cantidad: e.target.value })}
                                className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none"
                            />
                        </FormField>
                    </div>
                    <FormField label="Origen / Proveedor">
                        <input
                            type="text"
                            value={entryForm.origen}
                            onChange={(e) => setEntryForm({ ...entryForm, origen: e.target.value })}
                            className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none"
                            placeholder="Mina La Poderosa, etc."
                        />
                    </FormField>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsEntryOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800 rounded-xl font-medium transition-colors">Cancelar</button>
                        <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl hover:from-amber-700 hover:to-orange-700 font-medium shadow-md transition-all">Registrar Ingreso</button>
                    </div>
                </form>
            </Dialog>

            {/* Move Modal */}
            <Dialog isOpen={isMoveOpen} onClose={() => setIsMoveOpen(false)} title="Traslado entre Canchas" maxWidth="max-w-md">
                <form onSubmit={handleMove} className="space-y-6">
                    <div className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-gray-100 dark:border-zinc-800 space-y-4">
                        <FormField label="1. Seleccione el Mineral">
                            <Select
                                required
                                value={moveForm.mineralId}
                                onChange={(e) => setMoveForm({ ...moveForm, mineralId: e.target.value, destino: "" })}
                            >
                                <option value="">Seleccione mineral...</option>
                                {minerals.filter(m => m.stockActual > 0).map(m => (
                                    <option key={m.id} value={m.id}>
                                        {m.nombre} — {m.stockActual} TM
                                    </option>
                                ))}
                            </Select>
                            {selectedMineral && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <MapPinIcon className="w-4 h-4" />
                                    <span>Ubicación actual: <strong>{selectedMineral.ubicacion}</strong></span>
                                </div>
                            )}
                        </FormField>

                        <FormField label="2. Cancha de Destino">
                            <Select
                                required
                                value={moveForm.destino}
                                onChange={(e) => setMoveForm({ ...moveForm, destino: e.target.value })}
                                disabled={!moveForm.mineralId}
                                className={!moveForm.mineralId ? "opacity-50 cursor-not-allowed" : ""}
                            >
                                <option value="">
                                    {!moveForm.mineralId ? "Primero seleccione un mineral..." : "Seleccione destino..."}
                                </option>
                                {canchas
                                    .filter(c => !selectedMineral || (c.nombre || "").toLowerCase() !== (selectedMineral.ubicacion || "").toLowerCase())
                                    .map(c => (
                                        <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                    ))}
                            </Select>
                            {selectedMineral && (
                                <p className="text-[10px] text-gray-400 mt-1 pl-1">
                                    * La cancha de origen ha sido excluida de esta lista.
                                </p>
                            )}
                        </FormField>

                        <FormField label="3. Cantidad a Mover (TM)">
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    min="0.01"
                                    max={selectedMineral?.stockActual}
                                    value={moveForm.cantidad}
                                    onChange={(e) => setMoveForm({ ...moveForm, cantidad: e.target.value })}
                                    className="w-full pl-4 pr-12 py-3 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-bold text-gray-900 dark:text-white"
                                    placeholder="0.00"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">TM</span>
                            </div>
                        </FormField>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={() => setIsMoveOpen(false)} className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800 rounded-xl font-medium transition-colors">Cancelar</button>
                        <button
                            type="submit"
                            disabled={!moveForm.mineralId || !moveForm.destino || !moveForm.cantidad}
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg transform active:scale-95"
                        >
                            Confirmar Traslado
                        </button>
                    </div>
                </form>
            </Dialog>
        </div>
    );
}
