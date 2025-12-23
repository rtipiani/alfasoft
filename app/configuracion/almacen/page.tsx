"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, deleteDoc, onSnapshot, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
    PlusIcon,
    TrashIcon,
    BuildingOfficeIcon,
    MapIcon,
    TagIcon,
    CubeIcon,
    ScaleIcon,
    PencilIcon,
    XMarkIcon,
    ChevronLeftIcon,
    ChevronRightIcon
} from "@heroicons/react/24/outline";
import { Skeleton } from "@/app/components/ui/Skeleton";
import Select from "@/app/components/Select";

// Types
type Almacen = {
    id: string;
    nombre: string;
    direccion: string;
    tipo: string;
    activo: boolean;
};

type Zona = {
    id: string;
    almacenId: string;
    nombre: string;
    tipo: string;
    activo: boolean;
};

type Categoria = {
    id: string;
    nombre: string;
    activo: boolean;
};

type UnidadMedida = {
    id: string;
    nombre: string;
    codigoSunat: string;
    simbolo: string;
    abreviatura?: string; // Legacy support
    activo: boolean;
};

type Producto = {
    id: string;
    sku: string;
    nombre: string;
    categoriaId: string;
    unidad: string;
    stockMin: number;
    stockMax: number;
    atributos: {
        perecible: boolean;
        seriado: boolean;
    };
    activo: boolean;
};

export default function AlmacenConfigPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<unknown>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'almacenes' | 'zonas' | 'categorias' | 'productos' | 'unidades'>('almacenes');

    // Data States
    const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
    const [zonas, setZonas] = useState<Zona[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
    const [productos, setProductos] = useState<Producto[]>([]);

    // Form States
    const [newAlmacen, setNewAlmacen] = useState({ nombre: "", direccion: "", tipo: "Sucursal" });
    const [editingAlmacenId, setEditingAlmacenId] = useState<string | null>(null);

    const [newZona, setNewZona] = useState({ almacenId: "", nombre: "", tipo: "Almacenamiento" });
    const [editingZonaId, setEditingZonaId] = useState<string | null>(null);

    const [newCategoria, setNewCategoria] = useState("");
    const [editingCategoriaId, setEditingCategoriaId] = useState<string | null>(null);

    const [newUnidad, setNewUnidad] = useState({ nombre: "", codigoSunat: "", simbolo: "" });
    const [editingUnidadId, setEditingUnidadId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [newProducto, setNewProducto] = useState({
        sku: "",
        nombre: "",
        categoriaId: "",
        unidad: "",
        stockMin: 0,
        stockMax: 0,
        atributos: { perecible: false, seriado: false }
    });
    const [editingProductoId, setEditingProductoId] = useState<string | null>(null);

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

        const unsubAlmacenes = onSnapshot(query(collection(db, "almacenes"), orderBy("nombre")), (snap) => {
            setAlmacenes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Almacen)));
        });

        const unsubZonas = onSnapshot(query(collection(db, "almacen_zonas"), orderBy("nombre")), (snap) => {
            setZonas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Zona)));
        });

        const unsubCategorias = onSnapshot(query(collection(db, "almacen_categorias"), orderBy("nombre")), (snap) => {
            setCategorias(snap.docs.map(d => ({ id: d.id, ...d.data() } as Categoria)));
        });

        const unsubUnidades = onSnapshot(query(collection(db, "configuracion_unidades"), orderBy("nombre")), (snap) => {
            setUnidades(snap.docs.map(d => ({ id: d.id, ...d.data() } as UnidadMedida)));
        });

        const unsubProductos = onSnapshot(query(collection(db, "productos"), orderBy("nombre")), (snap) => {
            setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Producto)));
        });

        return () => {
            unsubAlmacenes();
            unsubZonas();
            unsubCategorias();
            unsubUnidades();
            unsubProductos();
        };
    }, [currentUser]);

    // --- Handlers ---

    // Almacenes
    const handleAddAlmacen = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingAlmacenId) {
                await updateDoc(doc(db, "almacenes", editingAlmacenId), { ...newAlmacen });
                Swal.fire('Actualizado', 'Almacén actualizado correctamente', 'success');
                setEditingAlmacenId(null);
            } else {
                await addDoc(collection(db, "almacenes"), { ...newAlmacen, activo: true });
                Swal.fire({
                    icon: 'success',
                    title: 'Almacén creado',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setNewAlmacen({ nombre: "", direccion: "", tipo: "Sucursal" });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar el almacén', 'error');
        }
    };

    const handleEditAlmacen = (almacen: Almacen) => {
        setNewAlmacen({ nombre: almacen.nombre, direccion: almacen.direccion, tipo: almacen.tipo });
        setEditingAlmacenId(almacen.id);
    };

    const handleCancelEditAlmacen = () => {
        setNewAlmacen({ nombre: "", direccion: "", tipo: "Sucursal" });
        setEditingAlmacenId(null);
    };

    // Zonas
    const handleAddZona = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingZonaId) {
                await updateDoc(doc(db, "almacen_zonas", editingZonaId), { ...newZona });
                Swal.fire('Actualizado', 'Zona actualizada correctamente', 'success');
                setEditingZonaId(null);
            } else {
                await addDoc(collection(db, "almacen_zonas"), { ...newZona, activo: true });
                Swal.fire({
                    icon: 'success',
                    title: 'Zona creada',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setNewZona({ ...newZona, nombre: "" }); // Keep selected warehouse and type
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar la zona', 'error');
        }
    };

    const handleEditZona = (zona: Zona) => {
        setNewZona({ almacenId: zona.almacenId, nombre: zona.nombre, tipo: zona.tipo });
        setEditingZonaId(zona.id);
    };

    const handleCancelEditZona = () => {
        setNewZona({ ...newZona, nombre: "" });
        setEditingZonaId(null);
    };


    // Categorias
    const handleAddCategoria = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoria.trim()) return;
        try {
            if (editingCategoriaId) {
                await updateDoc(doc(db, "almacen_categorias", editingCategoriaId), { nombre: newCategoria.trim() });
                Swal.fire('Actualizado', 'Categoría actualizada correctamente', 'success');
                setEditingCategoriaId(null);
            } else {
                await addDoc(collection(db, "almacen_categorias"), { nombre: newCategoria.trim(), activo: true });
                Swal.fire({
                    icon: 'success',
                    title: 'Categoría creada',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setNewCategoria("");
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar la categoría', 'error');
        }
    };

    const handleEditCategoria = (cat: Categoria) => {
        setNewCategoria(cat.nombre);
        setEditingCategoriaId(cat.id);
    };

    const handleCancelEditCategoria = () => {
        setNewCategoria("");
        setEditingCategoriaId(null);
    };

    // Unidades
    const handleAddUnidad = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUnidad.nombre.trim() || !newUnidad.codigoSunat.trim() || !newUnidad.simbolo.trim()) return;

        try {
            if (editingUnidadId) {
                await updateDoc(doc(db, "configuracion_unidades", editingUnidadId), {
                    nombre: newUnidad.nombre.trim(),
                    codigoSunat: newUnidad.codigoSunat.trim(),
                    simbolo: newUnidad.simbolo.trim()
                });
                Swal.fire('Actualizado', 'La unidad ha sido actualizada correctamente', 'success');
                setEditingUnidadId(null);
            } else {
                await addDoc(collection(db, "configuracion_unidades"), {
                    ...newUnidad,
                    activo: true
                });
                Swal.fire({
                    icon: 'success',
                    title: 'Unidad creada',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setNewUnidad({ nombre: "", codigoSunat: "", simbolo: "" });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', `No se pudo ${editingUnidadId ? 'actualizar' : 'crear'} la unidad`, 'error');
        }
    };

    const handleEditUnidad = (unidad: UnidadMedida) => {
        setNewUnidad({
            nombre: unidad.nombre || "",
            codigoSunat: unidad.codigoSunat || unidad.abreviatura || "",
            simbolo: unidad.simbolo || ""
        });
        setEditingUnidadId(unidad.id);
    };

    const handleCancelEditUnidad = () => {
        setNewUnidad({ nombre: "", codigoSunat: "", simbolo: "" });
        setEditingUnidadId(null);
    };

    // Productos
    const handleAddProducto = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingProductoId) {
                await updateDoc(doc(db, "productos", editingProductoId), { ...newProducto });
                Swal.fire('Actualizado', 'Producto actualizado correctamente', 'success');
                setEditingProductoId(null);
            } else {
                await addDoc(collection(db, "productos"), { ...newProducto, activo: true });
                Swal.fire({
                    icon: 'success',
                    title: 'Producto creado',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setNewProducto({
                sku: "",
                nombre: "",
                categoriaId: "",
                unidad: "UND",
                stockMin: 0,
                stockMax: 0,
                atributos: { perecible: false, seriado: false }
            });
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar el producto', 'error');
        }
    };

    const handleEditProducto = (prod: Producto) => {
        setNewProducto({
            sku: prod.sku,
            nombre: prod.nombre,
            categoriaId: prod.categoriaId,
            unidad: prod.unidad,
            stockMin: prod.stockMin,
            stockMax: prod.stockMax,
            atributos: prod.atributos || { perecible: false, seriado: false }
        });
        setEditingProductoId(prod.id);
    };

    const handleCancelEditProducto = () => {
        setNewProducto({
            sku: "",
            nombre: "",
            categoriaId: "",
            unidad: "UND",
            stockMin: 0,
            stockMax: 0,
            atributos: { perecible: false, seriado: false }
        });
        setEditingProductoId(null);
    };

    // Generic Delete
    const handleDelete = async (collectionName: string, id: string) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "No podrás revertir esto",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, collectionName, id));
                Swal.fire('Eliminado', 'Registro eliminado', 'success');
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'No se pudo eliminar', 'error');
            }
        }
    };

    if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;
    if (!currentUser) return null;

    const inputClass = "w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all";
    const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
    const buttonClass = "px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20";

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Configuración de Almacén</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Gestiona almacenes, zonas, categorías y el maestro de productos.
                </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-zinc-800">
                <nav className="-mb-px flex space-x-8">
                    <button onClick={() => setActiveTab('almacenes')} className={`${activeTab === 'almacenes' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>
                        <BuildingOfficeIcon className="w-5 h-5" /> Almacenes
                    </button>
                    <button onClick={() => setActiveTab('zonas')} className={`${activeTab === 'zonas' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>
                        <MapIcon className="w-5 h-5" /> Zonas
                    </button>
                    <button onClick={() => setActiveTab('categorias')} className={`${activeTab === 'categorias' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>
                        <TagIcon className="w-5 h-5" /> Categorías
                    </button>
                    <button onClick={() => setActiveTab('unidades')} className={`${activeTab === 'unidades' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>
                        <ScaleIcon className="w-5 h-5" /> Unidades
                    </button>
                    <button onClick={() => setActiveTab('productos')} className={`${activeTab === 'productos' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>
                        <CubeIcon className="w-5 h-5" /> Productos
                    </button>
                </nav>
            </div>

            <div className="mt-6">
                {/* ALMACENES TAB */}
                {activeTab === 'almacenes' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/20">
                            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Gestión de Almacenes</h3>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                                Registra tus sedes físicas, sucursales o centros de distribución.
                            </p>
                        </div>

                        <form onSubmit={handleAddAlmacen} className="bg-gray-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-gray-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <div>
                                <label className={labelClass}>Nombre</label>
                                <input required type="text" value={newAlmacen.nombre} onChange={e => setNewAlmacen({ ...newAlmacen, nombre: e.target.value })} className={inputClass} placeholder="Ej: Almacén Central" />
                            </div>
                            <div>
                                <label className={labelClass}>Dirección</label>
                                <input required type="text" value={newAlmacen.direccion} onChange={e => setNewAlmacen({ ...newAlmacen, direccion: e.target.value })} className={inputClass} placeholder="Av. Principal 123" />
                            </div>
                            <div>
                                <label className={labelClass}>Tipo</label>
                                <Select value={newAlmacen.tipo} onChange={e => setNewAlmacen({ ...newAlmacen, tipo: e.target.value })} className="w-full">
                                    <option value="Sucursal">Sucursal</option>
                                    <option value="Centro de Distribución">Centro de Distribución</option>
                                    <option value="Cross-Docking">Cross-Docking</option>
                                </Select>
                            </div>
                            <div className="md:col-span-3 flex gap-2">
                                <button type="submit" className={`${buttonClass} flex-1`}>
                                    <PlusIcon className="w-5 h-5" /> {editingAlmacenId ? 'Actualizar Almacén' : 'Crear Almacén'}
                                </button>
                                {editingAlmacenId && (
                                    <button type="button" onClick={handleCancelEditAlmacen} className="px-6 py-2.5 bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 transition font-medium flex items-center justify-center gap-2">
                                        <XMarkIcon className="w-5 h-5" /> Cancelar
                                    </button>
                                )}
                            </div>
                        </form>

                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dirección</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                    {almacenes.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{item.nombre}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{item.direccion}</td>
                                            <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs font-medium">{item.tipo}</span></td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                <button onClick={() => handleEditAlmacen(item)} className="text-blue-400 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar">
                                                    <PencilIcon className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => handleDelete('almacenes', item.id)} className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20" title="Eliminar">
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ZONAS TAB */}
                {activeTab === 'zonas' && (
                    <div className="space-y-6">
                        <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-lg border border-indigo-100 dark:border-indigo-900/20">
                            <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-300 mb-1">Gestión de Zonas</h3>
                            <p className="text-xs text-indigo-600 dark:text-indigo-400">
                                Define áreas internas para organizar mejor el flujo (Recepción, Picking, Despacho).
                            </p>
                        </div>

                        <form onSubmit={handleAddZona} className="bg-gray-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-gray-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                            <div>
                                <label className={labelClass}>Almacén</label>
                                <Select required value={newZona.almacenId} onChange={e => setNewZona({ ...newZona, almacenId: e.target.value })} className="w-full">
                                    <option value="">Seleccionar Almacén</option>
                                    {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                                </Select>
                            </div>
                            <div>
                                <label className={labelClass}>Nombre de Zona</label>
                                <input required type="text" value={newZona.nombre} onChange={e => setNewZona({ ...newZona, nombre: e.target.value })} className={inputClass} placeholder="Ej: Recepción, Rack A" />
                            </div>
                            <div>
                                <label className={labelClass}>Tipo de Zona</label>
                                <Select value={newZona.tipo} onChange={e => setNewZona({ ...newZona, tipo: e.target.value })} className="w-full">
                                    <option value="Almacenamiento">Almacenamiento</option>
                                    <option value="Recepción">Recepción</option>
                                    <option value="Picking">Picking</option>
                                    <option value="Empaque">Empaque</option>
                                    <option value="Despacho">Despacho</option>
                                    <option value="Cuarentena">Cuarentena</option>
                                    <option value="Devoluciones">Devoluciones</option>
                                    <option value="Frío">Frío / Alta Seguridad</option>
                                </Select>
                            </div>
                            <div className="md:col-span-3 flex gap-2">
                                <button type="submit" className={`${buttonClass} bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20 flex-1`}>
                                    <PlusIcon className="w-5 h-5" /> {editingZonaId ? 'Actualizar Zona' : 'Crear Zona'}
                                </button>
                                {editingZonaId && (
                                    <button type="button" onClick={handleCancelEditZona} className="px-6 py-2.5 bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 transition font-medium flex items-center justify-center gap-2">
                                        <XMarkIcon className="w-5 h-5" /> Cancelar
                                    </button>
                                )}
                            </div>
                        </form>

                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Almacén</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Zona</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                    {zonas.map(item => {
                                        const almacen = almacenes.find(a => a.id === item.almacenId);
                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-500">{almacen?.nombre || '---'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{item.nombre}</td>
                                                <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 dark:bg-zinc-700 rounded text-xs text-gray-600 dark:text-gray-300">{item.tipo}</span></td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button onClick={() => handleEditZona(item)} className="text-blue-400 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar">
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={() => handleDelete('almacen_zonas', item.id)} className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20" title="Eliminar">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* CATEGORIAS TAB */}
                {activeTab === 'categorias' && (
                    <div className="space-y-6">
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                            <h3 className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-1">Categorías de Productos</h3>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                Clasifica tu inventario para facilitar la búsqueda y reportes.
                            </p>
                        </div>

                        <form onSubmit={handleAddCategoria} className="bg-gray-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-gray-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div className="flex-1">
                                <label className={labelClass}>Nueva Categoría</label>
                                <input required type="text" value={newCategoria} onChange={e => setNewCategoria(e.target.value)} className={inputClass} placeholder="Ej: Herramientas" />
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className={`${buttonClass} bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20 flex-1`}>
                                    <PlusIcon className="w-5 h-5" /> {editingCategoriaId ? 'Actualizar' : 'Agregar'}
                                </button>
                                {editingCategoriaId && (
                                    <button type="button" onClick={handleCancelEditCategoria} className="px-6 py-2.5 bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 transition font-medium flex items-center justify-center gap-2">
                                        <XMarkIcon className="w-5 h-5" /> Cancelar
                                    </button>
                                )}
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
                                    {categorias.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{item.nombre}</td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                <button onClick={() => handleEditCategoria(item)} className="text-blue-400 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar">
                                                    <PencilIcon className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => handleDelete('almacen_categorias', item.id)} className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20" title="Eliminar">
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* UNIDADES TAB */}
                {activeTab === 'unidades' && (
                    <div className="space-y-6">
                        <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-100 dark:border-purple-900/20">
                            <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-1">Unidades de Medida</h3>
                            <p className="text-xs text-purple-600 dark:text-purple-400">
                                Gestiona las unidades de medida disponibles para los productos. Código Sunat es requerido para facturación electrónica.
                            </p>
                        </div>

                        <form onSubmit={handleAddUnidad} className="bg-gray-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-gray-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                            <div className="md:col-span-2">
                                <label className={labelClass}>Nombre</label>
                                <input required type="text" value={newUnidad.nombre} onChange={e => setNewUnidad({ ...newUnidad, nombre: e.target.value })} className={inputClass} placeholder="Ej: Kilogramo" />
                            </div>
                            <div>
                                <label className={labelClass}>Código Sunat</label>
                                <input required type="text" value={newUnidad.codigoSunat} onChange={e => setNewUnidad({ ...newUnidad, codigoSunat: e.target.value })} className={inputClass} placeholder="Ej: KGM" />
                            </div>
                            <div>
                                <label className={labelClass}>Símbolo Comercial</label>
                                <input required type="text" value={newUnidad.simbolo} onChange={e => setNewUnidad({ ...newUnidad, simbolo: e.target.value })} className={inputClass} placeholder="Ej: KG" />
                            </div>

                            <div className="md:col-span-4 flex gap-2">
                                <button type="submit" className={`${buttonClass} bg-purple-600 hover:bg-purple-700 shadow-purple-600/20 flex-1`}>
                                    <PlusIcon className="w-5 h-5" /> {editingUnidadId ? 'Actualizar Unidad' : 'Agregar Unidad'}
                                </button>
                                {editingUnidadId && (
                                    <button type="button" onClick={handleCancelEditUnidad} className="px-6 py-2.5 bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 transition font-medium flex items-center justify-center gap-2">
                                        <XMarkIcon className="w-5 h-5" /> Cancelar
                                    </button>
                                )}
                            </div>
                        </form>

                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden flex flex-col">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-zinc-800/80">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Código Sunat</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Símbolo</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                        {unidades.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{item.nombre}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{item.codigoSunat || item.abreviatura}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{item.simbolo || '-'}</td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button onClick={() => handleEditUnidad(item)} className="text-blue-400 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar">
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={() => handleDelete('configuracion_unidades', item.id)} className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20" title="Eliminar">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {unidades.length > itemsPerPage && (
                                <div className="px-6 py-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/30 flex items-center justify-between">
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                        Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, unidades.length)}</span> de <span className="font-medium">{unidades.length}</span> resultados
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeftIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(unidades.length / itemsPerPage)))}
                                            disabled={currentPage === Math.ceil(unidades.length / itemsPerPage)}
                                            className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronRightIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* PRODUCTOS TAB */}
                {activeTab === 'productos' && (
                    <div className="space-y-6">
                        <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-100 dark:border-amber-900/20">
                            <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">Maestro de Productos</h3>
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                Define los productos que se gestionarán en el almacén, sus códigos y atributos.
                            </p>
                        </div>

                        <form onSubmit={handleAddProducto} className="bg-gray-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-gray-100 dark:border-zinc-800 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                            <div>
                                <label className={labelClass}>SKU</label>
                                <input required type="text" value={newProducto.sku} onChange={e => setNewProducto({ ...newProducto, sku: e.target.value })} className={inputClass} placeholder="COD-001" />
                            </div>
                            <div className="md:col-span-2">
                                <label className={labelClass}>Nombre del Producto</label>
                                <input required type="text" value={newProducto.nombre} onChange={e => setNewProducto({ ...newProducto, nombre: e.target.value })} className={inputClass} placeholder="Martillo Hidráulico" />
                            </div>
                            <div>
                                <label className={labelClass}>Categoría</label>
                                <Select required value={newProducto.categoriaId} onChange={e => setNewProducto({ ...newProducto, categoriaId: e.target.value })} className="w-full">
                                    <option value="">Seleccionar</option>
                                    {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </Select>
                            </div>
                            <div>
                                <label className={labelClass}>Unidad</label>
                                <Select required value={newProducto.unidad} onChange={e => setNewProducto({ ...newProducto, unidad: e.target.value })} className="w-full">
                                    <option value="">Seleccionar</option>
                                    {unidades.map(u => (
                                        <option key={u.id} value={u.simbolo}>{u.nombre} ({u.simbolo})</option>
                                    ))}
                                </Select>
                            </div>
                            <div>
                                <label className={labelClass}>Stock Min</label>
                                <input type="number" value={newProducto.stockMin} onChange={e => setNewProducto({ ...newProducto, stockMin: parseInt(e.target.value) || 0 })} onWheel={(e) => e.currentTarget.blur()} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Stock Max</label>
                                <input type="number" value={newProducto.stockMax} onChange={e => setNewProducto({ ...newProducto, stockMax: parseInt(e.target.value) || 0 })} onWheel={(e) => e.currentTarget.blur()} className={inputClass} />
                            </div>
                            <div className="flex gap-4 items-center h-full pb-3">
                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={newProducto.atributos.perecible} onChange={e => setNewProducto({ ...newProducto, atributos: { ...newProducto.atributos, perecible: e.target.checked } })} />
                                    Perecible
                                </label>
                                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                                    <input type="checkbox" className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" checked={newProducto.atributos.seriado} onChange={e => setNewProducto({ ...newProducto, atributos: { ...newProducto.atributos, seriado: e.target.checked } })} />
                                    Seriado
                                </label>
                            </div>
                            <div className="md:col-span-4 flex gap-2">
                                <button type="submit" className={`${buttonClass} bg-amber-600 hover:bg-amber-700 shadow-amber-600/20 flex-1`}>
                                    <PlusIcon className="w-5 h-5" /> {editingProductoId ? 'Actualizar Producto' : 'Crear Producto'}
                                </button>
                                {editingProductoId && (
                                    <button type="button" onClick={handleCancelEditProducto} className="px-6 py-2.5 bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-600 transition font-medium flex items-center justify-center gap-2">
                                        <XMarkIcon className="w-5 h-5" /> Cancelar
                                    </button>
                                )}
                            </div>
                        </form>

                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">SKU</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoría</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Stock Min/Max</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                    {productos.map(item => {
                                        const cat = categorias.find(c => c.id === item.categoriaId);
                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4 font-mono text-xs text-gray-500">{item.sku}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-gray-900 dark:text-white">{item.nombre}</div>
                                                    <div className="text-xs mt-1 flex gap-2">
                                                        {item.atributos.perecible && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-medium">Perecible</span>}
                                                        {item.atributos.seriado && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">Seriado</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{cat?.nombre || '---'}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{item.stockMin} / {item.stockMax} {item.unidad}</td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button onClick={() => handleEditProducto(item)} className="text-blue-400 hover:text-blue-600 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar">
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                    <button onClick={() => handleDelete('productos', item.id)} className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20" title="Eliminar">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
