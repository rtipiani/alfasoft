import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | number): string {
    return new Date(date).toLocaleDateString("es-PE", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("es-PE", {
        style: "currency",
        currency: "PEN",
    }).format(amount);
}
