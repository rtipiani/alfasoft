import React from "react";

interface Props {
    label: string;
    children: React.ReactNode;
    required?: boolean;
    error?: string;
    className?: string;
}

export default function FormField({ label, children, required, error, className = "" }: Props) {
    // Clone the child to add default classes if it's a valid React element
    const child = React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ className?: string }>, {
            className: `${(children.props as { className?: string }).className || ''} border border-gray-300 dark:border-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 rounded-lg shadow-sm`
        })
        : children;

    return (
        <div className={`mb-4 ${className}`}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {child}
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        </div>
    );
}
