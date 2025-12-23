"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDocFromCache, getDocFromServer, setDoc, collection, onSnapshot, query, orderBy, where, getDocs, DocumentData, addDoc, deleteDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import Select from "@/app/components/Select";
import Swal from "sweetalert2";
import {
    ArrowRightOnRectangleIcon,
    ArrowLeftOnRectangleIcon,
    XMarkIcon,
    CheckCircleIcon,
    EyeIcon,
    PencilIcon,
    TrashIcon,
    PrinterIcon,
    MagnifyingGlassIcon
} from "@heroicons/react/24/outline";
import { Skeleton } from "@/app/components/ui/Skeleton";

// Tipo para las entradas de la garita
type GateEntry = {
    id: string;
    // Datos Generales
    tipoOperacion: "entrada" | "salida";
    motivo: string;
    tipoAcreditacion: string;
    descripcionProducto: string;
    canchaId?: string;
    canchaNombre?: string;
    pesoBruto: number;
    pesoTara: number;
    pesoNeto: number;
    // Datos del Cliente
    clienteTipoDoc: string;
    clienteNumDoc: string;
    clienteNombre: string;
    // Datos del Conductor
    conductorTipoDoc: string;
    conductorNumDoc: string;
    conductorNombre: string;
    conductorLicencia: string;
    conductorPlaca: string;
    // Guías de Transporte
    rucRemitente: string;
    nombreRemitente: string;
    numGuiaRemision: string;
    pesoRemitente: number;
    rucTransportista: string;
    nombreTransportista: string;
    // Otros Datos
    ticketPeso: string;
    pesoTicket: number;
    destinatario: string;
    timestamp: Date;
    status: "aprobado" | "rechazado" | "pendiente";
};

type Motivo = {
    id: string;
    nombre: string;
    activo: boolean;
};

type Acreditacion = {
    id: string;
    nombre: string;
    activo: boolean;
};

type Cancha = {
    id: string;
    nombre: string;
    stockActual: number;
    mineralId?: string;
};

// Componente StatCard
// function StatCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode; color: string }) {
//     return (
//         <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6">
//             <div className="flex items-center justify-between mb-4">
//                 <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
//                 <div className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 p-2 rounded-lg">
//                     {icon}
//                 </div>
//             </div>
//             <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
//         </div>
//     );
// }

// Componente FormField
function FormField({ label, children, required, error, className = "" }: { label: string; children: React.ReactNode; required?: boolean; error?: string, className?: string }) {
    return (
        <div className={`mb-4 ${className}`}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}

import { createGateEntry, updateGateEntry, deleteGateEntry } from "./actions";

export default function GaritaPage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<unknown>(null);
    // const [gateStatus, setGateStatus] = useState<"abierta" | "cerrada">("cerrada");
    const [entries, setEntries] = useState<GateEntry[]>([]);
    const [showDialog, setShowDialog] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [isSearchingClient, setIsSearchingClient] = useState(false);
    const [isSearchingConductor, setIsSearchingConductor] = useState(false);
    const [isSearchingRemitente, setIsSearchingRemitente] = useState(false);
    const [isSearchingTransportista, setIsSearchingTransportista] = useState(false);
    const [clientFound, setClientFound] = useState<boolean | null>(null);

    const [motivos, setMotivos] = useState<Motivo[]>([]);
    const [acreditaciones, setAcreditaciones] = useState<Acreditacion[]>([]);
    const [canchas, setCanchas] = useState<Cancha[]>([]);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Estado del formulario
    const [formData, setFormData] = useState({
        // Datos Generales
        tipoOperacion: "entrada" as "entrada" | "salida",
        motivo: "",
        tipoAcreditacion: "",
        descripcionProducto: "",
        canchaId: "",
        canchaNombre: "",
        pesoBruto: 0,
        pesoTara: 0,
        // Datos del Cliente
        clienteTipoDoc: "RUC",
        clienteNumDoc: "",
        clienteNombre: "",
        clienteDireccion: "",
        clienteEstado: "",
        clienteCondicion: "",
        clienteDepartamento: "",
        clienteProvincia: "",
        clienteDistrito: "",
        clienteReinfo: false,
        // Datos del Conductor
        conductorTipoDoc: "DNI",
        conductorNumDoc: "",
        conductorNombre: "",
        conductorLicencia: "",
        conductorPlaca: "",
        // Guías de Transporte
        rucRemitente: "",
        nombreRemitente: "",
        numGuiaRemision: "",
        pesoRemitente: 0,
        rucTransportista: "",
        nombreTransportista: "",
        // Otros Datos
        ticketPeso: "",
        pesoTicket: 0,
        destinatario: ""
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

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

    // Fetch Motivos
    useEffect(() => {
        const q = query(collection(db, "garita_motivos"), orderBy("nombre"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const motivosData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Motivo[];
            setMotivos(motivosData);
        }, (error) => {
            console.error("Error fetching motivos:", error);
        });
        return () => unsubscribe();
    }, []);

    // const toggleGate = () => {
    //     setGateStatus(gateStatus === "abierta" ? "cerrada" : "abierta");
    // };

    const openDialog = async (entry?: GateEntry, mode: 'create' | 'view' | 'edit' = 'create') => {
        setShowDialog(true);
        setActiveTab(0);

        if (entry) {
            setFormData({
                tipoOperacion: entry.tipoOperacion,
                motivo: entry.motivo,
                tipoAcreditacion: entry.tipoAcreditacion,
                descripcionProducto: entry.descripcionProducto,
                canchaId: entry.canchaId || "",
                canchaNombre: entry.canchaNombre || "",
                pesoBruto: entry.pesoBruto,
                pesoTara: entry.pesoTara,
                clienteTipoDoc: entry.clienteTipoDoc,
                clienteNumDoc: entry.clienteNumDoc,
                clienteNombre: entry.clienteNombre,
                clienteDireccion: "", // Will be populated by search
                clienteEstado: "",
                clienteCondicion: "",
                clienteDepartamento: "",
                clienteProvincia: "",
                clienteDistrito: "",
                clienteReinfo: false,
                conductorTipoDoc: entry.conductorTipoDoc,
                conductorNumDoc: entry.conductorNumDoc,
                conductorNombre: entry.conductorNombre,
                conductorLicencia: entry.conductorLicencia,
                conductorPlaca: entry.conductorPlaca,
                rucRemitente: entry.rucRemitente,
                nombreRemitente: entry.nombreRemitente,
                numGuiaRemision: entry.numGuiaRemision,
                pesoRemitente: entry.pesoRemitente,
                rucTransportista: entry.rucTransportista,
                nombreTransportista: entry.nombreTransportista,

                ticketPeso: entry.ticketPeso,
                pesoTicket: entry.pesoTicket || 0,
                destinatario: entry.destinatario
            });
            setEditingId(entry.id);
            setIsReadOnly(mode === 'view');

            // Fetch full client details if available
            if (entry.clienteNumDoc) {
                const controller = new AbortController();
                await handleClientSearch(entry.clienteNumDoc, entry.clienteTipoDoc, controller.signal);

                // RESTORE PRESERVED VALUES FOR EDIT MODE
                // Only if explicit value was saved, override whatever the search found/defaulted
                if (entry.tipoAcreditacion) {
                    setFormData(prev => ({
                        ...prev,
                        tipoAcreditacion: entry.tipoAcreditacion,
                        // Ensure REINFO flag matches if accreditation implies it, or keep simple
                        // If saved value is "REINFO", we might want to ensure clientReinfo is true? 
                        // But let's trust the saved string first.
                    }));
                }
            }
        } else {
            resetForm();
            setEditingId(null);
            setIsReadOnly(false);
        }
    };

    const closeDialog = async () => {
        if (isReadOnly) {
            setShowDialog(false);
            resetForm();
            return;
        }

        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: 'Los datos no guardados se perderán',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3b82f6',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Sí, cerrar',
            cancelButtonText: 'Cancelar'
        });
        if (result.isConfirmed) {
            setShowDialog(false);
            resetForm();
        }
    };

    const handleDelete = async (id: string) => {
        const result = await Swal.fire({
            title: '¿Eliminar registro?',
            text: "Esta acción no se puede deshacer",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });

        if (result.isConfirmed) {
            try {
                const res = await deleteGateEntry(id);
                if (!res.success) throw new Error(res.error);

                Swal.fire(
                    'Eliminado',
                    'El registro ha sido eliminado.',
                    'success'
                );
            } catch (error) {
                console.error("Error deleting document: ", error);
                Swal.fire(
                    'Error',
                    'No se pudo eliminar el registro.',
                    'error'
                );
            }
        }
    };

    const saveClientToFirestore = async (clientData: Record<string, unknown>, docId: string) => {
        try {
            await setDoc(doc(db, "clientes", docId), clientData, { merge: true });
        } catch (error) {
            console.error("Error saving client to Firestore:", error);
        }
    };

    // Subscribe to Motivos
    useEffect(() => {
        const q = query(collection(db, "garita_motivos"), orderBy("nombre"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const motivosData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Motivo[];
            setMotivos(motivosData);
        });
        return () => unsubscribe();
    }, []);

    // Subscribe to Acreditaciones
    useEffect(() => {
        const q = query(collection(db, "garita_acreditaciones"), orderBy("nombre"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Acreditacion[];
            setAcreditaciones(data);
        });
        return () => unsubscribe();
    }, []);

    // Subscribe to Canchas
    useEffect(() => {
        const q = query(collection(db, "canchas"), orderBy("nombre"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Cancha[];
            setCanchas(data);
        });
        return () => unsubscribe();
    }, []);

    const [loadingEntries, setLoadingEntries] = useState(true);

    // Subscribe to Garita Entries
    useEffect(() => {
        const q = query(collection(db, "garita_registros"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entriesData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timestamp: data.timestamp?.toDate() || new Date()
                };
            }) as GateEntry[];
            setEntries(entriesData);
            setLoadingEntries(false);
        });
        return () => unsubscribe();
    }, []);

    // Auto-search effect removed in favor of manual button
    // useEffect(() => {
    //     const controller = new AbortController();
    //     const timeoutId = setTimeout(() => {
    //         if (formData.clienteNumDoc) {
    //             handleClientSearch(formData.clienteNumDoc, formData.clienteTipoDoc, controller.signal);
    //         }
    //     }, 500); // 500ms debounce
    //
    //     return () => {
    //         clearTimeout(timeoutId);
    //         controller.abort();
    //     };
    //     // eslint-disable-next-line react-hooks/exhaustive-deps
    // }, [formData.clienteNumDoc, formData.clienteTipoDoc]);

    const handleClientSearch = async (numDoc: string, typeDoc: string, signal: AbortSignal) => {
        if (!numDoc) return;

        const expectedLength = typeDoc === "DNI" ? 8 : 11;
        if (numDoc.length !== expectedLength) {
            setClientFound(null);
            setIsSearchingClient(false);
            return;
        }

        setIsSearchingClient(true);
        try {
            const clientRef = doc(db, "clientes", numDoc);
            let clientData: DocumentData | undefined | null = null;
            let foundInFirestore = false;

            // 1. Try Cache First (Instant)
            try {
                const cacheSnap = await getDocFromCache(clientRef);
                if (cacheSnap.exists()) {
                    clientData = cacheSnap.data();
                    foundInFirestore = true;
                    console.log("Found in cache");
                }
            } catch {
                // Cache miss or error, proceed
                console.log("Cache miss");
            }

            if (foundInFirestore && clientData) {
                setFormData(prev => ({
                    ...prev,
                    clienteNombre: clientData.razonSocial || clientData.nombre || "",
                    clienteNumDoc: numDoc,
                    clienteDireccion: clientData.direccion || "",
                    clienteEstado: clientData.estado || "",
                    clienteCondicion: clientData.condicion || "",
                    clienteDepartamento: clientData.departamento || "",
                    clienteProvincia: clientData.provincia || "",
                    clienteDistrito: clientData.distrito || "",
                    clienteReinfo: clientData.reinfo || false,
                    tipoAcreditacion: clientData.reinfo ? "REINFO" : ""
                }));
                setClientFound(true);
                setIsSearchingClient(false);
                return;
            }

            // 2. Race: Server vs API (First Result Wins)
            const endpoint = typeDoc === "DNI"
                ? `/api/sunat/dni?dni=${numDoc}`
                : `/api/sunat/ruc?ruc=${numDoc}`;

            const fetchController = new AbortController();
            const timeoutId = setTimeout(() => fetchController.abort(), 10000); // 10 second timeout
            signal.addEventListener('abort', () => fetchController.abort());

            // API Promise
            const apiPromise = fetch(endpoint, { signal: fetchController.signal })
                .then(async res => {
                    clearTimeout(timeoutId);
                    if (!res.ok) throw new Error('API Error');
                    const result = await res.json();
                    if (result.success && result.data) {
                        return { source: 'api', data: result.data };
                    }
                    throw new Error('Not found in API');
                });

            // Firestore Server Promise
            const serverPromise = getDocFromServer(clientRef)
                .then(snap => {
                    if (snap.exists()) {
                        return { source: 'firestore', data: snap.data() };
                    }
                    throw new Error('Not found in Firestore');
                });

            // Wait for the first successful result
            const winner = await Promise.any([apiPromise, serverPromise]);

            if (winner.source === 'firestore') {
                console.log("Winner: Firestore Server");
                const clientData = winner.data;
                setFormData(prev => ({
                    ...prev,
                    clienteNombre: clientData.razonSocial || clientData.nombre || "",
                    clienteNumDoc: numDoc,
                    clienteDireccion: clientData.direccion || "",
                    clienteEstado: clientData.estado || "",
                    clienteCondicion: clientData.condicion || "",
                    clienteDepartamento: clientData.departamento || "",
                    clienteProvincia: clientData.provincia || "",
                    clienteDistrito: clientData.distrito || "",
                    clienteReinfo: clientData.reinfo || false,
                    tipoAcreditacion: clientData.reinfo ? "REINFO" : ""
                }));
                setClientFound(true);
            } else {
                console.log("Winner: API");
                const resultData = winner.data;
                const name = typeDoc === "DNI"
                    ? resultData.nombre_completo
                    : resultData.nombre_o_razon_social;

                const clientDataToSave = {
                    nombre: name || "",
                    razonSocial: name || "", // For compatibility
                    direccion: resultData.direccion_completa || resultData.direccion || "",
                    estado: resultData.estado || "",
                    condicion: resultData.condicion || "",
                    departamento: resultData.departamento || "",
                    provincia: resultData.provincia || "",
                    distrito: resultData.distrito || "",
                    tipoDocumento: typeDoc,
                    numeroDocumento: numDoc,
                    updatedAt: new Date()
                };

                // Save to Firestore (merge) without blocking UI
                saveClientToFirestore(clientDataToSave, numDoc);

                setFormData(prev => ({
                    ...prev,
                    clienteNombre: name || "",
                    clienteNumDoc: numDoc,
                    clienteDireccion: resultData.direccion_completa || resultData.direccion || "",
                    clienteEstado: resultData.estado || "",
                    clienteCondicion: resultData.condicion || "",
                    clienteDepartamento: resultData.departamento || "",
                    clienteProvincia: resultData.provincia || "",
                    clienteDistrito: resultData.distrito || ""
                }));
                setClientFound(true);
            }

        } catch (error: unknown) {
            // Check if it's an AbortError (user cancelled)
            if ((error as Error).name === 'AbortError' || signal.aborted) return;

            // If it's an AggregateError, it means both promises failed (not found in either)
            if (error instanceof AggregateError) {
                console.log("Not found in either Firestore or API");
            } else {
                console.error("Error searching client:", error);
            }

            setFormData(prev => ({
                ...prev,
                clienteNombre: "",
                clienteNumDoc: numDoc,
                clienteDireccion: "",
                clienteEstado: "",
                clienteCondicion: "",
                clienteDepartamento: "",
                clienteProvincia: "",
                clienteDistrito: ""
            }));
            setClientFound(false);
        } finally {
            if (!signal.aborted) {
                setIsSearchingClient(false);
            }
        }
    };

    const resetForm = () => {
        setFormData({
            tipoOperacion: "entrada",
            motivo: "",
            tipoAcreditacion: "",
            descripcionProducto: "",
            canchaId: "",
            canchaNombre: "",
            pesoBruto: 0,
            pesoTara: 0,
            clienteTipoDoc: "RUC",
            clienteNumDoc: "",
            clienteNombre: "",
            clienteDireccion: "",
            clienteEstado: "",
            clienteCondicion: "",
            clienteDepartamento: "",
            clienteProvincia: "",
            clienteDistrito: "",
            clienteReinfo: false,
            conductorTipoDoc: "DNI",
            conductorNumDoc: "",
            conductorNombre: "",
            conductorLicencia: "",
            conductorPlaca: "",
            rucRemitente: "",
            nombreRemitente: "",
            numGuiaRemision: "",
            pesoRemitente: 0,
            rucTransportista: "",
            nombreTransportista: "",

            ticketPeso: "",
            pesoTicket: 0,
            destinatario: ""
        });
        setErrors({});
        setClientFound(null);
        setIsSearchingClient(false);
        setIsSearchingConductor(false);
        setIsSearchingRemitente(false);
        setIsSearchingTransportista(false);
        setEditingId(null);
        setIsReadOnly(false);
    };

    const searchEntity = async (type: "DNI" | "RUC", number: string, loadingSetter: (loading: boolean) => void) => {
        if (!number || (type === "DNI" && number.length !== 8) || (type === "RUC" && number.length !== 11)) return null;

        loadingSetter(true);
        try {
            // 1. Check Firestore first (clientes collection)
            const clientsRef = collection(db, "clientes");
            const q = query(clientsRef, where("numeroDocumento", "==", number));

            // Add timeout to Firestore read
            const firestorePromise = getDocs(q);
            const timeoutPromise = new Promise<any>((_, reject) => setTimeout(() => reject(new Error("Firestore timeout")), 3000));

            try {
                const querySnapshot = await Promise.race([firestorePromise, timeoutPromise]);
                if (!querySnapshot.empty) {
                    const clientData = querySnapshot.docs[0].data();
                    loadingSetter(false);
                    return {
                        nombre: clientData.nombre || clientData.razonSocial || "",
                        direccion: clientData.direccion || "",
                        departamento: clientData.departamento || "",
                        provincia: clientData.provincia || "",
                        distrito: clientData.distrito || "",
                        estado: clientData.estado || "",
                        condicion: clientData.condicion || "",
                        licencia: clientData.licencia || ""
                    };
                }
            } catch (e) {
                console.warn("Firestore read timed out or failed, proceeding to API...", e);
            }

            // 2. If not in Firestore, check API
            const endpoint = type === "DNI" ? "/api/sunat/dni" : "/api/sunat/ruc";

            // Add timeout to API fetch (5 seconds)
            const controller = new AbortController();
            const fetchTimeoutId = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(`${endpoint}?${type === "DNI" ? "dni" : "ruc"}=${number}`, {
                signal: controller.signal
            });
            clearTimeout(fetchTimeoutId);

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    const data = result.data;
                    let nombre = "";
                    let direccion = "";
                    let departamento = "";
                    let provincia = "";
                    let distrito = "";
                    let estado = "";
                    let condicion = "";

                    if (type === "DNI") {
                        nombre = `${data.nombres} ${data.apellido_paterno} ${data.apellido_materno}`.trim();
                    } else {
                        nombre = data.nombre_o_razon_social || data.razon_social || data.nombre || "";
                        direccion = data.direccion || data.direccion_completa || "";
                        departamento = data.departamento || "";
                        provincia = data.provincia || "";
                        distrito = data.distrito || "";
                        estado = data.estado || "";
                        condicion = data.condicion || "";
                    }

                    // Save to Firestore in BACKGROUND (Fire-and-forget)
                    // We do NOT await this, so the UI updates immediately
                    setDoc(doc(db, "clientes", number), {
                        tipoDocumento: type,
                        numeroDocumento: number,
                        nombre: nombre,
                        razonSocial: nombre,
                        direccion: direccion,
                        departamento: departamento,
                        provincia: provincia,
                        distrito: distrito,
                        estado: estado,
                        condicion: condicion,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }, { merge: true }).catch(err => console.error("Background save failed:", err));

                    loadingSetter(false);
                    return { nombre, direccion, departamento, provincia, distrito, estado, condicion };
                }
            }
        } catch (error) {
            console.error(`Error searching ${type}:`, error);
        }
        loadingSetter(false);
        return null;
    };

    const handleConductorSearch = async (docValue?: string) => {
        const docNum = docValue || formData.conductorNumDoc;
        if (!docNum) return;

        if (formData.conductorTipoDoc !== "DNI" && formData.conductorTipoDoc !== "RUC") return;

        const result = await searchEntity(formData.conductorTipoDoc as "DNI" | "RUC", docNum, setIsSearchingConductor);

        if (result) {
            setFormData(prev => ({
                ...prev,
                conductorNombre: result.nombre,
                conductorLicencia: result.licencia || prev.conductorLicencia
            }));
            Swal.fire({
                icon: 'success',
                title: 'Conductor Encontrado',
                text: `Nombre: ${result.nombre}`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    };

    const handleRemitenteSearch = async (rucValue?: string) => {
        const ruc = rucValue || formData.rucRemitente;
        if (!ruc) return;

        const result = await searchEntity("RUC", ruc, setIsSearchingRemitente);

        if (result) {
            setFormData(prev => ({
                ...prev,
                nombreRemitente: result.nombre
            }));
            Swal.fire({
                icon: 'success',
                title: 'Remitente Encontrado',
                text: `Nombre: ${result.nombre}`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    };

    const handleTransportistaSearch = async (rucValue?: string) => {
        const ruc = rucValue || formData.rucTransportista;
        if (!ruc) return;

        const result = await searchEntity("RUC", ruc, setIsSearchingTransportista);

        if (result) {
            setFormData(prev => ({
                ...prev,
                nombreTransportista: result.nombre
            }));
            Swal.fire({
                icon: 'success',
                title: 'Transportista Encontrado',
                text: `Nombre: ${result.nombre}`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        }
    };

    const validateTab = (tabIndex: number): boolean => {
        const newErrors: Record<string, string> = {};

        if (tabIndex === 0) {
            if (!formData.clienteNumDoc) newErrors.clienteNumDoc = "El número de documento es requerido";
            if (!formData.clienteNombre) newErrors.clienteNombre = "El nombre es requerido";
            if (formData.clienteTipoDoc === "DNI" && formData.clienteNumDoc.length !== 8) {
                newErrors.clienteNumDoc = "El DNI debe tener 8 dígitos";
            }
            if (formData.clienteTipoDoc === "RUC" && formData.clienteNumDoc.length !== 11) {
                newErrors.clienteNumDoc = "El RUC debe tener 11 dígitos";
            }
        } else if (tabIndex === 1) {
            if (!formData.motivo) newErrors.motivo = "El motivo es requerido";
            if (!formData.tipoAcreditacion) newErrors.tipoAcreditacion = "La acreditación es requerida";
            if (!formData.descripcionProducto) newErrors.descripcionProducto = "La descripción es requerida";
            if (formData.pesoBruto <= 0) newErrors.pesoBruto = "El peso bruto debe ser mayor a 0";
            if (formData.pesoTara <= 0) newErrors.pesoTara = "La tara debe ser mayor a 0";
            if (formData.pesoBruto <= formData.pesoTara) newErrors.pesoBruto = "El peso bruto debe ser mayor a la tara";
        } else if (tabIndex === 2) {
            if (!formData.conductorNumDoc) newErrors.conductorNumDoc = "El número de documento es requerido";
            if (!formData.conductorNombre) newErrors.conductorNombre = "El nombre es requerido";
            if (!formData.conductorLicencia) newErrors.conductorLicencia = "La licencia es requerida";
            if (!formData.conductorPlaca) newErrors.conductorPlaca = "La placa es requerida";
            if (formData.conductorTipoDoc === "DNI" && formData.conductorNumDoc.length !== 8) {
                newErrors.conductorNumDoc = "El DNI debe tener 8 dígitos";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateTab(activeTab)) {
            setActiveTab(activeTab + 1);
        }
    };

    const handlePrevious = () => {
        setActiveTab(activeTab - 1);
    };

    const handleSave = async () => {
        if (isReadOnly) return;
        if (!validateTab(activeTab)) return;

        // Save/Update client data in Firestore
        if (formData.clienteNumDoc) {
            const clientDataToSave = {
                nombre: formData.clienteNombre,
                razonSocial: formData.clienteNombre,
                direccion: formData.clienteDireccion,
                estado: formData.clienteEstado,
                condicion: formData.clienteCondicion,
                departamento: formData.clienteDepartamento,
                provincia: formData.clienteProvincia,
                distrito: formData.clienteDistrito,
                tipoDocumento: formData.clienteTipoDoc,
                numeroDocumento: formData.clienteNumDoc,
                updatedAt: new Date()
            };
            await saveClientToFirestore(clientDataToSave, formData.clienteNumDoc);
        }

        const pesoNeto = formData.pesoBruto - formData.pesoTara;
        const ticketNumber = `GP-${String(entries.length + 1).padStart(5, '0')}`;

        // Save to Firestore
        try {
            const entryData = {
                tipoOperacion: formData.tipoOperacion,
                motivo: formData.motivo,
                tipoAcreditacion: formData.tipoAcreditacion,
                descripcionProducto: formData.descripcionProducto,
                canchaId: formData.canchaId,
                canchaNombre: formData.canchaNombre,
                pesoBruto: formData.pesoBruto,
                pesoTara: formData.pesoTara,
                pesoNeto: pesoNeto,
                clienteTipoDoc: formData.clienteTipoDoc,
                clienteNumDoc: formData.clienteNumDoc,
                clienteNombre: formData.clienteNombre,
                conductorTipoDoc: formData.conductorTipoDoc,
                conductorNumDoc: formData.conductorNumDoc,
                conductorNombre: formData.conductorNombre,
                conductorLicencia: formData.conductorLicencia,
                conductorPlaca: formData.conductorPlaca.toUpperCase(),
                rucRemitente: formData.rucRemitente,
                nombreRemitente: formData.nombreRemitente,
                numGuiaRemision: formData.numGuiaRemision,
                pesoRemitente: formData.pesoRemitente,

                rucTransportista: formData.rucTransportista,
                nombreTransportista: formData.nombreTransportista,
                ticketPeso: formData.ticketPeso || ticketNumber,
                pesoTicket: formData.pesoTicket,
                destinatario: formData.destinatario,
                // timestamp handled in action for create, passed for update if needed? Action handles it.
            };

            let result;
            if (editingId) {
                result = await updateGateEntry(editingId, entryData);
            } else {
                result = await createGateEntry(entryData);
            }

            if (!result.success) {
                throw new Error(result.error);
            }

            Swal.fire({
                icon: 'success',
                title: editingId ? '¡Registro Actualizado!' : '¡Registro Guardado!',
                text: editingId ? undefined : `Ticket: ${ticketNumber}`,
                timer: 2500,
                showConfirmButton: !editingId,
                confirmButtonColor: '#3b82f6'
            });

            setShowDialog(false);
            resetForm();
        } catch (error) {
            console.error("Error saving entry:", error);
            Swal.fire('Error', 'No se pudo guardar el registro', 'error');
        }
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    // const stats = {
    //     totalToday: entries.filter(e => {
    //         const today = new Date();
    //         return e.timestamp.toDateString() === today.toDateString();
    //     }).length,
    //     entradas: entries.filter(e => e.tipoOperacion === "entrada").length,
    //     salidas: entries.filter(e => e.tipoOperacion === "salida").length,
    //     pendientes: entries.filter(e => e.status === "pendiente").length
    // };

    const tabs = [
        { name: "Cliente", icon: "👤" },
        { name: "Datos Generales", icon: "📋" },
        { name: "Conductor", icon: "🚗" },
        { name: "Guías de Transporte", icon: "📄" },
        { name: "Otros Datos", icon: "📝" }
    ];

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex">
                <div className="w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 h-screen p-4">
                    <div className="space-y-4">
                        <Skeleton className="h-8 w-32" />
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </div>
                </div>
                <div className="flex-1 p-8">
                    <Skeleton className="h-8 w-48 mb-4" />
                    <Skeleton className="h-4 w-96 mb-8" />
                    <Skeleton className="h-64 w-full rounded-lg" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <Navbar />
            <Sidebar />

            <main className="ml-64 mt-16 p-8">
                <div className="max-w-full mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Control de Garita</h1>
                        <p className="text-gray-600 dark:text-gray-400">Gestión de entradas y salidas de vehículos</p>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md overflow-hidden">
                        <div className="p-6 border-b border-gray-200 dark:border-zinc-800 flex justify-between items-center">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Registro de Movimientos</h2>
                            <button
                                onClick={() => openDialog(undefined, 'create')}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
                            >
                                + Nuevo Registro
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-zinc-800">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ticket</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tipo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Placa</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Conductor</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Producto</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Peso Neto</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha/Hora</th>

                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-zinc-800">
                                    {loadingEntries ? (
                                        [...Array(5)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="px-6 py-4">
                                                    <Skeleton className="h-6 w-20 rounded-full" />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Skeleton className="h-6 w-24 rounded-full" />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Skeleton className="h-4 w-24" />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Skeleton className="h-4 w-32" />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Skeleton className="h-4 w-48" />
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        <Skeleton className="h-4 w-24" />
                                                        <Skeleton className="h-3 w-16" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Skeleton className="h-6 w-20 rounded-full" />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Skeleton className="h-8 w-8 rounded-md" />
                                                        <Skeleton className="h-8 w-8 rounded-md" />
                                                        <Skeleton className="h-8 w-8 rounded-md" />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : entries.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                No hay registros para mostrar
                                            </td>
                                        </tr>
                                    ) : (
                                        entries.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full text-xs font-mono font-semibold">
                                                        {entry.ticketPeso}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${entry.tipoOperacion === "entrada"
                                                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                                        : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                                        }`}>
                                                        {entry.tipoOperacion === "entrada" ? (
                                                            <ArrowRightOnRectangleIcon className="w-4 h-4" />
                                                        ) : (
                                                            <ArrowLeftOnRectangleIcon className="w-4 h-4" />
                                                        )}
                                                        {entry.tipoOperacion.charAt(0).toUpperCase() + entry.tipoOperacion.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                                                    {entry.conductorPlaca}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {entry.conductorNombre}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                                                    {entry.descripcionProducto}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                                                    {entry.pesoNeto.toFixed(2)} t
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    <div>{formatDate(entry.timestamp)}</div>
                                                    <div className="text-xs">{formatTime(entry.timestamp)}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openDialog(entry, 'view')}
                                                            className="text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 transition-colors p-1"
                                                            title="Ver detalles"
                                                        >
                                                            <EyeIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => openDialog(entry, 'edit')}
                                                            className="text-gray-400 hover:text-yellow-600 dark:text-gray-500 dark:hover:text-yellow-400 transition-colors p-1"
                                                            title="Editar"
                                                        >
                                                            <PencilIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => window.open(`/garita/ticket/${entry.id}`, '_blank')}
                                                            className="text-gray-400 hover:text-purple-600 dark:text-gray-500 dark:hover:text-purple-400 transition-colors p-1"
                                                            title="Imprimir Ticket"
                                                        >
                                                            <PrinterIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(entry.id)}
                                                            className="text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-1"
                                                            title="Eliminar"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main >

            {/* Dialog Modal */}
            {
                showDialog && (
                    <div className="fixed inset-0 z-[100] overflow-y-auto">
                        <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                            {/* Overlay with Blur */}
                            <div className="fixed inset-0 transition-opacity bg-black/40 backdrop-blur-sm" onClick={closeDialog}></div>

                            {/* Modal */}
                            <div className="relative z-10 inline-block w-full max-w-6xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-zinc-900 shadow-2xl rounded-xl border border-gray-200 dark:border-zinc-800">
                                {/* Header */}
                                <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-800 bg-gradient-to-r from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-900">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                            {isReadOnly ? 'Detalles del Registro' : editingId ? 'Editar Registro' : 'Nuevo Registro de Garita'}
                                        </h3>
                                        <button
                                            onClick={closeDialog}
                                            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                                        >
                                            <XMarkIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="px-6 pb-6 border-b border-gray-100 dark:border-zinc-800">
                                    <div className="flex p-1 bg-gray-100/80 dark:bg-zinc-800/80 rounded-xl">
                                        {tabs.map((tab, index) => (
                                            <button
                                                key={index}
                                                onClick={() => setActiveTab(index)}
                                                className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === index
                                                    ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm ring-1 ring-black/5"
                                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-zinc-700/50"
                                                    }`}
                                            >
                                                <span className={`mr-2 ${activeTab === index ? "text-gray-700 dark:text-gray-300" : "text-gray-400"}`}>
                                                    {tab.icon}
                                                </span>
                                                {tab.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Form Content */}
                                <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
                                    {/* Tab 0: Datos del Cliente */}
                                    {activeTab === 0 && (
                                        <div className="space-y-6">
                                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Datos del Cliente</h4>

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField label="Tipo de Documento" required>
                                                    <Select
                                                        value={formData.clienteTipoDoc}
                                                        onChange={(e) => setFormData({ ...formData, clienteTipoDoc: e.target.value, clienteNumDoc: '', clienteNombre: '' })}
                                                        disabled={isReadOnly}
                                                    >
                                                        <option value="DNI">DNI</option>
                                                        <option value="RUC">RUC</option>
                                                        <option value="CE">Carnet de Extranjería</option>
                                                        <option value="PASAPORTE">Pasaporte</option>
                                                    </Select>
                                                </FormField>

                                                <FormField label="Número de Documento" required error={errors.clienteNumDoc}>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={formData.clienteNumDoc}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, '');
                                                                setFormData({ ...formData, clienteNumDoc: val });
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleClientSearch(formData.clienteNumDoc, formData.clienteTipoDoc, new AbortController().signal);
                                                                }
                                                            }}
                                                            placeholder={formData.clienteTipoDoc === "DNI" ? "12345678" : "12345678901"}
                                                            maxLength={formData.clienteTipoDoc === "RUC" ? 11 : 8}
                                                            readOnly={isReadOnly}
                                                            className="w-full pl-4 pr-12 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleClientSearch(formData.clienteNumDoc, formData.clienteTipoDoc, new AbortController().signal)}
                                                            disabled={isSearchingClient || !formData.clienteNumDoc}
                                                            className="absolute right-0 top-0 bottom-0 aspect-square bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center border border-transparent"
                                                            title="Buscar cliente"
                                                        >
                                                            {isSearchingClient ? (
                                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                            ) : (
                                                                <MagnifyingGlassIcon className="w-5 h-5" />
                                                            )}
                                                        </button>
                                                    </div>
                                                    {clientFound === false && !isSearchingClient && formData.clienteNumDoc.length >= 8 && (
                                                        <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                                                            Cliente nuevo. Ingrese el nombre para registrarlo.
                                                        </p>
                                                    )}

                                                </FormField>
                                            </div>

                                            <FormField label="Nombre / Razón Social" required error={errors.clienteNombre}>
                                                <input
                                                    type="text"
                                                    value={formData.clienteNombre}
                                                    onChange={(e) => setFormData({ ...formData, clienteNombre: e.target.value })}
                                                    placeholder="Nombre completo o razón social"
                                                    readOnly={clientFound === true || isReadOnly}
                                                    className={`w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 ${clientFound === true || isReadOnly ? "opacity-75 cursor-not-allowed bg-gray-100 dark:bg-zinc-800" : ""}`}
                                                />
                                            </FormField>

                                            {/* New Fields for SUNAT Data */}
                                            {formData.clienteDireccion && (
                                                <FormField label="Dirección Fiscal">
                                                    <input
                                                        type="text"
                                                        value={formData.clienteDireccion}
                                                        readOnly
                                                        className="w-full px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 border border-transparent rounded-lg text-gray-900 dark:text-white"
                                                    />
                                                </FormField>
                                            )}

                                            {(formData.clienteDepartamento || formData.clienteProvincia || formData.clienteDistrito) && (
                                                <div className="grid grid-cols-3 gap-4">
                                                    <FormField label="Departamento">
                                                        <input
                                                            type="text"
                                                            value={formData.clienteDepartamento}
                                                            readOnly
                                                            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 border border-transparent rounded-lg text-gray-900 dark:text-white"
                                                        />
                                                    </FormField>
                                                    <FormField label="Provincia">
                                                        <input
                                                            type="text"
                                                            value={formData.clienteProvincia}
                                                            readOnly
                                                            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 border border-transparent rounded-lg text-gray-900 dark:text-white"
                                                        />
                                                    </FormField>
                                                    <FormField label="Distrito">
                                                        <input
                                                            type="text"
                                                            value={formData.clienteDistrito}
                                                            readOnly
                                                            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 border border-transparent rounded-lg text-gray-900 dark:text-white"
                                                        />
                                                    </FormField>
                                                </div>
                                            )}

                                            {(formData.clienteEstado || formData.clienteCondicion) && (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <FormField label="Estado">
                                                        <div className={`w-full px-4 py-2.5 rounded-lg font-medium ${formData.clienteEstado === "ACTIVO"
                                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                            }`}>
                                                            {formData.clienteEstado}
                                                        </div>
                                                    </FormField>
                                                    <FormField label="Condición">
                                                        <div className={`w-full px-4 py-2.5 rounded-lg font-medium ${formData.clienteCondicion === "HABIDO"
                                                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                            }`}>
                                                            {formData.clienteCondicion}
                                                        </div>
                                                    </FormField>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Tab 1: Datos Generales y Pesaje */}
                                    {activeTab === 1 && (
                                        <div className="space-y-6">
                                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Datos Generales y Pesaje</h4>

                                            {formData.clienteReinfo && (
                                                <div className="mb-4 p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg flex items-center gap-2 text-teal-800 dark:text-teal-400">
                                                    <CheckCircleIcon className="w-5 h-5" />
                                                    <span className="font-medium">Cliente con REINFO Activo</span>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField label="Tipo de Operación" required error={errors.tipoOperacion}>
                                                    <Select
                                                        value={formData.tipoOperacion}
                                                        onChange={(e) => setFormData({ ...formData, tipoOperacion: e.target.value as "entrada" | "salida" })}
                                                        disabled={isReadOnly}
                                                    >
                                                        <option value="entrada">Entrada</option>
                                                        <option value="salida">Salida</option>
                                                    </Select>
                                                </FormField>

                                                <FormField label="Tipo de Acreditación" required error={errors.tipoAcreditacion}>
                                                    <Select
                                                        value={formData.tipoAcreditacion}
                                                        onChange={(e) => setFormData({ ...formData, tipoAcreditacion: e.target.value })}
                                                        disabled={isReadOnly}
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {acreditaciones.map((a) => (
                                                            <option key={a.id} value={a.nombre}>
                                                                {a.nombre}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                </FormField>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField label="Motivo" required error={errors.motivo} className={formData.tipoOperacion === "entrada" ? "" : "col-span-2"}>
                                                    <Select
                                                        value={formData.motivo}
                                                        onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                                                        disabled={isReadOnly}
                                                    >
                                                        <option value="">Seleccionar motivo...</option>
                                                        {motivos.map((m) => (
                                                            <option key={m.id} value={m.nombre}>
                                                                {m.nombre}
                                                            </option>
                                                        ))}
                                                    </Select>
                                                </FormField>

                                                {formData.tipoOperacion === "entrada" && (
                                                    <FormField label="Cancha de Destino (Stockpile)">
                                                        <Select
                                                            value={formData.canchaId}
                                                            onChange={(e) => {
                                                                const selectedCancha = canchas.find(c => c.id === e.target.value);
                                                                setFormData({
                                                                    ...formData,
                                                                    canchaId: e.target.value,
                                                                    canchaNombre: selectedCancha?.nombre || ""
                                                                });
                                                            }}
                                                            disabled={isReadOnly}
                                                        >
                                                            <option value="">Seleccionar Cancha...</option>
                                                            {canchas.map((c) => (
                                                                <option key={c.id} value={c.id}>
                                                                    {c.nombre} (Stock: {c.stockActual} t)
                                                                </option>
                                                            ))}
                                                        </Select>
                                                        {canchas.length === 0 && (
                                                            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                                                                No hay canchas registradas.
                                                            </p>
                                                        )}
                                                    </FormField>
                                                )}
                                            </div>

                                            <FormField label="Descripción de Producto" required error={errors.descripcionProducto}>
                                                <textarea
                                                    value={formData.descripcionProducto}
                                                    onChange={(e) => setFormData({ ...formData, descripcionProducto: e.target.value })}
                                                    placeholder="Describe el producto transportado"
                                                    rows={3}
                                                    readOnly={isReadOnly}
                                                    className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                />
                                            </FormField>

                                            <div className="grid grid-cols-3 gap-4">
                                                <FormField label="Peso Bruto (t)" required error={errors.pesoBruto}>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                        value={formData.pesoBruto || ''}
                                                        onChange={(e) => setFormData({ ...formData, pesoBruto: parseFloat(e.target.value) || 0 })}
                                                        placeholder="0.00"
                                                        readOnly={isReadOnly}
                                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                    />
                                                </FormField>

                                                <FormField label="Peso Tara (t)" required error={errors.pesoTara}>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                        value={formData.pesoTara || ''}
                                                        onChange={(e) => setFormData({ ...formData, pesoTara: parseFloat(e.target.value) || 0 })}
                                                        placeholder="0.00"
                                                        readOnly={isReadOnly}
                                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                    />
                                                </FormField>

                                                <FormField label="Peso Neto (t)">
                                                    <input
                                                        type="text"
                                                        value={(formData.pesoBruto - formData.pesoTara).toFixed(2)}
                                                        readOnly
                                                        className="w-full px-4 py-2.5 bg-gray-100 dark:bg-zinc-800 border border-transparent rounded-lg font-semibold text-green-600 dark:text-green-400"
                                                    />
                                                </FormField>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 2: Datos del Conductor */}
                                    {activeTab === 2 && (
                                        <div className="space-y-6">
                                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Datos del Conductor</h4>

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField label="Tipo de Documento" required>
                                                    <Select
                                                        value={formData.conductorTipoDoc}
                                                        onChange={(e) => setFormData({ ...formData, conductorTipoDoc: e.target.value })}
                                                        disabled={isReadOnly}
                                                    >
                                                        <option value="DNI">DNI</option>
                                                        <option value="CE">Carnet de Extranjería</option>
                                                        <option value="PASAPORTE">Pasaporte</option>
                                                    </Select>
                                                </FormField>

                                                <FormField label="Número de Documento" required error={errors.conductorNumDoc}>
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={formData.conductorNumDoc}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, '');
                                                                setFormData({ ...formData, conductorNumDoc: val });
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleConductorSearch(formData.conductorNumDoc);
                                                                }
                                                            }}
                                                            placeholder="12345678"
                                                            maxLength={8}
                                                            readOnly={isReadOnly}
                                                            className="w-full pl-4 pr-12 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleConductorSearch(formData.conductorNumDoc)}
                                                            disabled={isSearchingConductor || !formData.conductorNumDoc}
                                                            className="absolute right-0 top-0 bottom-0 aspect-square bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center border border-transparent"
                                                            title="Buscar conductor"
                                                        >
                                                            {isSearchingConductor ? (
                                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                            ) : (
                                                                <MagnifyingGlassIcon className="w-5 h-5" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </FormField>
                                            </div>

                                            <FormField label="Nombre o Razón Social" required error={errors.conductorNombre}>
                                                <input
                                                    type="text"
                                                    value={formData.conductorNombre}
                                                    onChange={(e) => setFormData({ ...formData, conductorNombre: e.target.value })}
                                                    placeholder="Nombre completo"
                                                    readOnly={isReadOnly}
                                                    className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                />
                                            </FormField>

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField label="Licencia de Conducir" required error={errors.conductorLicencia}>
                                                    <input
                                                        type="text"
                                                        value={formData.conductorLicencia}
                                                        onChange={(e) => setFormData({ ...formData, conductorLicencia: e.target.value })}
                                                        placeholder="Q12345678"
                                                        readOnly={isReadOnly}
                                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                    />
                                                </FormField>

                                                <FormField label="Placa del Vehículo" required error={errors.conductorPlaca}>
                                                    <input
                                                        type="text"
                                                        value={formData.conductorPlaca}
                                                        onChange={(e) => setFormData({ ...formData, conductorPlaca: e.target.value.toUpperCase() })}
                                                        placeholder="ABC-123"
                                                        readOnly={isReadOnly}
                                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                    />
                                                </FormField>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 3: Guías de Transporte */}
                                    {activeTab === 3 && (
                                        <div className="space-y-6">
                                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Guías de Transporte</h4>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <FormField label="RUC Remitente">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={formData.rucRemitente}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, '');
                                                                setFormData({ ...formData, rucRemitente: val });
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleRemitenteSearch(formData.rucRemitente);
                                                                }
                                                            }}
                                                            placeholder="20123456789"
                                                            maxLength={11}
                                                            readOnly={isReadOnly}
                                                            className="w-full pl-4 pr-12 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemitenteSearch(formData.rucRemitente)}
                                                            disabled={isSearchingRemitente || !formData.rucRemitente}
                                                            className="absolute right-0 top-0 bottom-0 aspect-square bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center border border-transparent"
                                                            title="Buscar remitente"
                                                        >
                                                            {isSearchingRemitente ? (
                                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                            ) : (
                                                                <MagnifyingGlassIcon className="w-5 h-5" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </FormField>

                                                <div className="md:col-span-2">
                                                    <FormField label="Nombre Remitente">
                                                        <input
                                                            type="text"
                                                            value={formData.nombreRemitente}
                                                            onChange={(e) => setFormData({ ...formData, nombreRemitente: e.target.value })}
                                                            placeholder="Razón Social Remitente"
                                                            readOnly={isReadOnly}
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                        />
                                                    </FormField>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <FormField label="N° Guía Remisión">
                                                    <input
                                                        type="text"
                                                        value={formData.numGuiaRemision}
                                                        onChange={(e) => setFormData({ ...formData, numGuiaRemision: e.target.value })}
                                                        placeholder="T001-00001234"
                                                        readOnly={isReadOnly}
                                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                    />
                                                </FormField>

                                                <div className="md:col-span-2">
                                                    <FormField label="Peso Remitente (t)">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            onWheel={(e) => e.currentTarget.blur()}
                                                            value={formData.pesoRemitente || ''}
                                                            onChange={(e) => setFormData({ ...formData, pesoRemitente: parseFloat(e.target.value) || 0 })}
                                                            placeholder="0.00"
                                                            readOnly={isReadOnly}
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                        />
                                                    </FormField>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <FormField label="RUC Transportista">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            value={formData.rucTransportista}
                                                            onChange={(e) => {
                                                                const val = e.target.value.replace(/\D/g, '');
                                                                setFormData({ ...formData, rucTransportista: val });
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleTransportistaSearch(formData.rucTransportista);
                                                                }
                                                            }}
                                                            placeholder="20123456789"
                                                            maxLength={11}
                                                            readOnly={isReadOnly}
                                                            className="w-full pl-4 pr-12 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleTransportistaSearch(formData.rucTransportista)}
                                                            disabled={isSearchingTransportista || !formData.rucTransportista}
                                                            className="absolute right-0 top-0 bottom-0 aspect-square bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center border border-transparent"
                                                            title="Buscar transportista"
                                                        >
                                                            {isSearchingTransportista ? (
                                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                            ) : (
                                                                <MagnifyingGlassIcon className="w-5 h-5" />
                                                            )}
                                                        </button>
                                                    </div>
                                                </FormField>

                                                <div className="md:col-span-2">
                                                    <FormField label="Nombre Transportista">
                                                        <input
                                                            type="text"
                                                            value={formData.nombreTransportista}
                                                            onChange={(e) => setFormData({ ...formData, nombreTransportista: e.target.value })}
                                                            placeholder="Razón Social Transportista"
                                                            readOnly={isReadOnly}
                                                            className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                        />
                                                    </FormField>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Tab 4: Otros Datos */}
                                    {activeTab === 4 && (
                                        <div className="space-y-6">
                                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Otros Datos</h4>

                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField label="Ticket de Peso (Manual)">
                                                    <input
                                                        type="text"
                                                        value={formData.ticketPeso}
                                                        onChange={(e) => setFormData({ ...formData, ticketPeso: e.target.value })}
                                                        placeholder="Dejar en blanco para autogenerar"
                                                        readOnly={isReadOnly}
                                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                    />
                                                </FormField>

                                                <FormField label="Peso del Ticket (t)">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        onWheel={(e) => e.currentTarget.blur()}
                                                        value={formData.pesoTicket || ''}
                                                        onChange={(e) => setFormData({ ...formData, pesoTicket: parseFloat(e.target.value) || 0 })}
                                                        placeholder="0.00"
                                                        readOnly={isReadOnly}
                                                        className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                    />
                                                </FormField>
                                            </div>

                                            <FormField label="Destinatario">
                                                <input
                                                    type="text"
                                                    value={formData.destinatario}
                                                    onChange={(e) => setFormData({ ...formData, destinatario: e.target.value })}
                                                    placeholder="Nombre del destinatario final"
                                                    readOnly={isReadOnly}
                                                    className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 transition-all disabled:opacity-60 read-only:bg-gray-100 dark:read-only:bg-zinc-800"
                                                />
                                            </FormField>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-6 py-5 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 rounded-b-xl flex justify-between items-center">
                                    <button
                                        onClick={handlePrevious}
                                        disabled={activeTab === 0}
                                        className="px-6 py-2.5 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                    >
                                        Anterior
                                    </button>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={closeDialog}
                                            className="px-6 py-2.5 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition font-medium"
                                        >
                                            Cancelar
                                        </button>

                                        {(isReadOnly || editingId) && (
                                            <button
                                                onClick={() => window.open(`/garita/ticket/${editingId}`, '_blank')}
                                                className="px-6 py-2.5 border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition font-medium flex items-center gap-2"
                                            >
                                                <PrinterIcon className="w-5 h-5" />
                                                Imprimir
                                            </button>
                                        )}

                                        {!isReadOnly && (
                                            activeTab === tabs.length - 1 ? (
                                                <button
                                                    onClick={handleSave}
                                                    className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 font-medium"
                                                >
                                                    {editingId ? 'Actualizar Registro' : 'Guardar Registro'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleNext}
                                                    className="px-8 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/20 font-medium"
                                                >
                                                    Siguiente
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

