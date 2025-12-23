"use server";

import { db } from "@/lib/firebase";
import { collection, doc, runTransaction, Timestamp } from "firebase/firestore";

export async function createGateEntry(data: any) {
    try {
        await runTransaction(db, async (transaction) => {
            // 1. ALL READS FIRST
            // Check Cancha Stock if applicable
            let canchaDoc: any = null;
            let currentStock = 0;
            const canchaRef = data.canchaId ? doc(db, "canchas", data.canchaId) : null;

            if (canchaRef && data.tipoOperacion === "entrada" && data.pesoNeto > 0) {
                canchaDoc = await transaction.get(canchaRef);
                if (!canchaDoc.exists()) {
                    throw new Error("La cancha seleccionada no existe.");
                }
                currentStock = canchaDoc.data().stockActual || 0;
            }

            // 2. ALL WRITES NEXT
            const entryRef = doc(collection(db, "garita_registros"));
            const entryData = {
                ...data,
                timestamp: Timestamp.now(),
                status: "aprobado",
            };

            // 2.1 Create Almacen Item (if applicable)
            if (data.tipoOperacion === "entrada" && data.canchaNombre && data.pesoNeto > 0) {
                const almacenItemRef = doc(collection(db, "almacen_items"));
                const almacenItemData = {
                    nombre: data.descripcionProducto || "Mineral Sin Nombre",
                    tipo: "MINERAL",
                    categoria: "MINERAL",
                    unidad: "TM",
                    stockActual: data.pesoNeto,
                    ubicacion: data.canchaNombre,
                    origen: data.nombreRemitente || "Garita",
                    ley: "",
                    stockMinimo: 0,
                    createdAt: Timestamp.now(),
                    gateEntryId: entryRef.id
                };

                transaction.set(almacenItemRef, almacenItemData);
                entryData.almacenItemId = almacenItemRef.id;
            }

            // 2.2 Update Cancha Stock
            if (canchaRef && canchaDoc) {
                const newStock = currentStock + data.pesoNeto;
                transaction.update(canchaRef, {
                    stockActual: newStock,
                    updatedAt: Timestamp.now()
                });
            }

            // 2.3 Save Entry
            transaction.set(entryRef, entryData);
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error creating gate entry:", error);
        return { success: false, error: error.message };
    }
}

export async function updateGateEntry(id: string, data: any) {
    try {
        await runTransaction(db, async (transaction) => {
            // 1. ALL READS FIRST
            const entryRef = doc(db, "garita_registros", id);
            const entryDoc = await transaction.get(entryRef);

            if (!entryDoc.exists()) {
                throw new Error("Registro no encontrado");
            }

            const oldData = entryDoc.data();

            // Prepare Reads for Canchas
            let oldCanchaDoc: any = null;
            let newCanchaDoc: any = null;
            const oldCanchaRef = oldData.canchaId ? doc(db, "canchas", oldData.canchaId) : null;
            const newCanchaRef = data.canchaId ? doc(db, "canchas", data.canchaId) : null;

            if (data.tipoOperacion === "entrada") {
                if (oldCanchaRef) oldCanchaDoc = await transaction.get(oldCanchaRef);

                if (newCanchaRef && (!oldCanchaRef || newCanchaRef.id !== oldCanchaRef.id)) {
                    newCanchaDoc = await transaction.get(newCanchaRef);
                } else if (newCanchaRef && oldCanchaRef && newCanchaRef.id === oldCanchaRef.id) {
                    newCanchaDoc = oldCanchaDoc;
                }
            }

            // 2. ALL WRITES NEXT
            // Update Stock
            if (data.tipoOperacion === "entrada") {
                // Revert old
                if (oldCanchaDoc && oldCanchaDoc.exists() && oldCanchaRef) {
                    const currentStock = oldCanchaDoc.data().stockActual || 0;
                    transaction.update(oldCanchaRef, { stockActual: currentStock - oldData.pesoNeto });
                }

                // Apply new
                if (newCanchaDoc && newCanchaDoc.exists() && newCanchaRef) {
                    if (oldCanchaRef && newCanchaRef && oldCanchaRef.id === newCanchaRef.id) {
                        // Same doc. Net change = new - old
                        const currentStock = oldCanchaDoc.data().stockActual || 0;
                        transaction.update(newCanchaRef, { stockActual: currentStock - oldData.pesoNeto + data.pesoNeto });
                    } else {
                        // Different docs.
                        const currentStock = newCanchaDoc.data().stockActual || 0;
                        transaction.update(newCanchaRef, { stockActual: currentStock + data.pesoNeto });
                    }
                }
            }

            transaction.update(entryRef, {
                ...data,
                updatedAt: Timestamp.now()
            });

            // Determine valid cancha name
            const activeCanchaName = data.canchaNombre || (newCanchaDoc && newCanchaDoc.exists() ? newCanchaDoc.data().nombre : "");

            // Sync Almacen Item
            if (oldData.almacenItemId) {
                const almacenItemRef = doc(db, "almacen_items", oldData.almacenItemId);
                if (data.tipoOperacion === "entrada") {
                    transaction.update(almacenItemRef, {
                        nombre: data.descripcionProducto,
                        stockActual: data.pesoNeto,
                        ubicacion: activeCanchaName,
                        origen: data.nombreRemitente,
                        updatedAt: Timestamp.now()
                    });
                }
            } else if (data.tipoOperacion === "entrada" && activeCanchaName && data.pesoNeto > 0) {
                // Link Missing? Create it (Backfill/Repair)
                const almacenItemRef = doc(collection(db, "almacen_items"));
                const almacenItemData = {
                    nombre: data.descripcionProducto || "Mineral Sin Nombre",
                    tipo: "MINERAL",
                    categoria: "MINERAL",
                    unidad: "TM",
                    stockActual: data.pesoNeto,
                    ubicacion: activeCanchaName,
                    origen: data.nombreRemitente || "Garita",
                    ley: "",
                    stockMinimo: 0,
                    createdAt: Timestamp.now(),
                    gateEntryId: entryRef.id
                };

                transaction.set(almacenItemRef, almacenItemData);
                transaction.update(entryRef, { almacenItemId: almacenItemRef.id });
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error updating gate entry:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteGateEntry(id: string) {
    try {
        await runTransaction(db, async (transaction) => {
            // 1. Reads
            const entryRef = doc(db, "garita_registros", id);
            const entryDoc = await transaction.get(entryRef);

            if (!entryDoc.exists()) {
                throw new Error("Registro no encontrado");
            }

            const data = entryDoc.data();
            let canchaDoc: any = null;
            const canchaRef = (data.tipoOperacion === "entrada" && data.canchaId) ? doc(db, "canchas", data.canchaId) : null;

            if (canchaRef) {
                canchaDoc = await transaction.get(canchaRef);
            }

            // 2. Writes
            // Revert stock
            if (canchaRef && canchaDoc && canchaDoc.exists()) {
                const currentStock = canchaDoc.data().stockActual || 0;
                transaction.update(canchaRef, { stockActual: currentStock - data.pesoNeto });
            }

            transaction.delete(entryRef);

            // Delete Almacen Item
            if (data.almacenItemId) {
                const almacenItemRef = doc(db, "almacen_items", data.almacenItemId);
                transaction.delete(almacenItemRef);
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error deleting gate entry:", error);
        return { success: false, error: error.message };
    }
}
