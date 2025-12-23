"use client";

import { useState, useEffect } from "react";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon, XMarkIcon, TrashIcon, EyeIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { collection, query, orderBy, onSnapshot, addDoc, Timestamp, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Swal from "sweetalert2";
import { useSearchParams } from "next/navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type OrderItem = {
    descripcion: string;
    cantidad: number;
    unidad: string;
    precioUnitario: number;
    total: number;
};

type PurchaseOrder = {
    id: string;
    codigo: string;
    proveedorNombre: string;
    proveedorRuc: string;
    tipo: "mineral" | "suministro";
    fechaEmision: Date;
    items: OrderItem[];
    subtotal: number;
    igv: number;
    total: number;
    estado: "borrador" | "pendiente" | "aprobado" | "recibido" | "anulado";
    observaciones?: string;
};

const FormField = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label}
        </label>
        {children}
    </div>
);

export default function OrdenesPage() {
    const searchParams = useSearchParams();
    const initialType = searchParams.get("new") as "mineral" | "suministro" | null;

    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        proveedorNombre: "",
        proveedorRuc: "",
        tipo: initialType || "suministro",
        items: [] as OrderItem[],
        observaciones: ""
    });

    // New Item State
    const [newItem, setNewItem] = useState<OrderItem>({
        descripcion: "",
        cantidad: 1,
        unidad: "UND",
        precioUnitario: 0,
        total: 0
    });

    useEffect(() => {
        if (initialType) {
            setFormData(prev => ({ ...prev, tipo: initialType }));
            setShowModal(true);
        }
    }, [initialType]);

    useEffect(() => {
        const q = query(collection(db, "compras_ordenes"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                fechaEmision: doc.data().fechaEmision?.toDate()
            })) as PurchaseOrder[];
            setOrders(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const addItem = () => {
        if (!newItem.descripcion || newItem.cantidad <= 0) return;
        const itemTotal = newItem.cantidad * newItem.precioUnitario;
        setFormData({
            ...formData,
            items: [...formData.items, { ...newItem, total: itemTotal }]
        });
        setNewItem({ descripcion: "", cantidad: 1, unidad: "UND", precioUnitario: 0, total: 0 });
    };

    const handleViewOrder = (order: any) => {
        setFormData({
            proveedorNombre: order.proveedorNombre,
            proveedorRuc: order.proveedorRuc || "",
            tipo: order.tipo,
            items: order.items,
            observaciones: order.observaciones || ""
        });
        setIsReadOnly(true);
        setShowModal(true);
    };

    const handleDownloadPDF = async (order: any) => {
        const element = document.createElement("div");
        element.innerHTML = `
            <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1f2937; line-height: 1.5; padding: 0; background: white; width: 800px; position: relative;">
                <!-- Header Band -->
                <div style="background: #000000; height: 12px; width: 100%;"></div>
                
                <div style="padding: 40px 50px;">
                    <!-- Header Content -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
                        <div>
                            <h1 style="margin: 0; color: #000000; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">ALFASOFT</h1>
                            <div style="margin-top: 8px; color: #6b7280; font-size: 13px; line-height: 1.6;">
                                <p style="margin: 0;">RUC: 20123456789</p>
                                <p style="margin: 0;">Av. Principal 123, Lima, Perú</p>
                                <p style="margin: 0;">contacto@alfasoft.com</p>
                            </div>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: #f3f4f6; padding: 15px 25px; border-radius: 8px; border-left: 4px solid #000000;">
                                <h2 style="margin: 0 0 5px 0; font-size: 18px; color: #111827; font-weight: 700; text-transform: uppercase;">Orden de Compra</h2>
                                <p style="margin: 0; font-size: 16px; color: #000000; font-weight: 600;">${order.codigo}</p>
                            </div>
                            <div style="margin-top: 12px; font-size: 13px; color: #4b5563;">
                                <p style="margin: 2px 0;">Fecha: <strong style="color: #111827;">${order.fechaEmision?.toLocaleDateString()}</strong></p>
                                <p style="margin: 2px 0;">Estado: <strong style="color: #111827; text-transform: uppercase;">${order.estado}</strong></p>
                            </div>
                        </div>
                    </div>

                    <!-- Provider & Ship To -->
                    <div style="display: flex; gap: 40px; margin-bottom: 40px;">
                        <div style="flex: 1;">
                            <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 700; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Proveedor</h3>
                            <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb;">
                                <strong style="display: block; font-size: 15px; color: #111827; margin-bottom: 4px;">${order.proveedorNombre}</strong>
                                <p style="margin: 0; font-size: 13px; color: #4b5563;">RUC: ${order.proveedorRuc || '-'}</p>
                            </div>
                        </div>
                        <div style="flex: 1;">
                            <h3 style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 700; margin-bottom: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Enviar A</h3>
                            <div style="padding: 0 5px;">
                                <strong style="display: block; font-size: 14px; color: #111827; margin-bottom: 4px;">Almacén Principal</strong>
                                <p style="margin: 0; font-size: 13px; color: #4b5563;">Av. Industrial 456, Zona Industrial</p>
                                <p style="margin: 0; font-size: 13px; color: #4b5563;">Lima, Perú</p>
                            </div>
                        </div>
                    </div>

                    <!-- Items Table -->
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                        <thead>
                            <tr style="background: #000000; color: white;">
                                <th style="text-align: left; padding: 12px 15px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-top-left-radius: 6px; border-bottom-left-radius: 6px;">Descripción</th>
                                <th style="text-align: center; padding: 12px 15px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 80px;">Cant.</th>
                                <th style="text-align: center; padding: 12px 15px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 80px;">Und.</th>
                                <th style="text-align: right; padding: 12px 15px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 120px;">P. Unit</th>
                                <th style="text-align: right; padding: 12px 15px; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 120px; border-top-right-radius: 6px; border-bottom-right-radius: 6px;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.items.map((item: any, index: number) => `
                                <tr style="border-bottom: 1px solid #e5e7eb; background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                                    <td style="padding: 12px 15px; font-size: 13px; color: #374151;">${item.descripcion}</td>
                                    <td style="padding: 12px 15px; font-size: 13px; color: #374151; text-align: center;">${item.cantidad}</td>
                                    <td style="padding: 12px 15px; font-size: 13px; color: #374151; text-align: center;">${item.unidad}</td>
                                    <td style="padding: 12px 15px; font-size: 13px; color: #374151; text-align: right;">S/ ${item.precioUnitario.toFixed(2)}</td>
                                    <td style="padding: 12px 15px; font-size: 13px; font-weight: 600; color: #111827; text-align: right;">S/ ${item.total.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <!-- Totals Section -->
                    <div style="display: flex; justify-content: flex-end; margin-bottom: 50px;">
                        <div style="width: 300px;">
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #4b5563;">
                                <span>Subtotal</span>
                                <span style="font-weight: 500;">S/ ${order.subtotal?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-size: 13px; color: #4b5563;">
                                <span>IGV (18%)</span>
                                <span style="font-weight: 500;">S/ ${order.igv?.toFixed(2) || '0.00'}</span>
                            </div>
                            <div style="display: flex; justify-content: space-between; padding: 12px 0; font-size: 18px; color: #000000; font-weight: 800; border-bottom: 2px solid #000000; margin-top: 5px;">
                                <span>Total</span>
                                <span>S/ ${order.total?.toFixed(2) || '0.00'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Signatures -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 60px;">
                        <div style="text-align: center;">
                            <div style="height: 60px; border-bottom: 1px solid #9ca3af; margin-bottom: 10px;"></div>
                            <p style="margin: 0; font-weight: 600; color: #111827; font-size: 13px;">AUTORIZADO POR</p>
                            <span style="display: block; margin-top: 2px; font-size: 11px; color: #6b7280;">Firma y Sello Alfasoft</span>
                        </div>
                        <div style="text-align: center;">
                            <div style="height: 60px; border-bottom: 1px solid #9ca3af; margin-bottom: 10px;"></div>
                            <p style="margin: 0; font-weight: 600; color: #111827; font-size: 13px;">RECIBIDO CONFORME</p>
                            <span style="display: block; margin-top: 2px; font-size: 11px; color: #6b7280;">Firma y Sello Proveedor</span>
                        </div>
                    </div>
                </div>

                <!-- Footer Band -->
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: #f3f4f6; padding: 15px 50px; border-top: 1px solid #e5e7eb;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #6b7280;">
                        <div>
                            <p style="margin: 0;"><strong>Condiciones:</strong> Pago a 30 días. Entrega en almacén central.</p>
                        </div>
                        <div>
                            <p style="margin: 0;">Página 1 de 1</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(element);

        try {
            const canvas = await html2canvas(element.firstElementChild as HTMLElement, {
                scale: 2,
                logging: false,
                useCORS: true
            } as any);

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            pdf.save(`Orden_Compra_${order.codigo}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            Swal.fire("Error", "No se pudo generar el PDF", "error");
        } finally {
            document.body.removeChild(element);
        }
    };

    const removeItem = (index: number) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems });
    };

    const calculateTotals = () => {
        const subtotal = formData.items.reduce((acc, item) => acc + item.total, 0);
        const igv = subtotal * 0.18;
        const total = subtotal + igv;
        return { subtotal, igv, total };
    };

    const handleProviderSearch = async (ruc: string) => {
        if (ruc.length !== 11) return;

        // Simple loading state for the input could be added here
        try {
            // 1. Try Firestore first
            const clientRef = collection(db, "clientes");
            const q = query(clientRef, where("numeroDocumento", "==", ruc));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                setFormData(prev => ({
                    ...prev,
                    proveedorNombre: data.razonSocial || data.nombre || ""
                }));
                return;
            }

            // 2. Try API
            const response = await fetch(`/ api / sunat / ruc ? ruc = ${ruc} `);
            const result = await response.json();

            if (result.success && result.data) {
                const name = result.data.nombre_o_razon_social;
                setFormData(prev => ({
                    ...prev,
                    proveedorNombre: name || ""
                }));
            }
        } catch (error) {
            console.error("Error searching provider:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.items.length === 0) {
            Swal.fire("Error", "Debe agregar al menos un ítem", "error");
            return;
        }

        const totals = calculateTotals();
        const codigo = `OC - ${Date.now().toString().slice(-6)} `; // Simple ID gen

        try {
            await addDoc(collection(db, "compras_ordenes"), {
                ...formData,
                ...totals,
                codigo,
                fechaEmision: Timestamp.now(),
                estado: "pendiente",
                createdAt: Timestamp.now()
            });
            setShowModal(false);
            Swal.fire("Éxito", "Orden de Compra creada correctamente", "success");
            setFormData({
                proveedorNombre: "",
                proveedorRuc: "",
                tipo: "suministro",
                items: [],
                observaciones: ""
            });
        } catch (error) {
            console.error("Error creating order:", error);
            Swal.fire("Error", "No se pudo crear la orden", "error");
        }
    };

    const inputClass = "w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800";

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <Navbar />
            <Sidebar />

            <main className="ml-64 mt-16 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Órdenes de Compra</h1>
                            <p className="text-gray-600 dark:text-gray-400">Administra tus pedidos a proveedores</p>
                        </div>
                        <button
                            onClick={() => {
                                setIsReadOnly(false);
                                setFormData({
                                    proveedorNombre: "",
                                    proveedorRuc: "",
                                    tipo: "suministro",
                                    items: [],
                                    observaciones: ""
                                });
                                setShowModal(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Nueva Orden
                        </button>
                    </div>

                    {/* Filters & Search (Placeholder) */}
                    <div className="flex gap-4 mb-6">
                        <div className="relative flex-1 max-w-md">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Buscar por proveedor o código..."
                                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button className="px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 flex items-center gap-2">
                            <FunnelIcon className="w-5 h-5" />
                            Filtros
                        </button>
                    </div>

                    {/* Orders List */}
                    <div className="grid gap-4">
                        {orders.map((order) => (
                            <div key={order.id} className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 flex justify-between items-center hover:border-blue-500/30 transition-colors cursor-pointer">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="font-bold text-gray-900 dark:text-white">{order.codigo}</span>
                                        <span className={`px - 2 py - 0.5 rounded - full text - xs font - medium ${order.tipo === 'mineral'
                                            ? 'bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400'
                                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            } `}>
                                            {order.tipo === 'mineral' ? 'Mineral' : 'Suministro'}
                                        </span>
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-400">{order.proveedorNombre} • {order.fechaEmision?.toLocaleDateString()}</p>
                                </div>
                                <div className="text-right flex items-center gap-4">
                                    <div>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                                            S/ {order.total?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                        </p>
                                        <span className={`inline - block mt - 1 px - 2 py - 0.5 rounded - full text - xs font - medium ${order.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                                            order.estado === 'aprobado' ? 'bg-blue-100 text-blue-700' :
                                                order.estado === 'recibido' ? 'bg-green-100 text-green-700' :
                                                    'bg-red-100 text-red-700'
                                            } `}>
                                            {order.estado.toUpperCase()}
                                        </span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewOrder(order);
                                        }}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        title="Ver Detalle"
                                    >
                                        <EyeIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDownloadPDF(order);
                                        }}
                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                                        title="Descargar PDF"
                                    >
                                        <ArrowDownTrayIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Create Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[100] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                        {/* Overlay */}
                        <div className="fixed inset-0 transition-opacity bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>

                        {/* Modal Card */}
                        <div className="relative z-10 inline-block w-full max-w-5xl my-8 text-left align-middle transition-all transform bg-white dark:bg-zinc-900 shadow-2xl rounded-xl border border-gray-200 dark:border-zinc-800">
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-800 bg-gradient-to-r from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-900 rounded-t-xl">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                        {isReadOnly ? 'Detalle de Orden' : 'Nueva Orden de Compra'}
                                    </h3>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col max-h-[80vh]">
                                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                    {/* Header Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                        <div className="md:col-span-3">
                                            <FormField label="Tipo de Orden">
                                                <select
                                                    value={formData.tipo}
                                                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as "mineral" | "suministro" })}
                                                    className={inputClass}
                                                    disabled={isReadOnly}
                                                >
                                                    <option value="suministro">Suministros / Repuestos</option>
                                                    <option value="mineral">Mineral (Materia Prima)</option>
                                                </select>
                                            </FormField>
                                        </div>
                                        <div className="md:col-span-3">
                                            <FormField label="RUC">
                                                <input
                                                    type="text"
                                                    value={formData.proveedorRuc}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/\D/g, '');
                                                        setFormData({ ...formData, proveedorRuc: val });
                                                        if (val.length === 11) {
                                                            handleProviderSearch(val);
                                                        }
                                                    }}
                                                    maxLength={11}
                                                    className={inputClass}
                                                    placeholder="10123456789"
                                                    readOnly={isReadOnly}
                                                />
                                            </FormField>
                                        </div>
                                        <div className="md:col-span-6">
                                            <FormField label="Proveedor">
                                                <input
                                                    type="text"
                                                    required
                                                    value={formData.proveedorNombre}
                                                    onChange={(e) => setFormData({ ...formData, proveedorNombre: e.target.value })}
                                                    className={inputClass}
                                                    placeholder="Nombre o Razón Social"
                                                    readOnly={isReadOnly}
                                                />
                                            </FormField>
                                        </div>
                                    </div>

                                    {/* Items Table */}
                                    <div>
                                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Detalle de Ítems</h4>
                                        <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-gray-400 font-medium">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left">Descripción</th>
                                                        <th className="px-4 py-3 w-24">Cant.</th>
                                                        <th className="px-4 py-3 w-24">Und.</th>
                                                        <th className="px-4 py-3 w-32">P. Unit</th>
                                                        <th className="px-4 py-3 w-32">Total</th>
                                                        <th className="px-4 py-3 w-16"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                                    {formData.items.map((item, idx) => (
                                                        <tr key={idx} className="bg-white dark:bg-zinc-900">
                                                            <td className="px-4 py-3 text-gray-900 dark:text-white">{item.descripcion}</td>
                                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.cantidad}</td>
                                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.unidad}</td>
                                                            <td className="px-4 py-3 text-gray-600 dark:text-gray-300">S/ {item.precioUnitario.toFixed(2)}</td>
                                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">S/ {item.total.toFixed(2)}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                {!isReadOnly && (
                                                                    <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700 transition-colors">
                                                                        <TrashIcon className="w-4 h-4" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {/* Add Item Row - Hide if ReadOnly */}
                                                    {!isReadOnly && (
                                                        <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                                                            <td className="px-4 py-2">
                                                                <input
                                                                    type="text"
                                                                    value={newItem.descripcion}
                                                                    onChange={(e) => setNewItem({ ...newItem, descripcion: e.target.value })}
                                                                    placeholder="Agregar ítem..."
                                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white placeholder-gray-400"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <input
                                                                    type="number"
                                                                    value={newItem.cantidad}
                                                                    onChange={(e) => setNewItem({ ...newItem, cantidad: parseFloat(e.target.value) })}
                                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <input
                                                                    type="text"
                                                                    value={newItem.unidad}
                                                                    onChange={(e) => setNewItem({ ...newItem, unidad: e.target.value })}
                                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2">
                                                                <input
                                                                    type="number"
                                                                    value={newItem.precioUnitario}
                                                                    onChange={(e) => setNewItem({ ...newItem, precioUnitario: parseFloat(e.target.value) })}
                                                                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-900 dark:text-white"
                                                                />
                                                            </td>
                                                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">
                                                                S/ {(newItem.cantidad * newItem.precioUnitario).toFixed(2)}
                                                            </td>
                                                            <td className="px-4 py-2 text-center">
                                                                <button type="button" onClick={addItem} className="text-blue-600 hover:text-blue-800 font-bold p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                                                                    <PlusIcon className="w-5 h-5" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Totals */}
                                    <div className="flex justify-end">
                                        <div className="w-72 space-y-3 bg-gray-50 dark:bg-zinc-800/30 p-4 rounded-xl border border-gray-100 dark:border-zinc-800">
                                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                                <span>Subtotal:</span>
                                                <span className="font-medium text-gray-900 dark:text-white">S/ {calculateTotals().subtotal.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                                                <span>IGV (18%):</span>
                                                <span className="font-medium text-gray-900 dark:text-white">S/ {calculateTotals().igv.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-lg font-bold border-t pt-3 border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white">
                                                <span>Total:</span>
                                                <span>S/ {calculateTotals().total.toFixed(2)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="px-6 py-5 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 rounded-b-xl flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="px-6 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg font-medium transition-colors"
                                    >
                                        {isReadOnly ? 'Cerrar' : 'Cancelar'}
                                    </button>
                                    {!isReadOnly && (
                                        <button
                                            onClick={handleSubmit}
                                            className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 font-medium"
                                        >
                                            Crear Orden
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
