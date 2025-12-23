"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, doc, where, getDocs, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
    PlusIcon,
    PencilIcon,
    TrashIcon,
    MagnifyingGlassIcon,
    XMarkIcon,
    FunnelIcon
} from "@heroicons/react/24/outline";
import { Skeleton } from "@/app/components/ui/Skeleton";
import Dialog from "@/app/components/Dialog";
import Select from "@/app/components/Select";
import { format } from "date-fns";

const labelClass = "block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1";
const inputClass = "w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800";

const LISTA_BANCOS = [
    "BCP",
    "BBVA",
    "Interbank",
    "Scotiabank",
    "Banco de la Nación",
    "BanBif",
    "Pichincha",
    "GNB",
    "Comercio",
    "MiBanco",
    "Caja Arequipa",
    "Caja Piura",
    "Caja Cusco",
    "Caja Huancayo",
    "Santander",
    "Crediscotia",
    "Falabella",
    "Ripley",
    "Otro"
];


// Types
type Banco = {
    id: string;
    nombre: string;
    activo: boolean;
    moneda?: string;
    numeroCuenta?: string;
};

type Cliente = {
    id: string;
    nombre: string;
    tipoDocumento: string;
    numeroDocumento: string;
};

type Adelanto = {
    id: string;
    facturaRelacionada: string;
    numeroOperacion: string;
    clienteId: string;
    clienteNombre: string; // Store name for easier display
    moneda: "PEN" | "USD";
    monto: number;
    fecha: Date; // Firestore Timestamp
    estado: "pendiente" | "aprobado" | "rechazado" | "pagado";
    bancoOrigenId: string;
    bancoOrigenNombre: string;
    bancoDestino: string;
    montoFactura?: number; // Replaced tipoCambio
    monedaCuentaDestino?: "PEN" | "USD"; // Added field
    cuentaDestino: string;
    descripcion?: string;
    timestamp: Date;
};



export default function AdelantosPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<unknown>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Data States
    const [adelantos, setAdelantos] = useState<Adelanto[]>([]);
    const [bancos, setBancos] = useState<Banco[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        facturaRelacionada: "",
        numeroOperacion: "",
        clienteId: "",
        tipoDocumento: "RUC",
        numeroDocumento: "",
        moneda: "USD" as "PEN" | "USD",
        monto: 0,
        montoFactura: 0,
        fecha: new Date().toISOString().split('T')[0],
        estado: "pendiente" as "pendiente" | "aprobado" | "rechazado" | "pagado",
        bancoOrigenId: "",
        bancoDestino: "",
        monedaCuentaDestino: "PEN" as "PEN" | "USD",
        cuentaDestino: "",
        descripcion: ""
    });
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [filterEstado, setFilterEstado] = useState("todos");

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
        });

        // Fetch Clientes (Assuming 'clientes' collection exists)
        const qClientes = query(collection(db, "clientes"), orderBy("nombre"));
        const unsubClientes = onSnapshot(qClientes, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                nombre: doc.data().nombre || doc.data().razonSocial,
                tipoDocumento: doc.data().tipoDocumento || "RUC",
                numeroDocumento: doc.data().numeroDocumento || doc.data().ruc || doc.data().dni || ""
            })) as Cliente[];
            setClientes(data);
        });

        // Fetch Adelantos
        const qAdelantos = query(collection(db, "finanzas_adelantos"), orderBy("timestamp", "desc"));
        const unsubAdelantos = onSnapshot(qAdelantos, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    fecha: d.fecha?.toDate(),
                    timestamp: d.timestamp?.toDate()
                };
            }) as Adelanto[];
            setAdelantos(data);
        });

        return () => {
            unsubBancos();
            unsubClientes();
            unsubAdelantos();
        };
    }, [currentUser]);

    const resetForm = () => {
        setFormData({
            facturaRelacionada: "",
            numeroOperacion: "",
            clienteId: "",
            tipoDocumento: "RUC",
            numeroDocumento: "",
            moneda: "USD",
            monto: 0,
            montoFactura: 0,
            fecha: new Date().toISOString().split('T')[0],
            estado: "pendiente",
            bancoOrigenId: "",
            bancoDestino: "",
            monedaCuentaDestino: "PEN",
            cuentaDestino: "",
            descripcion: ""
        });
        setErrors({});
        setEditingId(null);
        setIsReadOnly(false);
    };

    const openDialog = (mode: 'create' | 'edit' | 'view', adelanto?: Adelanto) => {
        resetForm();
        if (mode !== 'create' && adelanto) {
            setFormData({
                facturaRelacionada: adelanto.facturaRelacionada,
                numeroOperacion: adelanto.numeroOperacion,
                clienteId: adelanto.clienteId,
                tipoDocumento: "RUC", // Default or fetch
                numeroDocumento: "", // Computed below
                moneda: adelanto.moneda,
                monto: adelanto.monto,
                montoFactura: adelanto.montoFactura || 0,
                fecha: adelanto.fecha.toISOString().split('T')[0],
                estado: adelanto.estado,
                bancoOrigenId: adelanto.bancoOrigenId,
                bancoDestino: adelanto.bancoDestino,
                monedaCuentaDestino: adelanto.monedaCuentaDestino || "PEN",
                cuentaDestino: adelanto.cuentaDestino,
                descripcion: adelanto.descripcion || ""
            });
            // Try to find helper data
            const relatedClient = clientes.find(c => c.id === adelanto.clienteId);
            if (relatedClient) {
                setFormData(prev => ({
                    ...prev,
                    tipoDocumento: relatedClient.tipoDocumento,
                    numeroDocumento: relatedClient.numeroDocumento
                }));
            }
            setEditingId(adelanto.id);
            setIsReadOnly(mode === 'view');
        }
        setShowDialog(true);
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.facturaRelacionada) newErrors.facturaRelacionada = "Requerido";
        if (!formData.numeroOperacion) newErrors.numeroOperacion = "Requerido";
        if (!formData.clienteId) newErrors.clienteId = "Requerido";
        if (formData.monto <= 0) newErrors.monto = "Debe ser mayor a 0";
        if (!formData.fecha) newErrors.fecha = "Requerido";
        if (!formData.bancoOrigenId) newErrors.bancoOrigenId = "Requerido";
        if (!formData.bancoDestino) newErrors.bancoDestino = "Requerido";
        if (!formData.cuentaDestino) newErrors.cuentaDestino = "Requerido";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };



    const handleCancelEdit = () => {
        resetForm();
    };

    const saveClientToFirestore = async (clientData: Record<string, unknown>, docId: string) => {
        try {
            await setDoc(doc(db, "clientes", docId), clientData, { merge: true });
        } catch (error) {
            console.error("Error saving client to Firestore:", error);
        }
    };

    const handleSearchClient = async () => {
        if (!formData.numeroDocumento) return;
        const searchTerm = formData.numeroDocumento.trim();

        // 1. Check Local State (Fastest)
        const match = clientes.find(c => c.numeroDocumento === searchTerm);

        if (match) {
            setFormData(prev => ({
                ...prev,
                clienteId: match.id,
                tipoDocumento: match.tipoDocumento
            }));
            Swal.fire({
                icon: 'success',
                title: `Cliente seleccionado: ${match.nombre}`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
            return;
        }

        // 2. Fallback to API
        console.log(`Searching API for ${formData.tipoDocumento}: ${searchTerm}`);
        try {
            const endpoint = formData.tipoDocumento === "DNI"
                ? `/api/sunat/dni?dni=${searchTerm}`
                : `/api/sunat/ruc?ruc=${searchTerm}`;

            const res = await fetch(endpoint);
            const result = await res.json();
            console.log("API Result:", result);

            if (result.success && result.data) {
                const apiData = result.data;
                const name = formData.tipoDocumento === "DNI" ? apiData.nombre_completo : apiData.nombre_o_razon_social;
                const address = apiData.direccion_completa || apiData.direccion || "";

                const clientDataToSave = {
                    nombre: name || "",
                    razonSocial: name || "",
                    direccion: address,
                    estado: apiData.estado || "",
                    condicion: apiData.condicion || "",
                    departamento: apiData.departamento || "",
                    provincia: apiData.provincia || "",
                    distrito: apiData.distrito || "",
                    tipoDocumento: formData.tipoDocumento,
                    numeroDocumento: searchTerm,
                    updatedAt: new Date()
                };

                // Save to Firestore
                await saveClientToFirestore(clientDataToSave, searchTerm);

                setFormData(prev => ({
                    ...prev,
                    clienteId: searchTerm, // We used numDoc as ID
                    tipoDocumento: formData.tipoDocumento
                }));

                Swal.fire({
                    icon: 'success',
                    title: `Cliente encontrado y registrado: ${name}`,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });

            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'No encontrado',
                    text: result.error || result.message || 'No se encontró un cliente con este número de documento en la base de datos ni en SUNAT/RENIEC.',
                    confirmButtonColor: '#3b82f6'
                });
            }
        } catch (error) {
            console.error("API Error:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error de búsqueda',
                text: 'Hubo un problema al consultar la API externa.',
            });
        }
    };

    const handleSave = async () => {
        if (!validateForm()) return;



        try {
            const cliente = clientes.find(c => c.id === formData.clienteId);
            const banco = bancos.find(b => b.id === formData.bancoOrigenId);

            const data = {
                ...formData,
                clienteNombre: cliente?.nombre || "Desconocido",
                bancoOrigenNombre: banco?.nombre || "Desconocido",
                fecha: new Date(formData.fecha), // Convert string to Date
                timestamp: new Date()
            };

            if (editingId) {
                await updateDoc(doc(db, "finanzas_adelantos", editingId), data);
                Swal.fire({
                    icon: 'success',
                    title: 'Adelanto actualizado',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                await addDoc(collection(db, "finanzas_adelantos"), data);
                Swal.fire({
                    icon: 'success',
                    title: 'Adelanto registrado',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                });
            }
            setShowDialog(false);
        } catch (error) {
            console.error("Error saving adelanto:", error);
            Swal.fire('Error', 'No se pudo guardar el adelanto', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const result = await Swal.fire({
                title: '¿Eliminar adelanto?',
                text: "Esta acción no se puede deshacer",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await deleteDoc(doc(db, "finanzas_adelantos", id));
                Swal.fire('Eliminado', 'El adelanto ha sido eliminado.', 'success');
            }
        } catch (error) {
            console.error("Error deleting adelanto:", error);
            Swal.fire('Error', 'No se pudo eliminar el adelanto', 'error');
        }
    };

    const filteredAdelantos = adelantos.filter(a => {
        const matchesSearch =
            a.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.facturaRelacionada.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.numeroOperacion.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesEstado = filterEstado === "todos" || a.estado === filterEstado;
        return matchesSearch && matchesEstado;
    });

    if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Adelantos</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gestión de adelantos y préstamos</p>
                </div>
                <button
                    onClick={() => openDialog('create')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                    <PlusIcon className="w-5 h-5" />
                    Nuevo Adelanto
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por cliente, factura o operación..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <FunnelIcon className="w-5 h-5 text-gray-400" />
                    <div className="w-48">
                        <Select
                            value={filterEstado}
                            onChange={(e) => setFilterEstado(e.target.value)}
                        >
                            <option value="todos">Todos los estados</option>
                            <option value="pendiente">Pendiente</option>
                            <option value="aprobado">Aprobado</option>
                            <option value="rechazado">Rechazado</option>
                            <option value="pagado">Pagado</option>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente / Lote</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Factura</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monto</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {filteredAdelantos.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        No se encontraron adelantos
                                    </td>
                                </tr>
                            ) : (
                                filteredAdelantos.map((adelanto) => (
                                    <tr key={adelanto.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                            {format(adelanto.fecha, "dd/MM/yyyy")}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{adelanto.clienteNombre}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Op: {adelanto.numeroOperacion}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                            {adelanto.facturaRelacionada}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                            {adelanto.moneda === "PEN" ? "S/ " : "$ "}
                                            {adelanto.monto.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${adelanto.estado === 'aprobado' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                adelanto.estado === 'pagado' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                    adelanto.estado === 'rechazado' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                }`}>
                                                {adelanto.estado.charAt(0).toUpperCase() + adelanto.estado.slice(1)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openDialog('view', adelanto)}
                                                    className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                    title="Ver detalles"
                                                >
                                                    <MagnifyingGlassIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => openDialog('edit', adelanto)}
                                                    className="text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors"
                                                    title="Editar"
                                                >
                                                    <PencilIcon className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(adelanto.id)}
                                                    className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Dialog */}
            <Dialog
                isOpen={showDialog}
                onClose={() => setShowDialog(false)}
                title={isReadOnly ? 'Detalles del Adelanto' : editingId ? 'Editar Adelanto' : 'Nuevo Adelanto'}
                maxWidth="max-w-4xl"
            >
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Row 1: Document Type & Number */}
                        <div className="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
                            <div>
                                <label className={labelClass}>Tipo Documento</label>
                                <Select
                                    value={formData.tipoDocumento}
                                    onChange={(e) => setFormData({ ...formData, tipoDocumento: e.target.value })}
                                    disabled={isReadOnly}
                                >
                                    <option value="RUC">RUC</option>
                                    <option value="DNI">DNI</option>
                                    <option value="CE">CE</option>
                                </Select>
                            </div>

                            <div>
                                <label className={labelClass}>Número Documento</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.numeroDocumento}
                                        onChange={(e) => setFormData({ ...formData, numeroDocumento: e.target.value })}
                                        disabled={isReadOnly}
                                        placeholder="Número"
                                        className={`${inputClass} pr-10`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSearchClient();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSearchClient}
                                        disabled={isReadOnly}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                        title="Buscar Cliente"
                                    >
                                        <MagnifyingGlassIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Client Name (Select) */}
                        <div className="col-span-1 md:col-span-2">
                            <label className={labelClass}>Nombre o Razón Social <span className="text-red-500">*</span></label>
                            <Select
                                value={formData.clienteId}
                                onChange={(e) => {
                                    const selectedId = e.target.value;
                                    const client = clientes.find(c => c.id === selectedId);
                                    setFormData({
                                        ...formData,
                                        clienteId: selectedId,
                                        tipoDocumento: client?.tipoDocumento || "RUC",
                                        numeroDocumento: client?.numeroDocumento || ""
                                    });
                                }}
                                disabled={isReadOnly}
                            >
                                <option value="">Seleccionar Cliente...</option>
                                {clientes.map(c => (
                                    <option key={c.id} value={c.id}>{c.nombre}</option>
                                ))}
                            </Select>
                            {errors.clienteId && <p className="mt-1 text-xs text-red-500">{errors.clienteId}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>Factura Relacionada / Lote <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.facturaRelacionada}
                                onChange={(e) => setFormData({ ...formData, facturaRelacionada: e.target.value })}
                                disabled={isReadOnly}
                                placeholder="F001-0000123"
                                className={inputClass}
                            />
                            {errors.facturaRelacionada && <p className="mt-1 text-xs text-red-500">{errors.facturaRelacionada}</p>}
                        </div>

                        <div>
                            <label className={labelClass}>Monto 100% Factura</label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.montoFactura}
                                onChange={(e) => setFormData({ ...formData, montoFactura: parseFloat(e.target.value) || 0 })}
                                disabled={isReadOnly}
                                placeholder="0.00"
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Fecha de Factura <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                value={formData.fecha}
                                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                disabled={isReadOnly}
                                className={inputClass}
                            />
                            {errors.fecha && <p className="mt-1 text-xs text-red-500">{errors.fecha}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>Estado <span className="text-red-500">*</span></label>
                            <Select
                                value={formData.estado}
                                onChange={(e) => setFormData({ ...formData, estado: e.target.value as any })}
                                disabled={isReadOnly}
                            >
                                <option value="pendiente">Pendiente</option>
                                <option value="aprobado">Aprobado</option>
                                <option value="rechazado">Rechazado</option>
                                <option value="pagado">Pagado</option>
                            </Select>
                        </div>

                        <div>
                            <label className={labelClass}>Monto <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.monto}
                                onChange={(e) => setFormData({ ...formData, monto: parseFloat(e.target.value) || 0 })}
                                disabled={isReadOnly}
                                className={inputClass}
                            />
                            {errors.monto && <p className="mt-1 text-xs text-red-500">{errors.monto}</p>}
                        </div>
                        <div>
                            <label className={labelClass}>Moneda <span className="text-red-500">*</span></label>
                            <Select
                                value={formData.moneda}
                                onChange={(e) => setFormData({ ...formData, moneda: e.target.value as "PEN" | "USD" })}
                                disabled={isReadOnly}
                            >
                                <option value="USD">Dólares (USD)</option>
                                <option value="PEN">Soles (PEN)</option>
                            </Select>
                        </div>
                    </div>

                    <hr className="border-gray-200 dark:border-zinc-800 my-4" />

                    {/* Section: Bank Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Banco Origen <span className="text-red-500">*</span></label>
                            <Select
                                value={formData.bancoOrigenId}
                                onChange={(e) => setFormData({ ...formData, bancoOrigenId: e.target.value })}
                                disabled={isReadOnly}
                            >
                                <option value="">Seleccionar Banco...</option>
                                {bancos.map(b => (
                                    <option key={b.id} value={b.id}>{b.nombre} ({b.moneda}) - {b.numeroCuenta}</option>
                                ))}
                            </Select>
                            {errors.bancoOrigenId && <p className="mt-1 text-xs text-red-500">{errors.bancoOrigenId}</p>}
                        </div>
                        <div>
                            <label className={labelClass}>N° Operación Bancaria <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.numeroOperacion}
                                onChange={(e) => setFormData({ ...formData, numeroOperacion: e.target.value })}
                                disabled={isReadOnly}
                                placeholder="Ej: 12345678"
                                className={inputClass}
                            />
                            {errors.numeroOperacion && <p className="mt-1 text-xs text-red-500">{errors.numeroOperacion}</p>}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Banco Destino <span className="text-red-500">*</span></label>
                            <Select
                                value={formData.bancoDestino}
                                onChange={(e) => setFormData({ ...formData, bancoDestino: e.target.value })}
                                disabled={isReadOnly}
                            >
                                <option value="">Seleccionar Banco...</option>
                                {LISTA_BANCOS.map((b, i) => (
                                    <option key={i} value={b}>{b}</option>
                                ))}
                            </Select>
                            {errors.bancoDestino && <p className="mt-1 text-xs text-red-500">{errors.bancoDestino}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Moneda Destino</label>
                                <Select
                                    value={formData.monedaCuentaDestino}
                                    onChange={(e) => setFormData({ ...formData, monedaCuentaDestino: e.target.value as "PEN" | "USD" })}
                                    disabled={isReadOnly}
                                >
                                    <option value="PEN">Soles</option>
                                    <option value="USD">Dólares</option>
                                </Select>
                            </div>
                            <div>
                                <label className={labelClass}>N° Cuenta Destino</label>
                                <input
                                    type="text"
                                    value={formData.cuentaDestino}
                                    onChange={(e) => setFormData({ ...formData, cuentaDestino: e.target.value })}
                                    disabled={isReadOnly}
                                    placeholder="N° Cuenta"
                                    className={inputClass}
                                />
                                {errors.cuentaDestino && <p className="mt-1 text-xs text-red-500">{errors.cuentaDestino}</p>}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Descripción (Opcional)</label>
                        <textarea
                            value={formData.descripcion}
                            onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                            disabled={isReadOnly}
                            rows={3}
                            className={`${inputClass} resize-none`}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                    <button
                        onClick={() => setShowDialog(false)}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition font-medium"
                    >
                        Cerrar
                    </button>
                    {!isReadOnly && (
                        <button
                            onClick={handleSave}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-lg shadow-blue-600/20"
                        >
                            {editingId ? 'Guardar Cambios' : 'Registrar Adelanto'}
                        </button>
                    )}
                </div>
            </Dialog>
        </div>
    );
}