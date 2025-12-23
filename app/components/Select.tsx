"use client";

import React from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    className?: string;
}

export default function Select({ className = "", children, ...props }: SelectProps) {
    return (
        <div className="relative">
            <select
                className={`w-full pl-4 pr-10 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none shadow-sm ${className}`}
                {...props}
            >
                {children}
            </select>
            <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
    );
}
