"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { PlusIcon, TrashIcon, BuildingLibraryIcon, BookOpenIcon, BuildingOfficeIcon, TagIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@/app/components/ui/Skeleton";
import Select from "@/app/components/Select";

type Banco = {
    id: string;
    nombre: string;
    numeroCuenta: string;
    codigo: string;
    cuentaContableId?: string;
    activo: boolean;
};

type CuentaContable = {
    id: string;
    codigo: string;
    nombre: string;
    tipo: "activo" | "pasivo" | "patrimonio" | "ingreso" | "gasto";
};

type Area = {
    id: string;
    nombre: string;
    numero?: number;
};

type Categoria = {
    id: string;
    nombre: string;
};

export default function FinanzasConfigPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<unknown>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'bancos' | 'cuentas' | 'areas' | 'categorias'>('bancos');

    // Bancos State
    const [bancos, setBancos] = useState<Banco[]>([]);
    const [newBanco, setNewBanco] = useState("");
    const [newNumeroCuenta, setNewNumeroCuenta] = useState("");
    const [selectedCuentaContable, setSelectedCuentaContable] = useState("");
    const [editingBancoId, setEditingBancoId] = useState<string | null>(null);

    // Cuentas Contables State
    const [cuentas, setCuentas] = useState<CuentaContable[]>([]);
    const [newCuentaCodigo, setNewCuentaCodigo] = useState("");
    const [newCuentaNombre, setNewCuentaNombre] = useState("");
    const [newCuentaTipo, setNewCuentaTipo] = useState<CuentaContable['tipo']>("activo");
    const [editingCuentaId, setEditingCuentaId] = useState<string | null>(null);

    // Areas State
    const [areas, setAreas] = useState<Area[]>([]);
    const [newAreaNombre, setNewAreaNombre] = useState("");
    const [editingAreaId, setEditingAreaId] = useState<string | null>(null);

    // Categorias State
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [newCategoriaNombre, setNewCategoriaNombre] = useState("");
    const [editingCategoriaId, setEditingCategoriaId] = useState<string | null>(null);

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

        // Fetch Bancos
        const qBancos = query(collection(db, "finanzas_bancos"), orderBy("nombre"));
        const unsubBancos = onSnapshot(qBancos, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Banco[];
            setBancos(data);
        }, (error) => console.error("Error listening to bancos:", error));

        // Fetch Cuentas Contables
        const qCuentas = query(collection(db, "finanzas_cuentas"), orderBy("codigo"));
        const unsubCuentas = onSnapshot(qCuentas, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CuentaContable[];
            setCuentas(data);
        }, (error) => console.error("Error listening to cuentas:", error));

        // Fetch Areas
        const qAreas = query(collection(db, "finanzas_areas"), orderBy("nombre"));
        const unsubAreas = onSnapshot(qAreas, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Area[];
            setAreas(data);
        }, (error) => console.error("Error listening to areas:", error));

        // Fetch Categorias
        const qCategorias = query(collection(db, "finanzas_categorias"), orderBy("nombre"));
        const unsubCategorias = onSnapshot(qCategorias, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Categoria[];
            setCategorias(data);
        }, (error) => console.error("Error listening to categorias:", error));

        return () => {
            unsubBancos();
            unsubCuentas();
            unsubAreas();
            unsubCategorias();
        };
    }, [currentUser]);

    // Handlers for Bancos
    const handleAddBanco = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBanco.trim()) return;

        try {
            if (editingBancoId) {
                await updateDoc(doc(db, "finanzas_bancos", editingBancoId), {
                    nombre: newBanco.trim(),
                    numeroCuenta: newNumeroCuenta.trim(),
                    cuentaContableId: selectedCuentaContable || null
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Actualizado',
                    text: 'El banco ha sido actualizado correctamente',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                const prefix = newBanco.substring(0, 3).toUpperCase();
                const randomNum = Math.floor(1000 + Math.random() * 9000);
                const generatedCode = `${prefix}-${randomNum}`;

                await addDoc(collection(db, "finanzas_bancos"), {
                    nombre: newBanco.trim(),
                    numeroCuenta: newNumeroCuenta.trim(),
                    codigo: generatedCode,
                    cuentaContableId: selectedCuentaContable || null,
                    activo: true
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Banco agregado',
                    text: `Código generado: ${generatedCode}`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setNewBanco("");
            setNewNumeroCuenta("");
            setSelectedCuentaContable("");
            setEditingBancoId(null);
        } catch (error) {
            console.error("Error saving banco:", error);
            Swal.fire('Error', 'No se pudo guardar el banco.', 'error');
        }
    };

    const handleEditBanco = (banco: Banco) => {
        setNewBanco(banco.nombre);
        setNewNumeroCuenta(banco.numeroCuenta);
        setSelectedCuentaContable(banco.cuentaContableId || "");
        setEditingBancoId(banco.id);
    };

    const handleCancelEditBanco = () => {
        setNewBanco("");
        setNewNumeroCuenta("");
        setSelectedCuentaContable("");
        setEditingBancoId(null);
    };

    const handleDeleteBanco = async (id: string) => {
        try {
            const result = await Swal.fire({
                title: '¿Eliminar banco?',
                text: "Esta acción no se puede deshacer",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(db, "finanzas_bancos", id));
                Swal.fire('Eliminado', 'El banco ha sido eliminado.', 'success');
            }
        } catch (error) {
            console.error("Error deleting banco:", error);
            Swal.fire('Error', 'No se pudo eliminar el banco', 'error');
        }
    };

    // Handlers for Cuentas Contables
    const handleAddCuenta = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCuentaCodigo.trim() || !newCuentaNombre.trim()) return;

        try {
            if (editingCuentaId) {
                await updateDoc(doc(db, "finanzas_cuentas", editingCuentaId), {
                    codigo: newCuentaCodigo.trim(),
                    nombre: newCuentaNombre.trim(),
                    tipo: newCuentaTipo
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Actualizado',
                    text: 'La cuenta ha sido actualizada correctamente',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                await addDoc(collection(db, "finanzas_cuentas"), {
                    codigo: newCuentaCodigo.trim(),
                    nombre: newCuentaNombre.trim(),
                    tipo: newCuentaTipo
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Cuenta agregada',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setNewCuentaCodigo("");
            setNewCuentaNombre("");
            setNewCuentaTipo("activo");
            setEditingCuentaId(null);
        } catch (error) {
            console.error("Error saving cuenta:", error);
            Swal.fire('Error', 'No se pudo guardar la cuenta.', 'error');
        }
    };

    const handleEditCuenta = (cuenta: CuentaContable) => {
        setNewCuentaCodigo(cuenta.codigo);
        setNewCuentaNombre(cuenta.nombre);
        setNewCuentaTipo(cuenta.tipo);
        setEditingCuentaId(cuenta.id);
    };

    const handleCancelEditCuenta = () => {
        setNewCuentaCodigo("");
        setNewCuentaNombre("");
        setNewCuentaTipo("activo");
        setEditingCuentaId(null);
    };

    const handleDeleteCuenta = async (id: string) => {
        try {
            const result = await Swal.fire({
                title: '¿Eliminar cuenta?',
                text: "Esta acción no se puede deshacer",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(db, "finanzas_cuentas", id));
                Swal.fire('Eliminado', 'La cuenta ha sido eliminada.', 'success');
            }
        } catch (error) {
            console.error("Error deleting cuenta:", error);
            Swal.fire('Error', 'No se pudo eliminar la cuenta', 'error');
        }
    };

    // Handlers for Areas
    const handleAddArea = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAreaNombre.trim()) return;

        try {
            if (editingAreaId) {
                await updateDoc(doc(db, "finanzas_areas", editingAreaId), {
                    nombre: newAreaNombre.trim()
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Actualizado',
                    text: 'El área ha sido actualizada correctamente',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                await addDoc(collection(db, "finanzas_areas"), {
                    nombre: newAreaNombre.trim()
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Área agregada',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setNewAreaNombre("");
            setEditingAreaId(null);
        } catch (error) {
            console.error("Error saving area:", error);
            Swal.fire('Error', 'No se pudo guardar el área.', 'error');
        }
    };

    const handleEditArea = (area: Area) => {
        setNewAreaNombre(area.nombre);
        setEditingAreaId(area.id);
    };

    const handleCancelEditArea = () => {
        setNewAreaNombre("");
        setEditingAreaId(null);
    };

    const handleDeleteArea = async (id: string) => {
        try {
            const result = await Swal.fire({
                title: '¿Eliminar área?',
                text: "Esta acción no se puede deshacer",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(db, "finanzas_areas", id));
                Swal.fire('Eliminado', 'El área ha sido eliminada.', 'success');
            }
        } catch (error) {
            console.error("Error deleting area:", error);
            Swal.fire('Error', 'No se pudo eliminar el área', 'error');
        }
    };

    // Handlers for Categorias
    const handleAddCategoria = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoriaNombre.trim()) return;

        try {
            if (editingCategoriaId) {
                await updateDoc(doc(db, "finanzas_categorias", editingCategoriaId), {
                    nombre: newCategoriaNombre.trim()
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Actualizado',
                    text: 'La categoría ha sido actualizada correctamente',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                await addDoc(collection(db, "finanzas_categorias"), {
                    nombre: newCategoriaNombre.trim()
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Categoría agregada',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setNewCategoriaNombre("");
            setEditingCategoriaId(null);
        } catch (error) {
            console.error("Error saving categoria:", error);
            Swal.fire('Error', 'No se pudo guardar la categoría.', 'error');
        }
    };

    const handleEditCategoria = (categoria: Categoria) => {
        setNewCategoriaNombre(categoria.nombre);
        setEditingCategoriaId(categoria.id);
    };

    const handleCancelEditCategoria = () => {
        setNewCategoriaNombre("");
        setEditingCategoriaId(null);
    };

    const handleDeleteCategoria = async (id: string) => {
        try {
            const result = await Swal.fire({
                title: '¿Eliminar categoría?',
                text: "Esta acción no se puede deshacer",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(db, "finanzas_categorias", id));
                Swal.fire('Eliminado', 'La categoría ha sido eliminada.', 'success');
            }
        } catch (error) {
            console.error("Error deleting categoria:", error);
            Swal.fire('Error', 'No se pudo eliminar la categoría', 'error');
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
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Configuración de Finanzas</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Gestiona los catálogos y opciones disponibles para el módulo de Finanzas.
                </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-zinc-800">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('bancos')}
                        className={`${activeTab === 'bancos'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <BuildingLibraryIcon className="w-5 h-5" />
                        Bancos
                    </button>
                    <button
                        onClick={() => setActiveTab('cuentas')}
                        className={`${activeTab === 'cuentas'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <BookOpenIcon className="w-5 h-5" />
                        Cuentas Contables
                    </button>
                    <button
                        onClick={() => setActiveTab('areas')}
                        className={`${activeTab === 'areas'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <BuildingOfficeIcon className="w-5 h-5" />
                        Áreas
                    </button>
                    <button
                        onClick={() => setActiveTab('categorias')}
                        className={`${activeTab === 'categorias'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <TagIcon className="w-5 h-5" />
                        Categorías
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className="mt-6">
                {/* BANCOS TAB */}
                {activeTab === 'bancos' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/20">
                            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Gestión de Bancos</h3>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                Registra los bancos de origen disponibles para los adelantos. El código de trazabilidad se genera automáticamente.
                            </p>
                        </div>

                        <form onSubmit={handleAddBanco} className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Nombre del Banco
                                    </label>
                                    <input
                                        type="text"
                                        value={newBanco}
                                        onChange={(e) => setNewBanco(e.target.value)}
                                        placeholder="Ej: BCP"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Número de Cuenta
                                    </label>
                                    <input
                                        type="text"
                                        value={newNumeroCuenta}
                                        onChange={(e) => setNewNumeroCuenta(e.target.value)}
                                        placeholder="Ej: 191-12345678-0-01"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Cuenta Contable
                                    </label>
                                    <Select
                                        value={selectedCuentaContable}
                                        onChange={(e) => setSelectedCuentaContable(e.target.value)}
                                        className="w-full"
                                    >
                                        <option value="">Seleccionar cuenta...</option>
                                        {cuentas
                                            .filter(c => c.tipo === 'activo')
                                            .map(cuenta => (
                                                <option key={cuenta.id} value={cuenta.id}>
                                                    {cuenta.codigo} - {cuenta.nombre}
                                                </option>
                                            ))
                                        }
                                    </Select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                {editingBancoId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEditBanco}
                                        className="px-6 py-2.5 bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 transition font-medium flex items-center gap-2"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={!newBanco.trim()}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    {editingBancoId ? 'Actualizar Banco' : 'Agregar Banco'}
                                </button>
                            </div>
                        </form>

                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">N° Cuenta</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cuenta Contable</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Código</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                    {bancos.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                                No hay bancos registrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        bancos.map((banco) => {
                                            const cuentaContable = cuentas.find(c => c.id === banco.cuentaContableId);
                                            return (
                                                <tr key={banco.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                                                        {banco.nombre}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                                        {banco.numeroCuenta || '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                                        {cuentaContable ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                                                {cuentaContable.codigo} - {cuentaContable.nombre}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400 italic">No asignada</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                                        <span className="px-2 py-1 bg-gray-100 dark:bg-zinc-800 rounded text-xs font-mono">
                                                            {banco.codigo || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEditBanco(banco)}
                                                            className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                        >
                                                            <PencilIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteBanco(banco.id)}
                                                            className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* CUENTAS CONTABLES TAB */}
                {activeTab === 'cuentas' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/20">
                            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Plan de Cuentas</h3>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                Gestiona las cuentas contables para el registro de operaciones financieras.
                            </p>
                        </div>

                        <form onSubmit={handleAddCuenta} className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Código
                                    </label>
                                    <input
                                        type="text"
                                        value={newCuentaCodigo}
                                        onChange={(e) => setNewCuentaCodigo(e.target.value)}
                                        placeholder="Ej: 10.1"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Nombre de la Cuenta
                                    </label>
                                    <input
                                        type="text"
                                        value={newCuentaNombre}
                                        onChange={(e) => setNewCuentaNombre(e.target.value)}
                                        placeholder="Ej: Caja Efectivo"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Tipo
                                    </label>
                                    <Select
                                        value={newCuentaTipo}
                                        onChange={(e) => setNewCuentaTipo(e.target.value as any)}
                                        className="w-full"
                                    >
                                        <option value="activo">Activo</option>
                                        <option value="pasivo">Pasivo</option>
                                        <option value="patrimonio">Patrimonio</option>
                                        <option value="ingreso">Ingreso</option>
                                        <option value="gasto">Gasto</option>
                                    </Select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                {editingCuentaId && (
                                    <button
                                        type="button"
                                        onClick={handleCancelEditCuenta}
                                        className="px-6 py-2.5 bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 transition font-medium flex items-center gap-2"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                        Cancelar
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    disabled={!newCuentaCodigo.trim() || !newCuentaNombre.trim()}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    {editingCuentaId ? 'Actualizar Cuenta' : 'Agregar Cuenta'}
                                </button>
                            </div>
                        </form>

                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Código</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                    {cuentas.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                                No hay cuentas registradas.
                                            </td>
                                        </tr>
                                    ) : (
                                        cuentas.map((cuenta) => (
                                            <tr key={cuenta.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm font-mono text-gray-600 dark:text-gray-300">
                                                    {cuenta.codigo}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                                                    {cuenta.nombre}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${cuenta.tipo === 'activo' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                        cuenta.tipo === 'pasivo' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                            cuenta.tipo === 'patrimonio' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                                'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300'
                                                        }`}>
                                                        {cuenta.tipo.charAt(0).toUpperCase() + cuenta.tipo.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditCuenta(cuenta)}
                                                        className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    >
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCuenta(cuenta.id)}
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

                {/* AREAS TAB */}
                {activeTab === 'areas' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/20">
                            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Gestión de Áreas</h3>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                Registra las áreas que pueden solicitar fondos de caja chica (ej. Gerencia, Logística, Balanza).
                            </p>
                        </div>

                        <form onSubmit={handleAddArea} className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg space-y-4">
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Nombre del Área
                                    </label>
                                    <input
                                        type="text"
                                        value={newAreaNombre}
                                        onChange={(e) => setNewAreaNombre(e.target.value)}
                                        placeholder="Ej: Logística"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    {editingAreaId && (
                                        <button
                                            type="button"
                                            onClick={handleCancelEditArea}
                                            className="px-6 py-2.5 bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 transition font-medium flex items-center gap-2"
                                        >
                                            <XMarkIcon className="w-5 h-5" />
                                            Cancelar
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={!newAreaNombre.trim()}
                                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                        {editingAreaId ? 'Actualizar Área' : 'Agregar Área'}
                                    </button>
                                </div>
                            </div>
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
                                    {areas.length === 0 ? (
                                        <tr>
                                            <td colSpan={2} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                                No hay áreas registradas.
                                            </td>
                                        </tr>
                                    ) : (
                                        areas.map((area) => (
                                            <tr key={area.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                                                    {area.nombre}
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditArea(area)}
                                                        className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    >
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteArea(area.id)}
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

                {/* CATEGORIAS TAB */}
                {activeTab === 'categorias' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/20">
                            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Gestión de Categorías</h3>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                Registra las categorías de gastos para clasificar los movimientos de caja chica (ej. Movilidad, Alimentación).
                            </p>
                        </div>

                        <form onSubmit={handleAddCategoria} className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg space-y-4">
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Nombre de la Categoría
                                    </label>
                                    <input
                                        type="text"
                                        value={newCategoriaNombre}
                                        onChange={(e) => setNewCategoriaNombre(e.target.value)}
                                        placeholder="Ej: Movilidad"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    {editingCategoriaId && (
                                        <button
                                            type="button"
                                            onClick={handleCancelEditCategoria}
                                            className="px-6 py-2.5 bg-gray-100 text-gray-700 dark:bg-zinc-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-600 transition font-medium flex items-center gap-2"
                                        >
                                            <XMarkIcon className="w-5 h-5" />
                                            Cancelar
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={!newCategoriaNombre.trim()}
                                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-600/20"
                                    >
                                        <PlusIcon className="w-5 h-5" />
                                        {editingCategoriaId ? 'Actualizar Categoría' : 'Agregar Categoría'}
                                    </button>
                                </div>
                            </div>
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
                                    {categorias.length === 0 ? (
                                        <tr>
                                            <td colSpan={2} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                                No hay categorías registradas.
                                            </td>
                                        </tr>
                                    ) : (
                                        categorias.map((categoria) => (
                                            <tr key={categoria.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                                                    {categoria.nombre}
                                                </td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleEditCategoria(categoria)}
                                                        className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                                    >
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCategoria(categoria.id)}
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
