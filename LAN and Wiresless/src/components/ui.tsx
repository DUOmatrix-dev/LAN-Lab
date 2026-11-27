import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";

export interface Progress {
  done: string[];
  visited: string[];
  best: number;
  toggleDone: (id: string) => void;
  setBest: (n: number) => void;
}
export const ProgressCtx = createContext<Progress>({ done: [], visited: [], best: 0, toggleDone: () => {}, setBest: () => {} });
export const useProgress = () => useContext(ProgressCtx);

export function Card({ children, className = "", title, icon, accent }: { children: ReactNode; className?: string; title?: string; icon?: string; accent?: string }) {
  return (
    <div className={cn("rounded-2xl border border-ink-600/60 bg-ink-800/70 p-5", className)}>
      {title && (
        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-white">
          {icon && <span className="text-lg">{icon}</span>}
          <span style={accent ? { color: accent } : undefined}>{title}</span>
        </h3>
      )}
      {children}
    </div>
  );
}

export function Btn({ children, onClick, variant = "primary", disabled, className = "", small, active }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "good" | "amber"; disabled?: boolean; className?: string; small?: boolean; active?: boolean;
}) {
  const v = {
    primary: "bg-cyan-400 text-ink-950 hover:bg-cyan-300",
    good: "bg-emerald-400 text-ink-950 hover:bg-emerald-300",
    amber: "bg-amber-400 text-ink-950 hover:bg-amber-300",
    danger: "bg-rose-500/90 text-white hover:bg-rose-400",
    ghost: "bg-ink-700 text-slate-200 hover:bg-ink-600 border border-ink-600",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg font-semibold transition active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-40",
        small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        v,
        active && "ring-2 ring-cyan-300",
        className
      )}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon?: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-5 flex flex-wrap gap-1.5 rounded-xl border border-ink-600/60 bg-ink-900/80 p-1.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-lg px-3.5 py-2 text-sm font-semibold transition",
            value === t.id ? "bg-cyan-400 text-ink-950 shadow" : "text-slate-300 hover:bg-ink-700"
          )}
        >
          {t.icon && <span className="mr-1.5">{t.icon}</span>}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Callout({ children, kind = "info", title }: { children: ReactNode; kind?: "info" | "warn" | "good" | "bad" | "key"; title?: string }) {
  const s = {
    info: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
    warn: "border-amber-400/40 bg-amber-400/10 text-amber-100",
    good: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
    bad: "border-rose-400/40 bg-rose-400/10 text-rose-100",
    key: "border-violet-400/40 bg-violet-400/10 text-violet-100",
  }[kind];
  const ic = { info: "💡", warn: "⚠️", good: "✅", bad: "⛔", key: "🔑" }[kind];
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm leading-relaxed", s)}>
      <span className="mr-1.5">{ic}</span>
      {title && <b className="mr-1.5">{title}</b>}
      {children}
    </div>
  );
}

export function LogPanel({ lines, className = "" }: { lines: { t: string; kind?: "ok" | "bad" | "info" | "warn" }[]; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines.length]);
  const col = { ok: "text-emerald-300", bad: "text-rose-300", info: "text-slate-300", warn: "text-amber-300" };
  return (
    <div ref={ref} className={cn("mono h-44 overflow-y-auto rounded-xl border border-ink-600/60 bg-ink-950 p-3 text-xs leading-relaxed", className)}>
      {lines.length === 0 && <div className="text-slate-500">Event log — run the simulation to see what happens…</div>}
      {lines.map((l, i) => (
        <div key={i} className={col[l.kind ?? "info"]}>
          <span className="mr-2 text-slate-600">{String(i + 1).padStart(2, "0")}</span>
          {l.t}
        </div>
      ))}
    </div>
  );
}

export type LogLine = { t: string; kind?: "ok" | "bad" | "info" | "warn" };
export function useLog() {
  const [lines, setLines] = useState<LogLine[]>([]);
  const add = (t: string, kind?: LogLine["kind"]) => setLines((l) => [...l.slice(-80), { t, kind }]);
  const clear = () => setLines([]);
  return { lines, add, clear };
}

export function Stat({ label, value, tone = "cyan" }: { label: string; value: ReactNode; tone?: "cyan" | "rose" | "emerald" | "amber" | "violet" }) {
  const t = { cyan: "text-cyan-300", rose: "text-rose-300", emerald: "text-emerald-300", amber: "text-amber-300", violet: "text-violet-300" }[tone];
  return (
    <div className="rounded-xl border border-ink-600/60 bg-ink-900/80 px-4 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className={cn("mono text-xl font-bold", t)}>{value}</div>
    </div>
  );
}

export function Pill({ children, color = "#22d3ee" }: { children: ReactNode; color?: string }) {
  return (
    <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: color + "26", color, border: `1px solid ${color}55` }}>
      {children}
    </span>
  );
}

export function ModuleHeader({ n, title, subtitle, outcomes }: { n: number; title: string; subtitle: string; outcomes?: string[] }) {
  return (
    <header className="mb-6 fade-up">
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-cyan-400">
        <span className="rounded-md bg-cyan-400/15 px-2 py-0.5">Module {n}</span>
      </div>
      <h1 className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-slate-300">{subtitle}</p>
      {outcomes && (
        <div className="mt-4 flex flex-wrap gap-2">
          {outcomes.map((o) => (
            <span key={o} className="rounded-full border border-ink-600 bg-ink-800 px-3 py-1 text-xs text-slate-300">🎯 {o}</span>
          ))}
        </div>
      )}
    </header>
  );
}

export function CompleteBar({ id }: { id: string }) {
  const { done, toggleDone } = useProgress();
  const isDone = done.includes(id);
  return (
    <div className="mt-8 flex items-center justify-between rounded-2xl border border-ink-600/60 bg-ink-800/60 p-4">
      <span className="text-sm text-slate-300">{isDone ? "Nice work — module completed ✔" : "Finished experimenting with the simulations?"}</span>
      <Btn variant={isDone ? "ghost" : "good"} onClick={() => toggleDone(id)}>{isDone ? "Mark as not done" : "Mark module complete"}</Btn>
    </div>
  );
}

export function Controls({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex flex-wrap items-center gap-2">{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
      {label}
      {children}
    </label>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex items-center gap-2 text-xs font-semibold text-slate-200">
      <span className={cn("relative h-5 w-9 rounded-full transition", on ? "bg-cyan-400" : "bg-ink-600")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", on ? "left-[18px]" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}

/** Small knowledge-check used inside modules */
export function MiniQuiz({ q, options, answer, why }: { q: string; options: string[]; answer: number; why: string }) {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <Card title="Check your understanding" icon="🧠">
      <p className="mb-3 text-sm font-medium text-white">{q}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o, i) => (
          <button
            key={o}
            onClick={() => setSel(i)}
            className={cn(
              "rounded-lg border px-3 py-2 text-left text-sm transition",
              sel === null && "border-ink-600 bg-ink-900 hover:border-cyan-400",
              sel !== null && i === answer && "border-emerald-400 bg-emerald-400/15 text-emerald-100",
              sel === i && i !== answer && "border-rose-400 bg-rose-400/15 text-rose-100",
              sel !== null && i !== answer && sel !== i && "border-ink-600 bg-ink-900 opacity-60"
            )}
          >
            <b className="mr-2 text-cyan-300">{String.fromCharCode(65 + i)}</b>
            {o}
          </button>
        ))}
      </div>
      {sel !== null && (
        <div className="mt-3">
          <Callout kind={sel === answer ? "good" : "bad"} title={sel === answer ? "Correct!" : "Not quite."}>{why}</Callout>
        </div>
      )}
    </Card>
  );
}
