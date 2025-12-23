"use client";

import { format } from "date-fns";
import { EyeIcon, PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

type ProcurementItem = {
    id: string;
    fecha: Date;
    codigo: string;
    solicitante?: string;
    proveedor?: string;
    items: { nombre: string; cantidad: number; unidad: string }[];
    estado: "PENDIENTE" | "COTIZANDO" | "APROBADO" | "RECHAZADO" | "EMITIDA" | "RECIBIDA" | "CANCELADA";
    total?: number;
};

type Props = {
    title: string;
    data: ProcurementItem[];
    type: "REQUERIMIENTO" | "ORDEN";
    onView: (item: ProcurementItem) => void;
    onStatusChange?: (id: string, newStatus: string) => void;
    onEdit?: (item: ProcurementItem) => void;
    onDelete?: (id: string) => void;
};

export default function ProcurementTable({ title, data, type, onView, onStatusChange, onEdit, onDelete }: Props) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case "PENDIENTE": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
            case "COTIZANDO": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
            case "APROBADO": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
            case "RECHAZADO": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
            case "EMITIDA": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
            case "RECIBIDA": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
            case "CANCELADA": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Código</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                {type === "REQUERIMIENTO" ? "Solicitante" : "Proveedor"}
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Items</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">No hay registros</td>
                            </tr>
                        ) : (
                            data.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                        {item.codigo}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {format(item.fecha, "dd/MM/yyyy")}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {type === "REQUERIMIENTO" ? item.solicitante : item.proveedor}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {item.items.length} items
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(item.estado)}`}>
                                            {item.estado}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => onView(item)}
                                            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                            title="Ver Detalles"
                                        >
                                            <EyeIcon className="w-5 h-5" />
                                        </button>

                                        {type === "REQUERIMIENTO" && item.estado === "PENDIENTE" && (
                                            <>
                                                {onEdit && (
                                                    <button
                                                        onClick={() => onEdit(item)}
                                                        className="text-amber-600 hover:text-amber-800 dark:text-amber-400"
                                                        title="Editar"
                                                    >
                                                        <PencilIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                                {onDelete && (
                                                    <button
                                                        onClick={() => onDelete(item.id)}
                                                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                                                        title="Eliminar"
                                                    >
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}

                                                {onStatusChange && (
                                                    <>
                                                        <div className="inline-block w-px h-4 bg-gray-300 dark:bg-zinc-700 mx-1 align-middle"></div>
                                                        <button
                                                            onClick={() => onStatusChange(item.id, "APROBADO")}
                                                            className="text-green-600 hover:text-green-800 dark:text-green-400"
                                                            title="Aprobar"
                                                        >
                                                            <CheckCircleIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => onStatusChange(item.id, "RECHAZADO")}
                                                            className="text-red-600 hover:text-red-800 dark:text-red-400"
                                                            title="Rechazar"
                                                        >
                                                            <XCircleIcon className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
