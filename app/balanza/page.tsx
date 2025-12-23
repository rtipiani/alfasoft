"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import Swal from "sweetalert2";
import {
    ScaleIcon,
    TruckIcon,
    ArrowTrendingUpIcon,
    ClockIcon,
    DocumentTextIcon,
    CheckCircleIcon
} from "@heroicons/react/24/outline";

// Tipo para los registros de pesaje
type WeightRecord = {
    id: string;
    vehiclePlate: string;
    vehicleType: string;
    driver: string;
    product: string;
    grossWeight: number; // Peso bruto
    tareWeight: number;  // Tara
    netWeight: number;   // Peso neto
    timestamp: Date;
    ticket: string;
};

export default function BalanzaPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<unknown>(null);
    const [currentWeight, setCurrentWeight] = useState<number>(0);
    const [isWeighing, setIsWeighing] = useState(false);
    const [records, setRecords] = useState<WeightRecord[]>([]);

    useEffect(() => {
        const now = Date.now();
        // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
        setRecords([
            {
                id: "1",
                vehiclePlate: "ABC-1234",
                vehicleType: "Camión",
                driver: "Juan Pérez",
                product: "Arena",
                grossWeight: 25000,
                tareWeight: 8000,
                netWeight: 17000,
                timestamp: new Date(now - 1000 * 60 * 30),
                ticket: "T-001"
            },
            {
                id: "2",
                vehiclePlate: "XYZ-5678",
                vehicleType: "Camioneta",
                driver: "María González",
                product: "Grava",
                grossWeight: 15000,
                tareWeight: 3000,
                netWeight: 12000,
                timestamp: new Date(now - 1000 * 60 * 90),
                ticket: "T-002"
            }
        ]);
    }, []);

    // Formulario para nuevo pesaje
    const [showForm, setShowForm] = useState(false);
    const [newRecord, setNewRecord] = useState({
        vehiclePlate: "",
        vehicleType: "",
        driver: "",
        product: "",
        grossWeight: 0,
        tareWeight: 0
    });

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                setCurrentUser(user);
            } else {
                router.push("/");
            }
        });

        return () => unsubscribe();
    }, [router]);

    // Simular lectura de peso en tiempo real
    useEffect(() => {
        if (isWeighing) {
            const interval = setInterval(() => {
                setCurrentWeight(Math.floor(Math.random() * 30000) + 5000);
            }, 500);
            return () => clearInterval(interval);
        }
    }, [isWeighing]);

    const handleStartWeighing = () => {
        setIsWeighing(true);
    };

    const handleStopWeighing = () => {
        setIsWeighing(false);
        setCurrentWeight(0);
    };

    const handleCaptureWeight = (type: 'gross' | 'tare') => {
        if (type === 'gross') {
            setNewRecord({ ...newRecord, grossWeight: currentWeight });
        } else {
            setNewRecord({ ...newRecord, tareWeight: currentWeight });
        }
    };

    const handleSaveRecord = () => {
        if (!newRecord.vehiclePlate || !newRecord.vehicleType || !newRecord.driver || !newRecord.product) {
            Swal.fire({
                icon: 'error',
                title: 'Campos Incompletos',
                text: 'Por favor completa todos los campos',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        if (newRecord.grossWeight === 0 || newRecord.tareWeight === 0) {
            Swal.fire({
                icon: 'error',
                title: 'Pesos Requeridos',
                text: 'Por favor captura el peso bruto y la tara',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }

        const netWeight = newRecord.grossWeight - newRecord.tareWeight;
        const ticketNumber = `T-${String(records.length + 1).padStart(3, '0')}`;

        const record: WeightRecord = {
            id: Date.now().toString(),
            vehiclePlate: newRecord.vehiclePlate,
            vehicleType: newRecord.vehicleType,
            driver: newRecord.driver,
            product: newRecord.product,
            grossWeight: newRecord.grossWeight,
            tareWeight: newRecord.tareWeight,
            netWeight: netWeight,
            timestamp: new Date(),
            ticket: ticketNumber
        };

        setRecords([record, ...records]);
        setNewRecord({
            vehiclePlate: "",
            vehicleType: "",
            driver: "",
            product: "",
            grossWeight: 0,
            tareWeight: 0
        });
        setShowForm(false);
        setIsWeighing(false);
        Swal.fire({
            icon: 'success',
            title: '¡Ticket Generado!',
            text: `Ticket ${ticketNumber} generado exitosamente`,
            timer: 2500,
            showConfirmButton: true,
            confirmButtonColor: '#3b82f6'
        });
    };

    const formatWeight = (weight: number) => {
        return weight.toLocaleString('es-ES') + " kg";
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // Estadísticas
    const stats = {
        totalToday: records.filter(r => {
            const today = new Date();
            return r.timestamp.toDateString() === today.toDateString();
        }).length,
        totalWeightToday: records
            .filter(r => {
                const today = new Date();
                return r.timestamp.toDateString() === today.toDateString();
            })
            .reduce((sum, r) => sum + r.netWeight, 0),
        averageWeight: records.length > 0
            ? Math.floor(records.reduce((sum, r) => sum + r.netWeight, 0) / records.length)
            : 0,
        totalRecords: records.length
    };

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <Navbar />
            <Sidebar />

            <main className="ml-64 mt-16 p-8">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Control de Balanza</h1>
                        <p className="text-gray-600 dark:text-gray-400">Gestión de pesaje de vehículos y materiales</p>
                    </div>

                    {/* Estadísticas */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <StatCard
                            title="Pesajes Hoy"
                            value={stats.totalToday.toString()}
                            icon={<ClockIcon className="w-6 h-6" />}
                            color="blue"
                        />
                        <StatCard
                            title="Peso Total Hoy"
                            value={`${(stats.totalWeightToday / 1000).toFixed(1)}t`}
                            icon={<ArrowTrendingUpIcon className="w-6 h-6" />}
                            color="green"
                        />
                        <StatCard
                            title="Promedio"
                            value={`${(stats.averageWeight / 1000).toFixed(1)}t`}
                            icon={<ScaleIcon className="w-6 h-6" />}
                            color="purple"
                        />
                        <StatCard
                            title="Total Registros"
                            value={stats.totalRecords.toString()}
                            icon={<DocumentTextIcon className="w-6 h-6" />}
                            color="yellow"
                        />
                    </div>

                    {/* Control de Balanza */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        {/* Lectura actual */}
                        <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Lectura Actual</h2>
                            <div className="text-center">
                                <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                                    <ScaleIcon className="w-16 h-16 text-white" />
                                </div>
                                <div className="mb-4">
                                    <p className="text-5xl font-bold text-gray-900 dark:text-white mb-2">
                                        {isWeighing ? currentWeight.toLocaleString('es-ES') : '0'}
                                    </p>
                                    <p className="text-gray-600 dark:text-gray-400">kilogramos</p>
                                </div>
                                <div className="space-y-2">
                                    {!isWeighing ? (
                                        <button
                                            onClick={handleStartWeighing}
                                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition"
                                        >
                                            Iniciar Pesaje
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleStopWeighing}
                                            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition"
                                        >
                                            Detener Pesaje
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Formulario de registro */}
                        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Nuevo Registro de Pesaje</h2>
                                <button
                                    onClick={() => setShowForm(!showForm)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                                >
                                    {showForm ? "Cancelar" : "Nuevo Pesaje"}
                                </button>
                            </div>

                            {showForm && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Placa del Vehículo
                                            </label>
                                            <input
                                                type="text"
                                                value={newRecord.vehiclePlate}
                                                onChange={(e) => setNewRecord({ ...newRecord, vehiclePlate: e.target.value.toUpperCase() })}
                                                placeholder="ABC-1234"
                                                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Tipo de Vehículo
                                            </label>
                                            <input
                                                type="text"
                                                value={newRecord.vehicleType}
                                                onChange={(e) => setNewRecord({ ...newRecord, vehicleType: e.target.value })}
                                                placeholder="Ej: Camión"
                                                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Conductor
                                            </label>
                                            <input
                                                type="text"
                                                value={newRecord.driver}
                                                onChange={(e) => setNewRecord({ ...newRecord, driver: e.target.value })}
                                                placeholder="Nombre del conductor"
                                                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Producto
                                            </label>
                                            <input
                                                type="text"
                                                value={newRecord.product}
                                                onChange={(e) => setNewRecord({ ...newRecord, product: e.target.value })}
                                                placeholder="Ej: Arena, Grava"
                                                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                                            />
                                        </div>
                                    </div>

                                    {/* Captura de pesos */}
                                    <div className="bg-gray-50 dark:bg-zinc-800 rounded-lg p-4">
                                        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Captura de Pesos</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Peso Bruto
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={newRecord.grossWeight > 0 ? formatWeight(newRecord.grossWeight) : ''}
                                                        readOnly
                                                        placeholder="0 kg"
                                                        className="flex-1 px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg dark:text-white"
                                                    />
                                                    <button
                                                        onClick={() => handleCaptureWeight('gross')}
                                                        disabled={!isWeighing}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Capturar
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                    Tara
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={newRecord.tareWeight > 0 ? formatWeight(newRecord.tareWeight) : ''}
                                                        readOnly
                                                        placeholder="0 kg"
                                                        className="flex-1 px-4 py-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg dark:text-white"
                                                    />
                                                    <button
                                                        onClick={() => handleCaptureWeight('tare')}
                                                        disabled={!isWeighing}
                                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Capturar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        {newRecord.grossWeight > 0 && newRecord.tareWeight > 0 && (
                                            <div className="mt-4 p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                                                <p className="text-sm text-green-800 dark:text-green-200">
                                                    <strong>Peso Neto:</strong> {formatWeight(newRecord.grossWeight - newRecord.tareWeight)}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleSaveRecord}
                                        className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold flex items-center justify-center gap-2"
                                    >
                                        <CheckCircleIcon className="w-5 h-5" />
                                        Guardar y Generar Ticket
                                    </button>
                                </div>
                            )}

                            {!showForm && (
                                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                    <TruckIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                    <p>Haz clic en &quot;Nuevo Pesaje&quot; para registrar un pesaje</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tabla de registros */}
                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Historial de Pesajes</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ticket</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Placa</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vehículo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Peso Bruto</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tara</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Peso Neto</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha/Hora</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                    {records.map((record) => (
                                        <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-xs font-mono font-semibold">
                                                    {record.ticket}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                                                {record.vehiclePlate}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {record.vehicleType}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {record.product}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {formatWeight(record.grossWeight)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {formatWeight(record.tareWeight)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                                                {formatWeight(record.netWeight)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                <div>{formatDate(record.timestamp)}</div>
                                                <div className="text-xs">{formatTime(record.timestamp)}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

// Componente de tarjeta de estadística
function StatCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
    const colorStyles = {
        blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
        green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
        purple: "bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-400",
        yellow: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400"
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 transition-all duration-200 hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${colorStyles[color as keyof typeof colorStyles]}`}>
                    {icon}
                </div>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${colorStyles[color as keyof typeof colorStyles]}`}>
                    +2.5%
                </span>
            </div>
            <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{value}</h3>
            </div>
        </div>
    );
}
