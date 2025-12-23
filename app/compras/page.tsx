"use client";

import { useState, useEffect } from "react";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import {
    ShoppingCartIcon,
    CurrencyDollarIcon,
    ClockIcon,
    CheckCircleIcon,
    DocumentTextIcon
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ComprasDashboard() {
    const [stats, setStats] = useState({
        totalOrdenes: 0,
        montoTotal: 0,
        pendientes: 0,
        completadas: 0
    });
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Orders
                const q = query(collection(db, "compras_ordenes"), orderBy("createdAt", "desc"), limit(5));
                const snapshot = await getDocs(q);
                const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setRecentOrders(orders);

                // Calculate Stats (This should ideally be a server aggregation or separate stats doc)
                // For now, fetching all to count (not scalable but works for MVP)
                const allQ = query(collection(db, "compras_ordenes"));
                const allSnap = await getDocs(allQ);

                let total = 0;
                let monto = 0;
                let pend = 0;
                let comp = 0;

                allSnap.forEach(doc => {
                    const data = doc.data();
                    total++;
                    monto += data.total || 0;
                    if (data.estado === "pendiente") pend++;
                    if (data.estado === "recibido") comp++;
                });

                setStats({
                    totalOrdenes: total,
                    montoTotal: monto,
                    pendientes: pend,
                    completadas: comp
                });

            } catch (error) {
                console.error("Error fetching compras stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <Navbar />
            <Sidebar />

            <main className="ml-64 mt-16 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Compras</h1>
                        <p className="text-gray-600 dark:text-gray-400">Gestión de adquisiciones de mineral y suministros</p>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Total Órdenes</p>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalOrdenes}</h3>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <ShoppingCartIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Gasto Total</p>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                        S/ {stats.montoTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                    </h3>
                                </div>
                                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <CurrencyDollarIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Pendientes</p>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.pendientes}</h3>
                                </div>
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                    <ClockIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Completadas</p>
                                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.completadas}</h3>
                                </div>
                                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                    <CheckCircleIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Orders Table */}
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900 dark:text-white">Órdenes Recientes</h3>
                            <Link href="/compras/ordenes" className="text-sm text-blue-600 hover:text-blue-500 font-medium">
                                Ver todas &rarr;
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-zinc-800 dark:text-gray-400">
                                    <tr>
                                        <th className="px-6 py-3">Código</th>
                                        <th className="px-6 py-3">Proveedor</th>
                                        <th className="px-6 py-3">Tipo</th>
                                        <th className="px-6 py-3">Fecha</th>
                                        <th className="px-6 py-3">Total</th>
                                        <th className="px-6 py-3">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">Cargando...</td>
                                        </tr>
                                    ) : recentOrders.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No hay órdenes recientes.</td>
                                        </tr>
                                    ) : (
                                        recentOrders.map((order) => (
                                            <tr key={order.id} className="bg-white border-b dark:bg-zinc-900 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                                    {order.codigo || order.id.slice(0, 8)}
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                                    {order.proveedorNombre}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.tipo === 'mineral'
                                                            ? 'bg-stone-100 text-stone-700 dark:bg-stone-900/30 dark:text-stone-400'
                                                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                        }`}>
                                                        {order.tipo === 'mineral' ? 'Mineral' : 'Suministro'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                                    {order.createdAt?.toDate().toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                                    S/ {order.total?.toLocaleString('es-PE', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                                                            order.estado === 'aprobado' ? 'bg-blue-100 text-blue-700' :
                                                                order.estado === 'recibido' ? 'bg-green-100 text-green-700' :
                                                                    'bg-red-100 text-red-700'
                                                        }`}>
                                                        {order.estado.toUpperCase()}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                        <Link href="/compras/ordenes?new=mineral" className="flex items-center justify-center gap-3 p-6 bg-white dark:bg-zinc-900 border border-dashed border-gray-300 dark:border-zinc-700 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors group">
                            <div className="p-3 bg-stone-100 dark:bg-stone-900/30 rounded-full group-hover:scale-110 transition-transform">
                                <DocumentTextIcon className="w-6 h-6 text-stone-700 dark:text-stone-400" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-semibold text-gray-900 dark:text-white">Nueva Orden de Mineral</h4>
                                <p className="text-sm text-gray-500">Compra de materia prima</p>
                            </div>
                        </Link>

                        <Link href="/compras/ordenes?new=suministro" className="flex items-center justify-center gap-3 p-6 bg-white dark:bg-zinc-900 border border-dashed border-gray-300 dark:border-zinc-700 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors group">
                            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full group-hover:scale-110 transition-transform">
                                <ShoppingCartIcon className="w-6 h-6 text-blue-700 dark:text-blue-400" />
                            </div>
                            <div className="text-left">
                                <h4 className="font-semibold text-gray-900 dark:text-white">Nueva Orden de Suministro</h4>
                                <p className="text-sm text-gray-500">Repuestos, EPPs, Reactivos</p>
                            </div>
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}
