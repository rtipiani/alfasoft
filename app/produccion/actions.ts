"use server";

import { db } from "@/lib/firebase";
import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";

export async function createProductionBatch(
    composition: { mineralId: string; quantity: number }[],
    startTime: string,
    clientData?: { tipoDoc: string; numDoc: string; nombre: string }
) {
    try {
        if (!composition || composition.length === 0) {
            throw new Error("Debe seleccionar al menos un mineral para el lote.");
        }

        await runTransaction(db, async (transaction) => {
            // 1. PREPARE READS
            const mineralRefs = composition.map(item => doc(db, "productos", item.mineralId));
            const tolvaRef = doc(db, "produccion_stats", "tolva_gruesos");

            // Execute all reads
            const mineralDocs = await Promise.all(mineralRefs.map(ref => transaction.get(ref)));
            const tolvaDoc = await transaction.get(tolvaRef);

            let totalQuantity = 0;
            const mineralNames: string[] = [];

            // 2. VALIDATE AND CALCULATE
            composition.forEach((item, index) => {
                const mineralDoc = mineralDocs[index];
                if (!mineralDoc.exists()) {
                    throw new Error(`El mineral con ID ${item.mineralId} no existe.`);
                }

                const mineralData = mineralDoc.data();
                const currentStock = mineralData.stockActual || 0;

                if (currentStock < item.quantity) {
                    throw new Error(`Stock insuficiente para ${mineralData.nombre}. Disponible: ${currentStock}, Solicitado: ${item.quantity}`);
                }

                totalQuantity += item.quantity;
                mineralNames.push(mineralData.nombre);
            });

            // 3. EXECUTE WRITES
            // Update Mineral Stocks
            composition.forEach((item, index) => {
                const mineralDoc = mineralDocs[index];
                const currentStock = mineralDoc.data()!.stockActual || 0;

                transaction.update(mineralRefs[index], {
                    stockActual: currentStock - item.quantity,
                    updatedAt: serverTimestamp()
                });
            });

            // Create Production Batch
            const batchRef = doc(collection(db, "production_batches"));
            transaction.set(batchRef, {
                composition,
                mineralName: mineralNames.join(" + "),
                quantity: totalQuantity,
                startTime: new Date(startTime),
                status: "programado",
                currentStage: "tolva_gruesos",
                clientData: clientData || null, // Save client data
                createdAt: serverTimestamp()
            });

            // Update Tolva Gruesos
            const currentTolvaStock = tolvaDoc.exists() ? (tolvaDoc.data().stock || 0) : 0;
            transaction.set(tolvaRef, {
                stock: currentTolvaStock + totalQuantity,
                lastUpdated: serverTimestamp()
            }, { merge: true });
        });

        return { success: true, message: "Lote de producción (Blend) programado correctamente." };
    } catch (error: any) {
        console.error("Error creating production batch:", error);
        return { success: false, message: error.message };
    }
}
