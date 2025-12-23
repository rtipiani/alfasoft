"use client";

import { useState, useEffect, useMemo } from "react";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import { auth, db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, getDoc, where } from "firebase/firestore";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { ArrowRightOnRectangleIcon, ArrowLeftOnRectangleIcon, TruckIcon, BuildingOfficeIcon, FunnelIcon } from "@heroicons/react/24/outline";
import Select from "@/app/components/Select";

type GateEntry = {
    id: string;
    tipoOperacion: "entrada" | "salida";
    motivo: string;
    clienteNombre: string;
    conductorNombre: string;
    conductorPlaca: string;
    status: "aprobado" | "rechazado" | "pendiente";
    timestamp: any;
    canchaId?: string; // Critical for filtering
    canchaNombre?: string;
};

type Almacen = {
    id: string;
    nombre: string;
};

export default function Dashboard() {
    const [stats, setStats] = useState({
        entriesToday: 0,
        exitsToday: 0,
        vehiclesInPlant: 0,
        totalActive: 0
    });
    const [recentActivity, setRecentActivity] = useState<GateEntry[]>([]);
    const [vehiclesInPlantList, setVehiclesInPlantList] = useState<GateEntry[]>([]);
    const [loading, setLoading] = useState(true);

    // Multi-site Logic
    const [userAlmacenId, setUserAlmacenId] = useState<string | null>(null); // assigned to user
    const [selectedAlmacenId, setSelectedAlmacenId] = useState<string>("all"); // current filter
    const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
    const [canchaAlmacenMap, setCanchaAlmacenMap] = useState<Record<string, string>>({}); // canchaId -> almacenId

    useEffect(() => {
        // 1. Fetch Almacenes
        const unsubAlmacenes = onSnapshot(query(collection(db, "almacenes"), orderBy("nombre")), (snap) => {
            setAlmacenes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Almacen)));
        });

        // 2. Fetch Canchas to build the Map (Cancha -> Almacen)
        const unsubCanchas = onSnapshot(collection(db, "canchas"), (snap) => {
            const map: Record<string, string> = {};
            snap.docs.forEach(d => {
                const data = d.data();
                if (data.almacenId) {
                    map[d.id] = data.almacenId;
                }
            });
            setCanchaAlmacenMap(map);
        });

        // 3. Fetch Current User Config
        const checkUserConfig = async (user: any) => {
            if (!user) return;
            try {
                const userDoc = await getDoc(doc(db, "usuarios", user.uid));
                // Try fetching by query if uid doesn't match doc id (common in some setups, but here we likely search by email or match id)
                // Assuming standard firebase auth, let's try to match by email if doc by uid fails or is empty,
                // BUT current logic in Users page uses auto-generated IDs. So we need to query by email.

                const q = query(collection(db, "usuarios"), where("email", "==", user.email));
                const querySnap = await getDoc(doc(db, "usuarios", user.uid)); // First try direct ID

                let userData = querySnap.exists() ? querySnap.data() : null;

                // Fallback to email query if direct ID didn't work (historical reasons)
                if (!userData) {
                    const usersQ = query(collection(db, "usuarios"), where("email", "==", user.email));
                    const usersSnap = await new Promise<any>((resolve) => {
                        onSnapshot(usersQ, (s) => resolve(s)); // Just using onSnapshot as a one-off for now or getDocs
                    });
                    if (!usersSnap.empty) {
                        userData = usersSnap.docs[0].data();
                    }
                }

                if (userData && userData.almacenId) {
                    setUserAlmacenId(userData.almacenId);
                    setSelectedAlmacenId(userData.almacenId); // Enforce selection
                }
            } catch (e) {
                console.error("Error fetching user config", e);
            }
        };

        const unsubAuth = auth.onAuthStateChanged((user) => {
            if (user) checkUserConfig(user);
        });

        return () => {
            unsubAlmacenes();
            unsubCanchas();
            unsubAuth();
        };
    }, []);

    useEffect(() => {
        // Query for all entries ordered by date (Newest First)
        const q = query(collection(db, "garita_registros"), orderBy("timestamp", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allEntries = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as GateEntry[];

            // Apply Filter
            const filteredEntries = allEntries.filter(entry => {
                // If filter is 'all', show everything
                if (selectedAlmacenId === 'all') return true;

                // If filter is specific, check if the entry's cancha belongs to the selected almacen
                // We need the entry.canchaId to map to an almacenId
                if (!entry.canchaId) return false; // Or decide global/unassigned entries default behavior
                const entryAlmacenId = canchaAlmacenMap[entry.canchaId];
                return entryAlmacenId === selectedAlmacenId;
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            let entriesToday = 0;
            let exitsToday = 0;

            const vehiclesInside: GateEntry[] = [];
            const seenPlates = new Set<string>();

            // Calculate stats based on FILTERED entries
            filteredEntries.forEach(entry => {
                const entryDate = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);

                if (entryDate >= today) {
                    if (entry.tipoOperacion === 'entrada') entriesToday++;
                    if (entry.tipoOperacion === 'salida') exitsToday++;
                }

                const plate = entry.conductorPlaca ? entry.conductorPlaca.trim().toUpperCase() : "";

                if (plate && !seenPlates.has(plate)) {
                    seenPlates.add(plate);
                    const status = (entry.status || "aprobado").toLowerCase();

                    if (entry.tipoOperacion === 'entrada' && status !== 'rechazado') {
                        vehiclesInside.push(entry);
                    }
                }
            });

            setStats({
                entriesToday,
                exitsToday,
                vehiclesInPlant: vehiclesInside.length,
                totalActive: filteredEntries.length
            });

            setRecentActivity(filteredEntries.slice(0, 5));
            setVehiclesInPlantList(vehiclesInside.slice(0, 5));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [selectedAlmacenId, canchaAlmacenMap]); // Re-run when filter or map changes

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 font-sans">
            <Navbar />
            <Sidebar />

            <main className="ml-64 mt-16 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
                            <p className="text-gray-600 dark:text-gray-400">Resumen de operaciones de Garita en tiempo real</p>
                        </div>

                        {/* Almacen Filter Control */}
                        <div className="flex items-center gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                                <BuildingOfficeIcon className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sede / Almacén</span>
                                {userAlmacenId ? (
                                    // Static display for assigned users
                                    <span className="font-medium text-gray-900 dark:text-white">
                                        {almacenes.find(a => a.id === userAlmacenId)?.nombre || 'Sede Asignada'}
                                    </span>
                                ) : (
                                    // Dropdown for Admins/Global users
                                    <select
                                        value={selectedAlmacenId}
                                        onChange={(e) => setSelectedAlmacenId(e.target.value)}
                                        className="bg-transparent text-sm font-semibold text-gray-900 dark:text-white outline-none cursor-pointer hover:text-indigo-600 transition min-w-[150px]"
                                    >
                                        <option value="all">Todas las Sedes</option>
                                        {almacenes.map(a => (
                                            <option key={a.id} value={a.id}>{a.nombre}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            {!userAlmacenId && <div className="text-gray-300 pointer-events-none"><FunnelIcon className="w-4 h-4" /></div>}
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        {loading ? (
                            <>
                                <Skeleton className="h-32 rounded-lg" />
                                <Skeleton className="h-32 rounded-lg" />
                                <Skeleton className="h-32 rounded-lg" />
                                <Skeleton className="h-32 rounded-lg" />
                            </>
                        ) : (
                            <>
                                <StatCard
                                    title="Ingresos Hoy"
                                    value={stats.entriesToday.toString()}
                                    icon={<ArrowRightOnRectangleIcon className="w-6 h-6 text-green-600" />}
                                    color="green"
                                />
                                <StatCard
                                    title="Salidas Hoy"
                                    value={stats.exitsToday.toString()}
                                    icon={<ArrowLeftOnRectangleIcon className="w-6 h-6 text-blue-600" />}
                                    color="blue"
                                />
                                <StatCard
                                    title="Vehículos en Planta"
                                    value={stats.vehiclesInPlant.toString()}
                                    icon={<TruckIcon className="w-6 h-6 text-orange-600" />}
                                    color="orange"
                                />
                                <StatCard
                                    title="Total Registros"
                                    value={stats.totalActive.toString()}
                                    icon={<TruckIcon className="w-6 h-6 text-purple-600" />}
                                    color="purple"
                                />
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Recent Activity */}
                        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Actividad Reciente</h2>
                            <div className="space-y-4">
                                {loading ? (
                                    <>
                                        <Skeleton className="h-16 w-full" />
                                        <Skeleton className="h-16 w-full" />
                                        <Skeleton className="h-16 w-full" />
                                    </>
                                ) : recentActivity.length > 0 ? (
                                    recentActivity.map((entry) => (
                                        <ActivityItem key={entry.id} entry={entry} />
                                    ))
                                ) : (
                                    <p className="text-gray-500 dark:text-gray-400">No hay actividad reciente.</p>
                                )}
                            </div>
                        </div>

                        {/* Vehicles in Plant */}
                        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Vehículos en Planta</h2>
                                <span className="text-xs text-gray-500">(Tiempo real)</span>
                            </div>
                            <div className="space-y-4">
                                {loading ? (
                                    <>
                                        <Skeleton className="h-12 w-full" />
                                        <Skeleton className="h-12 w-full" />
                                        <Skeleton className="h-12 w-full" />
                                    </>
                                ) : vehiclesInPlantList.length > 0 ? (
                                    vehiclesInPlantList.map((entry) => (
                                        <div key={entry.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-zinc-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-gray-900 dark:text-white">{entry.conductorPlaca}</p>
                                                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{entry.tipoOperacion}</span>
                                                </div>
                                                <p className="text-xs text-gray-500">{entry.conductorNombre}</p>
                                            </div>
                                            <span className="px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 animate-pulse">
                                                En Planta
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-6 text-center">
                                        <TruckIcon className="w-10 h-10 text-gray-300 mb-2 hover:text-orange-500 transition-colors cursor-pointer" />
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Todos los vehículos han salido.</p>
                                        <p className="text-xs text-gray-400">O no hay ingresos registrados.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
    const colorClasses = {
        blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30",
        green: "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30",
        orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-900/30",
        purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-900/30"
    };

    return (
        <div className={`rounded-xl border p-6 ${colorClasses[color as keyof typeof colorClasses]}`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
                <div className="p-2 bg-white dark:bg-zinc-800 rounded-lg shadow-sm">
                    {icon}
                </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
    );
}

function ActivityItem({ entry }: { entry: GateEntry }) {
    const date = entry.timestamp?.toDate ? entry.timestamp.toDate() : new Date(entry.timestamp);
    const timeAgo = getTimeAgo(date);

    return (
        <div className="flex items-start gap-4 p-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 rounded-lg transition-colors">
            <div className={`mt-1 p-2 rounded-full ${entry.tipoOperacion === 'entrada'
                ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                {entry.tipoOperacion === 'entrada'
                    ? <ArrowRightOnRectangleIcon className="w-4 h-4" />
                    : <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                }
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {entry.tipoOperacion === 'entrada' ? 'Ingreso' : 'Salida'} - {entry.motivo}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {entry.clienteNombre}
                </p>
            </div>
            <div className="text-right whitespace-nowrap">
                <p className="text-xs font-medium text-gray-900 dark:text-white">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                <p className="text-xs text-gray-500">{timeAgo}</p>
            </div>
        </div>
    );
}

function getTimeAgo(date: Date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " años";

    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " meses";

    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " días";

    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " h";

    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " min";

    return "ahora";
}
