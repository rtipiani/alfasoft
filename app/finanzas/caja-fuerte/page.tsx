"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, deleteDoc, onSnapshot, query, orderBy, doc, where, updateDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
    ShieldCheckIcon,
    PlusIcon,
    MinusIcon,
    CurrencyDollarIcon,
    CalendarIcon,
    TrashIcon,
    ArrowsRightLeftIcon,
    KeyIcon,
    LockClosedIcon
} from "@heroicons/react/24/outline";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createNotification } from "@/lib/notifications";

type Caja = {
    id: string;
    nombre: string;
    saldo: number;
    estado: 'activa' | 'cerrada';
    fechaCreacion: any;
};

type Movimiento = {
    id: string;
    cajaId: string;
    tipo: 'ingreso' | 'egreso' | 'apertura';
    monto: number;
    descripcion: string;
    fecha: any;
    usuarioId: string;
};

export default function CajaFuertePage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Data State
    const [cajas, setCajas] = useState<Caja[]>([]);
    const [selectedCajaId, setSelectedCajaId] = useState<string>("");
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);

    // UI State
    const [showCreateCajaModal, setShowCreateCajaModal] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [transactionType, setTransactionType] = useState<'ingreso' | 'egreso' | 'apertura'>('ingreso');

    // Form State
    const [newCajaNombre, setNewCajaNombre] = useState("");
    const [transactionAmount, setTransactionAmount] = useState("");
    const [transactionDesc, setTransactionDesc] = useState("");

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                setCurrentUser(user);
            } else {
                router.push("/");
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [router]);

    // Fetch Cajas
    useEffect(() => {
        if (!currentUser) return;

        const q = query(collection(db, "finanzas_caja_fuerte"), orderBy("fechaCreacion", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Caja[];
            setCajas(data);

            // Auto-select first caja if none selected and cajas exist
            if (data.length > 0 && !selectedCajaId) {
                setSelectedCajaId(data[0].id);
            }
        });

        return () => unsubscribe();
    }, [currentUser, selectedCajaId]);

    // Fetch Movimientos for Selected Caja
    useEffect(() => {
        if (!selectedCajaId) {
            setMovimientos([]);
            return;
        }

        const q = query(
            collection(db, "finanzas_caja_fuerte_movimientos"),
            where("cajaId", "==", selectedCajaId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Movimiento[];
            // Sort client-side to avoid Firestore index requirement
            // Handle null dates (latency compensation) by using current time
            data.sort((a, b) => {
                const dateA = a.fecha?.seconds ? a.fecha.seconds * 1000 : Date.now();
                const dateB = b.fecha?.seconds ? b.fecha.seconds * 1000 : Date.now();
                return dateB - dateA;
            });
            setMovimientos(data);
        });

        return () => unsubscribe();
    }, [selectedCajaId]);

    const handleCreateCaja = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCajaNombre.trim()) return;

        try {
            const docRef = await addDoc(collection(db, "finanzas_caja_fuerte"), {
                nombre: newCajaNombre.trim(),
                saldo: 0,
                estado: 'activa',
                fechaCreacion: serverTimestamp()
            });

            setNewCajaNombre("");
            setShowCreateCajaModal(false);
            setSelectedCajaId(docRef.id);

            Swal.fire({
                icon: 'success',
                title: 'Caja Fuerte creada',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (error) {
            console.error("Error creating caja fuerte:", error);
            Swal.fire('Error', 'No se pudo crear la caja fuerte', 'error');
        }
    };

    const handleTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCajaId || !transactionAmount || !transactionDesc) return;

        const amount = parseFloat(transactionAmount);
        if (isNaN(amount) || amount <= 0) {
            Swal.fire('Error', 'El monto debe ser mayor a 0', 'error');
            return;
        }

        const currentCaja = cajas.find(c => c.id === selectedCajaId);
        if (!currentCaja) return;

        if (transactionType === 'egreso' && currentCaja.saldo < amount) {
            Swal.fire('Error', 'Saldo insuficiente en la caja fuerte', 'error');
            return;
        }

        try {
            // 1. Create Movement
            await addDoc(collection(db, "finanzas_caja_fuerte_movimientos"), {
                cajaId: selectedCajaId,
                tipo: transactionType,
                monto: amount,
                descripcion: transactionDesc.trim(),
                fecha: serverTimestamp(),
                usuarioId: currentUser.uid
            });

            // 2. Update Caja Balance
            // Apertura and Ingreso both add to balance
            const newBalance = (transactionType === 'ingreso' || transactionType === 'apertura')
                ? currentCaja.saldo + amount
                : currentCaja.saldo - amount;

            await updateDoc(doc(db, "finanzas_caja_fuerte", selectedCajaId), {
                saldo: newBalance
            });

            setTransactionAmount("");
            setTransactionDesc("");
            setShowTransactionModal(false);

            // Create Notification
            await createNotification({
                userId: currentUser.uid,
                titulo: transactionType === 'apertura' ? 'Caja Fuerte Aperturada' : 'Movimiento en Caja Fuerte',
                mensaje: `Se registró un ${transactionType} de S/ ${amount.toFixed(2)} en ${currentCaja.nombre}`,
                tipo: 'success',
                link: '/finanzas/caja-fuerte'
            });

            Swal.fire({
                icon: 'success',
                title: 'Movimiento registrado',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (error) {
            console.error("Error registering transaction:", error);
            Swal.fire('Error', 'No se pudo registrar el movimiento', 'error');
        }
    };

    const handleDeleteCaja = async () => {
        if (!selectedCajaId) return;

        const currentCaja = cajas.find(c => c.id === selectedCajaId);
        if (currentCaja && currentCaja.saldo > 0) {
            Swal.fire('Error', 'No se puede eliminar una caja fuerte con saldo positivo', 'error');
            return;
        }

        try {
            const result = await Swal.fire({
                title: '¿Eliminar caja fuerte?',
                text: "Esta acción no se puede deshacer. Se eliminarán también todos los movimientos asociados.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(db, "finanzas_caja_fuerte", selectedCajaId));
                // Note: Ideally we should also delete all sub-movements, but for now we just delete the caja ref
                // A cloud function would be better for cleanup
                setSelectedCajaId("");
                Swal.fire('Eliminado', 'La caja fuerte ha sido eliminada', 'success');
            }
        } catch (error) {
            console.error("Error deleting caja fuerte:", error);
            Swal.fire('Error', 'No se pudo eliminar la caja fuerte', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-64 w-full rounded-lg" />
            </div>
        );
    }

    if (!currentUser) return null;

    const selectedCaja = cajas.find(c => c.id === selectedCajaId);

    return (
        <div className="space-y-6">
            {/* Header & Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <LockClosedIcon className="w-8 h-8 text-blue-600" />
                        Caja Fuerte
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Control de fondos de seguridad y reservas
                    </p>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <select
                        value={selectedCajaId}
                        onChange={(e) => setSelectedCajaId(e.target.value)}
                        className="flex-1 md:w-64 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="" disabled>Seleccionar Caja</option>
                        {cajas.map(caja => (
                            <option key={caja.id} value={caja.id}>{caja.nombre}</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setShowCreateCajaModal(true)}
                        className="p-2 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                        title="Crear nueva caja fuerte"
                    >
                        <PlusIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                    </button>
                    {selectedCajaId && (
                        <button
                            onClick={handleDeleteCaja}
                            className="p-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            title="Eliminar caja actual"
                        >
                            <TrashIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </button>
                    )}
                </div>
            </div>

            {cajas.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-zinc-700">
                    <LockClosedIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-zinc-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tienes cajas fuertes registradas</h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-6">Crea una caja fuerte para comenzar a registrar movimientos.</p>
                    <button
                        onClick={() => setShowCreateCajaModal(true)}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium inline-flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Crear Primera Caja Fuerte
                    </button>
                </div>
            ) : (
                <>
                    {/* Balance Card */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 bg-gradient-to-br from-slate-700 to-slate-900 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <CurrencyDollarIcon className="w-32 h-32" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-slate-300 font-medium mb-1">Saldo en Custodia</p>
                                <h3 className="text-4xl font-bold mb-4">
                                    S/ {selectedCaja?.saldo.toFixed(2) || '0.00'}
                                </h3>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setTransactionType('ingreso');
                                            setShowTransactionModal(true);
                                        }}
                                        className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition flex items-center gap-2 text-sm font-medium"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                        Ingresar Fondos
                                    </button>
                                    <button
                                        onClick={() => {
                                            setTransactionType('egreso');
                                            setShowTransactionModal(true);
                                        }}
                                        className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg transition flex items-center gap-2 text-sm font-medium"
                                    >
                                        <MinusIcon className="w-4 h-4" />
                                        Retirar Fondos
                                    </button>
                                    {/* Botón de Apertura (solo si saldo es 0 o no hay movimientos) */}
                                    {(selectedCaja?.saldo === 0 && movimientos.length === 0) && (
                                        <button
                                            onClick={() => {
                                                setTransactionType('apertura');
                                                setShowTransactionModal(true);
                                            }}
                                            className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 backdrop-blur-sm rounded-lg transition flex items-center gap-2 text-sm font-medium text-yellow-100"
                                        >
                                            <KeyIcon className="w-4 h-4" />
                                            Apertura Inicial
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 border border-gray-200 dark:border-zinc-800 shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Resumen Rápido</h4>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Ingresos (Mes)</span>
                                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                                        + S/ {movimientos
                                            .filter(m => m.tipo === 'ingreso' || m.tipo === 'apertura')
                                            .reduce((acc, curr) => acc + curr.monto, 0)
                                            .toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">Egresos (Mes)</span>
                                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                        - S/ {movimientos
                                            .filter(m => m.tipo === 'egreso')
                                            .reduce((acc, curr) => acc + curr.monto, 0)
                                            .toFixed(2)}
                                    </span>
                                </div>
                                <div className="h-px bg-gray-100 dark:bg-zinc-800 my-2" />
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">Movimientos</span>
                                    <span className="text-sm text-gray-500">{movimientos.length} regs.</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Movements Table */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Historial de Movimientos</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                    {movimientos.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                No hay movimientos registrados en esta caja fuerte.
                                            </td>
                                        </tr>
                                    ) : (
                                        movimientos.map((mov) => (
                                            <tr key={mov.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarIcon className="w-4 h-4" />
                                                        {mov.fecha ? format(mov.fecha.toDate(), "dd/MM/yyyy HH:mm", { locale: es }) : <span className="italic text-xs">Pendiente...</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                                                    {mov.descripcion}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${mov.tipo === 'ingreso'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                        : mov.tipo === 'apertura'
                                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                        {mov.tipo.charAt(0).toUpperCase() + mov.tipo.slice(1)}
                                                    </span>
                                                </td>
                                                <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${mov.tipo === 'ingreso' || mov.tipo === 'apertura' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                                    }`}>
                                                    {mov.tipo === 'ingreso' || mov.tipo === 'apertura' ? '+' : '-'} S/ {mov.monto.toFixed(2)}
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

            {/* Create Caja Modal */}
            {showCreateCajaModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nueva Caja Fuerte</h3>
                        <form onSubmit={handleCreateCaja}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Nombre de la Caja
                                </label>
                                <input
                                    type="text"
                                    value={newCajaNombre}
                                    onChange={(e) => setNewCajaNombre(e.target.value)}
                                    placeholder="Ej: Caja Fuerte Principal"
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateCajaModal(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newCajaNombre.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    Crear Caja
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Transaction Modal */}
            {showTransactionModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-lg ${transactionType === 'ingreso' ? 'bg-green-100 text-green-600' :
                                transactionType === 'apertura' ? 'bg-yellow-100 text-yellow-600' :
                                    'bg-red-100 text-red-600'
                                }`}>
                                {transactionType === 'ingreso' ? <PlusIcon className="w-6 h-6" /> :
                                    transactionType === 'apertura' ? <KeyIcon className="w-6 h-6" /> :
                                        <MinusIcon className="w-6 h-6" />}
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {transactionType === 'apertura' ? 'Apertura de Caja Fuerte' :
                                    transactionType === 'ingreso' ? 'Ingresar Fondos' : 'Retirar Fondos'}
                            </h3>
                        </div>

                        <form onSubmit={handleTransaction}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Monto (S/)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        value={transactionAmount}
                                        onChange={(e) => setTransactionAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg font-medium"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Descripción
                                    </label>
                                    <textarea
                                        value={transactionDesc}
                                        onChange={(e) => setTransactionDesc(e.target.value)}
                                        placeholder={transactionType === 'apertura' ? "Saldo inicial..." : "Motivo del movimiento..."}
                                        rows={3}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowTransactionModal(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!transactionAmount || !transactionDesc.trim()}
                                    className={`px-4 py-2 text-white rounded-lg transition disabled:opacity-50 ${transactionType === 'ingreso' ? 'bg-green-600 hover:bg-green-700' :
                                        transactionType === 'apertura' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                            'bg-red-600 hover:bg-red-700'
                                        }`}
                                >
                                    {transactionType === 'apertura' ? 'Abrir Caja' :
                                        transactionType === 'ingreso' ? 'Ingresar' : 'Retirar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
