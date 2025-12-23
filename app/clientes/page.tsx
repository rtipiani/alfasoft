"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc } from "firebase/firestore";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import { MagnifyingGlassIcon, UserIcon, BuildingOfficeIcon, PencilIcon, XMarkIcon, CheckCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import Swal from "sweetalert2";
import { Skeleton } from "@/app/components/ui/Skeleton";

type Client = {
    id: string;
    tipoDocumento: string;
    numeroDocumento: string;
    nombre: string;
    razonSocial?: string;
    direccion: string;
    departamento: string;
    provincia: string;
    distrito: string;
    estado: string;
    condicion: string;
    reinfo?: boolean;
    capacidadCarga?: number;
    updatedAt?: any;
};

export default function ClientesPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [activeTab, setActiveTab] = useState<"empresas" | "personas">("empresas");
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        const q = query(collection(db, "clientes"), orderBy("updatedAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs: Client[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Client));
            setClients(docs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, activeTab]);

    const filteredClients = clients.filter(client => {
        const matchesSearch = client.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            client.numeroDocumento?.includes(searchTerm);

        const matchesTab = activeTab === "empresas"
            ? client.tipoDocumento === "RUC"
            : client.tipoDocumento === "DNI";

        return matchesSearch && matchesTab;
    });

    const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
    const paginatedClients = filteredClients.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleEdit = (client: Client) => {
        setEditingClient({ ...client });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!editingClient) return;

        try {
            await setDoc(doc(db, "clientes", editingClient.id), {
                direccion: editingClient.direccion,
                reinfo: editingClient.reinfo || false,
                updatedAt: new Date()
            }, { merge: true });

            setIsModalOpen(false);
            setEditingClient(null);
            Swal.fire({
                icon: 'success',
                title: 'Cliente actualizado',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } catch (error) {
            console.error("Error updating client:", error);
            Swal.fire('Error', 'No se pudo actualizar el cliente', 'error');
        }
    };

    const handleDelete = async (client: Client) => {
        const result = await Swal.fire({
            title: '¿Eliminar cliente?',
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
                await deleteDoc(doc(db, "clientes", client.id));
                Swal.fire(
                    'Eliminado',
                    'El cliente ha sido eliminado correctamente.',
                    'success'
                );
            } catch (error) {
                console.error("Error deleting client:", error);
                Swal.fire(
                    'Error',
                    'No se pudo eliminar el cliente.',
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
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Gestión de Clientes</h1>
                            <p className="text-gray-600 dark:text-gray-400">Base de datos de clientes y empresas</p>
                        </div>

                        <div className="flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg mr-4">
                            <button
                                onClick={() => setActiveTab("empresas")}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "empresas"
                                    ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                    }`}
                            >
                                Empresas (RUC)
                            </button>
                            <button
                                onClick={() => setActiveTab("personas")}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === "personas"
                                    ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                    }`}
                            >
                                Personas (DNI)
                            </button>
                        </div>

                        <div className="relative">
                            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o documento..."
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
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Documento</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre / Razón Social</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ubicación</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">REINFO</th>
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
                                                        <div className="space-y-2">
                                                            <Skeleton className="h-4 w-32" />
                                                            <Skeleton className="h-3 w-48" />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Skeleton className="h-4 w-24" />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <Skeleton className="h-5 w-16 rounded-full" />
                                                        <Skeleton className="h-5 w-16 rounded-full" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Skeleton className="h-5 w-16 rounded-full" />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <Skeleton className="h-8 w-8 rounded-full ml-auto" />
                                                </td>
                                            </tr>
                                        ))
                                    ) : filteredClients.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                No se encontraron clientes
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedClients.map((client) => (
                                            <tr key={client.id} className="group hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-all duration-200 border-b border-gray-50 dark:border-zinc-800/50 last:border-0 text-sm">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${client.tipoDocumento === "DNI"
                                                            ? "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-500/30"
                                                            : "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-500/30"
                                                            }`}>
                                                            {client.tipoDocumento}
                                                        </span>
                                                        <span className="font-mono text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                                            {client.numeroDocumento}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${client.tipoDocumento === "DNI"
                                                            ? "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400"
                                                            : "bg-orange-100 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400"
                                                            }`}>
                                                            {client.tipoDocumento === "DNI" ? (
                                                                <UserIcon className="w-5 h-5" />
                                                            ) : (
                                                                <BuildingOfficeIcon className="w-5 h-5" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-gray-900 dark:text-white">
                                                                {client.nombre || client.razonSocial}
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{client.direccion}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                                    {client.departamento && (
                                                        <div className="flex flex-col">
                                                            <span className="text-gray-900 dark:text-white font-medium">{client.departamento}</span>
                                                            <span className="text-xs">{client.provincia}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex flex-col gap-2">
                                                        {client.estado && (
                                                            <span className={`inline-flex w-fit items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${client.estado === "ACTIVO"
                                                                ? "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-500/30"
                                                                : "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-500/30"
                                                                }`}>
                                                                {client.estado}
                                                            </span>
                                                        )}
                                                        {client.condicion && (
                                                            <span className={`inline-flex w-fit items-center px-2 py-1 rounded-md text-xs font-medium ring-1 ring-inset ${client.condicion === "HABIDO"
                                                                ? "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-500/30"
                                                                : "bg-yellow-50 text-yellow-700 ring-yellow-600/10 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-500/30"
                                                                }`}>
                                                                {client.condicion}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {client.reinfo ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-900/20 dark:text-teal-400 dark:ring-teal-500/30">
                                                            <CheckCircleIcon className="w-3.5 h-3.5" />
                                                            REINFO
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300 dark:text-zinc-600 text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => handleEdit(client)}
                                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
                                                        title="Editar"
                                                    >
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(client)}
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

                            {filteredClients.length > 0 && (
                                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredClients.length)} de {filteredClients.length} resultados
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
                {isModalOpen && editingClient && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all scale-100">
                            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                        Editar Cliente
                                    </h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        Actualizar información del cliente
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
                                            Nombre / Razón Social
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <UserIcon className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={editingClient.nombre || editingClient.razonSocial}
                                                disabled
                                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-500 dark:text-gray-400 cursor-not-allowed font-medium"
                                            />
                                        </div>
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Dirección
                                        </label>
                                        <textarea
                                            value={editingClient.direccion}
                                            onChange={(e) => setEditingClient({ ...editingClient, direccion: e.target.value })}
                                            rows={3}
                                            className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none placeholder-gray-400"
                                            placeholder="Ingrese la dirección completa"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <div
                                            onClick={() => setEditingClient({ ...editingClient, reinfo: !editingClient.reinfo })}
                                            className={`cursor-pointer flex items-center justify-between p-4 rounded-xl border transition-all ${editingClient.reinfo
                                                ? "bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800"
                                                : "bg-gray-50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${editingClient.reinfo
                                                    ? "bg-teal-100 text-teal-600 dark:bg-teal-900/40 dark:text-teal-400"
                                                    : "bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-gray-400"
                                                    }`}>
                                                    <CheckCircleIcon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <p className={`font-semibold ${editingClient.reinfo ? "text-teal-900 dark:text-teal-300" : "text-gray-900 dark:text-white"
                                                        }`}>
                                                        REINFO Activo
                                                    </p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Marque esta opción si el cliente cuenta con REINFO vigente
                                                    </p>
                                                </div>
                                            </div>
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${editingClient.reinfo
                                                ? "bg-teal-500 border-teal-500"
                                                : "border-gray-300 dark:border-zinc-600"
                                                }`}>
                                                {editingClient.reinfo && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                            </div>
                                        </div>
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
