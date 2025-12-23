"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
    HomeIcon,
    CogIcon,
    ChartBarIcon,
    DocumentTextIcon,
    UsersIcon,
    CalendarIcon,
    ShieldCheckIcon,
    ScaleIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    BookOpenIcon,
    UserGroupIcon,
    ArchiveBoxIcon,
    BanknotesIcon,
    CurrencyDollarIcon,
    BeakerIcon,
    FunnelIcon,
    Cog6ToothIcon,
    PresentationChartLineIcon,
    ShoppingCartIcon,
    BriefcaseIcon
} from "@heroicons/react/24/outline";

type MenuItem = {
    name: string;
    href: string;
    icon: React.ElementType;
    submenu?: { name: string; href: string; icon: React.ElementType }[];
};

const menuItems: MenuItem[] = [
    { name: "Dashboard", href: "/dashboard", icon: HomeIcon },


    { name: "Calendario", href: "/calendar", icon: CalendarIcon },
    { name: "Garita", href: "/garita", icon: ShieldCheckIcon },
    {
        name: "Almacén",
        href: "/almacen",
        icon: ArchiveBoxIcon,
        submenu: [
            { name: "Dashboard", href: "/almacen", icon: ChartBarIcon },
            { name: "Reactivos", href: "/almacen/reactivos", icon: BeakerIcon },
            { name: "Materiales", href: "/almacen/materiales", icon: ArchiveBoxIcon },
        ]
    },
    {
        name: "Producción",
        href: "/produccion",
        icon: PresentationChartLineIcon,
        submenu: [
            { name: "Dashboard", href: "/produccion", icon: ChartBarIcon },
            { name: "Tolva Gruesos", href: "/produccion/tolva-gruesos", icon: FunnelIcon },
            { name: "Trituración", href: "/produccion/trituracion", icon: Cog6ToothIcon },
            { name: "Tolva Finos", href: "/produccion/tolva-finos", icon: FunnelIcon },
            { name: "Molienda", href: "/produccion/molienda", icon: Cog6ToothIcon },
            { name: "Flotación", href: "/produccion/flotacion", icon: BeakerIcon },
        ]
    },
    { name: "Balanza", href: "/balanza", icon: ScaleIcon },
    { name: "Reportes", href: "/reports", icon: ChartBarIcon },
    {
        name: "Comercial",
        href: "/comercial",
        icon: BriefcaseIcon,
        submenu: [
            { name: "Liquidaciones", href: "/liquidaciones", icon: DocumentTextIcon },
        ]
    },

    {
        name: "Finanzas",
        href: "/finanzas",
        icon: BanknotesIcon,
        submenu: [
            { name: "Dashboard", href: "/finanzas/dashboard", icon: ChartBarIcon },
            { name: "Adelantos", href: "/finanzas/adelantos", icon: CurrencyDollarIcon },
            { name: "Caja Chica", href: "/finanzas/caja-chica", icon: ArchiveBoxIcon },
            { name: "Caja Fuerte", href: "/finanzas/caja-fuerte", icon: ShieldCheckIcon },
        ]
    },

    {
        name: "Compras",
        href: "/compras",
        icon: ShoppingCartIcon,
        submenu: [
            { name: "Dashboard", href: "/compras", icon: ChartBarIcon },
            { name: "Órdenes de Compra", href: "/compras/ordenes", icon: DocumentTextIcon },
        ]
    },

    {
        name: "Directorios",
        href: "/directorios",
        icon: BookOpenIcon,
        submenu: [
            { name: "Clientes", href: "/clientes", icon: UsersIcon },
            { name: "Conductores", href: "/conductores", icon: UserGroupIcon },
        ]
    },
    {
        name: "Configuración",
        href: "/configuracion",
        icon: CogIcon,
        submenu: [
            { name: "Garita", href: "/configuracion/garita", icon: ShieldCheckIcon },
            { name: "Almacén", href: "/configuracion/almacen", icon: ArchiveBoxIcon },
            { name: "Canchas", href: "/configuracion/canchas", icon: FunnelIcon },
            { name: "Tolva de Grueso", href: "/configuracion/tolva", icon: FunnelIcon },
            { name: "Balanza", href: "/configuracion/balanza", icon: ScaleIcon },
            { name: "Finanzas", href: "/configuracion/finanzas", icon: BanknotesIcon },
            { name: "Usuarios", href: "/configuracion/usuarios", icon: UsersIcon },
        ]
    },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

    useEffect(() => {
        const activeParent = menuItems.find(item =>
            item.submenu?.some(sub => pathname === sub.href || pathname.startsWith(sub.href + '/'))
        );

        if (activeParent) {
            setExpandedMenu(activeParent.name);
        } else {
            setExpandedMenu(null);
        }
    }, [pathname]);

    const toggleMenu = (name: string) => {
        setExpandedMenu(expandedMenu === name ? null : name);
    };

    return (
        <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 flex flex-col">
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href || (item.submenu && pathname.startsWith(item.href));
                    const isExpanded = expandedMenu === item.name;
                    const Icon = item.icon;

                    return (
                        <div key={item.name}>
                            {item.submenu ? (
                                <button
                                    onClick={() => toggleMenu(item.name)}
                                    className={`
                                        w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                                        ${isActive
                                            ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400"
                                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon className="w-5 h-5" />
                                        <span>{item.name}</span>
                                    </div>
                                    {isExpanded ? (
                                        <ChevronDownIcon className="w-4 h-4" />
                                    ) : (
                                        <ChevronRightIcon className="w-4 h-4" />
                                    )}
                                </button>
                            ) : (
                                <Link
                                    href={item.href}
                                    className={`
                                        flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                                        ${isActive
                                            ? "bg-blue-600 text-white shadow-md"
                                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                        }
                                    `}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span>{item.name}</span>
                                </Link>
                            )}

                            {/* Submenu */}
                            {item.submenu && isExpanded && (
                                <div className="mt-1 ml-4 space-y-1 border-l-2 border-gray-100 dark:border-zinc-800 pl-2">
                                    {item.submenu.map((subItem) => {
                                        const isSubActive = pathname === subItem.href;
                                        const SubIcon = subItem.icon;
                                        return (
                                            <Link
                                                key={subItem.name}
                                                href={subItem.href}
                                                className={`
                                                    flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                                                    ${isSubActive
                                                        ? "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400"
                                                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800"
                                                    }
                                                `}
                                            >
                                                <SubIcon className="w-4 h-4" />
                                                <span>{subItem.name}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </nav>

            {/* Footer del Sidebar */}
            <div className="p-4 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900">
                <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    <p className="font-semibold">AlfaSoft v1.0</p>
                    <p>© 2025 Todos los derechos reservados</p>
                </div>
            </div>
        </aside>
    );
}
