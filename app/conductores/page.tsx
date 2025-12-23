"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, doc, setDoc, deleteDoc } from "firebase/firestore";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import { MagnifyingGlassIcon, UserIcon, IdentificationIcon, PencilIcon, XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";
import Swal from "sweetalert2";
import { Skeleton } from "@/app/components/ui/Skeleton";

type Conductor = {
    id: string;
    tipoDocumento: string;
    numeroDocumento: string;
    nombre: string;
    direccion: string;
    licencia?: string;
    updatedAt?: any;
};

export default function ConductoresPage() {
    const [conductores, setConductores] = useState<Conductor[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [editingConductor, setEditingConductor] = useState<Conductor | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [activeTab] = useState("conductores"); // Keep consistent structure
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        // Fetching only DNI documents as they are potential conductors
        const q = query(
            collection(db, "clientes"),
            where("tipoDocumento", "==", "DNI")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: Conductor[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Conductor));

            // Sort by updatedAt desc in memory
            docs.sort((a, b) => {
                const dateA = a.updatedAt?.toDate ? a.updatedAt.toDate() : new Date(0);
                const dateB = b.updatedAt?.toDate ? b.updatedAt.toDate() : new Date(0);
                return dateB.getTime() - dateA.getTime();
            });

            setConductores(docs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const filteredConductores = conductores.filter(conductor =>
        conductor.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conductor.numeroDocumento?.includes(searchTerm)
    );

    const totalPages = Math.ceil(filteredConductores.length / ITEMS_PER_PAGE);
    const paginatedConductores = filteredConductores.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleEdit = (conductor: Conductor) => {
        setEditingConductor({ ...conductor });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingConductor) return;

        try {
            await setDoc(doc(db, "clientes", editingConductor.id), {
                direccion: editingConductor.direccion,
                licencia: editingConductor.licencia || "",
                updatedAt: new Date()
            }, { merge: true });

            setIsModalOpen(false);
            setEditingConductor(null);
            Swal.fire({
                icon: 'success',
                title: 'Conductor actualizado',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (error) {
            console.error("Error updating conductor:", error);
            Swal.fire('Error', 'No se pudo actualizar el conductor', 'error');
        }
    };

    const handleDelete = async (conductor: Conductor) => {
        const result = await Swal.fire({
            title: '¿Eliminar conductor?',
            text: "Esta acción no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "clientes", conductor.id));
                Swal.fire(
                    'Eliminado',
                    'El conductor ha sido eliminado correctamente.',
                    'success'
                );
            } catch (error) {
                console.error("Error deleting conductor:", error);
                Swal.fire(
                    'Error',
                    'No se pudo eliminar el conductor.',
                    'error'
                );
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <Navbar />
            <Sidebar />

            <main className="ml-64 mt-16 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-8 flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Gestión de Conductores</h1>
                            <p className="text-gray-600 dark:text-gray-400">Base de datos de conductores (Personas Naturales)</p>
                        </div>
                        <div className="relative">
                            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o DNI..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-80"
                            />
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">DNI</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre Completo</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Licencia</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dirección</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                    {loading ? (
                                        [...Array(5)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Skeleton className="h-6 w-12" />
                                                        <Skeleton className="h-4 w-24" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <Skeleton className="h-8 w-8 rounded-full" />
                                                        <Skeleton className="h-4 w-32" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Skeleton className="h-4 w-4" />
                                                        <Skeleton className="h-4 w-24" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Skeleton className="h-4 w-48" />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Skeleton className="h-8 w-8 rounded-full ml-auto" />
                                                </td>
                                            </tr>
                                        ))
                                    ) : filteredConductores.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                No se encontraron conductores
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedConductores.map((conductor) => (
                                            <tr key={conductor.id} className="group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-all duration-200 border-b border-gray-50 dark:border-zinc-800/50 last:border-0 text-sm">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-500/30">
                                                            DNI
                                                        </span>
                                                        <span className="font-mono text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                                            {conductor.numeroDocumento}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
                                                            <UserIcon className="w-5 h-5" />
                                                        </div>
                                                        <div className="font-semibold text-gray-900 dark:text-white">
                                                            {conductor.nombre}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {conductor.licencia ? (
                                                        <div className="flex items-center gap-2">
                                                            <IdentificationIcon className="w-4 h-4 text-gray-400" />
                                                            <span className="font-mono text-gray-900 dark:text-white">{conductor.licencia}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">No registrada</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                                    {conductor.direccion || "-"}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => handleEdit(conductor)}
                                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                                        title="Editar"
                                                    >
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(conductor)}
                                                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {filteredConductores.length > 0 && (
                                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredConductores.length)} de {filteredConductores.length} resultados
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1 text-sm font-medium rounded-md border border-gray-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Anterior
                                        </button>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Página {currentPage} de {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-1 text-sm font-medium rounded-md border border-gray-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Edit Modal */}
                {isModalOpen && editingConductor && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all scale-100">
                            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                        Editar Conductor
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Actualizar información del conductor
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                                >
                                    <XMarkIcon className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Nombre Completo
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <UserIcon className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={editingConductor.nombre}
                                                disabled
                                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Licencia de Conducir
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <IdentificationIcon className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={editingConductor.licencia || ""}
                                                onChange={(e) => setEditingConductor({ ...editingConductor, licencia: e.target.value })}
                                                placeholder="Ej: Q12345678"
                                                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Dirección
                                        </label>
                                        <textarea
                                            value={editingConductor.direccion}
                                            onChange={(e) => setEditingConductor({ ...editingConductor, direccion: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none placeholder-gray-400"
                                            placeholder="Ingrese la dirección completa"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-zinc-800 border border-transparent hover:border-gray-200 dark:hover:border-zinc-700 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-95"
                                >
                                    Guardar Cambios
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
