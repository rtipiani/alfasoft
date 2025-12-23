"use client";

import { useState, useEffect } from "react";
import { PlusIcon, ArchiveBoxIcon, DocumentTextIcon, ShoppingCartIcon, ClipboardDocumentListIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import ProcurementTable from "../components/ProcurementTable";
import InventoryTable from "../components/InventoryTable";
import KardexTable from "../components/KardexTable";
import Dialog from "@/app/components/Dialog";
import FormField from "@/app/components/FormField";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, addDoc, doc, updateDoc, orderBy, limit, serverTimestamp, deleteDoc } from "firebase/firestore";
import { registrarMovimiento } from "@/lib/almacen";
import Swal from "sweetalert2";
import { format } from "date-fns";

export default function MaterialesPage() {
    const [activeTab, setActiveTab] = useState<"INVENTARIO" | "REQUERIMIENTOS" | "ORDENES" | "KARDEX">("INVENTARIO");
    const [inventory, setInventory] = useState<any[]>([]);
    const [requirements, setRequirements] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);

    // Kardex State
    const [selectedItemForKardex, setSelectedItemForKardex] = useState<any>(null);
    const [kardexMovements, setKardexMovements] = useState<any[]>([]);

    // Dialog States
    const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
    const [isReqDialogOpen, setIsReqDialogOpen] = useState(false);
    const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
    const [isAjusteDialogOpen, setIsAjusteDialogOpen] = useState(false);

    // View Details State
    const [viewReqData, setViewReqData] = useState<any>(null);

    // Edit Mode State
    // Edit Mode State
    const [editingItem, setEditingItem] = useState<string | null>(null);
    const [editingReq, setEditingReq] = useState<string | null>(null);

    // Form States
    const [itemForm, setItemForm] = useState({
        codigo: "",
        nombre: "",
        unidad: "",
        stockMinimo: 0,
        categoria: "MATERIAL",
        marca: "",
        modelo: "",
        descripcion: "",
        stockMaximo: 0,
        puntoReorden: 0,
        costoUnitario: 0,
        ubicacion: "",
        lote: "",
        fechaVencimiento: ""
    });
    const [reqForm, setReqForm] = useState({ solicitante: "", itemId: "", cantidad: 0 });
    const [orderForm, setOrderForm] = useState({ proveedor: "", items: "" });

    // Expanded Ajuste Form
    const [ajusteForm, setAjusteForm] = useState({
        itemId: "",
        tipo: "ENTRADA",
        subtipo: "CORRECCION",
        cantidad: 0,
        motivo: "",
        referencia: "",
        precioUnitario: 0,
        responsable: ""
    });

    // Subscribe to Inventory (Materiales)
    useEffect(() => {
        const q = query(collection(db, "almacen_items"), where("tipo", "==", "MATERIAL"));
        const unsub = onSnapshot(q, (snap) => {
            setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    // Subscribe to Requirements
    useEffect(() => {
        const q = query(collection(db, "compras_requerimientos"), where("tipo", "==", "MATERIAL"));
        const unsub = onSnapshot(q, (snap) => {
            setRequirements(snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                fecha: d.data().fecha?.toDate()
            })));
        });
        return () => unsub();
    }, []);

    // Subscribe to Orders
    useEffect(() => {
        const q = query(collection(db, "compras_ordenes"), where("tipo", "==", "MATERIAL"));
        const unsub = onSnapshot(q, (snap) => {
            setOrders(snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                fecha: d.data().fecha?.toDate()
            })));
        });
        return () => unsub();
    }, []);

    // Load Kardex when an item is selected
    useEffect(() => {
        if (selectedItemForKardex) {
            const q = query(
                collection(db, "almacen_movimientos"),
                where("itemId", "==", selectedItemForKardex.id),
                orderBy("fecha", "desc"),
                limit(50)
            );
            const unsub = onSnapshot(q, (snap) => {
                setKardexMovements(snap.docs.map(d => ({ id: d.id, ...d.data(), fecha: d.data().fecha?.toDate() })));
            });
            return () => unsub();
        } else {
            setKardexMovements([]);
        }
    }, [selectedItemForKardex]);

    const handleEditItem = (item: any) => {
        setEditingItem(item.id);
        setItemForm({
            codigo: item.codigo || "",
            nombre: item.nombre || "",
            unidad: item.unidad || "",
            stockMinimo: item.stockMinimo || 0,
            categoria: item.categoria || "MATERIAL",
            marca: item.marca || "",
            modelo: item.modelo || "",
            descripcion: item.descripcion || "",
            stockMaximo: item.stockMaximo || 0,
            puntoReorden: item.puntoReorden || 0,
            costoUnitario: item.costoUnitario || 0,
            ubicacion: item.ubicacion || "",
            lote: item.lote || "",
            fechaVencimiento: item.fechaVencimiento || ""
        });
        setIsItemDialogOpen(true);
    };

    const handleDeleteItem = async (id: string) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: "Se eliminará el item y todo su historial. Esta acción no se puede deshacer.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                // TODO: Consider archiving instead of deleting if history exists
                await deleteDoc(doc(db, "almacen_items", id));
                Swal.fire('Eliminado', 'El item ha sido eliminado.', 'success');
            } catch (error: any) {
                Swal.fire('Error', error.message, 'error');
            }
        }
    };

    const handleSaveItem = async () => {
        try {
            if (editingItem) {
                // Update existing item
                await updateDoc(doc(db, "almacen_items", editingItem), {
                    ...itemForm,
                    updatedAt: serverTimestamp()
                });
                Swal.fire("Éxito", "Material actualizado correctamente", "success");
            } else {
                // Create new item
                const docRef = await addDoc(collection(db, "almacen_items"), {
                    ...itemForm,
                    tipo: "MATERIAL",
                    stockActual: 0,
                    createdAt: serverTimestamp()
                });

                // Initial movement only for new items
                await registrarMovimiento({
                    itemId: docRef.id,
                    tipo: "ENTRADA",
                    subtipo: "INICIAL",
                    cantidad: 0,
                    observacion: "Creación de item",
                    precioUnitario: Number(itemForm.costoUnitario),
                    area: itemForm.ubicacion,
                    responsable: "Sistema"
                });
                Swal.fire("Éxito", "Material creado correctamente", "success");
            }

            setIsItemDialogOpen(false);
            setEditingItem(null);
            setItemForm({
                codigo: "", nombre: "", unidad: "", stockMinimo: 0,
                categoria: "MATERIAL", marca: "", modelo: "", descripcion: "",
                stockMaximo: 0, puntoReorden: 0, costoUnitario: 0, ubicacion: "", lote: "", fechaVencimiento: ""
            });

        } catch (e: any) {
            Swal.fire("Error", e.message, "error");
        }
    };

    const handleSaveRequirement = async () => {
        const selectedItem = inventory.find(i => i.id === reqForm.itemId);
        if (!selectedItem) return;

        try {
            if (editingReq) {
                await updateDoc(doc(db, "compras_requerimientos", editingReq), {
                    solicitante: reqForm.solicitante,
                    items: [{
                        itemId: selectedItem.id,
                        nombre: selectedItem.nombre,
                        cantidad: Number(reqForm.cantidad),
                        unidad: selectedItem.unidad
                    }],
                    updatedAt: serverTimestamp()
                });
                Swal.fire("Éxito", "Requerimiento actualizado", "success");
            } else {
                await addDoc(collection(db, "compras_requerimientos"), {
                    tipo: "MATERIAL",
                    codigo: `REQ-MAT-${Date.now().toString().slice(-4)}`,
                    fecha: new Date(),
                    solicitante: reqForm.solicitante,
                    estado: "PENDIENTE",
                    items: [{
                        itemId: selectedItem.id,
                        nombre: selectedItem.nombre,
                        cantidad: Number(reqForm.cantidad),
                        unidad: selectedItem.unidad
                    }]
                });
                Swal.fire("Éxito", "Requerimiento creado", "success");
            }
            setIsReqDialogOpen(false);
            setEditingReq(null);
            setReqForm({ solicitante: "", itemId: "", cantidad: 0 });
        } catch (e) {
            console.error(e);
            Swal.fire("Error", "No se pudo guardar", "error");
        }
    };

    const handleEditRequirement = (req: any) => {
        setEditingReq(req.id);
        const item = req.items[0];
        setReqForm({
            solicitante: req.solicitante,
            itemId: item.itemId,
            cantidad: item.cantidad
        });
        setIsReqDialogOpen(true);
    };

    const handleDeleteRequirement = async (id: string) => {
        const result = await Swal.fire({
            title: '¿Eliminar Requerimiento?',
            text: "Esta acción no se puede deshacer.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar'
        });

        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, "compras_requerimientos", id));
                Swal.fire('Eliminado', 'Requerimiento eliminado.', 'success');
            } catch (error: any) {
                Swal.fire('Error', error.message, 'error');
            }
        }
    };

    const handleSaveOrder = async () => {
        try {
            await addDoc(collection(db, "compras_ordenes"), {
                tipo: "MATERIAL",
                codigo: `OC-MAT-${Date.now().toString().slice(-4)}`,
                fecha: new Date(),
                proveedor: orderForm.proveedor,
                estado: "EMITIDA",
                items: [{ nombre: orderForm.items, cantidad: 1, unidad: "GLB" }]
            });
            setIsOrderDialogOpen(false);
            setOrderForm({ proveedor: "", items: "" });
            Swal.fire("Éxito", "Orden creada", "success");
        } catch (e) {
            console.error(e);
            Swal.fire("Error", "No se pudo crear", "error");
        }
    };

    const handleRecepcionarOrden = async (orden: any) => {
        const { value: formValues } = await Swal.fire({
            title: 'Recepcionar Orden',
            html:
                '<p class="mb-2 text-sm text-gray-600">Seleccione el item a ingresar al inventario</p>' +
                `<select id="swal-input1" class="swal2-input">
                ${inventory.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('')}
            </select>` +
                '<input id="swal-input2" type="number" placeholder="Cantidad" class="swal2-input">',
            focusConfirm: false,
            preConfirm: () => {
                return [
                    (document.getElementById('swal-input1') as HTMLInputElement).value,
                    (document.getElementById('swal-input2') as HTMLInputElement).value
                ]
            }
        });

        if (formValues) {
            const [itemId, cantidad] = formValues;
            try {
                await registrarMovimiento({
                    itemId,
                    tipo: "ENTRADA",
                    subtipo: "COMPRA",
                    cantidad: Number(cantidad),
                    referencia: orden.codigo,
                    observacion: `Recepción de Orden ${orden.codigo}`
                });

                await updateDoc(doc(db, "compras_ordenes", orden.id), { estado: "RECIBIDA" });
                Swal.fire("Éxito", "Orden recepcionada y stock actualizado", "success");
            } catch (e: any) {
                Swal.fire("Error", e.message, "error");
            }
        }
    };

    const handleSaveAjuste = async () => {
        if (!ajusteForm.itemId) {
            Swal.fire("Error", "Debe seleccionar un item", "error");
            return;
        }
        try {
            await registrarMovimiento({
                itemId: ajusteForm.itemId,
                tipo: ajusteForm.tipo as any,
                subtipo: ajusteForm.subtipo as any,
                cantidad: Number(ajusteForm.cantidad),
                observacion: ajusteForm.motivo,
                referencia: ajusteForm.referencia,
                precioUnitario: Number(ajusteForm.precioUnitario),
                responsable: ajusteForm.responsable
            });
            setIsAjusteDialogOpen(false);
            setAjusteForm({
                itemId: "", tipo: "ENTRADA", subtipo: "CORRECCION",
                cantidad: 0, motivo: "", referencia: "", precioUnitario: 0, responsable: ""
            });
            Swal.fire("Éxito", "Movimiento registrado", "success");
        } catch (e: any) {
            Swal.fire("Error", e.message, "error");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ArchiveBoxIcon className="w-8 h-8 text-amber-600" />
                        Almacén de Materiales
                    </h2>
                    <p className="text-gray-500 dark:text-gray-400">Gestión de inventario y compras de materiales</p>
                </div>
                <div className="flex gap-2">
                    {activeTab === "INVENTARIO" && (
                        <>
                            <button
                                onClick={() => setIsAjusteDialogOpen(true)}
                                className="px-4 py-2 bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 transition flex items-center gap-2"
                            >
                                <ArrowPathIcon className="w-5 h-5" />
                                Ajuste / Conteo
                            </button>
                            <button
                                onClick={() => {
                                    setEditingItem(null);
                                    setItemForm({
                                        codigo: "", nombre: "", unidad: "", stockMinimo: 0,
                                        categoria: "MATERIAL", marca: "", modelo: "", descripcion: "",
                                        stockMaximo: 0, puntoReorden: 0, costoUnitario: 0, ubicacion: "", lote: "", fechaVencimiento: ""
                                    });
                                    setIsItemDialogOpen(true);
                                }}
                                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-2"
                            >
                                <PlusIcon className="w-5 h-5" />
                                Nuevo Item
                            </button>
                        </>
                    )}
                    {activeTab === "REQUERIMIENTOS" && (
                        <button
                            onClick={() => {
                                setEditingReq(null);
                                setReqForm({ solicitante: "", itemId: "", cantidad: 0 });
                                setIsReqDialogOpen(true);
                            }}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-2"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Nuevo Requerimiento
                        </button>
                    )}
                    {activeTab === "ORDENES" && (
                        <button
                            onClick={() => setIsOrderDialogOpen(true)}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition flex items-center gap-2"
                        >
                            <PlusIcon className="w-5 h-5" />
                            Nueva Orden
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-zinc-800">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab("INVENTARIO")}
                        className={`
                        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                        ${activeTab === "INVENTARIO"
                                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }
                    `}
                    >
                        <ArchiveBoxIcon className="w-5 h-5" />
                        Inventario
                    </button>
                    <button
                        onClick={() => setActiveTab("REQUERIMIENTOS")}
                        className={`
                        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                        ${activeTab === "REQUERIMIENTOS"
                                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }
                    `}
                    >
                        <DocumentTextIcon className="w-5 h-5" />
                        Requerimientos
                    </button>
                    <button
                        onClick={() => setActiveTab("ORDENES")}
                        className={`
                        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                        ${activeTab === "ORDENES"
                                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }
                    `}
                    >
                        <ShoppingCartIcon className="w-5 h-5" />
                        Órdenes de Compra
                    </button>
                    <button
                        onClick={() => setActiveTab("KARDEX")}
                        className={`
                        whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                        ${activeTab === "KARDEX"
                                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }
                    `}
                    >
                        <ClipboardDocumentListIcon className="w-5 h-5" />
                        Kardex
                    </button>
                </nav>
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {activeTab === "INVENTARIO" && (
                    <InventoryTable
                        data={inventory}
                        onEdit={handleEditItem}
                        onDelete={handleDeleteItem}
                    />
                )}

                {/* ... other tabs ... */}
                {activeTab === "REQUERIMIENTOS" && (
                    <ProcurementTable
                        title="Requerimientos de Materiales"
                        data={requirements}
                        type="REQUERIMIENTO"
                        onView={(item) => setViewReqData(item)}
                        onEdit={handleEditRequirement}
                        onDelete={handleDeleteRequirement}
                        onStatusChange={async (id, status) => {
                            await updateDoc(doc(db, "compras_requerimientos", id), { estado: status });
                        }}
                    />
                )}

                {activeTab === "ORDENES" && (
                    <div className="space-y-4">
                        <ProcurementTable
                            title="Órdenes de Compra - Materiales"
                            data={orders}
                            type="ORDEN"
                            onView={(item) => {
                                if (item.estado !== "RECIBIDA") {
                                    handleRecepcionarOrden(item);
                                }
                            }}
                        />
                        <p className="text-sm text-gray-500 italic">* Haga clic en el ojo para recepcionar una orden y cargar el inventario.</p>
                    </div>
                )}

                {activeTab === "KARDEX" && (
                    <div className="space-y-4">
                        <div className="flex gap-4 items-center bg-gray-50 dark:bg-zinc-800 p-4 rounded-lg">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ver Kardex de:</span>
                            <select
                                className="border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-zinc-900 dark:border-zinc-700"
                                value={selectedItemForKardex?.id || ""}
                                onChange={(e) => {
                                    const item = inventory.find(i => i.id === e.target.value);
                                    setSelectedItemForKardex(item);
                                }}
                            >
                                <option value="">Seleccione un item...</option>
                                {inventory.map(i => (
                                    <option key={i.id} value={i.id}>{i.nombre}</option>
                                ))}
                            </select>
                        </div>

                        {selectedItemForKardex ? (
                            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow">
                                <div className="p-4 border-b border-gray-200 dark:border-zinc-700">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                                        Movimientos de {selectedItemForKardex.nombre}
                                    </h3>
                                    <p className="text-sm text-gray-500">Stock Actual: {selectedItemForKardex.stockActual} {selectedItemForKardex.unidad}</p>
                                </div>
                                <KardexTable movimientos={kardexMovements} />
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                Seleccione un item para ver sus movimientos
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Dialogs */}

            {/* View Requirement Dialog */}
            <Dialog
                isOpen={!!viewReqData}
                onClose={() => setViewReqData(null)}
                title={`Detalles del Requerimiento - ${viewReqData?.codigo}`}
                maxWidth="max-w-2xl"
            >
                {viewReqData && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase">Solicitante</label>
                                <p className="text-gray-900 dark:text-white text-base">{viewReqData.solicitante}</p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase">Fecha</label>
                                <p className="text-gray-900 dark:text-white text-base">
                                    {viewReqData.fecha ? format(viewReqData.fecha, "dd/MM/yyyy HH:mm") : "N/A"}
                                </p>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase">Estado</label>
                                <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold mt-1
                                    ${viewReqData.estado === "PENDIENTE" ? "bg-yellow-100 text-yellow-800" :
                                        viewReqData.estado === "APROBADO" ? "bg-green-100 text-green-800" :
                                            viewReqData.estado === "RECHAZADO" ? "bg-red-100 text-red-800" :
                                                "bg-gray-100 text-gray-800"}`}
                                >
                                    {viewReqData.estado}
                                </span>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Items Solicitados</h4>
                            <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-zinc-700 dark:text-gray-300">
                                        <tr>
                                            <th className="px-4 py-2">Item</th>
                                            <th className="px-4 py-2 text-right">Cantidad</th>
                                            <th className="px-4 py-2">Unidad</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewReqData.items?.map((item: any, idx: number) => (
                                            <tr key={idx} className="border-b dark:border-zinc-700 last:border-0">
                                                <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{item.nombre}</td>
                                                <td className="px-4 py-2 text-right">{item.cantidad}</td>
                                                <td className="px-4 py-2 text-gray-500">{item.unidad}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                onClick={() => setViewReqData(null)}
                                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}
            </Dialog>

            <Dialog
                isOpen={isItemDialogOpen}
                onClose={() => {
                    setIsItemDialogOpen(false);
                    setEditingItem(null);
                }}
                title={editingItem ? "Editar Material" : "Nuevo Producto / Material"}
                maxWidth="max-w-4xl"
            >
                <div className="space-y-6">
                    {/* A. Datos del Producto */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 border-b border-gray-200 dark:border-zinc-700 pb-2">A. Datos del Producto</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField label="Código">
                                <input
                                    type="text"
                                    value={itemForm.codigo}
                                    onChange={(e) => setItemForm({ ...itemForm, codigo: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                    placeholder="COD-001"
                                />
                            </FormField>
                            <FormField label="Nombre">
                                <input
                                    type="text"
                                    value={itemForm.nombre}
                                    onChange={(e) => setItemForm({ ...itemForm, nombre: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                    placeholder="Nombre del producto"
                                />
                            </FormField>
                            <FormField label="Categoría">
                                <select
                                    value={itemForm.categoria || "MATERIAL"}
                                    onChange={(e) => setItemForm({ ...itemForm, categoria: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                >
                                    <option value="MATERIAL">Material</option>
                                    <option value="INSUMO">Insumo</option>
                                    <option value="REPUESTO">Repuesto</option>
                                    <option value="EPP">EPP</option>
                                    <option value="HERRAMIENTA">Herramienta</option>
                                </select>
                            </FormField>
                            <FormField label="Unidad de Medida">
                                <input
                                    type="text"
                                    value={itemForm.unidad}
                                    onChange={(e) => setItemForm({ ...itemForm, unidad: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                    placeholder="kg, L, und..."
                                />
                            </FormField>
                            <FormField label="Marca (Opcional)">
                                <input
                                    type="text"
                                    value={itemForm.marca || ""}
                                    onChange={(e) => setItemForm({ ...itemForm, marca: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                    placeholder="Marca del material"
                                />
                            </FormField>
                            <FormField label="Modelo / Serie (Opcional)">
                                <input
                                    type="text"
                                    value={itemForm.modelo || ""}
                                    onChange={(e) => setItemForm({ ...itemForm, modelo: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                    placeholder="Modelo o Serie"
                                />
                            </FormField>
                        </div>
                        <FormField label="Descripción (Opcional)">
                            <textarea
                                value={itemForm.descripcion || ""}
                                onChange={(e) => setItemForm({ ...itemForm, descripcion: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                rows={2}
                            />
                        </FormField>
                    </div>

                    {/* B. Datos de Stock */}
                    <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-3 border-b border-gray-200 dark:border-zinc-700 pb-2">B. Datos de Stock y Ubicación</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <FormField label="Stock Mínimo">
                                <input
                                    type="number"
                                    value={itemForm.stockMinimo}
                                    onChange={(e) => setItemForm({ ...itemForm, stockMinimo: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                />
                            </FormField>
                            <FormField label="Stock Máximo (Opcional)">
                                <input
                                    type="number"
                                    value={itemForm.stockMaximo || ""}
                                    onChange={(e) => setItemForm({ ...itemForm, stockMaximo: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                />
                            </FormField>
                            <FormField label="Punto de Reorden">
                                <input
                                    type="number"
                                    value={itemForm.puntoReorden || 0}
                                    onChange={(e) => setItemForm({ ...itemForm, puntoReorden: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                />
                            </FormField>
                            <FormField label="Costo Unitario (Ref)">
                                <input
                                    type="number"
                                    value={itemForm.costoUnitario || 0}
                                    onChange={(e) => setItemForm({ ...itemForm, costoUnitario: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                />
                            </FormField>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <FormField label="Ubicación (Estante/Zona)">
                                <input
                                    type="text"
                                    value={itemForm.ubicacion || ""}
                                    onChange={(e) => setItemForm({ ...itemForm, ubicacion: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                    placeholder="Ej: Estante A-1"
                                />
                            </FormField>
                            <FormField label="Lote / Batch (Inicial)">
                                <input
                                    type="text"
                                    value={itemForm.lote || ""}
                                    onChange={(e) => setItemForm({ ...itemForm, lote: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                />
                            </FormField>
                            <FormField label="Fecha Vencimiento (Si aplica)">
                                <input
                                    type="date"
                                    value={itemForm.fechaVencimiento || ""}
                                    onChange={(e) => setItemForm({ ...itemForm, fechaVencimiento: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50"
                                />
                            </FormField>
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 gap-3">
                        <button
                            onClick={() => {
                                setIsItemDialogOpen(false);
                                setEditingItem(null);
                            }}
                            className="px-6 py-3 bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition font-semibold"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveItem}
                            className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-semibold"
                        >
                            {editingItem ? "Actualizar Producto" : "Guardar Producto"}
                        </button>
                    </div>
                </div>
            </Dialog>

            <Dialog isOpen={isReqDialogOpen} onClose={() => {
                setIsReqDialogOpen(false);
                setEditingReq(null);
            }} title={editingReq ? "Editar Requerimiento" : "Nuevo Requerimiento"} maxWidth="max-w-2xl">
                <div className="space-y-4">
                    <FormField label="Solicitante">
                        <input
                            type="text"
                            value={reqForm.solicitante}
                            onChange={(e) => setReqForm({ ...reqForm, solicitante: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        />
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Item">
                            <select
                                value={reqForm.itemId}
                                onChange={(e) => setReqForm({ ...reqForm, itemId: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                            >
                                <option value="">Seleccionar Item</option>
                                {inventory.map(item => (
                                    <option key={item.id} value={item.id}>{item.nombre}</option>
                                ))}
                            </select>
                        </FormField>
                        <FormField label="Cantidad">
                            <input
                                type="number"
                                value={reqForm.cantidad}
                                onChange={(e) => setReqForm({ ...reqForm, cantidad: Number(e.target.value) })}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                            />
                        </FormField>
                    </div>
                    <div className="flex justify-end pt-4 gap-2">
                        <button
                            onClick={() => {
                                setIsReqDialogOpen(false);
                                setEditingReq(null);
                            }}
                            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveRequirement}
                            className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-semibold"
                        >
                            {editingReq ? "Actualizar Requerimiento" : "Crear Requerimiento"}
                        </button>
                    </div>
                </div>
            </Dialog>

            <Dialog isOpen={isOrderDialogOpen} onClose={() => setIsOrderDialogOpen(false)} title="Nueva Orden de Compra" maxWidth="max-w-2xl">
                <div className="space-y-4">
                    <FormField label="Proveedor">
                        <input
                            type="text"
                            value={orderForm.proveedor}
                            onChange={(e) => setOrderForm({ ...orderForm, proveedor: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        />
                    </FormField>
                    <FormField label="Items (Descripción)">
                        <textarea
                            value={orderForm.items}
                            onChange={(e) => setOrderForm({ ...orderForm, items: e.target.value })}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                            rows={3}
                        />
                    </FormField>
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSaveOrder}
                            className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-semibold"
                        >
                            Crear Orden
                        </button>
                    </div>
                </div>
            </Dialog>

            <Dialog isOpen={isAjusteDialogOpen} onClose={() => setIsAjusteDialogOpen(false)} title="Registro de Movimiento / Ajuste" maxWidth="max-w-2xl">
                <div className="space-y-4">
                    <FormField label="Item">
                        <select
                            value={ajusteForm.itemId}
                            onChange={(e) => {
                                const item = inventory.find(i => i.id === e.target.value);
                                setAjusteForm({
                                    ...ajusteForm,
                                    itemId: e.target.value,
                                    precioUnitario: item ? item.costoUnitario || 0 : 0
                                });
                            }}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        >
                            <option value="">Seleccionar Item</option>
                            {inventory.map(item => (
                                <option key={item.id} value={item.id}>{item.nombre} (Stock: {item.stockActual})</option>
                            ))}
                        </select>
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Tipo Movimiento">
                            <select
                                value={ajusteForm.tipo}
                                onChange={(e) => setAjusteForm({ ...ajusteForm, tipo: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                            >
                                <option value="ENTRADA">ENTRADA (Agregar)</option>
                                <option value="SALIDA">SALIDA (Quitar)</option>
                                <option value="AJUSTE">AJUSTE (Inventario Físico)</option>
                            </select>
                        </FormField>
                        <FormField label="Subtipo / Motivo">
                            <select
                                value={ajusteForm.subtipo}
                                onChange={(e) => setAjusteForm({ ...ajusteForm, subtipo: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                            >
                                {ajusteForm.tipo === "ENTRADA" && (
                                    <>
                                        <option value="COMPRA">Compra</option>
                                        <option value="DEVOLUCION">Devolución</option>
                                        <option value="TRANSFERENCIA">Transferencia</option>
                                        <option value="CORRECCION">Corrección (+)</option>
                                    </>
                                )}
                                {ajusteForm.tipo === "SALIDA" && (
                                    <>
                                        <option value="CONSUMO">Consumo Interno</option>
                                        <option value="MERMA">Merma / Desecho</option>
                                        <option value="VENCIMIENTO">Vencimiento</option>
                                        <option value="TRANSFERENCIA">Transferencia</option>
                                        <option value="CORRECCION">Corrección (-)</option>
                                    </>
                                )}
                                {ajusteForm.tipo === "AJUSTE" && (
                                    <>
                                        <option value="INICIAL">Inventario Inicial</option>
                                        <option value="CORRECCION">Ajuste de Inventario</option>
                                    </>
                                )}
                            </select>
                        </FormField>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Cantidad">
                            <input
                                type="number"
                                value={ajusteForm.cantidad}
                                onChange={(e) => setAjusteForm({ ...ajusteForm, cantidad: Number(e.target.value) })}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                            />
                        </FormField>
                        <FormField label="Precio Unitario (Opcional)">
                            <input
                                type="number"
                                value={ajusteForm.precioUnitario}
                                onChange={(e) => setAjusteForm({ ...ajusteForm, precioUnitario: Number(e.target.value) })}
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                            />
                        </FormField>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Documento / Referencia">
                            <input
                                type="text"
                                value={ajusteForm.referencia}
                                onChange={(e) => setAjusteForm({ ...ajusteForm, referencia: e.target.value })}
                                placeholder="Ej: Guía 001-123"
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                            />
                        </FormField>
                        <FormField label="Responsable">
                            <input
                                type="text"
                                value={ajusteForm.responsable}
                                onChange={(e) => setAjusteForm({ ...ajusteForm, responsable: e.target.value })}
                                placeholder="Nombre del responsable"
                                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                            />
                        </FormField>
                    </div>

                    <FormField label="Observación">
                        <textarea
                            value={ajusteForm.motivo}
                            onChange={(e) => setAjusteForm({ ...ajusteForm, motivo: e.target.value })}
                            placeholder="Detalles adicionales..."
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border border-transparent focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                            rows={2}
                        />
                    </FormField>
                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSaveAjuste}
                            className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-semibold"
                        >
                            Registrar Movimiento
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
