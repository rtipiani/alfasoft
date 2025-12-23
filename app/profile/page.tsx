"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { updateProfile, User } from "firebase/auth";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Sidebar from "@/app/components/Sidebar";
import {
    UserCircleIcon,
    ShieldCheckIcon,
    CheckIcon,
    XMarkIcon,
    IdentificationIcon,
    KeyIcon,
    BriefcaseIcon
} from "@heroicons/react/24/outline";

export default function ProfilePage() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [firestoreUser, setFirestoreUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'general' | 'seguridad'>('general');

    // Edit State
    const [displayName, setDisplayName] = useState("");
    const [photoURL, setPhotoURL] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (user) {
                setCurrentUser(user);
                setDisplayName(user.displayName || "");
                setPhotoURL(user.photoURL || "");

                // Fetch Firestore User Data
                if (user.email) {
                    try {
                        const q = query(collection(db, "usuarios"), where("email", "==", user.email));
                        const querySnapshot = await getDocs(q);
                        if (!querySnapshot.empty) {
                            const userDoc = querySnapshot.docs[0];
                            setFirestoreUser({ id: userDoc.id, ...userDoc.data() });
                        }
                    } catch (error) {
                        console.error("Error fetching user data:", error);
                    }
                }
            } else {
                router.push("/");
            }
        });

        return () => unsubscribe();
    }, [router]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        setLoading(true);
        setMessage(null);

        try {
            // 1. Update Firebase Auth Profile
            await updateProfile(currentUser, {
                displayName: displayName || null,
                photoURL: photoURL || null,
            });

            // 2. Update Firestore User Document (if exists)
            if (firestoreUser && firestoreUser.id) {
                await updateDoc(doc(db, "usuarios", firestoreUser.id), {
                    nombre: displayName
                });
                // Update local state
                setFirestoreUser((prev: any) => ({ ...prev, nombre: displayName }));
            }

            setMessage({ type: 'success', text: '¡Perfil actualizado exitosamente!' });

            // Forzar recarga del usuario
            await currentUser.reload();
            setCurrentUser(auth.currentUser);
        } catch (error: unknown) {
            const err = error as Error;
            setMessage({ type: 'error', text: `Error al actualizar: ${err.message}` });
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (timestamp: string | null) => {
        if (!timestamp) return "No disponible";
        return new Date(timestamp).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    if (!currentUser) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando perfil...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
            <Navbar />
            <Sidebar />

            <main className="ml-64 mt-16 p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* Header */}
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Mi Perfil</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Gestiona tu información personal y preferencias de cuenta.
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-gray-200 dark:border-zinc-800">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setActiveTab('general')}
                                className={`${activeTab === 'general'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                            >
                                <IdentificationIcon className="w-5 h-5" />
                                Información General
                            </button>
                            <button
                                onClick={() => setActiveTab('seguridad')}
                                className={`${activeTab === 'seguridad'
                                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
                            >
                                <ShieldCheckIcon className="w-5 h-5" />
                                Seguridad
                            </button>
                        </nav>
                    </div>

                    {/* Mensaje de estado */}
                    {message && (
                        <div className={`p-4 rounded-lg flex items-center gap-2 ${message.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                            }`}>
                            {message.type === 'success' ? <CheckIcon className="w-5 h-5" /> : <XMarkIcon className="w-5 h-5" />}
                            {message.text}
                        </div>
                    )}

                    {/* Content */}
                    <div className="mt-6">
                        {/* GENERAL TAB */}
                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-900/20">
                                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">Información Personal</h3>
                                    <p className="text-xs text-blue-600 dark:text-blue-400">
                                        Actualiza tu nombre y foto de perfil. Esta información será visible para otros usuarios.
                                    </p>
                                </div>

                                <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-6">
                                    <div className="flex flex-col md:flex-row gap-8">
                                        {/* Foto */}
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="relative w-32 h-32">
                                                {photoURL ? (
                                                    <Image
                                                        src={photoURL}
                                                        alt="Foto de perfil"
                                                        fill
                                                        className="rounded-full object-cover border-4 border-gray-100 dark:border-zinc-800"
                                                        unoptimized={true}
                                                    />
                                                ) : (
                                                    <UserCircleIcon className="w-32 h-32 text-gray-300 dark:text-zinc-700" />
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-[150px]">
                                                Se recomienda una imagen cuadrada de al menos 200x200px.
                                            </p>

                                            {/* Rol Badge */}
                                            {firestoreUser?.rol && (
                                                <div className="flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                                                    <BriefcaseIcon className="w-3 h-3" />
                                                    {firestoreUser.rol}
                                                </div>
                                            )}
                                        </div>

                                        {/* Formulario */}
                                        <form onSubmit={handleSave} className="flex-1 space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Nombre Completo
                                                </label>
                                                <input
                                                    type="text"
                                                    value={displayName}
                                                    onChange={(e) => setDisplayName(e.target.value)}
                                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                                                    placeholder="Tu nombre"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    URL de Foto
                                                </label>
                                                <input
                                                    type="url"
                                                    value={photoURL}
                                                    onChange={(e) => setPhotoURL(e.target.value)}
                                                    className="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white"
                                                    placeholder="https://ejemplo.com/foto.jpg"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                    Correo Electrónico
                                                </label>
                                                <input
                                                    type="email"
                                                    value={currentUser.email || ""}
                                                    disabled
                                                    className="w-full px-4 py-2 bg-gray-100 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-gray-500 dark:text-gray-400 cursor-not-allowed"
                                                />
                                                <p className="mt-1 text-xs text-gray-500">El correo electrónico no se puede cambiar.</p>
                                            </div>

                                            <div className="pt-4 flex justify-end">
                                                <button
                                                    type="submit"
                                                    disabled={loading}
                                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 flex items-center gap-2"
                                                >
                                                    {loading ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                            Guardando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckIcon className="w-5 h-5" />
                                                            Guardar Cambios
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SEGURIDAD TAB */}
                        {activeTab === 'seguridad' && (
                            <div className="space-y-6">
                                <div className="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-lg border border-purple-100 dark:border-purple-900/20">
                                    <h3 className="text-sm font-medium text-purple-800 dark:text-purple-300 mb-1">Seguridad de la Cuenta</h3>
                                    <p className="text-xs text-purple-600 dark:text-purple-400">
                                        Información sobre el estado y seguridad de tu cuenta.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                                                <IdentificationIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-gray-900 dark:text-white">ID de Usuario</h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-2">
                                                    Identificador único de tu cuenta en el sistema.
                                                </p>
                                                <code className="text-xs bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded select-all">
                                                    {currentUser.uid}
                                                </code>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-6">
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-lg ${currentUser.emailVerified
                                                ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                                                : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
                                                }`}>
                                                <ShieldCheckIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-gray-900 dark:text-white">Estado de Verificación</h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-2">
                                                    {currentUser.emailVerified
                                                        ? "Tu correo electrónico ha sido verificado."
                                                        : "Tu correo electrónico no ha sido verificado."}
                                                </p>
                                                {currentUser.emailVerified ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                        <CheckIcon className="w-3 h-3" />
                                                        Verificado
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                                        Pendiente
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg text-gray-600 dark:text-gray-400">
                                                <KeyIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-gray-900 dark:text-white">Contraseña</h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                                                    Para cambiar tu contraseña, por favor contacta al administrador o usa la opción de recuperación en el login.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-6">
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-gray-50 dark:bg-zinc-800 rounded-lg text-gray-600 dark:text-gray-400">
                                                <IdentificationIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-gray-900 dark:text-white">Registro</h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    Miembro desde: <span className="font-medium text-gray-900 dark:text-white">{formatDate(currentUser.metadata.creationTime || null)}</span>
                                                </p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    Último acceso: <span className="font-medium text-gray-900 dark:text-white">{formatDate(currentUser.metadata.lastSignInTime || null)}</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
