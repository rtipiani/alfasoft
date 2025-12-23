"use client";

import { useState } from "react";
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    subMonths,
    isSameMonth,
    isSameDay,
    isToday
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import { useEffect } from "react";

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const nextMonth = () => {
        setCurrentDate(addMonths(currentDate, 1));
    };

    const prevMonth = () => {
        setCurrentDate(subMonths(currentDate, 1));
    };

    const onDateClick = (day: Date) => {
        setSelectedDate(day);
    };

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                    {format(currentDate, "MMMM yyyy", { locale: es })}
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={prevMonth}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 transition-colors"
                    >
                        <ChevronLeftIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setCurrentDate(new Date())}
                        className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    >
                        Hoy
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 transition-colors"
                    >
                        <ChevronRightIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        const days = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
        return (
            <div className="grid grid-cols-7 mb-2">
                {days.map((day) => (
                    <div
                        key={day}
                        className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 uppercase py-2"
                    >
                        {day}
                    </div>
                ))}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
        const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

        const dateFormat = "d";
        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = "";

        // Generate all days to display
        const allDays = eachDayOfInterval({
            start: startDate,
            end: endDate
        });

        return (
            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                {allDays.map((dayItem, index) => {
                    formattedDate = format(dayItem, dateFormat);
                    const isCurrentMonth = isSameMonth(dayItem, monthStart);
                    const isSelected = isSameDay(dayItem, selectedDate);
                    const isTodayDate = isToday(dayItem);

                    return (
                        <div
                            key={dayItem.toString()}
                            className={`
                                min-h-[80px] bg-white dark:bg-zinc-900 p-2 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50
                                ${!isCurrentMonth ? "bg-gray-50/50 dark:bg-zinc-900/50 text-gray-400 dark:text-gray-600" : ""}
                                ${isSelected ? "ring-2 ring-inset ring-blue-500 z-10" : ""}
                            `}
                            onClick={() => onDateClick(dayItem)}
                        >
                            <div className="flex justify-between items-start">
                                <span
                                    className={`
                                        text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                                        ${isTodayDate
                                            ? "bg-blue-600 text-white"
                                            : "text-gray-700 dark:text-gray-300"
                                        }
                                    `}
                                >
                                    {formattedDate}
                                </span>
                            </div>
                            {/* Placeholder for events */}
                            <div className="mt-2 space-y-1">
                                {/* Example event dot or small bar */}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const [batches, setBatches] = useState<any[]>([]);

    useEffect(() => {
        // Fetch Active Batches
        const q = query(collection(db, "production_batches"), orderBy("startTime", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setBatches(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsubscribe();
    }, []);

    return (
        <div className="h-full flex flex-col space-y-6">
            <div className="flex-1 flex flex-col min-h-[500px]">
                {renderHeader()}
                <div className="flex-1 flex flex-col">
                    {renderDays()}
                    {renderCells()}
                </div>
            </div>

            {/* Active Processing Table */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-zinc-800">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Procesamiento en Curso (Clientes)</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-zinc-800 dark:text-gray-400">
                            <tr>
                                <th className="px-6 py-3">Fecha Inicio</th>
                                <th className="px-6 py-3">Cliente / Mineral</th>
                                <th className="px-6 py-3">Cantidad (TM)</th>
                                <th className="px-6 py-3">Etapa</th>
                                <th className="px-6 py-3">Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {batches.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                        No hay procesos activos programados.
                                    </td>
                                </tr>
                            ) : (
                                batches.map((batch) => (
                                    <tr key={batch.id} className="bg-white border-b dark:bg-zinc-900 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800/50">
                                        <td className="px-6 py-4">
                                            {batch.startTime?.seconds ? format(new Date(batch.startTime.seconds * 1000), "dd/MM/yyyy HH:mm") : "Pendiente"}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                            {batch.mineralName}
                                        </td>
                                        <td className="px-6 py-4">
                                            {batch.quantity}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {batch.currentStage?.replace('_', ' ').toUpperCase() || "N/A"}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${batch.status === 'programado' ? 'bg-blue-100 text-blue-700' :
                                                batch.status === 'en_proceso' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-green-100 text-green-700'
                                                }`}>
                                                {batch.status?.toUpperCase() || "DESCONOCIDO"}
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
    );
}
