"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, doc } from "firebase/firestore";
import Swal from "sweetalert2";
import { Skeleton } from "@/app/components/ui/Skeleton";
import {
    ArrowPathIcon,
    UsersIcon,
    ShieldCheckIcon,
    KeyIcon,
    PlusIcon,
    TrashIcon,
    PencilIcon,
    BuildingOfficeIcon
} from "@heroicons/react/24/outline";
import Select from "@/app/components/Select";
import Dialog from "@/app/components/Dialog";

type Usuario = {
    id: string;
    nombre: string;
    email: string;
    rol: string;
    activo: boolean;
    almacenId?: string; // Sede asignada

};

type Rol = {
    id: string;
    nombre: string;
    descripcion: string;
};

type Permiso = {
    id: string;
    nombre: string;
    clave: string;
    descripcion: string;
};

type Almacen = {
    id: string;
    nombre: string;
};

export default function UsuariosConfigPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<unknown>(null);
    const [activeTab, setActiveTab] = useState<'usuarios' | 'roles' | 'permisos'>('usuarios');
    const [isLoading, setIsLoading] = useState(true);

    // Data States
    const [usuarios, setUsuarios] = useState<Usuario[]>([]);
    const [roles, setRoles] = useState<Rol[]>([]);
    const [permisos, setPermisos] = useState<Permiso[]>([]);
    const [almacenes, setAlmacenes] = useState<Almacen[]>([]);

    // Form States
    const [newUser, setNewUser] = useState({ nombre: "", email: "", rol: "", almacenId: "" });
    const [newRol, setNewRol] = useState({ nombre: "", descripcion: "" });
    const [newPermiso, setNewPermiso] = useState({ nombre: "", clave: "", descripcion: "" });

    // Edit States (ID tracking)
    const [editingUserId, setEditingUserId] = useState<string | null>(null);
    const [editingRolId, setEditingRolId] = useState<string | null>(null);
    const [editingPermisoId, setEditingPermisoId] = useState<string | null>(null);

    // Dialog States
    const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
    const [isRolDialogOpen, setIsRolDialogOpen] = useState(false);
    const [isPermisoDialogOpen, setIsPermisoDialogOpen] = useState(false);

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

    // Listeners
    useEffect(() => {
        if (!currentUser) return;

        const unsubUsuarios = onSnapshot(query(collection(db, "usuarios"), orderBy("nombre")), (snap) => {
            setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() } as Usuario)));
        });

        const unsubRoles = onSnapshot(query(collection(db, "roles"), orderBy("nombre")), (snap) => {
            setRoles(snap.docs.map(d => ({ id: d.id, ...d.data() } as Rol)));
        });

        const unsubPermisos = onSnapshot(query(collection(db, "permisos"), orderBy("nombre")), (snap) => {
            setPermisos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Permiso)));
        });

        const unsubAlmacenes = onSnapshot(query(collection(db, "almacenes"), orderBy("nombre")), (snap) => {
            setAlmacenes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Almacen)));
        });

        return () => {
            unsubUsuarios();
            unsubRoles();
            unsubPermisos();
            unsubAlmacenes();
        };
    }, [currentUser]);

    // --- USERS HANDLERS ---
    const openUserDialog = (user?: Usuario) => {
        if (user) {
            setNewUser({
                nombre: user.nombre,
                email: user.email,
                rol: user.rol,
                almacenId: user.almacenId || ""
            });
            setEditingUserId(user.id);
        } else {
            setNewUser({ nombre: "", email: "", rol: "", almacenId: "" });
            setEditingUserId(null);
        }
        setIsUserDialogOpen(true);
    };

    const closeUserDialog = () => {
        setIsUserDialogOpen(false);
        setNewUser({ nombre: "", email: "", rol: "", almacenId: "" });
        setEditingUserId(null);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingUserId) {
                await updateDoc(doc(db, "usuarios", editingUserId), { ...newUser });
                Swal.fire({ icon: 'success', title: 'Usuario actualizado', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            } else {
                await addDoc(collection(db, "usuarios"), { ...newUser, activo: true });
                Swal.fire({ icon: 'success', title: 'Usuario registrado', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            }
            closeUserDialog();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar el usuario', 'error');
        }
    };

    // --- ROLES HANDLERS ---
    const openRolDialog = (rol?: Rol) => {
        if (rol) {
            setNewRol({ nombre: rol.nombre, descripcion: rol.descripcion });
            setEditingRolId(rol.id);
        } else {
            setNewRol({ nombre: "", descripcion: "" });
            setEditingRolId(null);
        }
        setIsRolDialogOpen(true);
    };

    const closeRolDialog = () => {
        setIsRolDialogOpen(false);
        setNewRol({ nombre: "", descripcion: "" });
        setEditingRolId(null);
    };

    const handleSaveRol = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingRolId) {
                await updateDoc(doc(db, "roles", editingRolId), newRol);
                Swal.fire({ icon: 'success', title: 'Rol actualizado', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            } else {
                await addDoc(collection(db, "roles"), newRol);
                Swal.fire({ icon: 'success', title: 'Rol creado', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            }
            closeRolDialog();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar el rol', 'error');
        }
    };

    // --- PERMISOS HANDLERS ---
    const openPermisoDialog = (permiso?: Permiso) => {
        if (permiso) {
            setNewPermiso({ nombre: permiso.nombre, clave: permiso.clave, descripcion: permiso.descripcion });
            setEditingPermisoId(permiso.id);
        } else {
            setNewPermiso({ nombre: "", clave: "", descripcion: "" });
            setEditingPermisoId(null);
        }
        setIsPermisoDialogOpen(true);
    };

    const closePermisoDialog = () => {
        setIsPermisoDialogOpen(false);
        setNewPermiso({ nombre: "", clave: "", descripcion: "" });
        setEditingPermisoId(null);
    };

    const handleSavePermiso = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingPermisoId) {
                await updateDoc(doc(db, "permisos", editingPermisoId), newPermiso);
                Swal.fire({ icon: 'success', title: 'Permiso actualizado', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            } else {
                await addDoc(collection(db, "permisos"), newPermiso);
                Swal.fire({ icon: 'success', title: 'Permiso creado', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            }
            closePermisoDialog();
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar el permiso', 'error');
        }
    };

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
                Swal.fire('Eliminado', 'El registro ha sido eliminado', 'success');
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'No se pudo eliminar', 'error');
            }
        }
    };

    const handleSeedData = async () => {
        const confirm = await Swal.fire({
            title: '¿Cargar datos por defecto?',
            text: "Esto agregará roles y permisos básicos. No borrará lo existente.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cargar',
            cancelButtonText: 'Cancelar'
        });

        if (!confirm.isConfirmed) return;

        const defaultRoles = [
            { nombre: "Administrador", descripcion: "Acceso total al sistema" },
            { nombre: "Operador Garita", descripcion: "Registro de entradas y salidas" },
            { nombre: "Operador Balanza", descripcion: "Gestión de pesajes" },
            { nombre: "Jefe Almacén", descripcion: "Gestión de inventario y productos" }
        ];

        const defaultPermisos = [
            { nombre: "Ver Garita", clave: "garita.view", descripcion: "Acceso al módulo de garita" },
            { nombre: "Crear Ticket", clave: "garita.create", descripcion: "Crear nuevos tickets de entrada" },
            { nombre: "Ver Balanza", clave: "balanza.view", descripcion: "Acceso al módulo de balanza" },
            { nombre: "Registrar Peso", clave: "balanza.create", descripcion: "Registrar pesos de camiones" },
            { nombre: "Ver Almacén", clave: "almacen.view", descripcion: "Acceso al módulo de almacén" },
            { nombre: "Gestionar Inventario", clave: "almacen.manage", descripcion: "Agregar/Editar productos" },
            { nombre: "Configuración", clave: "config.view", descripcion: "Acceso a la configuración del sistema" }
        ];

        try {
            const batchPromises = [
                ...defaultRoles.map(rol => addDoc(collection(db, "roles"), rol)),
                ...defaultPermisos.map(permiso => addDoc(collection(db, "permisos"), permiso))
            ];

            await Promise.all(batchPromises);
            Swal.fire('Éxito', 'Datos por defecto cargados correctamente', 'success');
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Hubo un problema cargando los datos', 'error');
        }
    };

    if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;
    if (!currentUser) return null;

    const inputClass = "w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all";
    const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
    const buttonClass = "px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20";

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Gestión de Usuarios y Accesos</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Administra usuarios, roles y permisos del sistema.</p>
                </div>
                <button
                    onClick={handleSeedData}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800"
                >
                    <ArrowPathIcon className="w-4 h-4" />
                    Cargar Datos por Defecto
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-zinc-800">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('usuarios')}
                        className={`${activeTab === 'usuarios'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <UsersIcon className="w-5 h-5" />
                        Usuarios
                    </button>
                    <button
                        onClick={() => setActiveTab('roles')}
                        className={`${activeTab === 'roles'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <ShieldCheckIcon className="w-5 h-5" />
                        Roles
                    </button>
                    <button
                        onClick={() => setActiveTab('permisos')}
                        className={`${activeTab === 'permisos'
                            ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                    >
                        <KeyIcon className="w-5 h-5" />
                        Permisos
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className="mt-6">
                {/* USUARIOS TAB */}
                {activeTab === 'usuarios' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/20 max-w-2xl">
                                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Directorio de Usuarios</h3>
                                <p className="text-xs text-blue-600 dark:text-blue-400">
                                    Gestiona el acceso de los colaboradores al sistema.
                                </p>
                            </div>
                            <button onClick={() => openUserDialog()} className={buttonClass}>
                                <PlusIcon className="w-5 h-5" /> Nuevo Usuario
                            </button>
                        </div>

                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rol</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sede</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                    {usuarios.map(user => {
                                        const sede = almacenes.find(a => a.id === user.almacenId)?.nombre || 'Todas';
                                        return (
                                            <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{user.nombre}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                                                <td className="px-6 py-4"><span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-xs font-medium">{user.rol}</span></td>
                                                <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-gray-300 rounded-full text-xs font-medium flex items-center w-fit gap-1"><BuildingOfficeIcon className="w-3 h-3" /> {sede}</span></td>
                                                <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                    <button onClick={() => openUserDialog(user)} className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"><PencilIcon className="w-5 h-5" /></button>
                                                    <button onClick={() => handleDelete('usuarios', user.id)} className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"><TrashIcon className="w-5 h-5" /></button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* User Dialog */}
                        <Dialog
                            isOpen={isUserDialogOpen}
                            onClose={closeUserDialog}
                            title={editingUserId ? "Editar Usuario" : "Nuevo Usuario"}
                            maxWidth="max-w-2xl"
                        >
                            <form onSubmit={handleSaveUser} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>Nombre</label>
                                        <input required type="text" value={newUser.nombre} onChange={e => setNewUser({ ...newUser, nombre: e.target.value })} className={inputClass} placeholder="Nombre completo" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Email</label>
                                        <input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className={inputClass} placeholder="usuario@empresa.com" />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Rol</label>
                                        <Select required value={newUser.rol} onChange={e => setNewUser({ ...newUser, rol: e.target.value })}>
                                            <option value="">Seleccionar Rol</option>
                                            {roles.map(rol => <option key={rol.id} value={rol.nombre}>{rol.nombre}</option>)}
                                        </Select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Sede Asignada (Almacén)</label>
                                        <Select value={newUser.almacenId} onChange={e => setNewUser({ ...newUser, almacenId: e.target.value })}>
                                            <option value="">Todas (Acceso Global)</option>
                                            {almacenes.map(sede => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}
                                        </Select>
                                        <p className="text-[10px] text-gray-500 mt-1">Dejar vacío para acceso total.</p>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <button type="submit" className={buttonClass}>
                                        <PlusIcon className="w-5 h-5" /> {editingUserId ? 'Actualizar Usuario' : 'Crear Usuario'}
                                    </button>
                                </div>
                            </form>
                        </Dialog>
                    </div>
                )}

                {/* ROLES TAB */}
                {activeTab === 'roles' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-100 dark:border-purple-900/20 max-w-2xl">
                                <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-1">Roles del Sistema</h3>
                                <p className="text-xs text-purple-600 dark:text-purple-400">
                                    Define perfiles de acceso agrupando permisos específicos.
                                </p>
                            </div>
                            <button onClick={() => openRolDialog()} className={`${buttonClass} bg-purple-600 hover:bg-purple-700 shadow-purple-600/20`}>
                                <PlusIcon className="w-5 h-5" /> Nuevo Rol
                            </button>
                        </div>

                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rol</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                    {roles.map(rol => (
                                        <tr key={rol.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{rol.nombre}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{rol.descripcion}</td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                <button onClick={() => openRolDialog(rol)} className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"><PencilIcon className="w-5 h-5" /></button>
                                                <button onClick={() => handleDelete('roles', rol.id)} className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"><TrashIcon className="w-5 h-5" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Rol Dialog */}
                        <Dialog
                            isOpen={isRolDialogOpen}
                            onClose={closeRolDialog}
                            title={editingRolId ? "Editar Rol" : "Nuevo Rol"}
                        >
                            <form onSubmit={handleSaveRol} className="space-y-4">
                                <div>
                                    <label className={labelClass}>Nombre del Rol</label>
                                    <input required type="text" value={newRol.nombre} onChange={e => setNewRol({ ...newRol, nombre: e.target.value })} className={inputClass} placeholder="Ej: Administrador" />
                                </div>
                                <div>
                                    <label className={labelClass}>Descripción</label>
                                    <input type="text" value={newRol.descripcion} onChange={e => setNewRol({ ...newRol, descripcion: e.target.value })} className={inputClass} placeholder="Acceso total al sistema" />
                                </div>
                                <div className="flex justify-end pt-4">
                                    <button type="submit" className={`${buttonClass} bg-purple-600 hover:bg-purple-700 shadow-purple-600/20`}>
                                        <PlusIcon className="w-5 h-5" /> {editingRolId ? 'Actualizar Rol' : 'Crear Rol'}
                                    </button>
                                </div>
                            </form>
                        </Dialog>
                    </div>
                )}

                {/* PERMISOS TAB */}
                {activeTab === 'permisos' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-lg border border-orange-100 dark:border-orange-900/20 max-w-2xl">
                                <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300 mb-1">Permisos Granulares</h3>
                                <p className="text-xs text-orange-600 dark:text-orange-400">
                                    Configura las llaves de acceso específicas para cada funcionalidad.
                                </p>
                            </div>
                            <button onClick={() => openPermisoDialog()} className={`${buttonClass} bg-orange-600 hover:bg-orange-700 shadow-orange-600/20`}>
                                <PlusIcon className="w-5 h-5" /> Nuevo Permiso
                            </button>
                        </div>

                        <div className="border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/80">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Clave</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                    {permisos.map(permiso => (
                                        <tr key={permiso.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">{permiso.nombre}</td>
                                            <td className="px-6 py-4"><span className="font-mono text-xs bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded text-gray-600 dark:text-gray-300">{permiso.clave}</span></td>
                                            <td className="px-6 py-4 text-sm text-gray-500">{permiso.descripcion}</td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-2">
                                                <button onClick={() => openPermisoDialog(permiso)} className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors p-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20"><PencilIcon className="w-5 h-5" /></button>
                                                <button onClick={() => handleDelete('permisos', permiso.id)} className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"><TrashIcon className="w-5 h-5" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Permiso Dialog */}
                        <Dialog
                            isOpen={isPermisoDialogOpen}
                            onClose={closePermisoDialog}
                            title={editingPermisoId ? "Editar Permiso" : "Nuevo Permiso"}
                        >
                            <form onSubmit={handleSavePermiso} className="space-y-4">
                                <div>
                                    <label className={labelClass}>Nombre</label>
                                    <input required type="text" value={newPermiso.nombre} onChange={e => setNewPermiso({ ...newPermiso, nombre: e.target.value })} className={inputClass} placeholder="Ej: Ver Dashboard" />
                                </div>
                                <div>
                                    <label className={labelClass}>Clave (Key)</label>
                                    <input required type="text" value={newPermiso.clave} onChange={e => setNewPermiso({ ...newPermiso, clave: e.target.value })} className={`${inputClass} font-mono text-sm`} placeholder="dashboard.view" />
                                </div>
                                <div>
                                    <label className={labelClass}>Descripción</label>
                                    <input type="text" value={newPermiso.descripcion} onChange={e => setNewPermiso({ ...newPermiso, descripcion: e.target.value })} className={inputClass} />
                                </div>
                                <div className="flex justify-end pt-4">
                                    <button type="submit" className={`${buttonClass} bg-orange-600 hover:bg-orange-700 shadow-orange-600/20`}>
                                        <PlusIcon className="w-5 h-5" /> {editingPermisoId ? 'Actualizar Permiso' : 'Crear Permiso'}
                                    </button>
                                </div>
                            </form>
                        </Dialog>
                    </div>
                )}
            </div>
        </div>
    );
}
