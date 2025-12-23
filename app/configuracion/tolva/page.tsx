"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import Swal from "sweetalert2";
import { FunnelIcon } from "@heroicons/react/24/outline";
import { Skeleton } from "@/app/components/ui/Skeleton";

export default function TolvaConfigPage() {
    const [loading, setLoading] = useState(true);
    const [capacidad, setCapacidad] = useState<number>(0);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const docRef = doc(db, "configuracion", "tolva_gruesos");
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setCapacidad(docSnap.data().capacidad || 0);
                }
            } catch (error) {
                console.error("Error fetching config:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchConfig();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await setDoc(doc(db, "configuracion", "tolva_gruesos"), {
                capacidad: Number(capacidad),
                updatedAt: new Date()
            }, { merge: true });

            Swal.fire({
                icon: 'success',
                title: 'Guardado',
                text: 'La configuración ha sido actualizada correctamente',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error("Error saving config:", error);
            Swal.fire('Error', 'No se pudo guardar la configuración', 'error');
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-64" />
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                    <Skeleton className="h-10 w-full mb-4" />
                    <Skeleton className="h-10 w-32" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Configuración de Tolva de Grueso</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Define los parámetros operativos para la Tolva de Gruesos.
                </p>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6">
                <div className="flex items-center gap-4 mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/20">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        <FunnelIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-medium text-blue-900 dark:text-blue-300">Parámetros Generales</h3>
                        <p className="text-sm text-blue-700 dark:text-blue-400">Configura la capacidad y límites operativos.</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="max-w-md space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Capacidad Máxima (Toneladas)
                        </label>
                        <div className="relative w-48">
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={capacidad}
                                onChange={(e) => setCapacidad(parseFloat(e.target.value) || 0)}
                                onWheel={(e) => e.currentTarget.blur()}
                                className="w-full pl-4 pr-12 py-2.5 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                placeholder="0.00"
                            />
                            <div className="absolute inset-y-0 right-3 pr-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 dark:text-gray-400 sm:text-sm">TM</span>
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Este valor se utilizará para calcular el porcentaje de llenado y alertas.
                        </p>
                    </div>

                    <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                        <button
                            type="submit"
                            className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg shadow-blue-600/20"
                        >
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
