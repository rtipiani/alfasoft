"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signOut, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, writeBatch } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
    MagnifyingGlassIcon,
    BellIcon,
    UserCircleIcon,
    ChevronDownIcon,
    ArrowRightOnRectangleIcon,
    Cog6ToothIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    InformationCircleIcon,
    XMarkIcon,
    TrashIcon
} from "@heroicons/react/24/outline";

type Notification = {
    id: string;
    titulo: string;
    mensaje: string;
    leido: boolean;
    fecha: any; // Timestamp
    tipo: 'info' | 'success' | 'warning' | 'error';
    link?: string;
};

export default function Navbar() {
    const router = useRouter();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    // Refs for click outside closing
    const notificationRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
        });

        // Click outside listener
        const handleClickOutside = (event: MouseEvent) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            unsubscribe();
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Notifications Listener
    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "notificaciones"),
            where("userId", "==", currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            // Sort client-side
            data.sort((a, b) => {
                const dateA = a.fecha?.seconds || 0;
                const dateB = b.fecha?.seconds || 0;
                return dateB - dateA;
            });
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.leido).length);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/");
    };

    const handleMarkAsRead = async (id: string) => {
        try {
            await updateDoc(doc(db, "notificaciones", id), { leido: true });
        } catch (error) {
            console.error("Error marking as read:", error);
        }
    };

    const handleMarkAllAsRead = async () => {
        const batch = writeBatch(db);
        const unread = notifications.filter(n => !n.leido);

        unread.forEach(n => {
            const ref = doc(db, "notificaciones", n.id);
            batch.update(ref, { leido: true });
        });

        try {
            await batch.commit();
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Prevent triggering the notification click
        try {
            await deleteDoc(doc(db, "notificaciones", id));
        } catch (error) {
            console.error("Error deleting notification:", error);
        }
    };

    const getIcon = (tipo: string) => {
        switch (tipo) {
            case 'success': return <CheckCircleIcon className="w-6 h-6 text-green-500" />;
            case 'warning': return <ExclamationCircleIcon className="w-6 h-6 text-yellow-500" />;
            case 'error': return <XMarkIcon className="w-6 h-6 text-red-500" />;
            default: return <InformationCircleIcon className="w-6 h-6 text-blue-500" />;
        }
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-20 h-16 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 shadow-sm">
            <div className="h-full px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-full">
                    {/* Logo */}
                    <div className="flex items-center gap-8">
                        <Link
                            href="/dashboard"
                            className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
                        >
                            AlfaSoft
                        </Link>

                        {/* Barra de búsqueda */}
                        <div className="hidden md:flex items-center">
                            <div className="relative">
                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    className="pl-10 pr-4 py-2 w-80 bg-gray-100 dark:bg-zinc-800 border-0 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Acciones de usuario */}
                    <div className="flex items-center gap-4">
                        {/* Notificaciones */}
                        <div className="relative" ref={notificationRef}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition"
                            >
                                <BellIcon className="w-6 h-6" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                )}
                            </button>

                            {/* Dropdown Notificaciones */}
                            {showNotifications && (
                                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 overflow-hidden z-50">
                                    <div className="p-4 border-b border-gray-200 dark:border-zinc-700 flex justify-between items-center bg-gray-50 dark:bg-zinc-800/50">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">Notificaciones</h3>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={handleMarkAllAsRead}
                                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                Marcar todas leídas
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-[400px] overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                                                <BellIcon className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                                <p>No tienes notificaciones</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-gray-100 dark:divide-zinc-700">
                                                {notifications.map((notif) => (
                                                    <div
                                                        key={notif.id}
                                                        onClick={() => {
                                                            if (!notif.leido) handleMarkAsRead(notif.id);
                                                            if (notif.link) router.push(notif.link);
                                                        }}
                                                        className={`p-4 hover:bg-gray-50 dark:hover:bg-zinc-700/50 transition cursor-pointer relative group ${!notif.leido ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                                                            }`}
                                                    >
                                                        <div className="flex gap-3">
                                                            <div className="mt-1 flex-shrink-0">
                                                                {getIcon(notif.tipo)}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-start">
                                                                    <p className={`text-sm font-medium ${!notif.leido ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                                                        {notif.titulo}
                                                                    </p>
                                                                    <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                                                        {notif.fecha?.seconds ? formatDistanceToNow(notif.fecha.seconds * 1000, { addSuffix: true, locale: es }) : 'Justo ahora'}
                                                                    </span>
                                                                </div>
                                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                                                    {notif.mensaje}
                                                                </p>
                                                            </div>
                                                            <button
                                                                onClick={(e) => handleDelete(e, notif.id)}
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity absolute right-2 bottom-2"
                                                                title="Eliminar"
                                                            >
                                                                <TrashIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                        {!notif.leido && (
                                                            <span className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full"></span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Menú de usuario */}
                        <div className="relative" ref={userMenuRef}>
                            <button
                                onClick={() => setShowUserMenu(!showUserMenu)}
                                className="flex items-center gap-2 p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition"
                            >
                                <UserCircleIcon className="w-8 h-8 text-gray-600 dark:text-gray-300" />
                                <div className="hidden md:block text-left">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Usuario'}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {currentUser?.email || 'Cargando...'}
                                    </p>
                                </div>
                                <ChevronDownIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                            </button>

                            {/* Dropdown Usuario */}
                            {showUserMenu && (
                                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-gray-200 dark:border-zinc-700 py-2 z-50">
                                    <Link
                                        href="/profile"
                                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                                        onClick={() => setShowUserMenu(false)}
                                    >
                                        <UserCircleIcon className="w-5 h-5" />
                                        Mi Perfil
                                    </Link>
                                    <Link
                                        href="/settings"
                                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700"
                                        onClick={() => setShowUserMenu(false)}
                                    >
                                        <Cog6ToothIcon className="w-5 h-5" />
                                        Configuración
                                    </Link>
                                    <hr className="my-2 border-gray-200 dark:border-zinc-700" />
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-zinc-700"
                                    >
                                        <ArrowRightOnRectangleIcon className="w-5 h-5" />
                                        Cerrar sesión
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
