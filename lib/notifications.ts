import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface CreateNotificationParams {
    userId: string;
    titulo: string;
    mensaje: string;
    tipo?: NotificationType;
    link?: string;
}

export const createNotification = async ({
    userId,
    titulo,
    mensaje,
    tipo = 'info',
    link
}: CreateNotificationParams) => {
    try {
        await addDoc(collection(db, "notificaciones"), {
            userId,
            titulo,
            mensaje,
            tipo,
            link,
            leido: false,
            fecha: serverTimestamp()
        });
    } catch (error) {
        console.error("Error creating notification:", error);
    }
};
