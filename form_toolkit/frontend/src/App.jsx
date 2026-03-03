import { useState, useEffect } from "react";
import OturumFormApp from "./OturumFormApp.jsx";
import PeselFormApp from "./PeselFormApp.jsx";

const STORAGE_KEY = "activeForm";

export default function App() {
  const [activeForm, setActiveForm] = useState(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) || null; }
    catch { return null; }
  });

  useEffect(() => {
    try {
      if (activeForm) sessionStorage.setItem(STORAGE_KEY, activeForm);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [activeForm]);

  const handleBack = () => setActiveForm(null);

  if (activeForm === "oturum") return <OturumFormApp onBack={handleBack} />;
  if (activeForm === "pesel")  return <PeselFormApp onBack={handleBack} />;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950">
      {/* Header */}
      <header className="flex-shrink-0 h-12 glass border-b border-white/[0.06] flex items-center px-4 gap-3 z-30">
        <span className="w-6 h-6 rounded bg-gradient-to-br from-emerald-500 to-blue-500
                         flex items-center justify-center text-white text-xs font-bold leading-none flex-shrink-0">F</span>
        <span className="text-sm font-semibold text-zinc-50">Form Doldurma Araci</span>
        <span className="text-xs text-zinc-500">— Polonya basvuru formlari</span>
      </header>

      {/* Landing — card selector */}
      <main className="flex-1 flex items-center justify-center gap-8 px-8">
        {/* Oturum Card */}
        <button
          onClick={() => setActiveForm("oturum")}
          className="group relative w-80 rounded-2xl p-6 text-left
                     glass border border-white/[0.06] hover:border-emerald-500/40
                     transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/10"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/5 to-transparent
                          opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center mb-4">
              <span className="text-emerald-400 text-lg font-bold">K</span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-50 mb-1">
              Oturum Karti Basvuru Formu
            </h2>
            <p className="text-sm text-zinc-500 mb-3">
              Wniosek o udzielenie zezwolenia na pobyt czasowy
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 rounded">
                13 sayfa
              </span>
              <span className="text-xs font-mono text-emerald-400/70 bg-emerald-500/10 px-2 py-0.5 rounded">
                113 alan
              </span>
            </div>
          </div>
        </button>

        {/* PESEL Card */}
        <button
          onClick={() => setActiveForm("pesel")}
          className="group relative w-80 rounded-2xl p-6 text-left
                     glass border border-white/[0.06] hover:border-blue-500/40
                     transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10"
        >
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/5 to-transparent
                          opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center mb-4">
              <span className="text-blue-400 text-lg font-bold">P</span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-50 mb-1">
              PESEL Numarasi Basvuru Formu
            </h2>
            <p className="text-sm text-zinc-500 mb-3">
              Wniosek o nadanie numeru PESEL
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-blue-400/70 bg-blue-500/10 px-2 py-0.5 rounded">
                4 sayfa
              </span>
              <span className="text-xs font-mono text-blue-400/70 bg-blue-500/10 px-2 py-0.5 rounded">
                70 alan
              </span>
            </div>
          </div>
        </button>
      </main>
    </div>
  );
}
