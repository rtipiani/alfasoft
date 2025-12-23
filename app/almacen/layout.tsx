"use client";

import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import { ArchiveBoxIcon } from "@heroicons/react/24/outline";

export default function AlmacenLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <Navbar />
            <Sidebar />

            <main className="ml-64 mt-16 p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                            <ArchiveBoxIcon className="w-8 h-8 text-blue-600" />
                            Gestión de Almacén
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Control de inventario, movimientos y logística.
                        </p>
                    </div>

                    {/* Content */}
                    {children}
                </div>
            </main>
        </div>
    );
}
