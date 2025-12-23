"use client";


import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/dashboard");
      }
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect to dashboard on success
      router.push('/dashboard');
    } catch (err: unknown) {
      // We handle the error gracefully in the UI, so no need to log raw errors to console
      const error = err as { code?: string };
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setError("Credenciales incorrectas. Por favor verifica tu correo y contraseña.");
      } else if (error.code === 'auth/too-many-requests') {
        setError("Acceso bloqueado temporalmente por múltiples intentos fallidos. Intenta más tarde.");
      } else {
        setError("Error de conexión. Por favor verifica tu internet e intenta nuevamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-gray-500 dark:text-gray-400">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-white dark:bg-zinc-950">
      {/* Left Side - Branding/Image */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-zinc-900">
        {/* Background Image with Slow Zoom Animation */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-50 mix-blend-overlay animate-pulse-slow"></div>

        {/* Advanced Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900/90 to-blue-900/80 z-10"></div>

        {/* Subtle Grain/Noise Overlay (Optional, using CSS pattern) */}
        <div className="absolute inset-0 opacity-20 z-10 mix-blend-overlay" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

        <div className="relative z-20 flex flex-col justify-between w-full p-16 text-white h-full">
          <div className="animate-in fade-in slide-in-from-left-8 duration-1000 flex flex-col justify-center h-full pb-32">
            <div className="flex items-center gap-3 mb-24 group cursor-default">
              <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-xl shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300 ease-out border border-white/10">
                <svg className="w-6 h-6 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-100 drop-shadow-sm">AlfaSoft ERP</span>
            </div>

            <h1 className="text-5xl font-bold mb-6 tracking-tight leading-tight max-w-lg drop-shadow-lg">
              Gestión <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Inteligente</span> <br />
              del Futuro.
            </h1>
            <p className="text-lg text-blue-100/90 max-w-md leading-relaxed font-light drop-shadow-md">
              Potencia tu organización con análisis de datos en tiempo real y control total de operaciones.
            </p>
          </div>

          <div className="space-y-6 backdrop-blur-md bg-white/10 p-8 rounded-3xl border border-white/20 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300 hover:bg-white/15 transition-colors">
            <p className="text-sm font-semibold text-blue-200 uppercase tracking-widest mb-4">Confían en nosotros</p>
            <div className="flex items-center gap-6">
              <div className="flex -space-x-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-12 h-12 rounded-full border-2 border-slate-900 bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-sm font-medium shadow-lg hover:translate-y-[-4px] transition-transform duration-300 cursor-pointer z-0 hover:z-10">
                    {String.fromCharCode(64 + i)}
                  </div>
                ))}
              </div>
              <div className="text-base text-white/90">
                <span className="text-white font-bold text-lg">+500</span> empresas líderes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 lg:p-16 bg-white dark:bg-zinc-950 relative overflow-hidden">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#4f46e5_1px,transparent_1px)] [background-size:16px_16px]"></div>

        <div className="w-full max-w-[440px] space-y-8 relative z-10">
          <div className="text-center lg:text-left animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Bienvenido
            </h2>
            <p className="mt-3 text-base text-slate-500 dark:text-slate-400">
              Ingresa tus credenciales para acceder al panel.
            </p>
          </div>

          <form className="mt-10 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-6">
              <div className="group animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium leading-6 text-slate-700 dark:text-slate-300 mb-2 transition-colors group-focus-within:text-blue-600"
                >
                  Correo electrónico
                </label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-xl border-0 py-4 px-5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-zinc-900/50 dark:ring-zinc-800 dark:text-white dark:focus:ring-blue-500 transition-all duration-300 ease-out bg-slate-50/50 hover:bg-white focus:bg-white focus:shadow-lg focus:shadow-blue-500/10"
                    placeholder="nombre@empresa.com"
                  />
                </div>
              </div>

              <div className="group animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium leading-6 text-slate-700 dark:text-slate-300 transition-colors group-focus-within:text-blue-600"
                  >
                    Contraseña
                  </label>
                  <div className="text-sm">
                    <a
                      href="#"
                      className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 transition-colors hover:underline underline-offset-4"
                    >
                      ¿Olvidaste tu contraseña?
                    </a>
                  </div>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-xl border-0 py-4 px-5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6 dark:bg-zinc-900/50 dark:ring-zinc-800 dark:text-white dark:focus:ring-blue-500 transition-all duration-300 ease-out bg-slate-50/50 hover:bg-white focus:bg-white focus:shadow-lg focus:shadow-blue-500/10"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 text-red-600 text-sm bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30 animate-in fade-in slide-in-from-top-2 shadow-sm">
                <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-4 text-sm font-bold leading-6 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:from-blue-500 hover:to-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-700 ease-in-out -skew-x-12 -translate-x-full"></div>
                {loading ? (
                  <div className="flex items-center gap-2 relative z-10">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Iniciando sesión...</span>
                  </div>
                ) : (
                  <span className="relative z-10">Iniciar sesión</span>
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-xs text-slate-400 mt-8 animate-in fade-in duration-1000 delay-500">
            &copy; {new Date().getFullYear()} Alphasoft Innovation. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
