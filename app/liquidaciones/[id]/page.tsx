"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Skeleton } from "@/app/components/ui/Skeleton";
import { PrinterIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function LiquidacionDetallePage() {
    const { id } = useParams();
    const router = useRouter();
    const [liq, setLiq] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const fetchLiq = async () => {
            const docRef = doc(db, "liquidaciones", id as string);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setLiq({ id: docSnap.id, ...docSnap.data() });
            } else {
                console.log("No such document!");
            }
            setIsLoading(false);
        };
        fetchLiq();
    }, [id]);

    if (isLoading) return <div className="p-8"><Skeleton className="h-[800px] w-full" /></div>;
    if (!liq) return <div className="p-8">Liquidación no encontrada.</div>;

    // --- RE-CALCULATE FOR DISPLAY ---
    // (We could store these, but re-calc ensures consistency with stored inputs)
    const { leyes, cotizaciones, deducciones, pagablePorc, pesos, costos } = liq;
    const factorCu = 22.0462;
    const factorAg = 1;
    const factorAu = 1;

    // Cu
    const cuDeducted = leyes.cu - deducciones.cu;
    const cuPayableQty = cuDeducted * factorCu; // Lbs
    const cuPayableVal = cuPayableQty * cotizaciones.cu; // USD

    // Ag
    const agDeducted = leyes.ag - deducciones.ag;
    const agPayableQty = agDeducted * (pagablePorc.ag / 100);
    const agPayableVal = agPayableQty * cotizaciones.ag;

    // Au
    const auDeducted = leyes.au - deducciones.au;
    const auPayableQty = auDeducted * (pagablePorc.au / 100);
    const auPayableVal = auPayableQty * cotizaciones.au;

    const totalPagos = cuPayableVal + agPayableVal + auPayableVal;

    // Refinacion
    const refinaCuCost = cuPayableQty * costos.refinaCu;
    const refinaAgCost = agPayableQty * costos.refinaAg;
    const refinaAuCost = auPayableQty * costos.refinaAu;
    const totalRefinacion = refinaCuCost + refinaAgCost + refinaAuCost;



    // Total Deducciones (Maquila + Refinacion)
    const totalDeducciones = costos.maquila + totalRefinacion;

    const totalAdelantos = liq.adelantos ? liq.adelantos.reduce((acc: number, curr: any) => acc + curr.monto, 0) : 0;
    const saldoFinal = liq.calculos.totalGeneral - totalAdelantos;

    const formatNum = (num: number, decimals = 3) => num?.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const formatMoney = (num: number) => num?.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-zinc-900 p-8 print:p-0 print:bg-white">
            {/* Toolbar - Hidden on Print */}
            <div className="max-w-[210mm] mx-auto mb-6 flex justify-between print:hidden">
                <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition">
                    <ArrowLeftIcon className="w-5 h-5" /> Volver
                </button>
                <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium">
                    <PrinterIcon className="w-5 h-5" /> Imprimir
                </button>
            </div>

            {/* DOCUMENT / SHEET */}
            <div className="max-w-[210mm] mx-auto bg-white text-black shadow-lg print:shadow-none p-[10mm] min-h-[297mm] text-[10px] leading-tight font-sans">

                {/* HEADER */}
                <div className="text-center border-b-2 border-yellow-400 pb-2 mb-4">
                    <h1 className="text-2xl font-bold text-[#8B4513] uppercase tracking-wider">Liquidacion General</h1>
                    <p className="text-xs font-bold mt-1">AV. GENERAL JUAN ANTONIO PEZET NRO. 895 SAN ISIDRO - LIMA - LIMA</p>
                </div>

                {/* INFO GRID */}
                <div className="grid grid-cols-[1.5fr_1fr_1fr] gap-0 border border-black mb-4">
                    {/* Col 1: Producer Info */}
                    <div className="p-2 border-r border-black">
                        <div className="flex bg-yellow-300 border-b border-black -m-2 mb-2 px-2 py-1 font-bold text-center justify-center">
                            LIQUIDACION
                            <span className="ml-4 bg-yellow-100 px-2 border border-black">PROVISIONAL</span>
                        </div>
                        <div className="grid grid-cols-[60px_1fr] gap-y-1 mt-3">
                            <span className="font-bold">Productor :</span>
                            <span>{liq.proveedorNombre}</span>
                            <span className="font-bold">RUC :</span>
                            <span>-</span>
                            <span className="font-bold">Direccion :</span>
                            <span>-</span>
                            <span className="font-bold">Producto :</span>
                            <span>{liq.producto}</span>
                            <span className="font-bold">Lote :</span>
                            <span>{liq.loteId}</span>
                            <span className="font-bold">Fecha Link :</span>
                            <span>{liq.fechaLiquidacion}</span>
                        </div>
                    </div>

                    {/* Col 2: Weights */}
                    <div className="p-2 border-r border-black flex flex-col justify-center">
                        <div className="grid grid-cols-[60px_60px_30px] gap-y-1 mx-auto">
                            <span className="font-bold">TMH</span>
                            <span className="text-right">{formatNum(pesos.tmh)}</span>
                            <span></span>
                            <span className="font-bold">H2O</span>
                            <span className="text-right">{formatNum(pesos.h2o)}</span>
                            <span className="pl-1">%</span>
                            <span className="font-bold">TMS</span>
                            <span className="text-right">{formatNum(pesos.tms)}</span>
                            <span></span>
                            <span className="font-bold">Merma</span>
                            <span className="text-right">{formatNum(pesos.merma)}</span>
                            <span className="pl-1">%</span>
                            <span className="font-bold border-t border-black pt-1">TMNS</span>
                            <span className="text-right font-bold border-t border-black pt-1">{formatNum(pesos.tmns)}</span>
                            <span></span>
                        </div>
                    </div>

                    {/* Col 3: Leyes & Cotizaciones */}
                    <div className="flex flex-col">
                        <div className="p-2 border-b border-black h-1/2">
                            <div className="font-bold underline mb-1">LEYES :</div>
                            <div className="grid grid-cols-[1fr_60px] gap-y-1">
                                <span>Cu %</span> <span className="text-right">{formatNum(leyes.cu)}</span>
                                <span>Ag Oz/TM</span> <span className="text-right">{formatNum(leyes.ag)}</span>
                                <span>Au Oz/TM</span> <span className="text-right">{formatNum(leyes.au)}</span>
                                <span>As %</span> <span className="text-right">0.01</span>
                                <span>Sb %</span> <span className="text-right">0.00</span>
                            </div>
                        </div>
                        <div className="p-2 h-1/2 bg-gray-50">
                            <div className="font-bold underline mb-1">Cotizaciones:</div>
                            <div className="grid grid-cols-[1fr_60px] gap-y-1 bg-yellow-200 border border-black p-1">
                                <span>Cu c$/Lb</span> <span className="text-right">{formatNum(cotizaciones.cu, 2)}</span>
                                <span>Ag $/Oz</span> <span className="text-right">{formatNum(cotizaciones.ag, 2)}</span>
                                <span>Au $/Oz</span> <span className="text-right">{formatNum(cotizaciones.au, 2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PAGOS CONTENTS */}
                <div className="mb-4">
                    <h3 className="font-bold mb-1">PAGOS DE CONTENIDOS</h3>
                    <table className="w-full text-right">
                        <thead className="border-b border-black">
                            <tr>
                                <th className="text-left w-20">Elemento</th>
                                <th>Ley</th>
                                <th>Deduccion</th>
                                <th>Factor</th>
                                <th>Pagable</th>
                                <th>Precio</th>
                                <th>Total US$</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="text-left font-bold">Cu:</td>
                                <td>{formatNum(leyes.cu)}</td>
                                <td>-{formatNum(deducciones.cu)}</td>
                                <td>{factorCu}</td>
                                <td>{formatNum(cuPayableQty)}</td>
                                <td>{formatNum(cotizaciones.cu)}</td>
                                <td className="font-mono">{formatNum(cuPayableVal, 2)}</td>
                            </tr>
                            <tr>
                                <td className="text-left font-bold">Ag:</td>
                                <td>{formatNum(leyes.ag)}</td>
                                <td>-{formatNum(deducciones.ag)}</td>
                                <td>{pagablePorc.ag}%</td>
                                <td>{formatNum(agPayableQty)}</td>
                                <td>{formatNum(cotizaciones.ag)}</td>
                                <td className="font-mono">{formatNum(agPayableVal, 2)}</td>
                            </tr>
                            <tr>
                                <td className="text-left font-bold">Au:</td>
                                <td>{formatNum(leyes.au)}</td>
                                <td>-{formatNum(deducciones.au)}</td>
                                <td>{pagablePorc.au}%</td>
                                <td>{formatNum(auPayableQty)}</td>
                                <td>{formatNum(cotizaciones.au)}</td>
                                <td className="font-mono">{formatNum(auPayableVal, 2)}</td>
                            </tr>
                            <tr className="border-t border-black font-bold">
                                <td colSpan={6} className="pt-1 text-center">Total Pagos ===================</td>
                                <td className="pt-1 border border-black bg-white">{formatNum(totalPagos, 2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* DEDUCCIONES */}
                <div className="mb-4">
                    <h3 className="font-bold mb-1">DEDUCCIONES</h3>
                    <div className="flex justify-between items-center mb-1">
                        <span className="font-bold">MAQUILA</span>
                        <div className="flex gap-2 items-center">
                            <span className="border border-black px-4 font-bold bg-white">US$</span>
                            <span>$ {formatNum(costos.maquila, 3)}</span>
                        </div>
                    </div>

                    <h4 className="font-bold text-[9px] mb-1">-REFINACION Pagable</h4>
                    <table className="w-full text-right text-[9px]">
                        <tbody>
                            <tr>
                                <td className="text-left w-20">Cu :</td>
                                <td>{formatNum(cuPayableQty)}</td>
                                <td className="text-center">x</td>
                                <td>{costos.refinaCu}</td>
                                <td className="text-left pl-1">lb</td>
                                <td className="w-20">$ {formatNum(refinaCuCost, 3)}</td>
                            </tr>
                            <tr>
                                <td className="text-left w-20">Ag :</td>
                                <td>{formatNum(agPayableQty)}</td>
                                <td className="text-center">x</td>
                                <td>{costos.refinaAg}</td>
                                <td className="text-left pl-1">oz</td>
                                <td className="w-20">$ {formatNum(refinaAgCost, 3)}</td>
                            </tr>
                            <tr>
                                <td className="text-left w-20">Au :</td>
                                <td>{formatNum(auPayableQty)}</td>
                                <td className="text-center">x</td>
                                <td>{costos.refinaAu}</td>
                                <td className="text-left pl-1">oz</td>
                                <td className="w-20">$ {formatNum(refinaAuCost, 3)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="flex justify-between items-center mt-1 border-t border-dashed border-black pt-1">
                        <span className="font-bold">Total Deducciones ===========</span>
                        <span>({formatNum(totalDeducciones, 2)})</span>
                    </div>
                </div>

                {/* PENALIDADES (Simplified placeholder) */}
                <div className="mb-4 border-t border-black pt-2">
                    <div className="flex justify-between items-center">
                        <span className="font-bold uppercase">-Penalidades</span>
                        <span></span>
                    </div>
                    {/* Just displaying the total penalty cost for now as mapped */}
                    <div className="flex justify-end mt-1">
                        <span className="mr-8">Cobro de Analisis</span>
                        <span>0.000</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-double border-black pt-1 font-bold">
                        <span>Total Penalidades ==========</span>
                        <span>({formatNum(costos.penalidades || 0, 3)})</span>
                    </div>
                </div>

                {/* FOOTER TOTALS */}
                <div className="flex gap-4 mt-8">
                    {/* White space / Notes box */}
                    <div className="border border-black flex-1 h-32 p-2">
                        {/* Placeholder for notes */}
                    </div>

                    {/* Totals Box */}
                    <div className="w-1/3 text-right space-y-1">
                        <div className="flex justify-between font-bold bg-yellow-300 px-1 border border-black">
                            <span>Valor por TMNS</span>
                            <span>$ {formatNum(liq.calculos.valorPorTmns, 2)}</span>
                        </div>
                        <div className="flex justify-between text-[9px] pr-1">
                            <span>TMNS</span>
                            <span>{formatNum(pesos.tmns)}</span>
                        </div>

                        <div className="mt-4 border-t border-black pt-2">
                            <div className="flex justify-between bg-yellow-100 px-1">
                                <span>Base Imponible</span>
                                <span>$ {formatNum(liq.calculos.baseImponible, 2)}</span>
                            </div>
                            <div className="flex justify-between px-1">
                                <span>IGV 18 %</span>
                                <span>$ {formatNum(liq.calculos.igv, 2)}</span>
                            </div>
                            <div className="flex justify-between font-bold bg-yellow-300 border border-black px-1 text-sm">
                                <span>TOTAL</span>
                                <span>$ {formatNum(liq.calculos.totalGeneral, 2)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* FOOTER ADELANTOS */}
                <div className="flex justify-end mt-4 text-[9px]">
                    <div className="w-1/3">
                        {/* List Adelantos */}
                        {liq.adelantos && liq.adelantos.length > 0 && (
                            <div className="mb-2 border-b border-black pb-1">
                                {liq.adelantos.map((adv: any, i: number) => (
                                    <div key={i} className="flex justify-between">
                                        <span>{adv.descripcion}</span>
                                        <span>$ {formatNum(adv.monto, 2)}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between border-t border-black pt-1 mb-1">
                            <span>SUB TOTAL</span>
                            <span className="font-bold">$ {formatNum(liq.calculos.totalGeneral, 2)}</span>
                        </div>
                        {totalAdelantos > 0 && (
                            <div className="flex justify-between border-t border-black pt-1 mb-1 text-red-600">
                                <span>TOTAL ADELANTOS</span>
                                <span className="font-bold">($ {formatNum(totalAdelantos, 2)})</span>
                            </div>
                        )}
                        <div className="flex justify-between bg-yellow-300 border border-black px-1 font-bold">
                            <span>TOTAL SALDO DISPONIBLE EN (USD)</span>
                            <span>{formatNum(saldoFinal, 2)}</span>
                        </div>
                    </div>
                </div>

                {/* SIGNATURES */}
                <div className="flex justify-between mt-20 text-[9px] text-center px-10">
                    <div className="border-t border-black w-40 pt-1">
                        V°B° TESORERO
                    </div>
                    <div className="border-t border-black w-40 pt-1">
                        {liq.proveedorNombre}<br />
                        0
                    </div>
                </div>

            </div>
        </div>
    );
}
