"use client";


import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import {
    CogIcon
} from "@heroicons/react/24/outline";

export default function ConfigurationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <Navbar />
            <Sidebar />

            <main className="ml-64 mt-16 p-8">
                <div className="max-w-[1600px] mx-auto space-y-6">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                                <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
                                    <CogIcon className="w-6 h-6 text-white" />
                                </div>
                                <span className="bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent">
                                    Configuración
                                </span>
                            </h1>
                            <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm">
                                Administra las preferencias y parámetros generales del sistema
                            </p>
                        </div>
                    </div>

                    {/* Content Card */}
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-black/20 border border-gray-200/60 dark:border-zinc-800/60 backdrop-blur-xl overflow-hidden">
                        <div className="p-6 md:p-8">
                            {children}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
