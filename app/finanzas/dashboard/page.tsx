"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
    BanknotesIcon,
    ArrowTrendingUpIcon,
    UserGroupIcon,
    DocumentCheckIcon,
    CalendarDaysIcon,
    FunnelIcon,
    ClockIcon
} from "@heroicons/react/24/outline";
import { Skeleton } from "@/app/components/ui/Skeleton";

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
);

type Adelanto = {
    id: string;
    monto: number;
    moneda: "PEN" | "USD";
    estado: string;
    clienteNombre: string;
    fecha: Date;
    timestamp: Date;
};

export default function FinanzasDashboard() {
    const [adelantos, setAdelantos] = useState<Adelanto[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "finanzas_adelantos"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    fecha: d.fecha?.toDate() || new Date(),
                    timestamp: d.timestamp?.toDate() || new Date()
                };
            }) as Adelanto[];
            setAdelantos(data);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // --- Statistics Calculations ---

    // Separate totals for Pendiente
    const totalPendientePEN = adelantos
        .filter(a => a.estado === 'pendiente' && a.moneda === 'PEN')
        .reduce((acc, curr) => acc + curr.monto, 0);

    const totalPendienteUSD = adelantos
        .filter(a => a.estado === 'pendiente' && a.moneda === 'USD')
        .reduce((acc, curr) => acc + curr.monto, 0);

    // Separate totals for Aprobado/Pagado
    const totalAprobadoPEN = adelantos
        .filter(a => (a.estado === 'aprobado' || a.estado === 'pagado') && a.moneda === 'PEN')
        .reduce((acc, curr) => acc + curr.monto, 0);

    const totalAprobadoUSD = adelantos
        .filter(a => (a.estado === 'aprobado' || a.estado === 'pagado') && a.moneda === 'USD')
        .reduce((acc, curr) => acc + curr.monto, 0);

    // 1. Bar Chart: Top 5 Clients (Maintains approximate conversion for sorting/visuals only)
    const clientMap = new Map<string, number>();
    adelantos.forEach(a => {
        const amount = a.moneda === 'USD' ? a.monto * 3.75 : a.monto;
        clientMap.set(a.clienteNombre, (clientMap.get(a.clienteNombre) || 0) + amount);
    });

    const sortedClients = Array.from(clientMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const barChartData = {
        labels: sortedClients.map(c => c[0]),
        datasets: [
            {
                label: 'Volumen Aprox (S/)',
                data: sortedClients.map(c => c[1]),
                backgroundColor: '#4F46E5', // Indigo-600
                hoverBackgroundColor: '#4338CA', // Indigo-700
                borderRadius: 4,
                barPercentage: 0.6,
            },
        ],
    };

    // 2. Line Chart: Evolution (Maintains approximate conversion for trends)
    const monthMap = new Map<string, number>();
    const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

    const sortedByDate = [...adelantos].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    sortedByDate.forEach(a => {
        const monthYear = `${months[a.fecha.getMonth()]} ${a.fecha.getFullYear()}`;
        const amount = a.moneda === 'USD' ? a.monto * 3.75 : a.monto;
        monthMap.set(monthYear, (monthMap.get(monthYear) || 0) + amount);
    });

    const lineChartData = {
        labels: Array.from(monthMap.keys()),
        datasets: [
            {
                label: 'Monto Mensual Aprox (S/)',
                data: Array.from(monthMap.values()),
                borderColor: '#10B981', // Emerald-500
                backgroundColor: (context: any) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
                    gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
                    return gradient;
                },
                pointBackgroundColor: '#fff',
                pointBorderColor: '#10B981',
                pointHoverBackgroundColor: '#10B981',
                pointHoverBorderColor: '#fff',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
            },
        ],
    };

    // 3. Doughnut Chart: Status
    const statusMap = new Map<string, number>();
    adelantos.forEach(a => {
        statusMap.set(a.estado, (statusMap.get(a.estado) || 0) + 1);
    });

    // Updated Colors: Pendiente is back to Golden (Amber)
    const statusColors: any = {
        'pendiente': '#F59E0B', // Amber-500 (Golden)
        'aprobado': '#10B981',  // Emerald-500
        'rechazado': '#64748B', // Slate-500
        'pagado': '#059669',    // Emerald-600
    };

    const doughnutData = {
        labels: Array.from(statusMap.keys()).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
        datasets: [
            {
                data: Array.from(statusMap.values()),
                backgroundColor: Array.from(statusMap.keys()).map(k => statusColors[k] || '#9CA3AF'),
                borderWidth: 2,
                borderColor: document.documentElement.classList.contains('dark') ? '#18181b' : '#ffffff',
                hoverOffset: 4
            },
        ],
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    usePointStyle: true,
                    pointStyle: 'circle',
                    padding: 20,
                    font: { family: "'Inter', sans-serif", size: 12 },
                    color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#64748B'
                }
            }
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-96 rounded-xl lg:col-span-2" />
                    <Skeleton className="h-80 rounded-xl" />
                    <Skeleton className="h-80 rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Panel de control financiero</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                        <CalendarDaysIcon className="w-4 h-4 text-slate-500" />
                        Últimos 30 días
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                        <FunnelIcon className="w-4 h-4 text-slate-500" />
                        Filtrar
                    </button>
                </div>
            </div>

            {/* Stats Cards - Updated with Golden for Pending */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                {/* Card 1: Desembolsado (Emerald) */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-all hover:border-emerald-200 dark:hover:border-emerald-900">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Desembolsado</p>
                            <div className="mt-3 space-y-1">
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                                    <span className="text-sm text-slate-500 font-normal">S/</span>
                                    {totalAprobadoPEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </h3>
                                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 flex items-baseline gap-1">
                                    <span className="text-sm text-slate-500 font-normal">$</span>
                                    {totalAprobadoUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </h3>
                            </div>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                            <BanknotesIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-500">
                            <ArrowTrendingUpIcon className="w-3 h-3" />
                            +12.5%
                        </div>
                        <span className="text-xs text-slate-400">vs mes anterior</span>
                    </div>
                </div>

                {/* Card 2: Pendiente (Golden/Amber) */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-all hover:border-amber-200 dark:hover:border-amber-900">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Por Aprobar</p>
                            <div className="mt-3 space-y-1">
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                                    <span className="text-sm text-slate-500 font-normal">S/</span>
                                    {totalPendientePEN.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                </h3>
                                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 flex items-baseline gap-1">
                                    <span className="text-sm text-slate-500 font-normal">$</span>
                                    {totalPendienteUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </h3>
                            </div>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-900/50">
                            <ClockIcon className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <span className="text-xs text-amber-600 dark:text-amber-500 font-medium">
                            En proceso
                        </span>
                        <span className="text-xs text-slate-400">• Actualizado hoy</span>
                    </div>
                </div>

                {/* Card 3: Operaciones (Indigo) */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm transition-all hover:border-indigo-200 dark:hover:border-indigo-900">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Operaciones Totales</p>
                            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-3">
                                {adelantos.length}
                            </h3>
                        </div>
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                            <UserGroupIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-500" />
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-500">
                            <ArrowTrendingUpIcon className="w-3 h-3" />
                            +5.2%
                        </div>
                        <span className="text-xs text-slate-400">nuevos clientes</span>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Evolution Chart (Wide) */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Tendencia de Desembolsos</h3>
                    </div>
                    <div className="h-[320px] w-full">
                        <Line
                            data={lineChartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        backgroundColor: '#1E293B',
                                        padding: 12,
                                        cornerRadius: 8,
                                        titleFont: { size: 13, family: "'Inter', sans-serif" },
                                        bodyFont: { size: 13, family: "'Inter', sans-serif" },
                                        displayColors: false,
                                    }
                                },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        border: { display: false },
                                        grid: { color: document.documentElement.classList.contains('dark') ? '#27272a' : '#f1f5f9', },
                                        ticks: {
                                            padding: 10,
                                            font: { size: 11, family: "'Inter', sans-serif" },
                                            color: '#64748B'
                                        }
                                    },
                                    x: {
                                        grid: { display: false },
                                        ticks: {
                                            font: { size: 11, family: "'Inter', sans-serif" },
                                            color: '#64748B'
                                        }
                                    }
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Status Distribution (Doughnut) */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2">Distribución por Estado</h3>
                    <p className="text-xs text-slate-500 mb-6">Proporción de adelantos según estado actual</p>
                    <div className="h-[280px] w-full relative">
                        <Doughnut data={doughnutData} options={doughnutOptions} />
                        {/* Center Text Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none pr-[90px] pb-4">
                            <div className="text-center">
                                <span className="block text-3xl font-bold text-slate-900 dark:text-white">{adelantos.length}</span>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Clients (Bar) */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm lg:col-span-3">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-6">Top 5 Clientes - Mayor Volumen</h3>
                    <div className="h-[300px] w-full">
                        <Bar
                            data={barChartData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        backgroundColor: '#1E293B',
                                        padding: 12,
                                        cornerRadius: 8,
                                        displayColors: false,
                                        titleFont: { family: "'Inter', sans-serif" },
                                        bodyFont: { family: "'Inter', sans-serif" },
                                    }
                                },
                                scales: {
                                    y: {
                                        border: { display: false },
                                        grid: { color: document.documentElement.classList.contains('dark') ? '#27272a' : '#f1f5f9' },
                                        ticks: {
                                            font: { size: 11 },
                                            color: '#64748B'
                                        }
                                    },
                                    x: {
                                        grid: { display: false },
                                        ticks: {
                                            font: { size: 11 },
                                            color: '#64748B'
                                        }
                                    }
                                }
                            }}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
