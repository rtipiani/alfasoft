import { ScaleIcon } from "@heroicons/react/24/outline";

export default function BalanzaConfigPage() {
    return (
        <div className="space-y-6 text-center py-12">
            <ScaleIcon className="w-16 h-16 mx-auto text-gray-300 dark:text-zinc-700 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Configuración de Balanza</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Aquí podrás configurar los parámetros de la balanza, puertos seriales y calibración.
            </p>
        </div>
    );
}
