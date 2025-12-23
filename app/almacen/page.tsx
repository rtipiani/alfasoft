"use client";

import { useState, useEffect } from "react";
import {
    ArchiveBoxIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    CubeIcon,
    ArrowRightIcon,
    BanknotesIcon
} from "@heroicons/react/24/outline";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

export default function AlmacenPage() {
    const [stats, setStats] = useState({
        totalProductos: 0,
        stockBajo: 0,
        valorSoles: 0,
        valorDolares: 0
    });
    const [loading, setLoading] = useState(true);

    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        const fetchStatsAndProducts = async () => {
            try {
                // Fetch Items from almacen_items
                const q = query(collection(db, "almacen_items"), orderBy("nombre"));
                const prodSnap = await getDocs(q);
                const prods = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setProducts(prods);

                // Calculate Stats
                const totalProds = prodSnap.size;
                const stockBajoCount = prods.filter((p: any) => (p.stockActual || 0) <= (p.stockMinimo || 0)).length;

                // Calculate Inventory Value split by currency
                let totalSoles = 0;
                let totalDolares = 0;

                prods.forEach((p: any) => {
                    const stock = p.stockActual || 0;
                    const cost = p.costoPromedio || 0;
                    const currency = p.moneda || 'PEN'; // Default to Soles if missing

                    if (currency === 'USD') {
                        totalDolares += stock * cost;
                    } else {
                        totalSoles += stock * cost;
                    }
                });

                setStats({
                    totalProductos: totalProds,
                    stockBajo: stockBajoCount,
                    valorSoles: totalSoles,
                    valorDolares: totalDolares
                });
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStatsAndProducts();
    }, []);

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {loading ? "..." : stats.totalProductos}
                            </h3>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <ArchiveBoxIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Alertas de Stock</p>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                                {loading ? "..." : stats.stockBajo}
                            </h3>
                        </div>
                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                            <ExclamationTriangleIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Valor del Inventario</p>
                            <div className="mt-1 flex flex-col">
                                <span className="text-lg font-bold text-gray-900 dark:text-white">
                                    {loading ? "..." : `S/ ${stats.valorSoles.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`}
                                </span>
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                    {loading ? "..." : `$ ${stats.valorDolares.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                                </span>
                            </div>
                        </div>
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                            <BanknotesIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Link href="/almacen/minerales" className="group">
                    <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-xl shadow-lg border border-transparent hover:scale-[1.02] transition-all cursor-pointer text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold">Almacén de Minerales</h3>
                                <p className="text-amber-100 mt-1">Gestión de Canchas y Pilas</p>
                            </div>
                            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                                <CubeIcon className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-amber-50 group-hover:text-white transition-colors">
                            Ver almacén <ArrowRightIcon className="w-4 h-4" />
                        </div>
                    </div>
                </Link>

                <Link href="/almacen/materiales" className="group">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 hover:border-blue-500/50 transition-all cursor-pointer group-hover:ring-2 ring-blue-500/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Materiales e Insumos</h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">Inventario General y Compras</p>
                            </div>
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                <ArchiveBoxIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 group-hover:text-blue-700 transition-colors">
                            Gestionar items <ArrowRightIcon className="w-4 h-4" />
                        </div>
                    </div>
                </Link>
            </div>

            {/* Previous KPI Cards (Optional - keeping simplified layout or moving them) */}
            {/* For now we keep existing stats but maybe push them down or restructure */}
            {/* Previous KPI Cards (Optional - keeping simplified layout or moving them) */}
            {/* For now we keep existing stats but maybe push them down or restructure */}
            <div className="grid grid-cols-1 gap-6">
                <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Resumen de Inventario</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-zinc-800 dark:text-gray-400">
                                <tr>
                                    <th className="px-6 py-4 font-semibold tracking-wider text-gray-900 dark:text-gray-200">Item</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider text-gray-900 dark:text-gray-200">Tipo</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider text-gray-900 dark:text-gray-200">Categoría</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider text-gray-900 dark:text-gray-200">Stock Actual</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider text-gray-900 dark:text-gray-200">Unidad</th>
                                    <th className="px-6 py-4 font-semibold tracking-wider text-gray-900 dark:text-gray-200">Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            Cargando inventario...
                                        </td>
                                    </tr>
                                ) : products.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                            No hay items registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    products.map((product) => (
                                        <tr key={product.id} className="bg-white border-b dark:bg-zinc-900 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                            <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                                {product.nombre}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                                {product.tipo}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                                {product.categoria}
                                            </td>
                                            <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                                                {product.stockActual}
                                            </td>
                                            <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                                                {product.unidad}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${(product.stockActual || 0) <= (product.stockMinimo || 0)
                                                    ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                                                    : "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${(product.stockActual || 0) <= (product.stockMinimo || 0) ? "bg-red-500" : "bg-green-500"
                                                        }`}></span>
                                                    {(product.stockActual || 0) <= (product.stockMinimo || 0) ? "Stock Bajo" : "Normal"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
