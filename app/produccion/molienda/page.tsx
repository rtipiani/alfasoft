"use client";

import { useState, useEffect } from "react";
import { Cog6ToothIcon, BoltIcon, ScaleIcon, ClockIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { db } from "@/lib/firebase";
import { collection, addDoc, onSnapshot, query, orderBy, limit, doc, setDoc } from "firebase/firestore";
import Swal from "sweetalert2";
import { format } from "date-fns";
import ProductionMetrics from "../components/ProductionMetrics";
import Dialog from "@/app/components/Dialog";
import FormField from "@/app/components/FormField";
import Select from "@/app/components/Select";

type MolinoData = {
    id?: string;
    molinoId: string;
    potencia: number;
    alimentacion: number;
    densidad: number;
    estado: "operando" | "detenido" | "mantenimiento";
    timestamp: any;
};

export default function MoliendaPage() {
    const [molino1, setMolino1] = useState<MolinoData | null>(null);
    const [molino2, setMolino2] = useState<MolinoData | null>(null);
    const [showDialog, setShowDialog] = useState(false);
    const [selectedMolino, setSelectedMolino] = useState("molino_1");
    const [formData, setFormData] = useState({
        potencia: 0,
        alimentacion: 0,
        densidad: 0,
        estado: "operando"
    });

    // --- BALLS SUPPLY LOGIC ---
    const [ballsRecords, setBallsRecords] = useState<any[]>([]);
    const [showBallsDialog, setShowBallsDialog] = useState(false);
    const [ballsForm, setBallsForm] = useState({
        fecha: format(new Date(), "yyyy-MM-dd"),
        b_2_5: 0,
        b_3: 0,
        b_3_5: 0,
        b_4: 0
    });

    useEffect(() => {
        const q = query(collection(db, "produccion_abastecimiento_billas"), orderBy("timestamp", "desc"), limit(5));
        const unsub = onSnapshot(q, (snapshot) => {
            setBallsRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }, []);

    const handleSaveBalls = async () => {
        try {
            await setDoc(doc(collection(db, "produccion_abastecimiento_billas")), {
                ...ballsForm,
                timestamp: new Date()
            });
            setShowBallsDialog(false);
            Swal.fire("Éxito", "Abastecimiento registrado", "success");
            setBallsForm({ ...ballsForm, b_2_5: 0, b_3: 0, b_3_5: 0, b_4: 0 });
        } catch (error) {
            console.error(error);
            Swal.fire("Error", "No se pudo guardar", "error");
        }
    };

    const getDayName = (dateStr: string) => {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        // Fix timezone issue by appending time or using localized parsing, simple approach:
        const d = new Date(dateStr + "T12:00:00");
        return days[d.getDay()];
    };

    const isSupplyDay = (dateStr: string) => {
        const day = getDayName(dateStr);
        return ['Lunes', 'Miércoles', 'Viernes', 'Domingo'].includes(day);
    };

    // Subscribe to latest data
    useEffect(() => {
        const unsub1 = onSnapshot(doc(db, "produccion_stats", "molino_1"), (doc) => {
            if (doc.exists()) setMolino1(doc.data() as MolinoData);
        });
        const unsub2 = onSnapshot(doc(db, "produccion_stats", "molino_2"), (doc) => {
            if (doc.exists()) setMolino2(doc.data() as MolinoData);
        });
        return () => { unsub1(); unsub2(); };
    }, []);

    const handleSave = async () => {
        try {
            const data = {
                molinoId: selectedMolino,
                ...formData,
                timestamp: new Date()
            };

            // 1. Save Log
            await addDoc(collection(db, "produccion_molienda"), data);

            // 2. Update Current Stats
            await setDoc(doc(db, "produccion_stats", selectedMolino), data);

            setShowDialog(false);
            Swal.fire("Éxito", "Lectura registrada correctamente", "success");
        } catch (error) {
            console.error("Error saving reading:", error);
            Swal.fire("Error", "No se pudo registrar la lectura", "error");
        }
    };

    const renderMolinoCard = (title: string, data: MolinoData | null, id: string) => (
        <div className={`bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden ${data?.estado === 'detenido' ? 'opacity-75' : ''}`}>
            <div className="p-4 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Cog6ToothIcon className="w-5 h-5 text-gray-500" />
                    {title}
                </h3>
                <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${data?.estado === 'operando' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        data?.estado === 'mantenimiento' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-gray-400'
                        }`}>
                        {(data?.estado || 'DESCONOCIDO').toUpperCase()}
                    </span>
                    <button
                        onClick={() => { setSelectedMolino(id); setShowDialog(true); }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition"
                        title="Registrar Lectura"
                    >
                        <PlusIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </button>
                </div>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-zinc-800/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400 text-sm">
                        <BoltIcon className="w-4 h-4" />
                        Potencia
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.potencia || 0} <span className="text-sm font-normal text-gray-500">kW</span></p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-zinc-800/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400 text-sm">
                        <ScaleIcon className="w-4 h-4" />
                        Alimentación
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.alimentacion || 0} <span className="text-sm font-normal text-gray-500">TPH</span></p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-zinc-800/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400 text-sm">
                        <BeakerIcon className="w-4 h-4" />
                        Densidad
                    </div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data?.densidad || 0} <span className="text-sm font-normal text-gray-500">g/L</span></p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-zinc-800/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400 text-sm">
                        <ClockIcon className="w-4 h-4" />
                        Última Lectura
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {data?.timestamp ? format(data.timestamp.toDate(), "HH:mm") : "-"}
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Molienda</h2>
                    <p className="text-gray-500 dark:text-gray-400">Control de molinos y preparación de pulpa</p>
                </div>
                <button
                    onClick={() => setShowBallsDialog(true)}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    Abastecimiento Billas
                </button>
            </div>

            {/* Production Metrics */}
            <ProductionMetrics defaultJornada={12} />

            {/* Balls Supply Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-orange-50 dark:bg-zinc-800/50">
                    <h3 className="font-semibold text-orange-900 dark:text-orange-100 flex items-center gap-2">
                        <ScaleIcon className="w-5 h-5" /> Abastecimiento de Billas (Semanal)
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-zinc-800">
                            <tr>
                                <th className="px-4 py-3 text-left">Fecha</th>
                                <th className="px-4 py-3 text-center">Billa 2.5"</th>
                                <th className="px-4 py-3 text-center">Billa 3"</th>
                                <th className="px-4 py-3 text-center">Billa 3.5"</th>
                                <th className="px-4 py-3 text-center">Billa 4"</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {ballsRecords.length === 0 ? (
                                <tr><td colSpan={5} className="px-4 py-3 text-center text-gray-500">No hay registros recientes</td></tr>
                            ) : (
                                ballsRecords.map(r => (
                                    <tr key={r.id}>
                                        <td className="px-4 py-3">
                                            {r.fecha} <span className="text-xs text-gray-500">({getDayName(r.fecha)})</span>
                                        </td>
                                        <td className="px-4 py-3 text-center font-medium">{r.b_2_5}</td>
                                        <td className="px-4 py-3 text-center font-medium">{r.b_3}</td>
                                        <td className="px-4 py-3 text-center font-medium">{r.b_3_5}</td>
                                        <td className="px-4 py-3 text-center font-medium">{r.b_4}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Balls Supply Dialog */}
            <Dialog
                isOpen={showBallsDialog}
                onClose={() => setShowBallsDialog(false)}
                title="Abastecimiento de Billas"
                maxWidth="max-w-2xl"
            >
                <div className="space-y-6">
                    <FormField label="Fecha">
                        <div className="space-y-1">
                            <input
                                type="date"
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                value={ballsForm.fecha}
                                onChange={e => setBallsForm({ ...ballsForm, fecha: e.target.value })}
                            />
                            {!isSupplyDay(ballsForm.fecha) && (
                                <p className="text-xs text-yellow-600 dark:text-yellow-500 flex items-center gap-1">
                                    <span>⚠️</span>
                                    Nota: El abastecimiento suele ser Lun, Mié, Vie, Dom.
                                </p>
                            )}
                        </div>
                    </FormField>

                    <div className="bg-orange-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-orange-100 dark:border-zinc-800">
                        <h4 className="text-sm font-bold text-orange-900 dark:text-orange-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <ScaleIcon className="w-5 h-5" />
                            Cantidad de Billas
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            {['2.5', '3', '3.5', '4'].map(size => (
                                <FormField key={size} label={`Billa ${size}"`}>
                                    <input
                                        type="number"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-orange-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                                        value={(ballsForm as any)[`b_${size.replace('.', '_')}`]}
                                        onChange={e => setBallsForm({ ...ballsForm, [`b_${size.replace('.', '_')}`]: Number(e.target.value) })}
                                        placeholder="0"
                                    />
                                </FormField>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100 dark:border-zinc-800">
                        <button
                            onClick={() => setShowBallsDialog(false)}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveBalls}
                            className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition font-medium shadow-lg shadow-orange-600/20"
                        >
                            Registrar Abastecimiento
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Mills Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderMolinoCard("Molino de Bolas 8x10", molino1, "molino_1")}
                {renderMolinoCard("Molino de Barras 6x8", molino2, "molino_2")}
            </div>

            {/* Dialog */}
            {showDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-800">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Registrar Lectura - {selectedMolino === 'molino_1' ? 'Molino Bolas' : 'Molino Barras'}
                            </h3>
                            <button
                                onClick={() => setShowDialog(false)}
                                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                            >
                                <XMarkIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Estado
                                </label>
                                <select
                                    value={formData.estado}
                                    onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                >
                                    <option value="operando">Operando</option>
                                    <option value="detenido">Detenido</option>
                                    <option value="mantenimiento">Mantenimiento</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Potencia (kW)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.potencia}
                                        onChange={(e) => setFormData({ ...formData, potencia: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Alimentación (TPH)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.alimentacion}
                                        onChange={(e) => setFormData({ ...formData, alimentacion: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Densidad (g/L)
                                </label>
                                <input
                                    type="number"
                                    value={formData.densidad}
                                    onChange={(e) => setFormData({ ...formData, densidad: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                            <button
                                onClick={() => setShowDialog(false)}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition font-medium"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-lg shadow-blue-600/20"
                            >
                                Guardar Lectura
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function BeakerIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
    );
}
