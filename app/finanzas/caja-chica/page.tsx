"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, deleteDoc, onSnapshot, query, orderBy, doc, where, updateDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
    ArchiveBoxIcon,
    PlusIcon,
    MinusIcon,
    CurrencyDollarIcon,
    CalendarIcon,
    TrashIcon,
    CheckCircleIcon,
    XCircleIcon,
    ClockIcon,
    MagnifyingGlassIcon,
    KeyIcon
} from "@heroicons/react/24/outline";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createNotification } from "@/lib/notifications";
import { exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { ArrowDownTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useRef } from "react";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

type Caja = {
    id: string;
    nombre: string;
    saldo: number;
    estado: 'activa' | 'cerrada';
    fechaCreacion: any;
};

type Solicitud = {
    id: string;
    cajaId: string;
    tipoDocumento: 'DNI' | 'RUC';
    numeroDocumento: string;
    beneficiario: string;
    areaId: string;
    categoriaId: string;
    monto: number;
    descripcion: string;
    tipoComprobante?: 'Ticket' | 'Boleta' | 'Factura' | 'Recibo' | 'Otro';
    numeroComprobante?: string;
    estado: 'pendiente' | 'aprobado' | 'rechazado';
    fechaSolicitud: any;
    fechaAprobacion?: any;
    usuarioSolicitanteId: string;
    usuarioAprobadorId?: string;
};

type Movimiento = {
    id: string;
    cajaId: string;
    tipo: 'ingreso' | 'egreso' | 'apertura';
    monto: number;
    descripcion: string;
    fecha: any;
    usuarioId: string;
    solicitudId?: string; // Link to the approved request
};

type Area = { id: string; nombre: string; };
type Categoria = { id: string; nombre: string; };

export default function CajaChicaPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'solicitudes' | 'historial'>('solicitudes');

    // Data State
    const [cajas, setCajas] = useState<Caja[]>([]);
    const [selectedCajaId, setSelectedCajaId] = useState<string>("");
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [areas, setAreas] = useState<Area[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);

    // UI State
    const [showCreateCajaModal, setShowCreateCajaModal] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showDepositModal, setShowDepositModal] = useState(false); // For adding funds/opening

    // Request Form State
    const [reqDocType, setReqDocType] = useState<'DNI' | 'RUC'>('DNI');
    const [reqDocNum, setReqDocNum] = useState("");
    const [reqBeneficiary, setReqBeneficiary] = useState("");
    const [reqArea, setReqArea] = useState("");
    const [reqCategory, setReqCategory] = useState("");
    const [reqAmount, setReqAmount] = useState("");
    const [reqDesc, setReqDesc] = useState("");
    const [reqComprobanteType, setReqComprobanteType] = useState<'Ticket' | 'Boleta' | 'Factura' | 'Recibo' | 'Otro'>('Boleta');
    const [reqComprobanteNum, setReqComprobanteNum] = useState("");
    const [isSearchingClient, setIsSearchingClient] = useState(false);

    // Deposit Form State
    const [depositAmount, setDepositAmount] = useState("");
    const [depositDesc, setDepositDesc] = useState("");
    const [depositType, setDepositType] = useState<'ingreso' | 'apertura'>('ingreso');

    const [newCajaNombre, setNewCajaNombre] = useState("");

    // Chart Ref
    const chartRef = useRef<any>(null);

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

    // Fetch Initial Data (Cajas, Areas, Categorias)
    useEffect(() => {
        if (!currentUser) return;

        // Cajas
        const qCajas = query(collection(db, "finanzas_cajas"), orderBy("fechaCreacion", "desc"));
        const unsubCajas = onSnapshot(qCajas, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Caja[];
            setCajas(data);
            if (data.length > 0) {
                setSelectedCajaId(prev => prev || data[0].id);
            }
        });

        // Areas
        const qAreas = query(collection(db, "finanzas_areas"), orderBy("nombre"));
        const unsubAreas = onSnapshot(qAreas, (snapshot) => {
            setAreas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Area)));
        });

        // Categorias
        const qCategorias = query(collection(db, "finanzas_categorias"), orderBy("nombre"));
        const unsubCategorias = onSnapshot(qCategorias, (snapshot) => {
            setCategorias(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Categoria)));
        });

        return () => {
            unsubCajas();
            unsubAreas();
            unsubCategorias();
        };
    }, [currentUser]);

    // Fetch Solicitudes and Movimientos for Selected Caja
    useEffect(() => {
        if (!selectedCajaId) {
            setSolicitudes([]);
            setMovimientos([]);
            return;
        }

        // Solicitudes
        const qSolicitudes = query(
            collection(db, "finanzas_caja_solicitudes"),
            where("cajaId", "==", selectedCajaId)
        );
        const unsubSolicitudes = onSnapshot(qSolicitudes, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Solicitud[];
            // Sort locally
            data.sort((a, b) => {
                const dateA = a.fechaSolicitud?.seconds || 0;
                const dateB = b.fechaSolicitud?.seconds || 0;
                return dateB - dateA;
            });
            setSolicitudes(data);
        });

        // Movimientos
        const qMovimientos = query(
            collection(db, "finanzas_caja_movimientos"),
            where("cajaId", "==", selectedCajaId)
        );
        const unsubMovimientos = onSnapshot(qMovimientos, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Movimiento[];
            data.sort((a, b) => {
                const dateA = a.fecha?.seconds || 0;
                const dateB = b.fecha?.seconds || 0;
                return dateB - dateA;
            });
            setMovimientos(data);
        });

        return () => {
            unsubSolicitudes();
            unsubMovimientos();
        };
    }, [selectedCajaId]);

    // Handlers
    const handleCreateCaja = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCajaNombre.trim()) return;

        try {
            const docRef = await addDoc(collection(db, "finanzas_cajas"), {
                nombre: newCajaNombre.trim(),
                saldo: 0,
                estado: 'activa',
                fechaCreacion: serverTimestamp()
            });
            setNewCajaNombre("");
            setShowCreateCajaModal(false);
            setSelectedCajaId(docRef.id);
            Swal.fire('Éxito', 'Caja creada correctamente', 'success');
        } catch (error) {
            console.error("Error creating caja:", error);
            Swal.fire('Error', 'No se pudo crear la caja', 'error');
        }
    };

    const handleSearchBeneficiary = async () => {
        if (!reqDocNum.trim()) return;
        setIsSearchingClient(true);
        try {
            // 1. Search Local DB
            const q = query(collection(db, "clientes"), where("numeroDocumento", "==", reqDocNum.trim()));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const clientData = snapshot.docs[0].data();
                setReqBeneficiary(clientData.razonSocial || clientData.nombre || "");
                Swal.fire({
                    icon: 'success',
                    title: 'Cliente encontrado',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000
                });
            } else {
                // 2. Search External API
                Swal.fire({
                    title: 'Buscando en SUNAT/RENIEC...',
                    didOpen: () => Swal.showLoading(),
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false
                });

                const endpoint = reqDocType === 'DNI'
                    ? `/api/sunat/dni?dni=${reqDocNum.trim()}`
                    : `/api/sunat/ruc?ruc=${reqDocNum.trim()}`;

                const response = await fetch(endpoint);
                const data = await response.json();

                if (data.success) {
                    const clientData = data.data;
                    let newClient: any = {
                        tipoDocumento: reqDocType,
                        numeroDocumento: reqDocNum.trim(),
                        estado: 'ACTIVO', // Default
                        condicion: 'HABIDO', // Default
                        updatedAt: serverTimestamp()
                    };

                    let nameToDisplay = "";

                    if (reqDocType === 'DNI') {
                        nameToDisplay = clientData.nombre_completo;
                        newClient.nombre = nameToDisplay;
                        newClient.direccion = clientData.direccion || '-';
                        newClient.departamento = clientData.departamento || '-';
                        newClient.provincia = clientData.provincia || '-';
                        newClient.distrito = clientData.distrito || '-';
                    } else {
                        nameToDisplay = clientData.nombre_o_razon_social;
                        newClient.nombre = nameToDisplay; // Unified field for display
                        newClient.razonSocial = nameToDisplay;
                        newClient.direccion = clientData.direccion || '-';
                        newClient.departamento = clientData.departamento || '-';
                        newClient.provincia = clientData.provincia || '-';
                        newClient.distrito = clientData.distrito || '-';
                        newClient.estado = clientData.estado || 'ACTIVO';
                        newClient.condicion = clientData.condicion || 'HABIDO';
                    }

                    // 3. Save to Firestore
                    await addDoc(collection(db, "clientes"), newClient);

                    setReqBeneficiary(nameToDisplay);
                    Swal.fire({
                        icon: 'success',
                        title: 'Cliente encontrado y registrado',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                } else {
                    Swal.fire({
                        icon: 'info',
                        title: 'No encontrado',
                        text: 'El cliente no se encontró en SUNAT/RENIEC. Ingrese el nombre manualmente.',
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 3000
                    });
                    setReqBeneficiary("");
                }
            }
        } catch (error) {
            console.error("Error searching client:", error);
            Swal.fire('Error', 'Ocurrió un error al buscar el cliente', 'error');
        } finally {
            setIsSearchingClient(false);
        }
    };

    const handleSubmitRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCajaId || !reqAmount || !reqBeneficiary || !reqArea || !reqCategory) return;

        try {
            await addDoc(collection(db, "finanzas_caja_solicitudes"), {
                cajaId: selectedCajaId,
                tipoDocumento: reqDocType,
                numeroDocumento: reqDocNum,
                beneficiario: reqBeneficiary,
                areaId: reqArea,
                categoriaId: reqCategory,
                monto: parseFloat(reqAmount),
                descripcion: reqDesc,
                tipoComprobante: reqComprobanteType,
                numeroComprobante: reqComprobanteNum,
                estado: 'pendiente',
                fechaSolicitud: serverTimestamp(),
                usuarioSolicitanteId: currentUser.uid
            });

            setReqDocNum("");
            setReqBeneficiary("");
            setReqAmount("");
            setReqDesc("");
            setReqComprobanteNum("");
            setReqArea("");
            setReqCategory("");
            setShowRequestModal(false);

            await createNotification({
                userId: currentUser.uid,
                titulo: 'Solicitud Creada',
                mensaje: `Se ha creado una solicitud por S/ ${reqAmount}`,
                tipo: 'info',
                link: '/finanzas/caja-chica'
            });

            Swal.fire('Solicitud Enviada', 'La solicitud está pendiente de aprobación', 'success');
        } catch (error) {
            console.error("Error creating request:", error);
            Swal.fire('Error', 'No se pudo crear la solicitud', 'error');
        }
    };

    const handleApproveRequest = async (solicitud: Solicitud) => {
        const currentCaja = cajas.find(c => c.id === selectedCajaId);
        if (!currentCaja) return;

        if (currentCaja.saldo < solicitud.monto) {
            Swal.fire('Error', 'Saldo insuficiente en la caja para aprobar esta solicitud', 'error');
            return;
        }

        try {
            const result = await Swal.fire({
                title: '¿Aprobar Solicitud?',
                text: `Se descontarán S/ ${solicitud.monto.toFixed(2)} de la caja.`,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Sí, Aprobar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                // 1. Update Solicitud Status
                await updateDoc(doc(db, "finanzas_caja_solicitudes", solicitud.id), {
                    estado: 'aprobado',
                    fechaAprobacion: serverTimestamp(),
                    usuarioAprobadorId: currentUser.uid
                });

                // 2. Create Movimiento (Egreso)
                await addDoc(collection(db, "finanzas_caja_movimientos"), {
                    cajaId: selectedCajaId,
                    tipo: 'egreso',
                    monto: solicitud.monto,
                    descripcion: `[Solicitud Aprobada] ${solicitud.descripcion} - ${solicitud.beneficiario}`,
                    fecha: serverTimestamp(),
                    usuarioId: currentUser.uid,
                    solicitudId: solicitud.id
                });

                // 3. Update Caja Balance
                await updateDoc(doc(db, "finanzas_cajas", selectedCajaId), {
                    saldo: currentCaja.saldo - solicitud.monto
                });

                await createNotification({
                    userId: solicitud.usuarioSolicitanteId,
                    titulo: 'Solicitud Aprobada',
                    mensaje: `Tu solicitud por S/ ${solicitud.monto.toFixed(2)} ha sido aprobada.`,
                    tipo: 'success',
                    link: '/finanzas/caja-chica'
                });

                Swal.fire('Aprobado', 'La solicitud ha sido aprobada y el saldo actualizado', 'success');
            }
        } catch (error) {
            console.error("Error approving request:", error);
            Swal.fire('Error', 'No se pudo aprobar la solicitud', 'error');
        }
    };

    const handleRejectRequest = async (solicitud: Solicitud) => {
        try {
            const result = await Swal.fire({
                title: '¿Rechazar Solicitud?',
                text: "Esta acción no se puede deshacer.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Sí, Rechazar',
                cancelButtonText: 'Cancelar'
            });

            if (result.isConfirmed) {
                await updateDoc(doc(db, "finanzas_caja_solicitudes", solicitud.id), {
                    estado: 'rechazado',
                    fechaAprobacion: serverTimestamp(), // Using this field for rejection date too
                    usuarioAprobadorId: currentUser.uid
                });

                await createNotification({
                    userId: solicitud.usuarioSolicitanteId,
                    titulo: 'Solicitud Rechazada',
                    mensaje: `Tu solicitud por S/ ${solicitud.monto.toFixed(2)} ha sido rechazada.`,
                    tipo: 'error',
                    link: '/finanzas/caja-chica'
                });

                Swal.fire('Rechazado', 'La solicitud ha sido rechazada', 'success');
            }
        } catch (error) {
            console.error("Error rejecting request:", error);
            Swal.fire('Error', 'No se pudo rechazar la solicitud', 'error');
        }
    };

    const handleDeposit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCajaId || !depositAmount || !depositDesc) return;

        const amount = parseFloat(depositAmount);
        if (isNaN(amount) || amount <= 0) return;

        const currentCaja = cajas.find(c => c.id === selectedCajaId);
        if (!currentCaja) return;

        try {
            // 1. Create Movimiento
            await addDoc(collection(db, "finanzas_caja_movimientos"), {
                cajaId: selectedCajaId,
                tipo: depositType,
                monto: amount,
                descripcion: depositDesc,
                fecha: serverTimestamp(),
                usuarioId: currentUser.uid
            });

            // 2. Update Balance
            await updateDoc(doc(db, "finanzas_cajas", selectedCajaId), {
                saldo: currentCaja.saldo + amount
            });

            setDepositAmount("");
            setDepositDesc("");
            setShowDepositModal(false);

            Swal.fire('Éxito', 'Fondos ingresados correctamente', 'success');
        } catch (error) {
            console.error("Error depositing funds:", error);
            Swal.fire('Error', 'No se pudo registrar el ingreso', 'error');
        }
    };

    const handleDeleteCaja = async () => {
        if (!selectedCajaId) return;
        const currentCaja = cajas.find(c => c.id === selectedCajaId);
        if (currentCaja && currentCaja.saldo > 0) {
            Swal.fire('Error', 'No se puede eliminar una caja con saldo positivo', 'error');
            return;
        }

        const result = await Swal.fire({
            title: '¿Eliminar caja?',
            text: "Se eliminarán todos los registros asociados.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "finanzas_cajas", selectedCajaId));
                setSelectedCajaId("");
                Swal.fire('Eliminado', 'Caja eliminada', 'success');
            } catch (error) {
                console.error("Error deleting caja:", error);
            }
        }
    };

    const handleExportConsolidated = () => {
        if (!selectedCajaId) return;
        const approvedRequests = solicitudes.filter(s => s.estado === 'aprobado');

        // Group by Category
        const categorySummary: { [key: string]: number } = {};
        approvedRequests.forEach(req => {
            const catName = categorias.find(c => c.id === req.categoriaId)?.nombre || 'Sin Categoría';
            categorySummary[catName] = (categorySummary[catName] || 0) + req.monto;
        });

        const data = Object.entries(categorySummary).map(([categoria, total]) => ({
            'Categoría': categoria,
            'Total (S/)': total.toFixed(2)
        }));

        exportToExcel(data, `Consolidado_Caja_${format(new Date(), 'yyyyMMdd')}`, 'Por Categoría');
    };

    const handleExportDetailed = () => {
        if (!selectedCajaId) return;

        const data = movimientos.map(mov => {
            let details = {
                beneficiario: '-',
                documento: '-',
                area: '-',
                categoria: '-',
                comprobante: '-'
            };

            if (mov.tipo === 'egreso' && mov.solicitudId) {
                const sol = solicitudes.find(s => s.id === mov.solicitudId);
                if (sol) {
                    const area = areas.find(a => a.id === sol.areaId)?.nombre || 'N/A';
                    const categoria = categorias.find(c => c.id === sol.categoriaId)?.nombre || 'N/A';
                    details = {
                        beneficiario: sol.beneficiario,
                        documento: `${sol.tipoDocumento} ${sol.numeroDocumento}`,
                        area: area,
                        categoria: categoria,
                        comprobante: `${sol.tipoComprobante || ''} ${sol.numeroComprobante || ''}`.trim() || '-'
                    };
                }
            }

            return {
                'Fecha': mov.fecha ? format(mov.fecha.toDate(), 'dd/MM/yyyy HH:mm') : '-',
                'Tipo': mov.tipo.charAt(0).toUpperCase() + mov.tipo.slice(1),
                'Descripción': mov.descripcion,
                'Monto (S/)': mov.monto.toFixed(2),
                'Beneficiario': details.beneficiario,
                'Documento': details.documento,
                'Área': details.area,
                'Categoría': details.categoria,
                'Comprobante': details.comprobante
            };
        });

        exportToExcel(data, `Detallado_Caja_${format(new Date(), 'yyyyMMdd')}`, 'Transacciones');
    };

    const handleExportConsolidatedPDF = () => {
        if (!selectedCajaId) return;
        const approvedRequests = solicitudes.filter(s => s.estado === 'aprobado');

        const categorySummary: { [key: string]: number } = {};
        approvedRequests.forEach(req => {
            const catName = categorias.find(c => c.id === req.categoriaId)?.nombre || 'Sin Categoría';
            categorySummary[catName] = (categorySummary[catName] || 0) + req.monto;
        });

        const headers = ['Categoría', 'Total (S/)'];
        const data = Object.entries(categorySummary).map(([categoria, total]) => [
            categoria,
            total.toFixed(2)
        ]);



        let chartImage = undefined;
        if (chartRef.current) {
            chartImage = chartRef.current.toBase64Image();
        }

        exportToPDF(
            `Consolidado Caja Chica - ${selectedCaja?.nombre}`,
            headers,
            data,
            `Consolidado_Caja_${format(new Date(), 'yyyyMMdd')}`,
            'portrait',
            chartImage
        );
    };

    const handleExportDetailedPDF = () => {
        if (!selectedCajaId) return;

        const headers = ['Fecha', 'Tipo', 'Descripción', 'Monto', 'Beneficiario', 'Doc.', 'Área', 'Cat.', 'Comp.'];
        const data = movimientos.map(mov => {
            let details = {
                beneficiario: '-',
                documento: '-',
                area: '-',
                categoria: '-',
                comprobante: '-'
            };

            if (mov.tipo === 'egreso' && mov.solicitudId) {
                const sol = solicitudes.find(s => s.id === mov.solicitudId);
                if (sol) {
                    const area = areas.find(a => a.id === sol.areaId)?.nombre || 'N/A';
                    const categoria = categorias.find(c => c.id === sol.categoriaId)?.nombre || 'N/A';
                    details = {
                        beneficiario: sol.beneficiario,
                        documento: `${sol.tipoDocumento} ${sol.numeroDocumento}`,
                        area: area,
                        categoria: categoria,
                        comprobante: `${sol.tipoComprobante || ''} ${sol.numeroComprobante || ''}`.trim() || '-'
                    };
                }
            }

            return [
                mov.fecha ? format(mov.fecha.toDate(), 'dd/MM/yyyy HH:mm') : '-',
                mov.tipo.charAt(0).toUpperCase() + mov.tipo.slice(1),
                mov.descripcion,
                `S/ ${mov.monto.toFixed(2)}`,
                details.beneficiario,
                details.documento,
                details.area,
                details.categoria,
                details.comprobante
            ];
        });

        exportToPDF(
            `Detalle de Movimientos - ${selectedCaja?.nombre}`,
            headers,
            data,
            `Detallado_Caja_${format(new Date(), 'yyyyMMdd')}`,
            'landscape'
        );
    };

    if (isLoading) return <Skeleton className="h-64 w-full" />;
    if (!currentUser) return null;

    const selectedCaja = cajas.find(c => c.id === selectedCajaId);
    const pendingRequests = solicitudes.filter(s => s.estado === 'pendiente');
    const historyRequests = solicitudes.filter(s => s.estado !== 'pendiente');

    // Prepare Chart Data
    const approvedRequests = solicitudes.filter(s => s.estado === 'aprobado');
    const categorySummary: { [key: string]: number } = {};
    approvedRequests.forEach(req => {
        const catName = categorias.find(c => c.id === req.categoriaId)?.nombre || 'Sin Categoría';
        categorySummary[catName] = (categorySummary[catName] || 0) + req.monto;
    });

    const chartData = {
        labels: Object.keys(categorySummary),
        datasets: [
            {
                label: 'Gastos por Categoría',
                data: Object.values(categorySummary),
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 1,
            },
        ],
    };

    return (
        <div className="space-y-6">
            {/* Hidden Chart for PDF Export */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '800px', height: '400px' }}>
                <Bar ref={chartRef} data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
            </div>
            {/* Header & Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ArchiveBoxIcon className="w-8 h-8 text-blue-600" />
                        Caja Chica
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Gestión de solicitudes y control de gastos
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
                        title="Crear nueva caja"
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
                    <ArchiveBoxIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-zinc-600 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tienes cajas registradas</h3>
                    <button
                        onClick={() => setShowCreateCajaModal(true)}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium inline-flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Crear Primera Caja
                    </button>
                </div>
            ) : (
                <>
                    {/* Balance Card */}
                    <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <CurrencyDollarIcon className="w-32 h-32" />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div>
                                <p className="text-blue-100 font-medium mb-1">Saldo Disponible</p>
                                <h3 className="text-4xl font-bold">
                                    S/ {selectedCaja?.saldo.toFixed(2) || '0.00'}
                                </h3>
                            </div>
                            <div className="flex gap-3 items-end">
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-blue-100 font-medium ml-1">Consolidado</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleExportConsolidated}
                                            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition flex items-center gap-2 text-sm font-medium"
                                            title="Excel Consolidado"
                                        >
                                            <ArrowDownTrayIcon className="w-4 h-4" />
                                            Excel
                                        </button>
                                        <button
                                            onClick={handleExportConsolidatedPDF}
                                            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition flex items-center gap-2 text-sm font-medium"
                                            title="PDF Consolidado"
                                        >
                                            <DocumentTextIcon className="w-4 h-4" />
                                            PDF
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1 border-l border-white/20 pl-3">
                                    <span className="text-xs text-blue-100 font-medium ml-1">Detallado</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleExportDetailed}
                                            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition flex items-center gap-2 text-sm font-medium"
                                            title="Excel Detallado"
                                        >
                                            <ArrowDownTrayIcon className="w-4 h-4" />
                                            Excel
                                        </button>
                                        <button
                                            onClick={handleExportDetailedPDF}
                                            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition flex items-center gap-2 text-sm font-medium"
                                            title="PDF Detallado"
                                        >
                                            <DocumentTextIcon className="w-4 h-4" />
                                            PDF
                                        </button>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowRequestModal(true)}
                                    className="px-4 py-2 bg-white text-blue-700 hover:bg-blue-50 rounded-lg transition flex items-center gap-2 font-medium shadow-sm"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    Nueva Solicitud
                                </button>
                                <button
                                    onClick={() => {
                                        setDepositType('ingreso');
                                        setShowDepositModal(true);
                                    }}
                                    className="px-4 py-2 bg-blue-500/30 hover:bg-blue-500/40 backdrop-blur-sm rounded-lg transition flex items-center gap-2 font-medium border border-blue-400/30"
                                >
                                    <PlusIcon className="w-5 h-5" />
                                    Ingresar Fondos
                                </button>
                                {(selectedCaja?.saldo === 0 && movimientos.length === 0) && (
                                    <button
                                        onClick={() => {
                                            setDepositType('apertura');
                                            setShowDepositModal(true);
                                        }}
                                        className="px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 backdrop-blur-sm rounded-lg transition flex items-center gap-2 font-medium text-yellow-100 border border-yellow-400/30"
                                    >
                                        <KeyIcon className="w-5 h-5" />
                                        Apertura
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-gray-200 dark:border-zinc-800">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setActiveTab('solicitudes')}
                                className={`${activeTab === 'solicitudes'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                            >
                                <ClockIcon className="w-5 h-5" />
                                Solicitudes Pendientes
                                {pendingRequests.length > 0 && (
                                    <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                                        {pendingRequests.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('historial')}
                                className={`${activeTab === 'historial'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                            >
                                <ArchiveBoxIcon className="w-5 h-5" />
                                Historial de Solicitudes
                            </button>
                        </nav>
                    </div>

                    {/* Content */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Beneficiario</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Área / Categoría</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Descripción</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monto</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                                        {activeTab === 'solicitudes' && (
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                    {(activeTab === 'solicitudes' ? pendingRequests : historyRequests).length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                No hay solicitudes {activeTab === 'solicitudes' ? 'pendientes' : 'en el historial'}.
                                            </td>
                                        </tr>
                                    ) : (
                                        (activeTab === 'solicitudes' ? pendingRequests : historyRequests).map((solicitud) => {
                                            const area = areas.find(a => a.id === solicitud.areaId)?.nombre || 'N/A';
                                            const categoria = categorias.find(c => c.id === solicitud.categoriaId)?.nombre || 'N/A';
                                            return (
                                                <tr key={solicitud.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                        {solicitud.fechaSolicitud ? format(solicitud.fechaSolicitud.toDate(), "dd/MM/yyyy HH:mm", { locale: es }) : '-'}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                                        <div className="font-medium">{solicitud.beneficiario}</div>
                                                        <div className="text-xs text-gray-500">{solicitud.tipoDocumento}: {solicitud.numeroDocumento}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                                        <div className="font-medium">{area}</div>
                                                        <div className="text-xs text-gray-500">{categoria}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={solicitud.descripcion}>
                                                        {solicitud.descripcion}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-gray-900 dark:text-white">
                                                        S/ {solicitud.monto.toFixed(2)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${solicitud.estado === 'aprobado' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                            solicitud.estado === 'rechazado' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                            }`}>
                                                            {solicitud.estado.charAt(0).toUpperCase() + solicitud.estado.slice(1)}
                                                        </span>
                                                    </td>
                                                    {activeTab === 'solicitudes' && (
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={() => handleApproveRequest(solicitud)}
                                                                className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300 mr-3"
                                                                title="Aprobar"
                                                            >
                                                                <CheckCircleIcon className="w-6 h-6" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectRequest(solicitud)}
                                                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                                                title="Rechazar"
                                                            >
                                                                <XCircleIcon className="w-6 h-6" />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Modals */}
            {showCreateCajaModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nueva Caja Chica</h3>
                        <form onSubmit={handleCreateCaja}>
                            <input
                                type="text"
                                value={newCajaNombre}
                                onChange={(e) => setNewCajaNombre(e.target.value)}
                                placeholder="Nombre de la caja"
                                className="w-full px-4 py-2 mb-4 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg"
                                autoFocus
                            />
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setShowCreateCajaModal(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">Crear</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showRequestModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nueva Solicitud de Fondos</h3>
                        <form onSubmit={handleSubmitRequest} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo Documento</label>
                                    <select
                                        value={reqDocType}
                                        onChange={(e) => setReqDocType(e.target.value as 'DNI' | 'RUC')}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg"
                                    >
                                        <option value="DNI">DNI</option>
                                        <option value="RUC">RUC</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Número Documento</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={reqDocNum}
                                            onChange={(e) => setReqDocNum(e.target.value)}
                                            className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg"
                                            placeholder="Ingrese número"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSearchBeneficiary}
                                            disabled={isSearchingClient}
                                            className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                                            title="Buscar Cliente"
                                        >
                                            <MagnifyingGlassIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Beneficiario (Nombre / Razón Social)</label>
                                <input
                                    type="text"
                                    value={reqBeneficiary}
                                    onChange={(e) => setReqBeneficiary(e.target.value)}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg"
                                    placeholder="Nombre del beneficiario"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Área Solicitante</label>
                                    <select
                                        value={reqArea}
                                        onChange={(e) => setReqArea(e.target.value)}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg"
                                    >
                                        <option value="">Seleccionar Área</option>
                                        {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoría de Gasto</label>
                                    <select
                                        value={reqCategory}
                                        onChange={(e) => setReqCategory(e.target.value)}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg"
                                    >
                                        <option value="">Seleccionar Categoría</option>
                                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto (S/)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={reqAmount}
                                    onChange={(e) => setReqAmount(e.target.value)}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-lg"
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo Comprobante</label>
                                    <select
                                        value={reqComprobanteType}
                                        onChange={(e) => setReqComprobanteType(e.target.value as any)}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg"
                                    >
                                        <option value="Ticket">Ticket</option>
                                        <option value="Boleta">Boleta</option>
                                        <option value="Factura">Factura</option>
                                        <option value="Recibo">Recibo por Honorarios</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">N° Comprobante / Recibo</label>
                                    <input
                                        type="text"
                                        value={reqComprobanteNum}
                                        onChange={(e) => setReqComprobanteNum(e.target.value)}
                                        className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg"
                                        placeholder="Ej: B001-123456"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción / Motivo</label>
                                <textarea
                                    value={reqDesc}
                                    onChange={(e) => setReqDesc(e.target.value)}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg resize-none"
                                    placeholder="Detalle de la solicitud..."
                                />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setShowRequestModal(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">Enviar Solicitud</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showDepositModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            {depositType === 'apertura' ? 'Apertura de Caja' : 'Ingreso de Fondos'}
                        </h3>
                        <form onSubmit={handleDeposit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monto (S/)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg font-bold text-lg"
                                    placeholder="0.00"
                                    autoFocus
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                                <input
                                    type="text"
                                    value={depositDesc}
                                    onChange={(e) => setDepositDesc(e.target.value)}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg"
                                    placeholder={depositType === 'apertura' ? "Saldo inicial" : "Reposición de caja..."}
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setShowDepositModal(false)} className="px-4 py-2 text-gray-700 dark:text-gray-300">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Registrar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
