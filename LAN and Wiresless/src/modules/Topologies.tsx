import { useMemo, useRef, useState } from "react";
import { Device, Link, PacketLayer, Stage, type DevType } from "../components/svg";
import { Btn, Callout, Card, CompleteBar, Controls, Field, LogPanel, MiniQuiz, ModuleHeader, Stat, Tabs, Toggle, useLog } from "../components/ui";
import { sleep, usePackets, type Pt } from "../lib/anim";
import { cn } from "../utils/cn";

type Topo = "bus" | "star" | "ring" | "mesh";
interface N { id: string; x: number; y: number; type: DevType | "junction" | "term"; label?: string }
type E = [string, string];
const ek = (a: string, b: string) => (a < b ? a + "|" + b : b + "|" + a);

function build(topo: Topo, n: number, center: "hub" | "switch") {
  const nodes: N[] = [];
  const edges: E[] = [];
  const cx = 400, cy = 215, rx = 290, ry = 150;
  if (topo === "bus") {
    nodes.push({ id: "t0", x: 70, y: 215, type: "term" }, { id: "t1", x: 730, y: 215, type: "term" });
    for (let i = 0; i < n; i++) {
      const x = 150 + (i * 500) / (n - 1);
      nodes.push({ id: "j" + i, x, y: 215, type: "junction" });
      nodes.push({ id: "n" + i, x, y: i % 2 ? 340 : 90, type: "pc", label: "PC" + (i + 1) });
      edges.push(["n" + i, "j" + i]);
      edges.push([i === 0 ? "t0" : "j" + (i - 1), "j" + i]);
    }
    edges.push(["j" + (n - 1), "t1"]);
  } else {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      nodes.push({ id: "n" + i, x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a), type: "pc", label: "PC" + (i + 1) });
    }
    if (topo === "star") {
      nodes.push({ id: "c", x: cx, y: cy, type: center, label: center === "hub" ? "Hub" : "Switch" });
      for (let i = 0; i < n; i++) edges.push(["c", "n" + i]);
    } else if (topo === "ring") {
      for (let i = 0; i < n; i++) edges.push(["n" + i, "n" + ((i + 1) % n)]);
    } else {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push(["n" + i, "n" + j]);
    }
  }
  return { nodes, edges, hosts: nodes.filter((x) => x.id.startsWith("n")).map((x) => x.id) };
}

const INFO: Record<Topo, { title: string; pros: string[]; cons: string[]; spof: string; note: string }> = {
  bus: {
    title: "Bus topology",
    pros: ["Simple layout, little cable", "Low initial cost for small networks"],
    cons: ["Backbone failure stops the whole network", "Performance falls as traffic grows", "Hard fault isolation, limited scalability"],
    spof: "The shared backbone cable",
    note: "Every frame travels along the shared backbone; all devices inspect it and only the destination accepts it. Terminators at both ends absorb the signal and reduce reflection.",
  },
  star: {
    title: "Star topology",
    pros: ["Easy to install, expand and troubleshoot", "One cable failure affects one device", "Great performance with modern switches"],
    cons: ["Central device failure affects everyone", "More cable than a bus"],
    spof: "The central switch / hub",
    note: "Most common wired LAN layout in offices, schools and labs. With a switch frames go only to the destination port; with a hub they are repeated to every port.",
  },
  ring: {
    title: "Ring topology",
    pros: ["Orderly access (token passing)", "Predictable transmission opportunities"],
    cons: ["A break or failed node can stop a single ring", "Adding/removing nodes disrupts the ring"],
    spof: "Any cable or node in a basic single ring",
    note: "Each device connects to two neighbours and data flows around the loop — in classic single rings in one direction only. A dual ring or bypass adds redundancy.",
  },
  mesh: {
    title: "Mesh topology",
    pros: ["Redundant paths, high resilience", "Alternative routes if a link fails"],
    cons: ["Expensive and cable-intensive", "Complex to build and manage as n grows"],
    spof: "None — multiple paths exist",
    note: "Full mesh: every device links to every other: n(n − 1) / 2 links. Partial mesh adds redundancy only between selected devices.",
  },
};

export default function Topologies() {
  const [topo, setTopo] = useState<Topo>("star");
  const [n, setN] = useState(6);
  const [center, setCenter] = useState<"hub" | "switch">("switch");
  const [dual, setDual] = useState(false);
  const [down, setDown] = useState<Set<string>>(new Set());
  const [src, setSrc] = useState("n0");
  const [dst, setDst] = useState("n3");
  const [busy, setBusy] = useState(false);
  const [st, setSt] = useState<Record<string, "accept" | "discard" | "src">>({});
  const [marks, setMarks] = useState<Pt[]>([]);
  const { packets, fly, clear } = usePackets();
  const { lines, add, clear: clearLog } = useLog();
  const busyRef = useRef(false);

  const g = useMemo(() => build(topo, n, center), [topo, n, center]);
  const pos = (id: string) => g.nodes.find((x) => x.id === id)!;
  const hosts = g.hosts;
  const s = hosts.includes(src) ? src : hosts[0];
  const d = hosts.includes(dst) && dst !== s ? dst : hosts.find((h) => h !== s)!;
  const unidirRing = topo === "ring" && !dual;

  const adj = useMemo(() => {
    const m: Record<string, string[]> = {};
    g.edges.forEach(([a, b]) => {
      (m[a] ||= []).push(b);
      (m[b] ||= []).push(a);
    });
    return m;
  }, [g]);

  const bfs = (a: string, b: string, respect: boolean): string[] | null => {
    if (respect && down.has(a)) return null;
    const prev: Record<string, string | null> = { [a]: null };
    const q = [a];
    while (q.length) {
      const u = q.shift()!;
      if (u === b) break;
      for (const v of adj[u] || []) {
        if (v in prev) continue;
        if (respect && (down.has(v) || down.has(ek(u, v)))) continue;
        prev[v] = u;
        q.push(v);
      }
    }
    if (!(b in prev)) return null;
    const path: string[] = [];
    for (let c: string | null = b; c; c = prev[c]) path.unshift(c);
    return path;
  };

  const ringPath = (a: string, b: string, respect: boolean): string[] | null => {
    const ia = +a.slice(1), ib = +b.slice(1);
    const p = [a];
    let i = ia;
    while (i !== ib) {
      const nx = (i + 1) % n;
      if (respect && (down.has("n" + nx) || down.has(ek("n" + i, "n" + nx)))) return null;
      p.push("n" + nx);
      i = nx;
    }
    return respect && down.has(a) ? null : p;
  };

  const routeOf = (a: string, b: string, respect: boolean) => (unidirRing ? ringPath(a, b, respect) : bfs(a, b, respect));

  const reach = useMemo(() => {
    let ok = 0, tot = 0;
    for (const a of hosts) for (const b of hosts) if (a !== b) { tot++; if (routeOf(a, b, true)) ok++; }
    return { ok, tot };
  }, [down, g, dual]); // eslint-disable-line

  const toggleDown = (id: string) => {
    if (busyRef.current) return;
    setDown((p) => {
      const c = new Set(p);
      c.has(id) ? c.delete(id) : c.add(id);
      return c;
    });
  };

  const send = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMarks([]);
    const flood = topo === "bus" || (topo === "star" && center === "hub");
    add(`${pos(s).label} → ${pos(d).label}: frame sent`, "info");
    if (down.has(s)) {
      add(`${pos(s).label} is down — it cannot transmit.`, "bad");
    } else if (flood) {
      // Everybody on the shared medium receives the signal
      const reachable = hosts.filter((h) => h !== s && bfs(s, h, true));
      setSt({ [s]: "src" });
      add(topo === "bus" ? "Signal propagates along the shared backbone in both directions." : "Hub repeats the signal out of every other port (logical bus).", "info");
      await Promise.all(
        reachable.map(async (h) => {
          const p = bfs(s, h, true)!;
          await fly(p.map(pos), { label: h === d ? "for me" : "frame", color: h === d ? "#34d399" : "#64748b", speed: 280 });
          setSt((o) => ({ ...o, [h]: h === d ? "accept" : "discard" }));
        })
      );
      if (reachable.includes(d)) {
        add(`${pos(d).label} accepts the frame (MAC matches).`, "ok");
        const others = reachable.length - 1;
        if (others > 0) add(`${others} other device(s) received it too and discarded it (wasted bandwidth / privacy risk).`, "warn");
      } else add(`${pos(d).label} is unreachable — the shared medium is broken.`, "bad");
    } else {
      const path = routeOf(s, d, true);
      if (path) {
        setSt({ [s]: "src" });
        const pts = path.map(pos);
        add(`Path: ${path.map((p) => pos(p).label ?? p).filter(Boolean).join(" → ")}`, "info");
        if (unidirRing) add("Single ring: data can only travel in one direction.", "info");
        await fly(pts, { label: "frame", speed: 260, shape: "env", color: "#22d3ee" });
        setSt({ [s]: "src", [d]: "accept" });
        add(`${pos(d).label} received the frame (${path.length - 1} hop${path.length > 2 ? "s" : ""}).`, "ok");
      } else {
        const ideal = routeOf(s, d, false)!;
        let k = 0;
        let stop: Pt | null = null;
        for (; k < ideal.length - 1; k++) {
          if (down.has(ideal[k + 1])) { stop = pos(ideal[k + 1]); break; }
          if (down.has(ek(ideal[k], ideal[k + 1]))) {
            const a = pos(ideal[k]), b = pos(ideal[k + 1]);
            stop = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            break;
          }
        }
        setSt({ [s]: "src" });
        const pts: Pt[] = ideal.slice(0, k + 1).map(pos);
        if (stop) pts.push(stop);
        await fly(pts, { label: "frame", speed: 260, shape: "env", color: "#f87171" });
        if (stop) setMarks([stop]);
        add(`Frame lost — there is no working path to ${pos(d).label}.`, "bad");
        if (topo === "mesh") add("(In a mesh this should be rare — try breaking more links!)", "info");
      }
    }
    await sleep(1400);
    setSt({});
    busyRef.current = false;
    setBusy(false);
  };

  const reset = () => {
    clear();
    setDown(new Set());
    setSt({});
    setMarks([]);
    clearLog();
    busyRef.current = false;
    setBusy(false);
  };

  const linkCount = topo === "mesh" ? (n * (n - 1)) / 2 : topo === "bus" ? n + 1 : n;
  const info = INFO[topo];

  return (
    <div className="space-y-6">
      <ModuleHeader
        n={2}
        title="Network Topologies"
        subtitle="Topology describes how devices and links are arranged. Build each topology, send a frame, then break cables and devices to see which designs survive failures."
        outcomes={["Compare bus, star, ring and mesh", "Physical vs logical topology", "Reason about failures"]}
      />

      <Tabs
        tabs={[{ id: "bus", label: "Bus", icon: "➖" }, { id: "star", label: "Star", icon: "⭐" }, { id: "ring", label: "Ring", icon: "⭕" }, { id: "mesh", label: "Mesh", icon: "🕸️" }]}
        value={topo}
        onChange={(t) => { reset(); setTopo(t); if (t === "mesh" && n > 7) setN(7); }}
      />

      <Card>
        <Controls>
          <Field label="Devices">
            <input type="range" min={3} max={topo === "mesh" ? 8 : 8} value={n} onChange={(e) => { reset(); setN(+e.target.value); }} />
            <span className="mono text-cyan-300">{n}</span>
          </Field>
          <Field label="From">
            <select value={s} onChange={(e) => setSrc(e.target.value)}>{hosts.map((h) => <option key={h} value={h}>{pos(h).label}</option>)}</select>
          </Field>
          <Field label="To">
            <select value={d} onChange={(e) => setDst(e.target.value)}>{hosts.filter((h) => h !== s).map((h) => <option key={h} value={h}>{pos(h).label}</option>)}</select>
          </Field>
          <Btn onClick={send} disabled={busy}>▶ Send frame</Btn>
          <Btn variant="ghost" onClick={reset}>↺ Reset</Btn>
        </Controls>
        <Controls>
          {topo === "star" && (
            <Field label="Central device">
              <select value={center} onChange={(e) => { reset(); setCenter(e.target.value as "hub" | "switch"); }}>
                <option value="switch">Switch (forwards to one port)</option>
                <option value="hub">Hub (repeats to all ports)</option>
              </select>
            </Field>
          )}
          {topo === "ring" && <Toggle on={dual} onChange={(v) => { reset(); setDual(v); }} label="Dual ring / bypass (redundancy)" />}
          <span className="text-xs text-slate-400">💡 Click any device or cable to <b className="text-rose-300">break</b> / repair it.</span>
        </Controls>

        <Stage w={800} h={430}>
          {topo === "bus" && <text x={400} y={252} textAnchor="middle" fontSize={11} fill="#8aa0c4" fontWeight={700} letterSpacing={2}>SHARED BACKBONE</text>}
          {g.edges.map(([a, b]) => {
            const A = pos(a), B = pos(b);
            const key = ek(a, b);
            const backbone = topo === "bus" && !(a.startsWith("n") || b.startsWith("n"));
            return <Link key={key} a={A} b={B} down={down.has(key)} width={backbone ? 5 : 2.5} color={backbone ? "#4f7bb5" : undefined} onClick={() => toggleDown(key)} />;
          })}
          {unidirRing &&
            g.edges.map(([a, b]) => {
              const A = pos(a), B = pos(b);
              const ang = (Math.atan2(B.y - A.y, B.x - A.x) * 180) / Math.PI;
              return <polygon key={"ar" + a} points="-6,-6 6,0 -6,6" fill="#22d3ee" transform={`translate(${(A.x + B.x) / 2},${(A.y + B.y) / 2}) rotate(${ang})`} />;
            })}
          {g.nodes.map((nd) => {
            if (nd.type === "junction") return <circle key={nd.id} cx={nd.x} cy={nd.y} r={5} fill="#4f7bb5" />;
            if (nd.type === "term")
              return (
                <g key={nd.id}>
                  <rect x={nd.x - 7} y={nd.y - 16} width={14} height={32} rx={3} fill="#1b2a47" stroke="#fbbf24" strokeWidth={2} />
                  <text x={nd.x} y={nd.y + 32} textAnchor="middle" fontSize={10} fill="#fbbf24" fontWeight={700}>Terminator</text>
                </g>
              );
            const status = st[nd.id];
            return (
              <Device
                key={nd.id}
                type={nd.type as DevType}
                x={nd.x}
                y={nd.y}
                label={nd.label}
                down={down.has(nd.id)}
                glow={status === "accept" ? "#34d399" : status === "src" ? "#22d3ee" : status === "discard" ? "#64748b" : undefined}
                tag={status === "accept" ? "ACCEPT" : status === "discard" ? "IGNORE" : undefined}
                tagColor={status === "accept" ? "#34d399" : "#94a3b8"}
                onClick={() => toggleDown(nd.id)}
                scale={nd.id === "c" ? 1.2 : 1}
              />
            );
          })}
          {marks.map((m, i) => (
            <g key={i} transform={`translate(${m.x},${m.y})`}>
              <circle r={14} fill="#1b0b10" stroke="#ef4444" strokeWidth={2.5} />
              <path d="M-6 -6l12 12M6 -6l-12 12" stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
            </g>
          ))}
          <PacketLayer packets={packets} />
        </Stage>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Stat label="Links / cables" value={linkCount} />
          <Stat label="Reachable pairs" value={`${reach.ok}/${reach.tot}`} tone={reach.ok === reach.tot ? "emerald" : "rose"} />
          <Stat label="Single point of failure" value={<span className="text-sm leading-tight">{info.spof}</span>} tone="amber" />
          <Stat label="Failures injected" value={down.size} tone="rose" />
        </div>
        <div className="mt-4"><LogPanel lines={lines} /></div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title={info.title} icon="📘">
          <p className="mb-3 text-sm text-slate-300">{info.note}</p>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div><div className="mb-1 font-bold text-emerald-300">Advantages</div><ul className="space-y-1 text-slate-300">{info.pros.map((p) => <li key={p}>✔ {p}</li>)}</ul></div>
            <div><div className="mb-1 font-bold text-rose-300">Disadvantages</div><ul className="space-y-1 text-slate-300">{info.cons.map((p) => <li key={p}>✖ {p}</li>)}</ul></div>
          </div>
        </Card>
        <Card title="Mesh link calculator" icon="🧮">
          <p className="mb-3 text-sm text-slate-300">A full mesh of <i>n</i> devices needs <b className="mono text-cyan-300">n(n − 1) / 2</b> links.</p>
          <div className="space-y-1.5">
            {[4, 6, 8, 10, 20, 50].map((k) => (
              <div key={k} className="flex items-center gap-2 text-xs">
                <span className="mono w-10 text-slate-400">n={k}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: Math.max(2, ((k * (k - 1)) / 2 / 1225) * 100) + "%" }} />
                </div>
                <span className="mono w-14 text-right text-cyan-300">{(k * (k - 1)) / 2}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">Cabling cost explodes — which is why full mesh is rare in LANs.</p>
        </Card>
      </div>

      <Card title="Physical vs logical topology" icon="🧠">
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          <div className="rounded-xl bg-ink-900 p-3"><b className="text-cyan-300">Physical</b><p className="mt-1 text-slate-300">The actual layout of cables, devices and connections — what you would see in the wiring closet.</p></div>
          <div className="rounded-xl bg-ink-900 p-3"><b className="text-violet-300">Logical</b><p className="mt-1 text-slate-300">How data moves between devices, regardless of the physical layout.</p></div>
          <div className="rounded-xl bg-ink-900 p-3"><b className="text-amber-300">Try it</b><p className="mt-1 text-slate-300">Open the <b>Star</b> tab and switch the central device between <i>Hub</i> and <i>Switch</i>. The wiring is identical (physical star) but a hub behaves like a logical bus!</p></div>
        </div>
      </Card>

      <Card title="Topology comparison" icon="📊">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-400"><th className="py-2">Topology</th><th>Layout</th><th>Strength</th><th>Weakness</th><th>Typical use</th></tr></thead>
            <tbody className="text-slate-200">
              {[
                ["Bus", "One shared backbone", "Low cost, simple", "Backbone failure = all down", "Legacy Ethernet"],
                ["Star", "All → central switch", "Easy to manage", "Switch is a SPOF", "Offices, homes, labs"],
                ["Ring", "Closed loop", "Orderly token access", "Break can stop ring", "Token Ring, FDDI"],
                ["Mesh", "Multiple paths", "Resilience", "Cost & complexity", "Backbones, WAN cores"],
              ].map((r) => (
                <tr key={r[0]} className={cn("border-t border-ink-600/50", r[0].toLowerCase() === topo && "bg-cyan-400/10")}>
                  <td className="py-2 font-bold text-cyan-300">{r[0]}</td>{r.slice(1).map((c) => <td key={c}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3"><Callout kind="key">Topology choice depends on cost, reliability, performance, scale and ease of maintenance.</Callout></div>
      </Card>

      <MiniQuiz
        q="In a basic single (unidirectional) ring, what happens if one cable is cut?"
        options={["Nothing — data reroutes automatically", "Traffic that must cross the break is blocked", "Only the switch fails", "The ring becomes a mesh"]}
        answer={1}
        why="A basic single ring has only one path, so a break or failed node disrupts it unless a bypass or redundant (dual) ring is provided."
      />
      <CompleteBar id="topologies" />
    </div>
  );
}
