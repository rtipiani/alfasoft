"use client";

import { useState, useEffect } from "react";
import { PlusIcon, BeakerIcon, XMarkIcon, FunnelIcon } from "@heroicons/react/24/outline";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc } from "firebase/firestore";
import Swal from "sweetalert2";
import { format } from "date-fns";
import ProductionMetrics from "../components/ProductionMetrics";
import Dialog from "@/app/components/Dialog";
import FormField from "@/app/components/FormField";
import Select from "@/app/components/Select";

type FlotacionRecord = {
    id: string;
    fecha: Date;
    turno: "DIA" | "NOCHE";
    pesoAgua: number;
    // Densidad
    densidad_au_pulpa: number;
    densidad_cu_pulpa: number;
    densidad_ag_pulpa: number;
    densidad_au_val: number;
    densidad_cu_val: number;
    densidad_ag_val: number;
    // Malla
    malla_au_val: number;
    malla_cu_val: number;
    malla_ag_val: number;
    timestamp: Date;
};

export default function FlotacionPage() {
    const [records, setRecords] = useState<FlotacionRecord[]>([]);
    const [showDialog, setShowDialog] = useState(false);
    const [formData, setFormData] = useState({
        fecha: format(new Date(), "yyyy-MM-dd"),
        turno: "DIA",
        pesoAgua: 1000,
        // Densidad Inputs (Peso Pulpa)
        densidad_au_pulpa: 0,
        densidad_cu_pulpa: 0,
        densidad_ag_pulpa: 0,
        // Malla Inputs (%)
        malla_au_val: 0,
        malla_cu_val: 0,
        malla_ag_val: 0,
    });

    // --- REAGENTS CONSUMPTION LOGIC ---
    const [reagentRecords, setReagentRecords] = useState<any[]>([]);
    const [showReagentsDialog, setShowReagentsDialog] = useState(false);
    const [reagentsForm, setReagentsForm] = useState({
        fecha: format(new Date(), "yyyy-MM-dd"),
        turno: "DIA",
        d250: 0, r208: 0, r404: 0, r3418: 0, a31: 0, mibc: 0, sulfuro_na: 0, z6: 0, cal: 0
    });

    useEffect(() => {
        const q = query(collection(db, "produccion_consumo_reactivos"), orderBy("timestamp", "desc"), limit(10));
        const unsub = onSnapshot(q, (snapshot) => {
            setReagentRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }, []);

    const handleSaveReagents = async () => {
        try {
            await setDoc(doc(collection(db, "produccion_consumo_reactivos")), {
                ...reagentsForm,
                timestamp: new Date()
            });
            setShowReagentsDialog(false);
            Swal.fire("Éxito", "Consumo registrado", "success");
            setReagentsForm({ ...reagentsForm, d250: 0, r208: 0, r404: 0, r3418: 0, a31: 0, mibc: 0, sulfuro_na: 0, z6: 0, cal: 0 });
        } catch (error) {
            console.error(error);
            Swal.fire("Error", "No se pudo guardar", "error");
        }
    };

    // Subscribe to Records
    useEffect(() => {
        const q = query(collection(db, "produccion_flotacion"), orderBy("timestamp", "desc"), limit(20));
        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                fecha: doc.data().fecha?.toDate(),
                timestamp: doc.data().timestamp?.toDate()
            })) as FlotacionRecord[];
            setRecords(data);
        });
        return () => unsub();
    }, []);

    const calculateDensity = (pulpa: number, agua: number) => {
        if (agua === 0 || pulpa === 0) return 0;
        return ((pulpa / agua) * 100) - 100;
    };

    const handleSave = async () => {
        if (formData.pesoAgua <= 0) {
            Swal.fire("Error", "El peso del agua debe ser mayor a 0", "error");
            return;
        }

        try {
            const densidad_au = calculateDensity(formData.densidad_au_pulpa, formData.pesoAgua);
            const densidad_cu = calculateDensity(formData.densidad_cu_pulpa, formData.pesoAgua);
            const densidad_ag = calculateDensity(formData.densidad_ag_pulpa, formData.pesoAgua);

            const newDocRef = doc(collection(db, "produccion_flotacion"));

            await setDoc(newDocRef, {
                fecha: new Date(formData.fecha + "T12:00:00"),
                turno: formData.turno,
                pesoAgua: formData.pesoAgua,

                densidad_au_pulpa: formData.densidad_au_pulpa,
                densidad_cu_pulpa: formData.densidad_cu_pulpa,
                densidad_ag_pulpa: formData.densidad_ag_pulpa,

                densidad_au_val: densidad_au,
                densidad_cu_val: densidad_cu,
                densidad_ag_val: densidad_ag,

                malla_au_val: formData.malla_au_val,
                malla_cu_val: formData.malla_cu_val,
                malla_ag_val: formData.malla_ag_val,

                timestamp: new Date()
            });

            setShowDialog(false);
            Swal.fire("Éxito", "Registro guardado correctamente", "success");

            // Reset form
            setFormData({
                fecha: format(new Date(), "yyyy-MM-dd"),
                turno: "DIA",
                pesoAgua: 1000,
                densidad_au_pulpa: 0,
                densidad_cu_pulpa: 0,
                densidad_ag_pulpa: 0,
                malla_au_val: 0,
                malla_cu_val: 0,
                malla_ag_val: 0,
            });

        } catch (error) {
            console.error("Error saving record:", error);
            Swal.fire("Error", "No se pudo guardar el registro", "error");
        }
    };

    // Live calculations for preview
    const val_densidad_au = calculateDensity(formData.densidad_au_pulpa, formData.pesoAgua);
    const val_densidad_cu = calculateDensity(formData.densidad_cu_pulpa, formData.pesoAgua);
    const val_densidad_ag = calculateDensity(formData.densidad_ag_pulpa, formData.pesoAgua);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Flotación</h2>
                    <p className="text-gray-500 dark:text-gray-400">Control de Densidad, Malla y Consumo de Reactivos</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowReagentsDialog(true)}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                    >
                        <BeakerIcon className="w-5 h-5" />
                        Consumo Reactivos
                    </button>
                    <button
                        onClick={() => setShowDialog(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                    >
                        <PlusIcon className="w-5 h-5" />
                        Registro Malla/Densidad
                    </button>
                </div>
            </div>

            {/* Production Metrics */}
            <ProductionMetrics defaultJornada={12} />

            {/* Reagents Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-zinc-800 bg-purple-50 dark:bg-zinc-800/50">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                        <BeakerIcon className="w-5 h-5" /> Consumo de Reactivos por Turno
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 dark:bg-zinc-800">
                            <tr>
                                <th className="px-3 py-2">Fecha</th>
                                <th className="px-3 py-2">Turno</th>
                                <th className="px-3 py-2">D250</th>
                                <th className="px-3 py-2">208</th>
                                <th className="px-3 py-2">404</th>
                                <th className="px-3 py-2">3418</th>
                                <th className="px-3 py-2">A31</th>
                                <th className="px-3 py-2">MIBC</th>
                                <th className="px-3 py-2">Sulf. Na</th>
                                <th className="px-3 py-2">Z6</th>
                                <th className="px-3 py-2">Cal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                            {reagentRecords.map(r => (
                                <tr key={r.id}>
                                    <td className="px-3 py-2">{r.fecha}</td>
                                    <td className="px-3 py-2">{r.turno}</td>
                                    <td className="px-3 py-2 text-center">{r.d250}</td>
                                    <td className="px-3 py-2 text-center">{r.r208}</td>
                                    <td className="px-3 py-2 text-center">{r.r404}</td>
                                    <td className="px-3 py-2 text-center">{r.r3418}</td>
                                    <td className="px-3 py-2 text-center">{r.a31}</td>
                                    <td className="px-3 py-2 text-center">{r.mibc}</td>
                                    <td className="px-3 py-2 text-center">{r.sulfuro_na}</td>
                                    <td className="px-3 py-2 text-center">{r.z6}</td>
                                    <td className="px-3 py-2 text-center">{r.cal}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Reagents Dialog */}
            <Dialog
                isOpen={showReagentsDialog}
                onClose={() => setShowReagentsDialog(false)}
                title="Registrar Consumo de Reactivos"
                maxWidth="max-w-4xl"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Fecha">
                            <input
                                type="date"
                                value={reagentsForm.fecha}
                                onChange={e => setReagentsForm({ ...reagentsForm, fecha: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </FormField>
                        <FormField label="Turno">
                            <Select
                                value={reagentsForm.turno}
                                onChange={e => setReagentsForm({ ...reagentsForm, turno: e.target.value })}
                            >
                                <option value="DIA">DIA</option>
                                <option value="NOCHE">NOCHE</option>
                            </Select>
                        </FormField>
                    </div>

                    <div className="bg-purple-50 dark:bg-zinc-800/50 p-6 rounded-xl border border-purple-100 dark:border-zinc-800">
                        <h4 className="text-sm font-bold text-purple-900 dark:text-purple-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <BeakerIcon className="w-5 h-5" />
                            Cantidades (Kg/Gal)
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                            {['D250', '208', '404', '3418', 'A31', 'MIBC', 'Sulfuro_NA', 'Z6', 'Cal'].map(chem => (
                                <FormField key={chem} label={chem.replace('_', ' ')}>
                                    <input
                                        type="number"
                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-purple-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                                        value={(reagentsForm as any)[chem.toLowerCase()]}
                                        onChange={e => setReagentsForm({ ...reagentsForm, [chem.toLowerCase()]: Number(e.target.value) })}
                                        placeholder="0.00"
                                    />
                                </FormField>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100 dark:border-zinc-800">
                        <button
                            onClick={() => setShowReagentsDialog(false)}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSaveReagents}
                            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium shadow-lg shadow-purple-600/20"
                        >
                            Guardar Consumo
                        </button>
                    </div>
                </div>
            </Dialog>

            {/* Records Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                    <thead className="bg-gray-50 dark:bg-zinc-800/50">
                        <tr>
                            <th rowSpan={2} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b dark:border-zinc-700">Fecha</th>
                            <th rowSpan={2} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b dark:border-zinc-700">Turno</th>
                            <th colSpan={3} className="px-4 py-2 text-center text-xs font-bold text-blue-600 dark:text-blue-400 uppercase border-b dark:border-zinc-700 bg-blue-50/50 dark:bg-blue-900/10">Densidad</th>
                            <th colSpan={3} className="px-4 py-2 text-center text-xs font-bold text-purple-600 dark:text-purple-400 uppercase border-b dark:border-zinc-700 bg-purple-50/50 dark:bg-purple-900/10">% Malla</th>
                        </tr>
                        <tr>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-zinc-700 bg-blue-50/50 dark:bg-blue-900/10">Au</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-zinc-700 bg-blue-50/50 dark:bg-blue-900/10">Cu</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-zinc-700 bg-blue-50/50 dark:bg-blue-900/10">Ag</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-zinc-700 bg-purple-50/50 dark:bg-purple-900/10">Au</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-zinc-700 bg-purple-50/50 dark:bg-purple-900/10">Cu</th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 border-b dark:border-zinc-700 bg-purple-50/50 dark:bg-purple-900/10">Ag</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                        {records.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">No hay registros</td>
                            </tr>
                        ) : (
                            records.map((record) => (
                                <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        {record.fecha ? format(record.fecha, "dd/MM/yyyy") : "-"}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${record.turno === 'DIA'
                                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
                                            }`}>
                                            {record.turno}
                                        </span>
                                    </td>
                                    {/* Densidad Values */}
                                    <td className="px-4 py-4 text-sm text-center font-medium text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/5">
                                        {record.densidad_au_val?.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-center font-medium text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/5">
                                        {record.densidad_cu_val?.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-center font-medium text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/5">
                                        {record.densidad_ag_val?.toFixed(2)}
                                    </td>
                                    {/* Malla Values */}
                                    <td className="px-4 py-4 text-sm text-center font-medium text-purple-600 dark:text-purple-400 bg-purple-50/30 dark:bg-purple-900/5">
                                        {record.malla_au_val}%
                                    </td>
                                    <td className="px-4 py-4 text-sm text-center font-medium text-purple-600 dark:text-purple-400 bg-purple-50/30 dark:bg-purple-900/5">
                                        {record.malla_cu_val}%
                                    </td>
                                    <td className="px-4 py-4 text-sm text-center font-medium text-purple-600 dark:text-purple-400 bg-purple-50/30 dark:bg-purple-900/5">
                                        {record.malla_ag_val}%
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Dialog */}
            <Dialog
                isOpen={showDialog}
                onClose={() => setShowDialog(false)}
                title="Nuevo Registro de Flotación"
                maxWidth="max-w-4xl"
            >
                <div className="space-y-6">
                    {/* General Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Fecha">
                            <input
                                type="date"
                                value={formData.fecha}
                                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                                className="w-full px-4 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </FormField>
                        <FormField label="Turno">
                            <Select
                                value={formData.turno}
                                onChange={(e) => setFormData({ ...formData, turno: e.target.value as "DIA" | "NOCHE" })}
                            >
                                <option value="DIA">Día</option>
                                <option value="NOCHE">Noche</option>
                            </Select>
                        </FormField>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* CARD 1: DENSIDAD */}
                        <div className="space-y-4 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-800/30">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                                    <BeakerIcon className="w-5 h-5" />
                                    DENSIDAD
                                </h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-blue-600 dark:text-blue-300">Agua (g):</span>
                                    <input
                                        type="number"
                                        value={formData.pesoAgua}
                                        onChange={(e) => setFormData({ ...formData, pesoAgua: parseFloat(e.target.value) || 0 })}
                                        className="w-24 px-3 py-1 text-sm bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* AU */}
                                <div className="grid grid-cols-12 gap-2 items-center">
                                    <span className="col-span-2 font-bold text-gray-700 dark:text-gray-300">AU</span>
                                    <div className="col-span-6">
                                        <input
                                            type="number"
                                            placeholder="Peso Pulpa"
                                            value={formData.densidad_au_pulpa || ''}
                                            onChange={(e) => setFormData({ ...formData, densidad_au_pulpa: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="col-span-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                        {val_densidad_au.toFixed(2)}
                                    </div>
                                </div>
                                {/* CU */}
                                <div className="grid grid-cols-12 gap-2 items-center">
                                    <span className="col-span-2 font-bold text-gray-700 dark:text-gray-300">CU</span>
                                    <div className="col-span-6">
                                        <input
                                            type="number"
                                            placeholder="Peso Pulpa"
                                            value={formData.densidad_cu_pulpa || ''}
                                            onChange={(e) => setFormData({ ...formData, densidad_cu_pulpa: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="col-span-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                        {val_densidad_cu.toFixed(2)}
                                    </div>
                                </div>
                                {/* AG */}
                                <div className="grid grid-cols-12 gap-2 items-center">
                                    <span className="col-span-2 font-bold text-gray-700 dark:text-gray-300">AG</span>
                                    <div className="col-span-6">
                                        <input
                                            type="number"
                                            placeholder="Peso Pulpa"
                                            value={formData.densidad_ag_pulpa || ''}
                                            onChange={(e) => setFormData({ ...formData, densidad_ag_pulpa: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div className="col-span-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                        {val_densidad_ag.toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CARD 2: MALLA */}
                        <div className="space-y-4 p-5 bg-purple-50/50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-800/30">
                            <h4 className="font-bold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                                <FunnelIcon className="w-5 h-5" />
                                MALLA (%)
                            </h4>

                            <div className="space-y-3">
                                {/* AU */}
                                <div className="grid grid-cols-12 gap-2 items-center">
                                    <span className="col-span-2 font-bold text-gray-700 dark:text-gray-300">AU</span>
                                    <div className="col-span-10">
                                        <div className="relative">
                                            <input
                                                type="number"
                                                placeholder="Porcentaje"
                                                value={formData.malla_au_val || ''}
                                                onChange={(e) => setFormData({ ...formData, malla_au_val: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-purple-500 pr-8"
                                            />
                                            <span className="absolute right-3 top-1.5 text-gray-400 text-sm">%</span>
                                        </div>
                                    </div>
                                </div>
                                {/* CU */}
                                <div className="grid grid-cols-12 gap-2 items-center">
                                    <span className="col-span-2 font-bold text-gray-700 dark:text-gray-300">CU</span>
                                    <div className="col-span-10">
                                        <div className="relative">
                                            <input
                                                type="number"
                                                placeholder="Porcentaje"
                                                value={formData.malla_cu_val || ''}
                                                onChange={(e) => setFormData({ ...formData, malla_cu_val: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-purple-500 pr-8"
                                            />
                                            <span className="absolute right-3 top-1.5 text-gray-400 text-sm">%</span>
                                        </div>
                                    </div>
                                </div>
                                {/* AG */}
                                <div className="grid grid-cols-12 gap-2 items-center">
                                    <span className="col-span-2 font-bold text-gray-700 dark:text-gray-300">AG</span>
                                    <div className="col-span-10">
                                        <div className="relative">
                                            <input
                                                type="number"
                                                placeholder="Porcentaje"
                                                value={formData.malla_ag_val || ''}
                                                onChange={(e) => setFormData({ ...formData, malla_ag_val: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-3 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:border-purple-500 pr-8"
                                            />
                                            <span className="absolute right-3 top-1.5 text-gray-400 text-sm">%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200 dark:border-zinc-800">
                        <button
                            onClick={() => setShowDialog(false)}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-lg shadow-blue-600/20"
                        >
                            Guardar
                        </button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
}
