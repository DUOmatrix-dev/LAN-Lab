import { useState } from "react";
import { Card, CompleteBar, ModuleHeader } from "../components/ui";
import { REFS, TERMS } from "../lib/terms";

export default function Resources() {
  const [q, setQ] = useState("");
  const list = TERMS.filter(([t, d]) => (t + d).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-6">
      <ModuleHeader n={12} title="Glossary & References" subtitle="Key terms from both lectures and the recommended reading." />
      <Card title="Key terms" icon="📖">
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms… (e.g. VLAN, token, CSMA)" className="mb-4 w-full" />
        <div className="grid gap-2 md:grid-cols-2">
          {list.map(([t, d]) => (
            <div key={t} className="rounded-xl border border-ink-600/60 bg-ink-900 p-3">
              <div className="font-bold text-cyan-300">{t}</div>
              <p className="mt-0.5 text-sm text-slate-300">{d}</p>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-slate-500">No matching terms.</p>}
        </div>
      </Card>
      <Card title="References and learning resources" icon="🔗">
        <ul className="space-y-2 text-sm">
          {REFS.map(([t, k, u]) => (
            <li key={t} className="flex flex-wrap items-baseline gap-2 rounded-lg bg-ink-900 px-3 py-2">
              {u ? <a href={u} target="_blank" rel="noreferrer" className="font-semibold text-cyan-300 underline-offset-2 hover:underline">{t} ↗</a> : <span className="font-semibold text-slate-200">{t}</span>}
              <span className="text-xs text-slate-500">{k}</span>
            </li>
          ))}
        </ul>
      </Card>
      <CompleteBar id="resources" />
    </div>
  );
}
