import { useState, useEffect } from "react";
import { CalculatorIcon, ClockIcon, ChartBarIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import FormField from "@/app/components/FormField";

export default function ProductionMetrics({
    defaultCapacidad = 350,
    defaultJornada = 12
}: {
    defaultCapacidad?: number,
    defaultJornada?: number
}) {
    // Inputs
    const [jornada, setJornada] = useState(defaultJornada); // Horas
    const [horasEfectivas, setHorasEfectivas] = useState(8); // Horas
    const [capacidadTolva, setCapacidadTolva] = useState(defaultCapacidad); // TN
    const [tasaProcesamiento, setTasaProcesamiento] = useState(22); // TN/h (Example default)
    const [turnosDia, setTurnosDia] = useState(2); // Turnos al día
    const [produccionReal, setProduccionReal] = useState(0); // TN reportadas

    // Paradas (Simple numeric input for now, could be detailed list later)
    // Calculated Effective Hours = Jornada - Paradas
    // But user gave Effective Hours as explicit data point in example, usually calculated.
    // I will act as if user inputs Effective Hours directly for simplicity as per prompt "Datos: Horas efectivas: 8 horas"

    // Metrics
    const [eficiencia, setEficiencia] = useState(0);
    const [produccionTurno, setProduccionTurno] = useState(0);
    const [capacidadDiaria, setCapacidadDiaria] = useState(0);
    const [rendimiento, setRendimiento] = useState(0);
    const [tiempoVaciado, setTiempoVaciado] = useState(0);
    const [perdidas, setPerdidas] = useState(0);

    /* 
       Fórmulas del Usuario:
       1. Eficiencia = (Horas Efectivas / Jornada) * 100
       2. Producción por Turno = Tasa (TN/h) * Horas Efectivas
          OR based on Tolva: 350 TN * (8h / ciclo) ...
          User logic: "22TN x H 8 => 176 TN" (Producción por Turno)
       3. Capacidad Diaria = Producción Turno * Turnos
       4. Rendimiento = (Producción Real / Capacidad Teórica (Turno o Dia? Usually comparable period)) * 100
    */

    useEffect(() => {
        // 1. Eficiencia Operativa
        const eff = (horasEfectivas / jornada) * 100;
        setEficiencia(eff);

        // 2. Pérdidas
        setPerdidas(jornada - horasEfectivas);

        // 3. Producción Teórica por Turno (Capacidad Teórica del Turno)
        // Usando Tasa de Procesamiento (TN/h)
        const prodTurno = tasaProcesamiento * horasEfectivas;
        setProduccionTurno(prodTurno);

        // 4. Capacidad Diaria (Teórica)
        const capDiaria = prodTurno * turnosDia;
        setCapacidadDiaria(capDiaria);

        // 5. Rendimiento (Base Turno for simplicity if Real input is per turn)
        // Assuming Produccion Real is per Turn for now, or we can add a toggle.
        // Let's assume Producción Real is compared to Producción Teórica del periodo (Turno)
        if (prodTurno > 0) {
            setRendimiento((produccionReal / prodTurno) * 100);
        } else {
            setRendimiento(0);
        }

        // Extra: Tiempo Vaciado Tolva
        if (tasaProcesamiento > 0) {
            setTiempoVaciado(capacidadTolva / tasaProcesamiento);
        }
    }, [jornada, horasEfectivas, tasaProcesamiento, turnosDia, produccionReal, capacidadTolva]);

    const getColor = (val: number, target: number) => {
        if (val >= target) return "text-green-600 dark:text-green-400";
        if (val >= target * 0.8) return "text-yellow-600 dark:text-yellow-400";
        return "text-red-600 dark:text-red-400";
    };

    return (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 space-y-6">
            <div className="flex items-center gap-2 border-b border-gray-200 dark:border-zinc-800 pb-4">
                <CalculatorIcon className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Calculadora de Eficiencia y Producción</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Inputs */}
                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <ClockIcon className="w-5 h-5 text-gray-500" /> Parámetros Operativos
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Jornada Nominal (h)">
                            <input
                                type="number"
                                value={jornada}
                                onChange={e => setJornada(Number(e.target.value))}
                                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </FormField>
                        <FormField label="Horas Efectivas (h)">
                            <input
                                type="number"
                                value={horasEfectivas}
                                onChange={e => setHorasEfectivas(Number(e.target.value))}
                                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </FormField>
                        <FormField label="Tasa Procesamiento (TN/h)">
                            <input
                                type="number"
                                value={tasaProcesamiento}
                                onChange={e => setTasaProcesamiento(Number(e.target.value))}
                                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </FormField>
                        <FormField label="Turnos por Día">
                            <input
                                type="number"
                                value={turnosDia}
                                onChange={e => setTurnosDia(Number(e.target.value))}
                                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </FormField>
                        <div className="sm:col-span-2">
                            <FormField label="Producción Real del Turno (TN)">
                                <input
                                    type="number"
                                    value={produccionReal}
                                    onChange={e => setProduccionReal(Number(e.target.value))}
                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </FormField>
                        </div>
                        <FormField label="Capacidad Tolva (TN)">
                            <input
                                type="number"
                                value={capacidadTolva}
                                onChange={e => setCapacidadTolva(Number(e.target.value))}
                                className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </FormField>
                    </div>
                </div>

                {/* Results */}
                <div className="space-y-4">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <ChartBarIcon className="w-5 h-5 text-blue-500" /> Indicadores de Desempeño
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50/50 dark:bg-zinc-800/30 rounded-xl border border-gray-100 dark:border-zinc-700/50">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Eficiencia Operativa</p>
                            <p className={`text-2xl font-bold mt-1 ${getColor(eficiencia, 85)}`}>
                                {eficiencia.toFixed(2)}%
                            </p>
                            <p className="text-xs text-gray-400 mt-2">Meta: &gt;85%</p>
                        </div>
                        <div className="p-4 bg-gray-50/50 dark:bg-zinc-800/30 rounded-xl border border-gray-100 dark:border-zinc-700/50">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pérdidas de Tiempo</p>
                            <p className="text-2xl font-bold mt-1 text-red-500">
                                {perdidas.toFixed(1)} h
                            </p>
                            <p className="text-xs text-gray-400 mt-2">Paradas/Mantto.</p>
                        </div>
                        <div className="p-4 bg-gray-50/50 dark:bg-zinc-800/30 rounded-xl border border-gray-100 dark:border-zinc-700/50">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Capacidad Turno</p>
                            <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                                {produccionTurno.toFixed(0)} TN
                            </p>
                            <p className="text-xs text-gray-400 mt-2">Teórica @{tasaProcesamiento}TN/h</p>
                        </div>
                        <div className="p-4 bg-gray-50/50 dark:bg-zinc-800/30 rounded-xl border border-gray-100 dark:border-zinc-700/50">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Rendimiento</p>
                            <p className={`text-2xl font-bold mt-1 ${getColor(rendimiento, 90)}`}>
                                {rendimiento.toFixed(2)}%
                            </p>
                            <p className="text-xs text-gray-400 mt-2">Real vs Teórico</p>
                        </div>
                    </div>

                    <div className="mt-4 p-4 border border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl flex items-start gap-3">
                        <ExclamationTriangleIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Análisis de Capacidad:</strong><br />
                            Con una tasa de <strong>{tasaProcesamiento} TN/h</strong>, procesar una tolva llena de <strong>{capacidadTolva} TN</strong> tomaría aproximadamente <strong>{tiempoVaciado.toFixed(1)} horas</strong>.
                            La capacidad diaria proyectada ({turnosDia} turnos) es de <strong>{capacidadDiaria.toLocaleString()} TN</strong>.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
