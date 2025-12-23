"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Skeleton } from "@/app/components/ui/Skeleton";

type GateEntry = {
    id: string;
    tipoOperacion: "entrada" | "salida";
    motivo: string;
    tipoAcreditacion: string;
    descripcionProducto: string;
    pesoBruto: number;
    pesoTara: number;
    pesoNeto: number;
    clienteTipoDoc: string;
    clienteNumDoc: string;
    clienteNombre: string;
    conductorTipoDoc: string;
    conductorNumDoc: string;
    conductorNombre: string;
    conductorLicencia: string;
    conductorPlaca: string;
    rucRemitente: string;
    nombreRemitente: string;
    numGuiaRemision: string;
    pesoRemitente: number;
    rucTransportista: string;
    nombreTransportista: string;
    ticketPeso: string;
    destinatario: string;
    timestamp: any; // Firestore Timestamp
    status: "aprobado" | "rechazado" | "pendiente";
};

export default function TicketPage() {
    const params = useParams();
    const [entry, setEntry] = useState<GateEntry | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEntry = async () => {
            if (!params.id) return;
            try {
                const docRef = doc(db, "garita_registros", params.id as string);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setEntry({ id: docSnap.id, ...docSnap.data() } as GateEntry);
                } else {
                    console.error("No such document!");
                }
            } catch (error) {
                console.error("Error getting document:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchEntry();
    }, [params.id]);

    useEffect(() => {
        if (!loading && entry) {
            setTimeout(() => {
                window.print();
            }, 500);
        }
    }, [loading, entry]);

    if (loading) {
        return (
            <div className="p-8 max-w-3xl mx-auto space-y-6">
                <Skeleton className="h-12 w-48 mx-auto" />
                <div className="grid grid-cols-2 gap-8">
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!entry) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-xl text-gray-500">Ticket no encontrado</p>
            </div>
        );
    }

    const formatDate = (timestamp: any) => {
        if (!timestamp) return "";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString("es-PE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <div className="bg-white min-h-screen p-8 text-black font-mono text-sm print:p-0">
            <div className="max-w-[80mm] mx-auto print:max-w-full print:w-full">
                {/* Header */}
                <div className="text-center mb-6 border-b-2 border-black pb-4 border-dashed">
                    <h1 className="text-xl font-bold uppercase mb-1">AlfaSoft Logistics</h1>
                    <p className="text-xs">Av. Principal 123, Lima - Perú</p>
                    <p className="text-xs">RUC: 20123456789</p>
                    <div className="mt-4">
                        <h2 className="text-lg font-bold">TICKET DE PESAJE</h2>
                        <p className="text-lg font-bold">{entry.ticketPeso}</p>
                    </div>
                </div>

                {/* Info General */}
                <div className="mb-4 space-y-1">
                    <div className="flex justify-between">
                        <span className="font-bold">Fecha:</span>
                        <span>{formatDate(entry.timestamp)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold">Operación:</span>
                        <span className="uppercase">{entry.tipoOperacion}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold">Motivo:</span>
                        <span className="uppercase">{entry.motivo}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold">Acreditación:</span>
                        <span className="uppercase">{entry.tipoAcreditacion}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="font-bold">Estado:</span>
                        <span className="uppercase">{entry.status}</span>
                    </div>
                </div>

                <div className="border-b border-black border-dashed my-2"></div>

                {/* Cliente y Destinatario */}
                <div className="mb-4 space-y-1">
                    <p className="font-bold underline mb-1">CLIENTE</p>
                    <p className="uppercase text-sm leading-tight">{entry.clienteNombre}</p>
                    <p>{entry.clienteTipoDoc}: {entry.clienteNumDoc}</p>

                    {entry.destinatario && (
                        <>
                            <p className="font-bold mt-2">Destinatario:</p>
                            <p className="uppercase text-sm leading-tight">{entry.destinatario}</p>
                        </>
                    )}
                </div>

                <div className="border-b border-black border-dashed my-2"></div>

                {/* Conductor y Transporte */}
                <div className="mb-4 space-y-1">
                    <p className="font-bold underline mb-1">TRANSPORTE</p>
                    <p className="font-bold">Conductor:</p>
                    <p className="uppercase text-sm leading-tight">{entry.conductorNombre}</p>
                    <div className="flex justify-between">
                        <span>Licencia: {entry.conductorLicencia}</span>
                        <span className="font-bold">Placa: {entry.conductorPlaca}</span>
                    </div>

                    {(entry.nombreTransportista || entry.rucTransportista) && (
                        <div className="mt-2">
                            <p className="font-bold">Empresa de Transporte:</p>
                            <p className="uppercase text-sm leading-tight">{entry.nombreTransportista}</p>
                            <p>RUC: {entry.rucTransportista}</p>
                        </div>
                    )}
                </div>

                <div className="border-b border-black border-dashed my-2"></div>

                {/* Carga y Guías */}
                <div className="mb-4 space-y-1">
                    <p className="font-bold underline mb-1">CARGA</p>
                    <p className="uppercase text-sm leading-tight">{entry.descripcionProducto}</p>

                    {(entry.numGuiaRemision || entry.nombreRemitente) && (
                        <div className="mt-2 text-xs">
                            <p><span className="font-bold">Guía Remisión:</span> {entry.numGuiaRemision}</p>
                            <p><span className="font-bold">Remitente:</span> {entry.nombreRemitente}</p>
                            {entry.rucRemitente && <p>RUC: {entry.rucRemitente}</p>}
                        </div>
                    )}

                    <div className="mt-3 space-y-1 border-t border-black border-dashed pt-2">
                        <div className="flex justify-between">
                            <span>Peso Bruto:</span>
                            <span>{entry.pesoBruto.toFixed(2)} t</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Peso Tara:</span>
                            <span>{entry.pesoTara.toFixed(2)} t</span>
                        </div>
                        {entry.pesoRemitente > 0 && (
                            <div className="flex justify-between text-xs text-gray-600 print:text-black">
                                <span>Peso Guía:</span>
                                <span>{entry.pesoRemitente.toFixed(2)} t</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-base border-t border-black border-dashed pt-1 mt-1">
                            <span>PESO NETO:</span>
                            <span>{entry.pesoNeto.toFixed(2)} t</span>
                        </div>
                    </div>
                </div>

                <div className="border-b border-black border-dashed my-6"></div>

                {/* Firmas */}
                <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs">
                    <div className="border-t border-black pt-2">
                        <p>Firma Conductor</p>
                    </div>
                    <div className="border-t border-black pt-2">
                        <p>Visto Bueno Garita</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-8 text-center text-xs">
                    <p>Gracias por su preferencia.</p>
                    <p className="mt-1 italic">Generado por sistema AlfaSoft</p>
                </div>
            </div>

            {/* Print Button (Hidden in Print) */}
            <div className="fixed bottom-8 right-8 print:hidden">
                <button
                    onClick={() => window.print()}
                    className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
                    title="Imprimir"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.198-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
