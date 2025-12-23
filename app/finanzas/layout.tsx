import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import { BanknotesIcon } from "@heroicons/react/24/outline";

export default function FinanzasLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <Navbar />
            <Sidebar />

            <main className="ml-64 mt-16 p-8">
                <div className="max-w-[1600px] mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-3">
                            <BanknotesIcon className="w-8 h-8 text-gray-700 dark:text-gray-300" />
                            Finanzas
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">Gestión de adelantos y caja chica</p>
                    </div>

                    {/* Content */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}
