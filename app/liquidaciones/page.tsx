"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp, where, getDocs } from "firebase/firestore";
import { PlusIcon, DocumentTextIcon, PencilIcon, TrashIcon, CalculatorIcon, MagnifyingGlassIcon, XMarkIcon, UserIcon, ScaleIcon, CurrencyDollarIcon, BanknotesIcon, FunnelIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@/app/components/ui/Skeleton";
import Dialog from "@/app/components/Dialog";
import Select from "@/app/components/Select";
import Swal from "sweetalert2";

// Helper for formatting currency
const formatMoney = (amount: number) => {
    return amount?.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }) || "$ 0.00";
};

// Componente FormField reused from Garita for consistency
function FormField({ label, children, required, error, className = "" }: { label: string; children: React.ReactNode; required?: boolean; error?: string, className?: string }) {
    return (
        <div className={`mb-4 ${className}`}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}

// Styled Input Class
const inputClass = "w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800";

type Liquidacion = {
    id: string;
    numero: string;
    fecha: any;
    proveedorNombre: string;
    proveedorDocType?: string; // New
    proveedorDocNum?: string; // New
    loteId: string;
    producto: string;
    fechaLiquidacion: string;
    pesos: { tmh: number, h2o: number, tms: number, merma: number, tmns: number };
    leyes: { cu: number, ag: number, au: number };
    cotizaciones: { cu: number, ag: number, au: number };
    deducciones: { cu: number, ag: number, au: number };
    pagablePorc: { ag: number, au: number };
    factores?: { cu: number };
    costos: { maquila: number, analisisTotal?: number, analisis?: number, analisisUnitario?: number, refinaCu: number, refinaAg: number, refinaAu: number, penalidades: number };
    penalidadesDetalle?: PenaltyDetail[];
    adelantos: { fecha: string, descripcion: string, monto: number }[];
    calculos: {
        tmns: number,
        valorPorTmns: number,
        baseImponible: number,
        igv: number,
        totalGeneral: number,
        totalAdelantos: number,
        saldoFinal: number
    };
    estado: string;
    totalSaldo?: number; // legacy/display
};

type PenaltyDetail = {
    element: string;
    ley: number;
    limite: number;
    unidad: number;
    costo: number;
    unitLabel: string;
};

const DEFAULT_PENALTIES: PenaltyDetail[] = [
    { element: "As", ley: 0, limite: 0.2, unidad: 0.1, costo: 7.0, unitLabel: "%" },
    { element: "Sb", ley: 0, limite: 0.1, unidad: 0.1, costo: 5.0, unitLabel: "%" },
    { element: "Bi", ley: 0, limite: 0.05, unidad: 0.01, costo: 5.0, unitLabel: "%" },
    { element: "Pb+Zn", ley: 0, limite: 4.0, unidad: 1.0, costo: 5.0, unitLabel: "%" },
    { element: "Hg", ley: 0, limite: 40, unidad: 20, costo: 10.0, unitLabel: "ppm" },
    { element: "Cd", ley: 0, limite: 0.1, unidad: 0.01, costo: 7.0, unitLabel: "%" },
    { element: "Au", ley: 0, limite: 0.05, unidad: 0.01, costo: 18.9, unitLabel: "%" },
    { element: "H2O", ley: 0, limite: 10.0, unidad: 1.0, costo: 0, unitLabel: "%" },
];

export default function LiquidacionesPage() {
    const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // --- FORM STATE ---
    // Header
    const [proveedor, setProveedor] = useState("");
    const [tipoDocumento, setTipoDocumento] = useState("RUC"); // DNI or RUC
    const [numeroDocumento, setNumeroDocumento] = useState("");
    const [isSearchingClient, setIsSearchingClient] = useState(false);

    const [lote, setLote] = useState("");
    const [producto, setProducto] = useState("CONCENTRADO DE COBRE / PLATA / ORO");
    const [fechaLiquidacion, setFechaLiquidacion] = useState(new Date().toISOString().split('T')[0]);
    const [estado, setEstado] = useState("Provisional");

    // Pesos
    const [tmh, setTmh] = useState(0);
    const [h2o, setH2o] = useState(0);
    const [merma, setMerma] = useState(1); // Default 1%

    // Leyes (Analysis)
    const [leyCu, setLeyCu] = useState(0);
    const [leyAg, setLeyAg] = useState(0);
    const [leyAu, setLeyAu] = useState(0);

    // Cotizaciones (Prices)
    const [precioCu, setPrecioCu] = useState(0);
    const [precioAg, setPrecioAg] = useState(0);
    const [precioAu, setPrecioAu] = useState(0);

    // Deductions (Parameters)
    const [deduccionCu, setDeduccionCu] = useState(1.350);
    const [deduccionAg, setDeduccionAg] = useState(2.000);
    const [deduccionAu, setDeduccionAu] = useState(0.0640);

    // Factors & Costs
    const [maquila, setMaquila] = useState(160.00);
    const [analisisTotal, setAnalisisTotal] = useState(80.00); // Total Cost in USD
    const [refinaCu, setRefinaCu] = useState(0.180);
    const [refinaAg, setRefinaAg] = useState(1.00);
    const [refinaAu, setRefinaAu] = useState(10.00);
    // Penalties
    const [penalties, setPenalties] = useState<PenaltyDetail[]>(DEFAULT_PENALTIES);
    const [isPenaltiesOpen, setIsPenaltiesOpen] = useState(false);

    // Computed Total Penalties
    const manualPenalties = penalties.reduce((acc, p) => {
        const diff = p.ley - p.limite;
        if (diff <= 0) return acc;
        const penalty = (diff / p.unidad) * p.costo;
        return acc + penalty;
    }, 0);

    // Adelantos
    const [adelantos, setAdelantos] = useState<{ fecha: string, descripcion: string, monto: number }[]>([]);
    const [newAdelanto, setNewAdelanto] = useState({ fecha: "", descripcion: "", monto: 0 });

    // Constants
    const factorAg = 1;
    const factorAu = 1;

    // Factors (State)
    const [factorCu, setFactorCu] = useState(22.0462);

    // Payable Factors (State)
    const [pagablePorcAg, setPagablePorcAg] = useState(90);
    const [pagablePorcAu, setPagablePorcAu] = useState(90);

    // --- CALCULATIONS ---
    // Derived values for display/logic
    const tms = tmh * (1 - h2o / 100);
    const tmns = tms * (1 - merma / 100);

    const payableCuQty = (leyCu - deduccionCu) * factorCu;
    const payableAgQty = (leyAg - deduccionAg) * factorAg * (pagablePorcAg / 100);
    const payableAuQty = (leyAu - deduccionAu) * factorAu * (pagablePorcAu / 100);

    const payableCuVal = payableCuQty * precioCu;
    const payableAgVal = payableAgQty * precioAg;
    const payableAuVal = payableAuQty * precioAu;

    const totalPagos = payableCuVal + payableAgVal + payableAuVal;

    const costRefinaCu = payableCuQty * refinaCu;
    const costRefinaAg = payableAgQty * refinaAg;
    const costRefinaAu = payableAuQty * refinaAu;
    const totalRefinacion = costRefinaCu + costRefinaAg + costRefinaAu;

    // Analysis Unit Cost Calculation: Total Cost / TMNS
    const analisisUnitario = tmns > 0 ? (analisisTotal / tmns) : 0;

    // Round Total Deductions to 2 decimals as requested (e.g. 236.606 -> 236.61)
    const totalDeduccionesRaw = maquila + totalRefinacion;
    const totalDeducciones = Math.round((totalDeduccionesRaw + Number.EPSILON) * 100) / 100;

    // Penalties stay with high precision or 3 decimals? Image showed 0.340. 
    // Let's keep it raw or 3 decimals. User asked for 236.61 specifically for Deductions.
    const totalPenalidades = manualPenalties + analisisUnitario;

    const totalAdelantos = adelantos.reduce((acc, curr) => acc + curr.monto, 0);

    const valorPorTmns = totalPagos - totalDeducciones - totalPenalidades;
    const baseImponible = valorPorTmns * tmns;
    const igv = baseImponible * 0.18;
    const totalGeneral = baseImponible + igv;
    const saldoFinal = totalGeneral - totalAdelantos;

    const handleSearchClient = async () => {
        if (!numeroDocumento) return;

        setIsSearchingClient(true);
        try {
            // 1. First, check Firestore (Local Cache)
            const clientsRef = collection(db, "clientes");
            const qClientNum = query(clientsRef, where("numeroDocumento", "==", numeroDocumento));
            const qClientRuc = query(clientsRef, where("ruc", "==", numeroDocumento)); // Fallback

            const [snapNum, snapRuc] = await Promise.all([
                getDocs(qClientNum),
                getDocs(qClientRuc)
            ]);

            let clientData = null;
            let clientId = "";

            if (!snapNum.empty) {
                clientData = snapNum.docs[0].data();
                clientId = snapNum.docs[0].id;
            } else if (!snapRuc.empty) {
                clientData = snapRuc.docs[0].data();
                clientId = snapRuc.docs[0].id;
            }

            if (clientData) {
                // FOUND LOCALLY
                const name = clientData.nombre || clientData.razonSocial || "";
                setProveedor(name);

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Cliente encontrado (Local)',
                    showConfirmButton: false,
                    timer: 1500
                });

                // Fetch advances for this client
                fetchAdelantos(clientId, numeroDocumento);
                return; // Stop here, no need to call API
            }

            // 2. Not found locally, call API
            const endpoint = tipoDocumento === "DNI"
                ? `/api/sunat/dni?dni=${numeroDocumento}`
                : `/api/sunat/ruc?ruc=${numeroDocumento}`;

            const res = await fetch(endpoint);
            const data = await res.json();

            if (data.success) {
                // FOUND IN API
                let name = "";
                let address = "";

                if (tipoDocumento === "DNI") {
                    name = `${data.data.nombres} ${data.data.apellido_paterno} ${data.data.apellido_materno}`;
                } else {
                    name = data.data.nombre_o_razon_social;
                    address = data.data.direccion_completa || data.data.direccion || "";
                }

                setProveedor(name);

                // Save to Firestore for next time
                const clientDataToSave = {
                    nombre: name,
                    razonSocial: name,
                    direccion: address,
                    estado: data.data.estado || "",
                    condicion: data.data.condicion || "",
                    departamento: data.data.departamento || "",
                    provincia: data.data.provincia || "",
                    distrito: data.data.distrito || "",
                    tipoDocumento: tipoDocumento,
                    numeroDocumento: numeroDocumento,
                    createdAt: new Date(),
                    ruc: tipoDocumento === 'RUC' ? numeroDocumento : null
                };

                // Use the document number as ID for easier lookup or let Firestore generate one? 
                // Previous logic often uses doc(db, 'clientes', numeroDocumento). Let's stick to auto-id or explicit if we want.
                // Best to query by field as we did above.
                await addDoc(collection(db, "clientes"), clientDataToSave);

                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Cliente encontrado y registrado',
                    showConfirmButton: false,
                    timer: 1500
                });

                // Even if new, check for adelantos? Unlikely to have adelantos if client didn't exist locally, 
                // EXCEPT if adelantos were created manually without a client record? 
                // Safe to try fetching by document number.
                fetchAdelantos(numeroDocumento, numeroDocumento); // Using numDoc as temp ID

            } else {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'error',
                    title: 'No encontrado',
                    text: data.error || 'No se encontraron datos en SUNAT/RENIEC',
                    showConfirmButton: false,
                    timer: 2000
                });
            }
        } catch (error) {
            console.error("Error searching client:", error);
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'Error de conexión',
                showConfirmButton: false,
                timer: 2000
            });
        } finally {
            setIsSearchingClient(false);
        }
    };

    const fetchAdelantos = async (clientId: string, docNum: string) => {
        try {
            const adelantosRef = collection(db, "finanzas_adelantos");
            let adelantosDocs: any[] = [];

            // 1. Direct match (clienteId == RUC/DNI or clienteId == FirestoreID)
            const qDirect = query(adelantosRef, where("clienteId", "in", [clientId, docNum]));
            const snapDirect = await getDocs(qDirect);

            snapDirect.forEach(doc => {
                if (!adelantosDocs.find(a => a.id === doc.id)) {
                    adelantosDocs.push({ id: doc.id, ...doc.data() });
                }
            });

            // Filter valid adelantos
            const relevantAdelantos = adelantosDocs.filter(a => a.estado !== 'rechazado');

            if (relevantAdelantos.length > 0) {
                const mappedAdelantos = relevantAdelantos.map(a => {
                    let fechaStr = "";
                    if (a.fecha && a.fecha.toDate) {
                        fechaStr = a.fecha.toDate().toISOString().split('T')[0];
                    } else if (a.fecha) {
                        fechaStr = a.fecha.toString().substring(0, 10);
                    }

                    return {
                        fecha: fechaStr,
                        descripcion: a.descripcion || `Adelanto ${a.moneda === 'USD' ? '$' : 'S/'} ${a.monto} - ${a.bancoOrigenNombre || 'Banco'}`,
                        monto: a.monto
                    };
                });

                setAdelantos(mappedAdelantos);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'info',
                    title: `Se encontraron ${mappedAdelantos.length} adelantos`,
                    showConfirmButton: false,
                    timer: 3000
                });
            } else {
                setAdelantos([]);
            }
        } catch (error) {
            console.error("Error fetching adelantos:", error);
        }
    };

    useEffect(() => {
        const q = query(collection(db, "liquidaciones"), orderBy("fecha", "desc"));
        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Liquidacion));
            setLiquidaciones(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setProveedor("");
        setTipoDocumento("RUC");
        setNumeroDocumento("");
        setLote("");
        setProducto("CONCENTRADO DE COBRE / PLATA / ORO");
        setFechaLiquidacion(new Date().toISOString().split('T')[0]);
        setTmh(0);
        setH2o(0);
        setMerma(1);
        setLeyCu(0);
        setLeyAg(0);
        setLeyAu(0);
        setPrecioCu(0);
        setPrecioAg(0);
        setPrecioAu(0);
        setDeduccionCu(1.350);
        setDeduccionAg(2.000);
        setDeduccionAu(0.0640);
        setPagablePorcAg(90);
        setPagablePorcAu(90);
        setFactorCu(22.0462);
        setMaquila(160.00);
        setAnalisisTotal(80.00);
        setRefinaCu(0.180);
        setRefinaAg(1.00);
        setRefinaAu(10.00);
        setPenalties(DEFAULT_PENALTIES);
        setAdelantos([]);
        setEstado("Provisional");
        setLote(`L-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`);
        setEditingId(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (liq: Liquidacion) => {
        setEditingId(liq.id);
        setProveedor(liq.proveedorNombre);
        setTipoDocumento(liq.proveedorDocType || "RUC");
        setNumeroDocumento(liq.proveedorDocNum || "");
        setLote(liq.loteId);
        setProducto(liq.producto);
        setFechaLiquidacion(liq.fechaLiquidacion);
        setEstado(liq.estado || "Provisional");

        setTmh(liq.pesos.tmh);
        setH2o(liq.pesos.h2o);
        setMerma(liq.pesos.merma);

        setLeyCu(liq.leyes.cu);
        setLeyAg(liq.leyes.ag);
        setLeyAu(liq.leyes.au);

        setPrecioCu(liq.cotizaciones.cu);
        setPrecioAg(liq.cotizaciones.ag);
        setPrecioAu(liq.cotizaciones.au);

        setDeduccionCu(liq.deducciones.cu);
        setDeduccionAg(liq.deducciones.ag);
        setDeduccionAu(liq.deducciones.au);

        // Load Payable Factors
        setPagablePorcAg(liq.pagablePorc?.ag || 90);
        setPagablePorcAu(liq.pagablePorc?.au || 90);

        setFactorCu(liq.factores?.cu || 22.0462);

        setMaquila(liq.costos.maquila);
        setAnalisisTotal(liq.costos.analisisTotal || liq.costos.analisis || 80.00); // Backwards compatibility if needed, or default
        setRefinaCu(liq.costos.refinaCu);
        setRefinaAg(liq.costos.refinaAg);
        setRefinaAu(liq.costos.refinaAu);
        // setManualPenalties(liq.costos.penalidades); // Now computed
        if (liq.penalidadesDetalle) {
            setPenalties(liq.penalidadesDetalle);
        } else {
            // Migration: if no details, try to set manual? No, we switch to calculated.
            // Reset to defaults if missing
            setPenalties(DEFAULT_PENALTIES);
        }

        setAdelantos(liq.adelantos || []);

        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string, numero: string) => {
        const result = await Swal.fire({
            title: '¿Eliminar?',
            text: `Se eliminará la liquidación ${numero}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "liquidaciones", id));
                Swal.fire('Eliminado', 'Registro eliminado correctamente', 'success');
            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'No se pudo eliminar', 'error');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // VALIDATION
        if (!proveedor || !proveedor.trim()) {
            Swal.fire('Error', 'El nombre del proveedor es obligatorio', 'warning');
            return;
        }
        if (!numeroDocumento || !numeroDocumento.trim()) {
            Swal.fire('Error', 'El número de documento (RUC/DNI) es obligatorio', 'warning');
            return;
        }
        if (!tmh || tmh <= 0) {
            Swal.fire('Error', 'El Peso TMH debe ser mayor a 0', 'warning');
            return;
        }

        setIsSaving(true);
        try {
            const dataToSave = {
                fechaLiquidacion,
                proveedorNombre: proveedor,
                proveedorDocType: tipoDocumento,
                proveedorDocNum: numeroDocumento,
                loteId: lote,
                producto,
                pesos: { tmh, h2o, tms, merma, tmns },
                leyes: { cu: leyCu, ag: leyAg, au: leyAu },
                cotizaciones: { cu: precioCu, ag: precioAg, au: precioAu },
                deducciones: { cu: deduccionCu, ag: deduccionAg, au: deduccionAu },
                pagablePorc: { ag: pagablePorcAg, au: pagablePorcAu },
                factores: { cu: factorCu },
                costos: { maquila, analisisTotal, analisisUnitario, refinaCu, refinaAg, refinaAu, penalidades: manualPenalties },
                penalidadesDetalle: penalties,
                adelantos,
                calculos: {
                    tmns,
                    valorPorTmns,
                    baseImponible,
                    igv,
                    totalGeneral,
                    totalAdelantos,
                    saldoFinal
                },
                estado
            };

            if (editingId) {
                await updateDoc(doc(db, "liquidaciones", editingId), dataToSave);
                Swal.fire('Actualizado', 'Liquidación actualizada correctamente', 'success');
            } else {
                await addDoc(collection(db, "liquidaciones"), {
                    ...dataToSave,
                    numero: "L-" + Date.now().toString().slice(-4),
                    fecha: serverTimestamp(),
                });
                Swal.fire('Creado', 'Liquidación creada correctamente', 'success');
            }
            setIsDialogOpen(false);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo guardar la liquidación', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const addAdelanto = () => {
        if (newAdelanto.monto > 0 && newAdelanto.descripcion) {
            setAdelantos([...adelantos, newAdelanto]);
            setNewAdelanto({ fecha: "", descripcion: "", monto: 0 });
        }
    };

    const removeAdelanto = (index: number) => {
        setAdelantos(adelantos.filter((_, i) => i !== index));
    };

    // --- TABS ---
    const [activeTab, setActiveTab] = useState(0);

    const handleNext = () => {
        if (activeTab < tabs.length - 1) {
            setActiveTab(activeTab + 1);
        }
    };

    const handlePrevious = () => {
        if (activeTab > 0) {
            setActiveTab(activeTab - 1);
        }
    };

    const tabs = [
        { name: "General", icon: <UserIcon className="w-4 h-4" /> },
        { name: "Leyes y Precios", icon: <ScaleIcon className="w-4 h-4" /> },
        { name: "Deducciones", icon: <CurrencyDollarIcon className="w-4 h-4" /> },
        { name: adelantos.length > 0 ? `Adelantos (${adelantos.length}) y Cierre` : "Adelantos y Cierre", icon: <BanknotesIcon className="w-4 h-4" /> }
    ];


    const labelClass = "block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1";
    const sectionClass = "bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-gray-100 dark:border-zinc-800";
    const headerClass = "text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2";

    if (isLoading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;

    const filteredLiquidaciones = liquidaciones.filter(liq =>
        (liq.proveedorNombre || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (liq.numero || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (liq.loteId || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Liquidaciones de Mineral</h2>
                    <p className="text-gray-500 dark:text-gray-400">Gestiona las liquidaciones de compra y venta de mineral.</p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                    <PlusIcon className="w-5 h-5" />
                    Nueva Liquidación
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por proveedor, lote o número..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500">
                        <FunnelIcon className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-zinc-800/50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Número</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Proveedor</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lote</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {filteredLiquidaciones.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                        No se encontraron liquidaciones
                                    </td>
                                </tr>
                            ) : (
                                filteredLiquidaciones.map((liq) => (
                                    <tr key={liq.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{liq.numero}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{new Date(liq.fecha?.seconds * 1000).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{liq.proveedorNombre}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{liq.loteId}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${liq.estado === 'Final'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                                }`}>
                                                {liq.estado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white font-mono">
                                            {formatMoney(liq.calculos?.totalGeneral || 0)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link href={`/liquidaciones/${liq.id}`} className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Ver Detalle">
                                                    <DocumentTextIcon className="w-5 h-5" />
                                                </Link>
                                                <button onClick={() => handleOpenEdit(liq)} className="text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition-colors" title="Editar">
                                                    <PencilIcon className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => handleDelete(liq.id, liq.numero)} className="text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Eliminar">
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

            <Dialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                title={
                    <div className="flex justify-between items-center w-full pr-8">
                        <span>{editingId ? "Editar Liquidación" : "Nueva Liquidación"}</span>
                        {lote && (
                            <span className="text-sm font-mono bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-3 py-1 rounded-full">
                                {lote}
                            </span>
                        )}
                    </div>
                }
                maxWidth="max-w-4xl"
            >
                {/* Tabs */}
                <div className="px-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
                    <div className="flex p-1 bg-gray-100/80 dark:bg-zinc-800/80 rounded-xl">
                        {tabs.map((tab, idx) => (
                            <button
                                key={idx}
                                onClick={() => setActiveTab(idx)}
                                className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === idx
                                    ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-black/5"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-zinc-700/50"
                                    }`}
                            >
                                <span className={`mr-2 ${activeTab === idx ? "text-gray-700 dark:text-gray-300" : "text-gray-400"}`}>
                                    {tab.icon}
                                </span>
                                {tab.name}
                            </button>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-6 max-h-[70vh] overflow-y-auto space-y-6">
                    {activeTab === 0 && (
                        <div className="space-y-6">
                            <div className={sectionClass}>
                                <h3 className={headerClass}>Información General</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Document Search */}
                                    <div>
                                        <label className={labelClass}>Tipo Documento</label>
                                        <Select
                                            value={tipoDocumento}
                                            onChange={(e) => setTipoDocumento(e.target.value)}
                                        >
                                            <option value="RUC">RUC</option>
                                            <option value="DNI">DNI</option>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Número Documento</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={numeroDocumento}
                                                onChange={(e) => setNumeroDocumento(e.target.value)}
                                                className={`pl-4 pr-12 ${inputClass} w-full`}
                                                placeholder={tipoDocumento === "RUC" ? "12345678901" : "12345678"}
                                                maxLength={tipoDocumento === "RUC" ? 11 : 8}
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
                                                disabled={isSearchingClient}
                                                className="absolute right-0 top-0 bottom-0 px-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center"
                                                title="Buscar en SUNAT/RENIEC"
                                            >
                                                {isSearchingClient ? (
                                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <MagnifyingGlassIcon className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className={labelClass}>Proveedor / Razón Social</label>
                                        <input required type="text" value={proveedor} onChange={e => setProveedor(e.target.value)} className={inputClass} placeholder="Nombre del Productor" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className={labelClass}>Producto</label>
                                        <input type="text" value={producto} onChange={e => setProducto(e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Fecha Liquidación</label>
                                        <input type="date" value={fechaLiquidacion} onChange={e => setFechaLiquidacion(e.target.value)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Estado</label>
                                        <Select
                                            value={estado}
                                            onChange={(e) => setEstado(e.target.value)}
                                        >
                                            <option value="Provisional">Provisional</option>
                                            <option value="Final">Final</option>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className={sectionClass}>
                                <h3 className={headerClass}>Pesos y Humedad</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelClass}>TMH</label>
                                        <input type="number" step="0.001" value={tmh} onChange={e => setTmh(parseFloat(e.target.value) || 0)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>H2O %</label>
                                        <input type="number" step="0.01" value={h2o} onChange={e => setH2o(parseFloat(e.target.value) || 0)} className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>Merma %</label>
                                        <input type="number" step="0.01" value={merma} onChange={e => setMerma(parseFloat(e.target.value) || 0)} className={inputClass} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-zinc-700">
                                    <div className="text-center p-3 bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-700">
                                        <div className="text-xs text-gray-500 mb-1">TMS</div>
                                        <div className="font-mono font-bold text-gray-900 dark:text-white">{tms.toFixed(3)}</div>
                                    </div>
                                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                        <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">TMNS</div>
                                        <div className="font-mono font-bold text-blue-800 dark:text-blue-300">{tmns.toFixed(3)}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 1 && (
                        <div className="space-y-6">
                            <div className={sectionClass}>
                                <h3 className={headerClass}>Leyes (Laboratorio)</h3>
                                <div className="grid grid-cols-6 gap-4 text-center text-xs text-gray-500 mb-2 font-medium bg-gray-100 dark:bg-zinc-800 p-2 rounded-md">
                                    <div className="text-left pl-2">Elemento</div>
                                    <div>Ley</div>
                                    <div>Deducción</div>
                                    <div>Ley Neta</div>
                                    <div>% Pagable</div>
                                    <div>Pagable Net.</div>
                                </div>
                                <div className="space-y-3">
                                    {/* Cu */}
                                    <div className="grid grid-cols-6 gap-4 items-center">
                                        <div className="text-sm font-medium">Cobre (Cu %)</div>
                                        <input type="number" step="0.001" value={leyCu} onChange={e => setLeyCu(parseFloat(e.target.value) || 0)} className={inputClass} placeholder="%" />
                                        <input type="number" step="0.001" value={deduccionCu} onChange={e => setDeduccionCu(parseFloat(e.target.value) || 0)} className={inputClass} placeholder="Ded" />
                                        <div className="text-xs text-center font-mono text-gray-600 dark:text-gray-300 font-bold">{(leyCu - deduccionCu).toFixed(3)}%</div>
                                        <input type="number" step="0.0001" value={factorCu} onChange={e => setFactorCu(parseFloat(e.target.value) || 0)} className={inputClass} placeholder="Factor" />
                                        <div className="text-xs text-center font-mono text-blue-600 dark:text-blue-400 font-bold">{((leyCu - deduccionCu) * factorCu).toFixed(3)}</div>
                                    </div>
                                    {/* Ag */}
                                    <div className="grid grid-cols-6 gap-4 items-center">
                                        <div className="text-sm font-medium">Plata (Ag oz/TM)</div>
                                        <input type="number" step="0.001" value={leyAg} onChange={e => setLeyAg(parseFloat(e.target.value) || 0)} className={inputClass} />
                                        <input type="number" step="0.001" value={deduccionAg} onChange={e => setDeduccionAg(parseFloat(e.target.value) || 0)} className={inputClass} />
                                        <div className="text-xs text-center font-mono text-gray-600 dark:text-gray-300 font-bold">{(leyAg - deduccionAg).toFixed(3)}</div>
                                        <input type="number" step="0.01" value={pagablePorcAg} onChange={e => setPagablePorcAg(parseFloat(e.target.value) || 0)} className={inputClass} placeholder="%" />
                                        <div className="text-xs text-center font-mono text-blue-600 dark:text-blue-400 font-bold">{((leyAg - deduccionAg) * (pagablePorcAg / 100)).toFixed(3)}</div>
                                    </div>
                                    {/* Au */}
                                    <div className="grid grid-cols-6 gap-4 items-center">
                                        <div className="text-sm font-medium">Oro (Au oz/TM)</div>
                                        <input type="number" step="0.0001" value={leyAu} onChange={e => setLeyAu(parseFloat(e.target.value) || 0)} className={inputClass} />
                                        <input type="number" step="0.0001" value={deduccionAu} onChange={e => setDeduccionAu(parseFloat(e.target.value) || 0)} className={inputClass} />
                                        <div className="text-xs text-center font-mono text-gray-600 dark:text-gray-300 font-bold">{(leyAu - deduccionAu).toFixed(4)}</div>
                                        <input type="number" step="0.01" value={pagablePorcAu} onChange={e => setPagablePorcAu(parseFloat(e.target.value) || 0)} className={inputClass} placeholder="%" />
                                        <div className="text-xs text-center font-mono text-blue-600 dark:text-blue-400 font-bold">{((leyAu - deduccionAu) * (pagablePorcAu / 100)).toFixed(3)}</div>
                                    </div>
                                </div>
                            </div>

                            <div className={sectionClass}>
                                <h3 className={headerClass}>Cotizaciones (Precios de Mercado)</h3>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-4 items-center bg-gray-100 dark:bg-zinc-800 p-2 rounded-md mb-2">
                                        <div className="text-xs font-medium text-gray-500">Metal</div>
                                        <div className="text-xs font-medium text-gray-500">Precio Unitario</div>
                                        <div className="text-xs font-medium text-gray-500 text-right">Valor Pagable / TM</div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4 items-center">
                                        <label className={labelClass}>Cu (USD/lb)</label>
                                        <input type="number" step="0.001" value={precioCu} onChange={e => setPrecioCu(parseFloat(e.target.value) || 0)} className={inputClass} />
                                        <div className="text-sm font-mono text-right text-green-600 font-bold">{formatMoney(payableCuVal)}</div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 items-center">
                                        <label className={labelClass}>Ag (USD/oz)</label>
                                        <input type="number" step="0.001" value={precioAg} onChange={e => setPrecioAg(parseFloat(e.target.value) || 0)} className={inputClass} />
                                        <div className="text-sm font-mono text-right text-green-600 font-bold">{formatMoney(payableAgVal)}</div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 items-center">
                                        <label className={labelClass}>Au (USD/oz)</label>
                                        <input type="number" step="0.001" value={precioAu} onChange={e => setPrecioAu(parseFloat(e.target.value) || 0)} className={inputClass} />
                                        <div className="text-sm font-mono text-right text-green-600 font-bold">{formatMoney(payableAuVal)}</div>
                                    </div>
                                    <div className="pt-3 border-t border-gray-200 dark:border-zinc-700 mt-2 flex justify-between items-center">
                                        <span className="font-bold text-sm">Total Valor Bruto</span>
                                        <span className="font-bold text-lg text-blue-600">{formatMoney(totalPagos)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 2 && (
                        <div className="space-y-6">
                            <div className={sectionClass}>
                                <h3 className={headerClass}>Penalidades</h3>
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <label className={labelClass}>Penalidades Detalles (USD/TM)</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsPenaltiesOpen(true)}
                                                    className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                                                >
                                                    Gestionar Detalles
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="number"
                                                    value={manualPenalties.toFixed(3)}
                                                    readOnly
                                                    className={`${inputClass} bg-gray-50 text-gray-600`}
                                                />
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">Suma de penalidades por elementos</p>
                                        </div>
                                        <div className="flex-1">
                                            <label className={labelClass}>Cobro de Análisis (Total USD)</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={analisisTotal}
                                                    onChange={e => setAnalisisTotal(parseFloat(e.target.value) || 0)}
                                                    className={inputClass}
                                                />
                                                <div className="text-[10px] text-gray-500 text-right whitespace-nowrap">
                                                    <div>/ {tmns.toFixed(3)} TMNS</div>
                                                    <div className="font-bold text-red-600">= {analisisUnitario.toFixed(3)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-3 border-t border-gray-200 dark:border-zinc-700 mt-2 flex justify-between items-center">
                                        <span className="font-bold text-sm">Total Penalidades</span>
                                        <span className="font-bold text-lg text-red-600">-{formatMoney(totalPenalidades)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={sectionClass}>
                                <h3 className={headerClass}>Maquila y Refinación</h3>
                                <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
                                    <div>
                                        <label className={labelClass}>Maquila (USD/TM)</label>
                                        <input type="number" step="0.01" value={maquila} onChange={e => setMaquila(parseFloat(e.target.value) || 0)} className={inputClass} />
                                    </div>
                                </div>

                                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Costos de Refinación</h4>
                                <div className="grid grid-cols-3 gap-4 mb-2 text-xs text-gray-500 font-medium bg-gray-100 dark:bg-zinc-800 p-2 rounded-md">
                                    <div>Metal</div>
                                    <div>Costo Unitario</div>
                                    <div className="text-right">Total Deducción</div>
                                </div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-4 items-center">
                                        <label className="text-sm font-medium">Cobre ($/lb)</label>
                                        <input type="number" step="0.001" value={refinaCu} onChange={e => setRefinaCu(parseFloat(e.target.value) || 0)} className={inputClass} />
                                        <div className="text-right text-red-500 text-sm font-mono">-{costRefinaCu.toFixed(3)}</div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 items-center">
                                        <label className="text-sm font-medium">Plata ($/oz)</label>
                                        <input type="number" step="0.001" value={refinaAg} onChange={e => setRefinaAg(parseFloat(e.target.value) || 0)} className={inputClass} />
                                        <div className="text-right text-red-500 text-sm font-mono">-{costRefinaAg.toFixed(3)}</div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 items-center">
                                        <label className="text-sm font-medium">Oro ($/oz)</label>
                                        <input type="number" step="0.001" value={refinaAu} onChange={e => setRefinaAu(parseFloat(e.target.value) || 0)} className={inputClass} />
                                        <div className="text-right text-red-500 text-sm font-mono">-{costRefinaAu.toFixed(3)}</div>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-gray-200 dark:border-zinc-700 mt-4 flex justify-between items-center">
                                    <span className="font-bold text-sm">Total Deducciones</span>
                                    <span className="font-bold text-lg text-red-600">-{totalDeducciones.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 3 && (
                        <div className="space-y-6">
                            {/* Adelantos Section */}
                            <div className={sectionClass}>
                                <h3 className={headerClass}>Adelantos y Deducciones Extra</h3>
                                <div className="space-y-4">
                                    {adelantos.length > 0 ? (
                                        <div className="border rounded-lg overflow-hidden text-xs mb-4">
                                            <table className="w-full bg-white dark:bg-zinc-900 leading-normal">
                                                <thead className="bg-gray-100 dark:bg-zinc-800">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left">Fecha</th>
                                                        <th className="px-3 py-2 text-left">Descripción</th>
                                                        <th className="px-3 py-2 text-right">Monto</th>
                                                        <th className="px-3 py-2 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {adelantos.map((adv, idx) => (
                                                        <tr key={idx} className="border-t border-gray-100 dark:border-zinc-800">
                                                            <td className="px-3 py-2 text-gray-500">{adv.fecha}</td>
                                                            <td className="px-3 py-2">{adv.descripcion}</td>
                                                            <td className="px-3 py-2 text-right text-red-600 font-medium">{formatMoney(adv.monto)}</td>
                                                            <td className="px-3 py-2 text-center text-red-500 cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => removeAdelanto(idx)}>
                                                                <TrashIcon className="w-4 h-4 mx-auto" />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-lg">
                                            No hay adelantos registrados para este RUC.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Summary Card */}
                            <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-xl">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 border-b pb-2">
                                    <CalculatorIcon className="w-5 h-5 text-blue-600" />
                                    Resumen Final
                                </h3>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg mt-2 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-medium">Base Imponible</span>
                                    <span className="font-bold">{formatMoney(baseImponible)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs text-blue-600 dark:text-blue-400">
                                    <span>IGV (18%)</span>
                                    <span>{formatMoney(igv)}</span>
                                </div>
                                <div className="flex justify-between items-center font-bold text-lg text-blue-900 dark:text-white pt-2 border-t border-blue-200 dark:border-blue-800/30">
                                    <span>TOTAL VENTA</span>
                                    <span>{formatMoney(totalGeneral)}</span>
                                </div>
                            </div>

                            {totalAdelantos > 0 && (
                                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-800">
                                    <div className="flex justify-between text-red-600 dark:text-red-400 text-sm mb-1">
                                        <span>Menos Adelantos</span>
                                        <span>-{formatMoney(totalAdelantos)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-xl text-green-700 dark:text-green-400 pt-2 border-t border-green-200 dark:border-green-800/30">
                                        <span>SALDO A PAGAR</span>
                                        <span>{formatMoney(saldoFinal)}</span>
                                    </div>
                                </div>
                            )}
                        </div>


                    )}

                    <div className="mt-8 flex justify-between items-center gap-3 pt-4 border-t border-gray-100 dark:border-zinc-800">
                        <button
                            type="button"
                            onClick={() => setIsDialogOpen(false)}
                            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition"
                        >
                            Cancelar
                        </button>

                        <div className="flex gap-3">
                            {activeTab > 0 && (
                                <button
                                    type="button"
                                    onClick={handlePrevious}
                                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg transition"
                                >
                                    Anterior
                                </button>
                            )}

                            {activeTab < tabs.length - 1 ? (
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-600/20 transition"
                                >
                                    Siguiente
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-600/20 disabled:opacity-50 transition"
                                >
                                    {isSaving ? 'Guardando...' : (editingId ? 'Actualizar' : 'Guardar Finalizar')}
                                </button>
                            )}
                        </div>
                    </div>
                </form >
            </Dialog >

            {/* Penalties Modal */}
            < Dialog
                isOpen={isPenaltiesOpen}
                onClose={() => setIsPenaltiesOpen(false)}
                title="Configuración de Penalidades"
                maxWidth="max-w-4xl"
            >
                <div className="p-6">
                    <p className="text-sm text-gray-500 mb-4 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-100 dark:border-yellow-800">
                        Ingrese las leyes de los elementos contaminantes. La penalidad se calcula automáticamente: <br />
                        <code className="text-xs font-mono">Max(0, Ley - Límite) / Unidad * Costo</code>
                    </p>

                    <div className="overflow-x-auto border rounded-xl border-gray-200 dark:border-zinc-700">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-zinc-800 text-xs text-gray-500 uppercase font-medium">
                                <tr>
                                    <th className="px-4 py-3 text-left">Elemento</th>
                                    <th className="px-4 py-3 text-left">Ley</th>
                                    <th className="px-4 py-3 text-center">Límite</th>
                                    <th className="px-4 py-3 text-center">Unidad</th>
                                    <th className="px-4 py-3 text-center">Costo ($)</th>
                                    <th className="px-4 py-3 text-right">Penalidad</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                                {penalties.map((p, idx) => {
                                    const diff = p.ley - p.limite;
                                    const result = diff > 0 ? (diff / p.unidad) * p.costo : 0;

                                    const updatePenalty = (field: keyof PenaltyDetail, value: number) => {
                                        const newPenalties = [...penalties];
                                        newPenalties[idx] = { ...newPenalties[idx], [field]: value };
                                        setPenalties(newPenalties);
                                    };

                                    return (
                                        <tr key={idx} className="bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-4 py-2 font-medium">{p.element}</td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="number"
                                                        value={p.ley}
                                                        onChange={e => updatePenalty('ley', parseFloat(e.target.value) || 0)}
                                                        className="w-20 px-2 py-1 border rounded bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                                    />
                                                    <span className="text-xs text-gray-400">{p.unitLabel}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={p.limite}
                                                    onChange={e => updatePenalty('limite', parseFloat(e.target.value) || 0)}
                                                    className="w-16 px-2 py-1 border rounded bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-center text-xs"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={p.unidad}
                                                    onChange={e => updatePenalty('unidad', parseFloat(e.target.value) || 0)}
                                                    className="w-16 px-2 py-1 border rounded bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-center text-xs"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number"
                                                    value={p.costo}
                                                    onChange={e => updatePenalty('costo', parseFloat(e.target.value) || 0)}
                                                    className="w-16 px-2 py-1 border rounded bg-gray-50 dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-center text-xs"
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-right font-mono font-bold text-red-600">
                                                {formatMoney(result)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-gray-50 dark:bg-zinc-800 font-bold text-sm">
                                <tr>
                                    <td colSpan={5} className="px-4 py-3 text-right">Total Penalidades</td>
                                    <td className="px-4 py-3 text-right text-red-600">{formatMoney(manualPenalties)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={() => setPenalties(DEFAULT_PENALTIES)}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 hover:bg-gray-100 rounded-lg transition"
                        >
                            Restablecer Valores
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsPenaltiesOpen(false)}
                            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
                        >
                            Aceptar y Guardar
                        </button>
                    </div>
                </div>
            </Dialog >
        </div >
    );
}
