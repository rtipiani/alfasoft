"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { PlusIcon, TrashIcon, ListBulletIcon, IdentificationIcon, PencilSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@/app/components/ui/Skeleton";

type Motivo = {
    id: string;
    nombre: string;
    activo: boolean;
};

type Acreditacion = {
    id: string;
    nombre: string;
    descripcion?: string;
    activo: boolean;
};

export default function GaritaConfigPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<unknown>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'motivos' | 'acreditacion'>('motivos');

    // Motivos State
    const [motivos, setMotivos] = useState<Motivo[]>([]);
    const [newMotivo, setNewMotivo] = useState("");
    const [editingMotivoId, setEditingMotivoId] = useState<string | null>(null);

    // Acreditacion State
    const [acreditaciones, setAcreditaciones] = useState<Acreditacion[]>([]);
    const [newAcreditacion, setNewAcreditacion] = useState("");
    const [newDescripcion, setNewDescripcion] = useState("");
    const [editingAcreditacionId, setEditingAcreditacionId] = useState<string | null>(null);

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

    // Fetch Data
    useEffect(() => {
        if (!currentUser) return;

        // Fetch Motivos
        const qMotivos = query(collection(db, "garita_motivos"), orderBy("nombre"));
        const unsubMotivos = onSnapshot(qMotivos, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Motivo[];
            setMotivos(data);
        }, (error) => console.error("Error listening to motivos:", error));

        // Fetch Acreditaciones
        const qAcreditaciones = query(collection(db, "garita_acreditaciones"), orderBy("nombre"));
        const unsubAcreditaciones = onSnapshot(qAcreditaciones, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Acreditacion[];
            setAcreditaciones(data);
        }, (error) => console.error("Error listening to acreditaciones:", error));

        return () => {
            unsubMotivos();
            unsubAcreditaciones();
        };
    }, [currentUser]);

    // Handlers for Motivos
    const handleAddMotivo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMotivo.trim()) return;
        try {
            if (editingMotivoId) {
                await updateDoc(doc(db, "garita_motivos", editingMotivoId), {
                    nombre: newMotivo.trim()
                });
                setEditingMotivoId(null);
                Swal.fire({
                    icon: 'success',
                    title: 'Motivo actualizado',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                await addDoc(collection(db, "garita_motivos"), {
                    nombre: newMotivo.trim(),
                    activo: true
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Motivo agregado',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setNewMotivo("");
        } catch (error) {
            console.error("Error saving motivo:", error);
            Swal.fire('Error', 'No se pudo guardar el motivo.', 'error');
        }
    };

    const handleEditMotivo = (motivo: Motivo) => {
        setNewMotivo(motivo.nombre);
        setEditingMotivoId(motivo.id);
    };

    const handleCancelMotivo = () => {
        setNewMotivo("");
        setEditingMotivoId(null);
    };

    const handleDeleteMotivo = async (id: string) => {
        try {
            const result = await Swal.fire({
                title: '¿Eliminar motivo?',
                text: "Esta acción no se puede deshacer",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(db, "garita_motivos", id));
                if (editingMotivoId === id) {
                    handleCancelMotivo();
                }
                Swal.fire('Eliminado', 'El motivo ha sido eliminado.', 'success');
            }
        } catch (error) {
            console.error("Error deleting motivo:", error);
            Swal.fire('Error', 'No se pudo eliminar el motivo', 'error');
        }
    };

    // Handlers for Acreditaciones
    const handleAddAcreditacion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAcreditacion.trim()) return;
        try {
            const dataToSave = {
                nombre: newAcreditacion.trim(),
                descripcion: newDescripcion.trim(),
                activo: true
            };

            if (editingAcreditacionId) {
                await updateDoc(doc(db, "garita_acreditaciones", editingAcreditacionId), {
                    nombre: newAcreditacion.trim(),
                    descripcion: newDescripcion.trim()
                });
                setEditingAcreditacionId(null);
                Swal.fire({
                    icon: 'success',
                    title: 'Acreditación actualizada',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                await addDoc(collection(db, "garita_acreditaciones"), dataToSave);
                Swal.fire({
                    icon: 'success',
                    title: 'Acreditación agregada',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setNewAcreditacion("");
            setNewDescripcion("");
        } catch (error) {
            console.error("Error saving acreditacion:", error);
            Swal.fire('Error', 'No se pudo guardar la acreditación.', 'error');
        }
    };

    const handleEditAcreditacion = (acreditacion: Acreditacion) => {
        setNewAcreditacion(acreditacion.nombre);
        setNewDescripcion(acreditacion.descripcion || "");
        setEditingAcreditacionId(acreditacion.id);
    };

    const handleCancelAcreditacion = () => {
        setNewAcreditacion("");
        setNewDescripcion("");
        setEditingAcreditacionId(null);
    };

    const handleDeleteAcreditacion = async (id: string) => {
        try {
            const result = await Swal.fire({
                title: '¿Eliminar acreditación?',
                text: "Esta acción no se puede deshacer",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(db, "garita_acreditaciones", id));
                if (editingAcreditacionId === id) {
                    handleCancelAcreditacion();
                }
                Swal.fire('Eliminado', 'La acreditación ha sido eliminada.', 'success');
            }
        } catch (error) {
            console.error("Error deleting acreditacion:", error);
            Swal.fire('Error', 'No se pudo eliminar la acreditación', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-8 w-48 mb-4" />
                <Skeleton className="h-4 w-96 mb-6" />
                <Skeleton className="h-12 w-full mb-8 rounded-lg" />
                <Skeleton className="h-64 w-full rounded-lg" />
            </div>
        );
    }

    if (!currentUser) return null;

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Configuración de Garita</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Gestiona los catálogos y opciones disponibles para el módulo de Garita.
                </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-zinc-800">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('motivos')}
                        className={`${activeTab === 'motivos'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <ListBulletIcon className="w-5 h-5" />
                        Motivos
                    </button>
                    <button
                        onClick={() => setActiveTab('acreditacion')}
                        className={`${activeTab === 'acreditacion'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <IdentificationIcon className="w-5 h-5" />
                        Acreditación
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className="mt-6">
                {/* MOTIVOS TAB */}
                {activeTab === 'motivos' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/20">
                            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Gestión de Motivos</h3>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                Estos motivos aparecerán en el selector al registrar una entrada o salida.
                            </p>
                        </div>

                        <form onSubmit={handleAddMotivo} className="flex gap-4 items-end bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg">
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {editingMotivoId ? 'Editar Motivo' : 'Nuevo Motivo'}
                                </label>
                                <input
                                    type="text"
                                    value={newMotivo}
                                    onChange={(e) => setNewMotivo(e.target.value)}
                                    placeholder="Ej: Entrega de mercadería"
                                    className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                                />
                            </div>
                            {editingMotivoId && (
                                <button
                                    type="button"
                                    onClick={handleCancelMotivo}
                                    className="px-4 py-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-medium flex items-center gap-2"
                                >
                                    <XMarkIcon className="w-5 h-5" />
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={!newMotivo.trim()}
                                className={`px-6 py-2.5 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg ${editingMotivoId
                                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                                    }`}
                            >
                                {editingMotivoId ? (
                                    <>
                                        <PencilSquareIcon className="w-5 h-5" />
                                        Actualizar
                                    </>
                                ) : (
                                    <>
                                        <PlusIcon className="w-5 h-5" />
                                        Agregar
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                    {motivos.length === 0 ? (
                                        <tr>
                                            <td colSpan={2} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                                No hay motivos registrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        motivos.map((motivo) => (
                                            <tr key={motivo.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                                                    {motivo.nombre}
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditMotivo(motivo)}
                                                        className="text-gray-400 hover:text-amber-600 dark:text-gray-500 dark:hover:text-amber-400 transition-colors p-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                                    >
                                                        <PencilSquareIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteMotivo(motivo.id)}
                                                        className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ACREDITACION TAB */}
                {activeTab === 'acreditacion' && (
                    <div className="space-y-6">
                        <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-100 dark:border-purple-900/20">
                            <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-1">Gestión de Acreditaciones</h3>
                            <p className="text-xs text-purple-600 dark:text-purple-400">
                                Define los tipos de documentos o pases requeridos para el ingreso (ej: DNI, Pase Laboral, SCTR).
                            </p>
                        </div>

                        <form onSubmit={handleAddAcreditacion} className="flex gap-4 items-end bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg">
                            <div className="flex-1 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        {editingAcreditacionId ? 'Editar Acreditación' : 'Nuevo Tipo de Acreditación'}
                                    </label>
                                    <input
                                        type="text"
                                        value={newAcreditacion}
                                        onChange={(e) => setNewAcreditacion(e.target.value)}
                                        placeholder="Ej: Pase de Inducción"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Descripción
                                    </label>
                                    <input
                                        type="text"
                                        value={newDescripcion}
                                        onChange={(e) => setNewDescripcion(e.target.value)}
                                        placeholder="Ej: Documento necesario para ingreso a planta"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mb-1">
                                {editingAcreditacionId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelAcreditacion}
                                        className="px-4 py-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition font-medium flex items-center gap-2 h-[46px]"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={!newAcreditacion.trim()}
                                    className={`px-6 py-2.5 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg h-[46px] ${editingAcreditacionId
                                            ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                                            : 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                                        }`}
                                >
                                    {editingAcreditacionId ? (
                                        <>
                                            <PencilSquareIcon className="w-5 h-5" />
                                            Actualizar
                                        </>
                                    ) : (
                                        <>
                                            <PlusIcon className="w-5 h-5" />
                                            Agregar
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-1/3">Nombre</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                    {acreditaciones.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                                No hay tipos de acreditación registrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        acreditaciones.map((item) => (
                                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium align-top">
                                                    {item.nombre}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 align-top">
                                                    {item.descripcion || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2 align-top">
                                                    <button
                                                        onClick={() => handleEditAcreditacion(item)}
                                                        className="text-gray-400 hover:text-amber-600 dark:text-gray-500 dark:hover:text-amber-400 transition-colors p-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                                    >
                                                        <PencilSquareIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAcreditacion(item.id)}
                                                        className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
