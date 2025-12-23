import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";

export default function LiquidacionesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <div className="print:hidden">
                <Navbar />
                <Sidebar />
            </div>
            <main className="ml-64 mt-16 p-8 print:ml-0 print:mt-0 print:p-0">
                {children}
            </main>
        </div>
    );
}
