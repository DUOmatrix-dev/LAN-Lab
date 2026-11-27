import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { ProgressCtx } from "./components/ui";
import { setSpeedMult } from "./lib/anim";
import Home from "./modules/Home";
import LanBasics from "./modules/LanBasics";
import Topologies from "./modules/Topologies";
import Access from "./modules/Access";
import Ethernet from "./modules/Ethernet";
import Switching from "./modules/Switching";
import Vlans from "./modules/Vlans";
import Stp from "./modules/Stp";
import Wlan from "./modules/Wlan";
import Encapsulation from "./modules/Encapsulation";
import Lab from "./modules/Lab";
import Quiz from "./modules/Quiz";
import Resources from "./modules/Resources";

export interface ModuleDef {
  id: string;
  title: string;
  icon: string;
  group: string;
  C: ComponentType<{ go: (id: string) => void }>;
}

export const MODULES: ModuleDef[] = [
  { id: "basics", title: "LAN Basics", icon: "🏢", group: "Part 1 · LAN fundamentals", C: LanBasics },
  { id: "topologies", title: "Topologies", icon: "🕸️", group: "Part 1 · LAN fundamentals", C: Topologies },
  { id: "access", title: "Access Methods & MAC", icon: "🚦", group: "Part 1 · LAN fundamentals", C: Access },
  { id: "ethernet", title: "Ethernet & LAN Tech", icon: "🔌", group: "Part 1 · LAN fundamentals", C: Ethernet },
  { id: "switching", title: "Ethernet Switching", icon: "🔀", group: "Part 2 · Switched & wireless LANs", C: Switching },
  { id: "vlans", title: "VLANs & Trunks", icon: "🧩", group: "Part 2 · Switched & wireless LANs", C: Vlans },
  { id: "stp", title: "Spanning Tree", icon: "🌲", group: "Part 2 · Switched & wireless LANs", C: Stp },
  { id: "wlan", title: "Wireless LANs", icon: "📶", group: "Part 2 · Switched & wireless LANs", C: Wlan },
  { id: "encap", title: "Encapsulation", icon: "📦", group: "Extra & practice", C: Encapsulation },
  { id: "lab", title: "Lab: Switch CLI & Design", icon: "🧪", group: "Extra & practice", C: Lab },
  { id: "quiz", title: "Quiz & Flashcards", icon: "🧠", group: "Extra & practice", C: Quiz },
  { id: "resources", title: "Glossary & References", icon: "📚", group: "Extra & practice", C: Resources },
];

const LS = "lanlab-progress-v1";

function load() {
  try {
    return JSON.parse(localStorage.getItem(LS) || "{}");
  } catch {
    return {};
  }
}

export default function App() {
  const [route, setRoute] = useState<string>(() => location.hash.replace("#/", "") || "home");
  const [menu, setMenu] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [done, setDone] = useState<string[]>(() => load().done ?? []);
  const [visited, setVisited] = useState<string[]>(() => load().visited ?? []);
  const [best, setBestState] = useState<number>(() => load().best ?? 0);

  useEffect(() => {
    const h = () => setRoute(location.hash.replace("#/", "") || "home");
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  useEffect(() => {
    setSpeedMult(speed);
  }, [speed]);

  useEffect(() => {
    localStorage.setItem(LS, JSON.stringify({ done, visited, best }));
  }, [done, visited, best]);

  useEffect(() => {
    if (route !== "home" && !visited.includes(route)) setVisited((v) => [...v, route]);
    window.scrollTo({ top: 0 });
    document.getElementById("main-scroll")?.scrollTo({ top: 0 });
  }, [route]); // eslint-disable-line

  const go = useCallback((id: string) => {
    location.hash = "#/" + id;
    setMenu(false);
  }, []);

  const progress = useMemo(
    () => ({
      done,
      visited,
      best,
      toggleDone: (id: string) => setDone((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id])),
      setBest: (n: number) => setBestState((b) => Math.max(b, n)),
    }),
    [done, visited, best]
  );

  const idx = MODULES.findIndex((m) => m.id === route);
  const mod = MODULES[idx];
  const groups = [...new Set(MODULES.map((m) => m.group))];
  const pct = Math.round((done.length / MODULES.length) * 100);

  return (
    <ProgressCtx.Provider value={progress}>
      <div className="flex h-full bg-ink-950">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 shrink-0 overflow-y-auto border-r border-ink-600/50 bg-ink-900 p-4 transition-transform lg:static lg:translate-x-0 ${
            menu ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button onClick={() => go("home")} className="mb-5 flex w-full items-center gap-3 text-left">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-violet-500 text-xl shadow-lg shadow-cyan-500/20">🌐</span>
            <span>
              <span className="block text-lg font-extrabold leading-none text-white">LAN Lab</span>
              <span className="text-[11px] font-medium text-slate-400">Interactive network simulator</span>
            </span>
          </button>

          <div className="mb-5 rounded-xl border border-ink-600/50 bg-ink-800/60 p-3">
            <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-300">
              <span>Your progress</span>
              <span className="text-cyan-300">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-600">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: pct + "%" }} />
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {done.length}/{MODULES.length} modules complete · best quiz {best}%
            </div>
          </div>

          <button
            onClick={() => go("home")}
            className={`mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${route === "home" ? "bg-cyan-400 text-ink-950" : "text-slate-300 hover:bg-ink-700"}`}
          >
            🏠 Home
          </button>
          {groups.map((g) => (
            <div key={g} className="mb-3">
              <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[.15em] text-slate-500">{g}</div>
              {MODULES.filter((m) => m.group === g).map((m) => {
                const n = MODULES.indexOf(m) + 1;
                return (
                  <button
                    key={m.id}
                    onClick={() => go(m.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                      route === m.id ? "bg-cyan-400 text-ink-950" : "text-slate-300 hover:bg-ink-700"
                    }`}
                  >
                    <span className="w-5 text-center">{m.icon}</span>
                    <span className="flex-1">{n}. {m.title}</span>
                    {done.includes(m.id) ? <span className={route === m.id ? "text-ink-950" : "text-emerald-400"}>✔</span> : visited.includes(m.id) ? <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/70" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>
        {menu && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMenu(false)} />}

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-ink-600/50 bg-ink-900/90 px-4 py-2.5 backdrop-blur">
            <button className="rounded-lg bg-ink-700 px-3 py-1.5 text-lg lg:hidden" onClick={() => setMenu(true)} aria-label="Menu">☰</button>
            <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-300">
              {mod ? <>{mod.icon} {mod.title}</> : "Welcome"}
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <span className="hidden sm:inline">Animation speed</span>
              {[0.5, 1, 2, 4].map((s) => (
                <button key={s} onClick={() => setSpeed(s)} className={`rounded-md px-2 py-1 ${speed === s ? "bg-cyan-400 text-ink-950" : "bg-ink-700 hover:bg-ink-600"}`}>
                  {s}×
                </button>
              ))}
            </div>
          </div>

          <main id="main-scroll" className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
              {route === "home" || !mod ? <Home go={go} modules={MODULES} /> : <mod.C key={mod.id} go={go} />}
              {mod && (
                <div className="mt-6 flex justify-between gap-3">
                  {idx > 0 ? (
                    <button onClick={() => go(MODULES[idx - 1].id)} className="rounded-xl border border-ink-600 bg-ink-800 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:border-cyan-400">
                      ← {MODULES[idx - 1].title}
                    </button>
                  ) : <span />}
                  {idx < MODULES.length - 1 && (
                    <button onClick={() => go(MODULES[idx + 1].id)} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-ink-950 hover:bg-cyan-300">
                      {MODULES[idx + 1].title} →
                    </button>
                  )}
                </div>
              )}
              <footer className="mt-10 border-t border-ink-600/40 pt-4 text-center text-xs text-slate-500">
                LAN Lab · Computer Networks & Communication Technology · all simulations run locally in your browser
              </footer>
            </div>
          </main>
        </div>
      </div>
    </ProgressCtx.Provider>
  );
}
