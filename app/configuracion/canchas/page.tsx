"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp } from "firebase/firestore";
import Swal from "sweetalert2";
import { PlusIcon, PencilIcon, TrashIcon, FunnelIcon, XMarkIcon, BuildingOfficeIcon } from "@heroicons/react/24/outline";
import { createPortal } from "react-dom";
import Select from "@/app/components/Select";

type Almacen = {
    id: string;
    nombre: string;
};

type Cancha = {
    id: string;
    nombre: string;
    stockActual: number;
    mineralId?: string; // Optional: if a cancha is dedicated to a specific mineral
    capacidad?: number;
    estado: "activo" | "inactivo";
    almacenId?: string; // Linked Warehouse
};

export default function CanchasConfigPage() {
    const [canchas, setCanchas] = useState<Cancha[]>([]);
    const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        nombre: "",
        stockActual: 0,
        capacidad: 0,
        estado: "activo",
        almacenId: ""
    });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch Almacenes
    useEffect(() => {
        const q = query(collection(db, "almacenes"), orderBy("nombre"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                nombre: doc.data().nombre
            })) as Almacen[];
            setAlmacenes(data);
        });
        return () => unsubscribe();
    }, []);

    // Fetch Canchas
    useEffect(() => {
        const q = query(collection(db, "canchas"), orderBy("nombre"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Cancha[];
            setCanchas(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                await updateDoc(doc(db, "canchas", editingId), {
                    ...formData,
                    updatedAt: Timestamp.now()
                });
                Swal.fire('Actualizado', 'La cancha ha sido actualizada', 'success');
            } else {
                await addDoc(collection(db, "canchas"), {
                    ...formData,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now()
                });
                Swal.fire('Creado', 'La cancha ha sido creada', 'success');
            }
            setShowModal(false);
            resetForm();
        } catch (error) {
            console.error("Error saving cancha:", error);
            Swal.fire('Error', 'No se pudo guardar', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        const result = await Swal.fire({
            title: '¿Eliminar cancha?',
            text: "Esta acción no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "canchas", id));
                Swal.fire('Eliminado', 'La cancha ha sido eliminada', 'success');
            } catch (error) {
                console.error("Error deleting cancha:", error);
                Swal.fire('Error', 'No se pudo eliminar', 'error');
            }
        }
    };

    const openEdit = (cancha: Cancha) => {
        setFormData({
            nombre: cancha.nombre,
            stockActual: cancha.stockActual,
            capacidad: cancha.capacidad || 0,
            estado: cancha.estado,
            almacenId: cancha.almacenId || ""
        });
        setEditingId(cancha.id);
        setShowModal(true);
    };

    const resetForm = () => {
        setFormData({
            nombre: "",
            stockActual: 0,
            capacidad: 0,
            estado: "activo",
            almacenId: ""
        });
        setEditingId(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Gestión de Canchas</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Administra los stockpiles y canchas de mineral</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowModal(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                >
                    <PlusIcon className="w-5 h-5" />
                    Nueva Cancha
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {canchas.map((cancha) => {
                    const almacenNombre = almacenes.find(a => a.id === cancha.almacenId)?.nombre || 'Sin Asignar';

                    return (
                        <div key={cancha.id} className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 hover:shadow-md transition-shadow relative overflow-hidden">
                            {/* Almacen Badge */}
                            <div className="absolute top-0 right-0 bg-gray-100 dark:bg-zinc-800 rounded-bl-lg px-3 py-1.5 flex items-center gap-1.5 border-b border-l border-gray-200 dark:border-zinc-700">
                                <BuildingOfficeIcon className="w-3.5 h-3.5 text-gray-500" />
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 truncate max-w-[150px]">{almacenNombre}</span>
                            </div>

                            <div className="flex justify-between items-start mb-4 mt-2">
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                                    <FunnelIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEdit(cancha)} className="p-1 text-gray-400 hover:text-blue-600 transition">
                                        <PencilIcon className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => handleDelete(cancha.id)} className="p-1 text-gray-400 hover:text-red-600 transition">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{cancha.nombre}</h3>
                            <div className="space-y-2 mt-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Stock Actual:</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{cancha.stockActual.toFixed(2)} t</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Capacidad:</span>
                                    <span className="font-medium text-gray-900 dark:text-white">{cancha.capacidad ? `${cancha.capacidad} t` : 'Ilimitada'}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Estado:</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cancha.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                        }`}>
                                        {cancha.estado.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Modal */}
            {showModal && mounted && createPortal(
                <div className="fixed inset-0 z-[100] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        {/* Overlay with Blur */}
                        <div
                            className="fixed inset-0 transition-opacity bg-black/40 backdrop-blur-sm"
                            onClick={() => setShowModal(false)}
                        ></div>

                        {/* Modal */}
                        <div className="relative z-10 inline-block w-full max-w-md my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-zinc-900 shadow-2xl rounded-xl border border-gray-200 dark:border-zinc-800">
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-800 bg-gradient-to-r from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-900">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {editingId ? 'Editar Cancha' : 'Nueva Cancha'}
                                    </h3>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sede / Almacén</label>
                                    <Select
                                        required
                                        value={formData.almacenId}
                                        onChange={(e) => setFormData({ ...formData, almacenId: e.target.value })}
                                        className="w-full"
                                    >
                                        <option value="">Seleccionar Sede</option>
                                        {almacenes.map(almacen => (
                                            <option key={almacen.id} value={almacen.id}>{almacen.nombre}</option>
                                        ))}
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de la Cancha</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.nombre}
                                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ej. Cancha Principal"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock Inicial (t)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.stockActual}
                                        onChange={(e) => setFormData({ ...formData, stockActual: parseFloat(e.target.value) || 0 })}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacidad (t)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.capacidad}
                                        onChange={(e) => setFormData({ ...formData, capacidad: parseFloat(e.target.value) || 0 })}
                                        onWheel={(e) => e.currentTarget.blur()}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="0 para ilimitada"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                                    <Select
                                        value={formData.estado}
                                        onChange={(e) => setFormData({ ...formData, estado: e.target.value as "activo" | "inactivo" })}
                                        className="w-full"
                                    >
                                        <option value="activo">Activo</option>
                                        <option value="inactivo">Inactivo</option>
                                    </Select>
                                </div>
                                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                                    >
                                        Guardar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
