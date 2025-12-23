import { db } from "@/lib/firebase";
import { collection, doc, runTransaction, serverTimestamp, addDoc, Timestamp } from "firebase/firestore";

export type TipoMovimiento = "ENTRADA" | "SALIDA" | "AJUSTE";
export type SubtipoMovimiento =
    | "COMPRA"
    | "INICIAL"
    | "DEVOLUCION"
    | "CONSUMO"
    | "MERMA"
    | "VENCIMIENTO"
    | "CORRECCION"
    | "TRANSFERENCIA"
    | "PRODUCCION";

export interface MovimientoParams {
    itemId: string;
    tipo: TipoMovimiento;
    subtipo: SubtipoMovimiento;
    cantidad: number;
    referencia?: string; // Documento soporte (guía, orden, vale)
    usuario?: string;
    observacion?: string;
    // New fields
    precioUnitario?: number;
    proveedor?: string;
    area?: string;
    responsable?: string;
    nuevoStock?: number; // Optional override
}

export async function registrarMovimiento({
    itemId,
    tipo,
    subtipo,
    cantidad,
    referencia = "",
    usuario = "Sistema",
    observacion = "",
    precioUnitario = 0,
    proveedor = "",
    area = "",
    responsable = ""
}: MovimientoParams) {
    try {
        if (!itemId) throw new Error("El ID del item es obligatorio");

        await runTransaction(db, async (transaction) => {
            const itemRef = doc(db, "almacen_items", itemId);
            const itemDoc = await transaction.get(itemRef);

            if (!itemDoc.exists()) {
                throw new Error("El item no existe");
            }

            const currentStock = itemDoc.data().stockActual || 0;
            let newStock = currentStock;

            // Calcular nuevo stock
            if (tipo === "ENTRADA") {
                newStock = currentStock + cantidad;
            } else if (tipo === "SALIDA") {
                if (currentStock < cantidad) {
                    throw new Error(`Stock insuficiente. Actual: ${currentStock}, Solicitado: ${cantidad}`);
                }
                newStock = currentStock - cantidad;
            } else if (tipo === "AJUSTE") {
                // En ajuste, 'cantidad' es el delta (positivo o negativo)
                newStock = currentStock + cantidad;
            }

            // Actualizar Item
            transaction.update(itemRef, {
                stockActual: newStock,
                updatedAt: serverTimestamp()
            });

            // Registrar Movimiento en Kardex
            const movimientoRef = doc(collection(db, "almacen_movimientos"));
            transaction.set(movimientoRef, {
                itemId,
                tipo,
                subtipo,
                cantidad: Math.abs(cantidad), // Guardamos valor absoluto en el registro
                saldoAnterior: currentStock,
                saldoNuevo: newStock,
                fecha: serverTimestamp(),
                referencia,
                usuario,
                observacion,
                precioUnitario,
                proveedor,
                area,
                responsable
            });
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error en registrarMovimiento:", error);
        throw new Error(error.message || "Error al registrar movimiento");
    }
}
