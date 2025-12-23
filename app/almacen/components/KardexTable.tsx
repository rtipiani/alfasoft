import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Movimiento {
    id: string;
    fecha: any; // Firestore Timestamp
    tipo: string;
    subtipo: string;
    cantidad: number;
    saldoAnterior: number;
    saldoNuevo: number;
    referencia: string;
    usuario: string;
    observacion: string;
    precioUnitario?: number;
    responsable?: string;
}

interface Props {
    movimientos: Movimiento[];
}

export default function KardexTable({ movimientos }: Props) {
    if (movimientos.length === 0) {
        return <div className="text-center py-8 text-gray-500">No hay movimientos registrados para este item.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
                <thead className="bg-gray-50 dark:bg-zinc-800">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Detalle</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Precio Unit.</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entrada</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Salida</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Saldo</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ref. / Resp.</th>
                    </tr>
                </thead>
                <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
                    {movimientos.map((mov) => {
                        const isEntrada = mov.tipo === "ENTRADA" || (mov.tipo === "AJUSTE" && mov.saldoNuevo > mov.saldoAnterior);
                        const isSalida = mov.tipo === "SALIDA" || (mov.tipo === "AJUSTE" && mov.saldoNuevo < mov.saldoAnterior);

                        // Handle date formatting safely
                        let formattedDate = "-";
                        if (mov.fecha) {
                            try {
                                // Check if it's a Firestore Timestamp (has toDate method)
                                if (typeof mov.fecha.toDate === 'function') {
                                    formattedDate = format(mov.fecha.toDate(), "dd/MM/yyyy HH:mm", { locale: es });
                                }
                                // Check if it's already a Date object
                                else if (mov.fecha instanceof Date) {
                                    formattedDate = format(mov.fecha, "dd/MM/yyyy HH:mm", { locale: es });
                                }
                                // Check if it's a string or number that can be parsed
                                else {
                                    formattedDate = format(new Date(mov.fecha), "dd/MM/yyyy HH:mm", { locale: es });
                                }
                            } catch (e) {
                                console.error("Error formatting date:", e);
                                formattedDate = "Fecha inválida";
                            }
                        }

                        return (
                            <tr key={mov.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {formattedDate}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                        ${mov.tipo === 'ENTRADA' ? 'bg-green-100 text-green-800' :
                                            mov.tipo === 'SALIDA' ? 'bg-red-100 text-red-800' :
                                                'bg-yellow-100 text-yellow-800'}`}>
                                        {mov.tipo}
                                    </span>
                                    <div className="text-xs text-gray-400 mt-1">{mov.subtipo}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {mov.observacion || "-"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500 dark:text-gray-400">
                                    {mov.precioUnitario ? `S/ ${mov.precioUnitario.toFixed(2)}` : "-"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-green-600 font-medium">
                                    {isEntrada ? `+${mov.cantidad}` : ""}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-red-600 font-medium">
                                    {isSalida ? `-${mov.cantidad}` : ""}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900 dark:text-white">
                                    {mov.saldoNuevo}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    <div className="flex flex-col">
                                        <span>{mov.referencia || "-"}</span>
                                        {mov.responsable && <span className="text-xs text-gray-400">Resp: {mov.responsable}</span>}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
