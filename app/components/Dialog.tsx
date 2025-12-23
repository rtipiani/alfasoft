"use client";

import { Fragment, ReactNode } from 'react';
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
    maxWidth?: string;
};

export default function Dialog({ isOpen, onClose, title, children, maxWidth = "max-w-md" }: Props) {
    return (
        <Transition appear show={isOpen} as={Fragment}>
            <HeadlessDialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <HeadlessDialog.Panel className={`w-full ${maxWidth} transform overflow-hidden rounded-xl bg-white dark:bg-zinc-900 text-left align-middle shadow-2xl transition-all border border-gray-200 dark:border-zinc-800`}>
                                <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-800 bg-gradient-to-r from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-900 flex items-center justify-between">
                                    <HeadlessDialog.Title
                                        as="div"
                                        className="text-xl font-bold text-gray-900 dark:text-white w-full"
                                    >
                                        {title}
                                    </HeadlessDialog.Title>
                                    <button
                                        onClick={onClose}
                                        className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
                                    >
                                        <XMarkIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                <div className="p-6">
                                    {children}
                                </div>
                            </HeadlessDialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </HeadlessDialog>
        </Transition>
    );
}
