import { useRef, useState } from "react";
import { Device, Link, PacketLayer, Stage } from "../components/svg";
import { Btn, Callout, Card, CompleteBar, Controls, Field, LogPanel, MiniQuiz, ModuleHeader, Stat, Toggle, useLog } from "../components/ui";
import { sleep, usePackets, type Pt } from "../lib/anim";
import { cn } from "../utils/cn";

const SW: Pt = { x: 380, y: 165 };
const HUB: Pt = { x: 630, y: 270 };
interface H { id: string; name: string; mac: string; port: string; p: Pt; type: "pc" | "server"; viaHub?: boolean }
const HOSTS: H[] = [
  { id: "A", name: "PC-A", mac: "AA:AA:AA:AA:AA:01", port: "Fa0/1", p: { x: 110, y: 70 }, type: "pc" },
  { id: "B", name: "PC-B", mac: "BB:BB:BB:BB:BB:02", port: "Fa0/2", p: { x: 110, y: 270 }, type: "pc" },
  { id: "S", name: "Server", mac: "EE:EE:EE:EE:EE:05", port: "Fa0/4", p: { x: 660, y: 60 }, type: "server" },
  { id: "C", name: "PC-C", mac: "CC:CC:CC:CC:CC:03", port: "Fa0/3", p: { x: 540, y: 375 }, type: "pc", viaHub: true },
  { id: "D", name: "PC-D", mac: "DD:DD:DD:DD:DD:04", port: "Fa0/3", p: { x: 730, y: 375 }, type: "pc", viaHub: true },
];
const host = (id: string) => HOSTS.find((h) => h.id === id)!;
const lerp = (a: Pt, b: Pt, f: number): Pt => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
const fromSw = (h: H): Pt[] => (h.viaHub ? [SW, HUB, h.p] : [SW, h.p]);

const GUIDE: [string, string, string][] = [
  ["A", "C", "Table is empty. The switch learns A on Fa0/1. C is unknown → it FLOODS the frame."],
  ["C", "A", "C replies. The switch learns C on Fa0/3. A is known → it FORWARDS only to Fa0/1."],
  ["A", "C", "Both addresses are known now → a clean unicast FORWARD to Fa0/3 only. No flooding."],
  ["D", "C", "D is behind the same hub port as C. The switch learns D on Fa0/3 and sees C is on the same port → FILTER."],
  ["B", "*", "A broadcast (FF:FF…) is always flooded to every other port of the VLAN."],
];

type Dec = "forward" | "flood" | "filter";

export default function Switching() {
  const { packets, fly, clear } = usePackets();
  const { lines, add, clear: clr } = useLog();
  const [table, setTable] = useState<Record<string, string>>({});
  const [fresh, setFresh] = useState<string | null>(null);
  const [src, setSrc] = useState("A");
  const [dst, setDst] = useState("C");
  const [hubMode, setHubMode] = useState(false);
  const [predict, setPredict] = useState(false);
  const [pending, setPending] = useState<{ s: string; d: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<string>("");
  const [st, setSt] = useState<Record<string, "accept" | "discard" | "src">>({});
  const [stats, setStats] = useState({ sent: 0, flood: 0, fwd: 0, filt: 0, waste: 0 });
  const [guide, setGuide] = useState(0);
  const [score, setScore] = useState({ ok: 0, n: 0 });
  const busyRef = useRef(false);

  const decide = (s: string, d: string, tbl = table): Dec => {
    if (hubMode || d === "*") return "flood";
    const sh = host(s);
    const t = { ...tbl, [sh.mac]: sh.port };
    const p = t[host(d).mac];
    if (!p) return "flood";
    return p === sh.port ? "filter" : "forward";
  };

  const run = async (s: string, d: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const sh = host(s);
    const bc = d === "*";
    const dh = bc ? null : host(d);
    add(`${sh.name} (${sh.mac.slice(0, 5)}…) sends a frame to ${bc ? "BROADCAST" : dh!.name}.`, "info");
    setSt({ [s]: "src" });
    const ing = sh.port;
    const waste: string[] = [];
    const mark = (id: string) => {
      const ok = bc || id === d;
      setSt((o) => ({ ...o, [id]: ok ? "accept" : "discard" }));
      if (!ok) waste.push(id);
    };
    const col = "#22d3ee";
    // ingress
    if (sh.viaHub) {
      await fly([sh.p, HUB], { color: col, label: "frame" });
      const other = HOSTS.find((h) => h.viaHub && h.id !== s)!;
      await Promise.all([
        fly([HUB, SW], { color: col, label: "frame" }),
        fly([HUB, other.p], { color: "#64748b", label: "frame" }).then(() => mark(other.id)),
      ]);
    } else await fly([sh.p, SW], { color: col, label: "frame" });

    // learn
    let tbl = table;
    if (!hubMode) {
      tbl = { ...table, [sh.mac]: sh.port };
      if (table[sh.mac] !== sh.port) add(`LEARN: ${sh.mac} is reachable via ${sh.port}.`, "ok");
      else add(`Refresh: ${sh.mac} already known on ${sh.port}.`, "info");
      setTable(tbl);
      setFresh(sh.mac);
    }
    const dec = decide(s, d, table);
    let targets: H[] = [];
    if (hubMode) {
      setDecision("REPEAT");
      add("HUB: no MAC table — repeats the signal out of every other port.", "warn");
      targets = HOSTS.filter((h) => h.port !== ing);
    } else if (bc) {
      setDecision("FLOOD");
      add("Destination is the broadcast address → FLOOD out of all other ports.", "warn");
      targets = HOSTS.filter((h) => h.port !== ing);
    } else if (dec === "filter") {
      setDecision("FILTER");
      add(`FILTER: ${dh!.name} is on the same port (${ing}) as the sender — frame is not forwarded.`, "ok");
    } else if (dec === "forward") {
      setDecision("FORWARD");
      add(`FORWARD: ${dh!.name} is known on ${dh!.port} → send only out of that port.`, "ok");
      targets = HOSTS.filter((h) => h.port === dh!.port);
    } else {
      setDecision("FLOOD");
      add(`FLOOD: ${dh!.mac.slice(0, 5)}… is not in the table → out of all ports except ${ing}.`, "warn");
      targets = HOSTS.filter((h) => h.port !== ing);
    }
    // egress
    await Promise.all(
      targets.map((h) => fly(fromSw(h), { color: h.id === d || bc ? "#34d399" : "#64748b", label: h.id === d || bc ? "for you" : "frame" }).then(() => mark(h.id)))
    );
    if (!bc && dh && !targets.some((t) => t.id === d) && !(sh.viaHub && dh.viaHub)) add("Destination not reached!", "bad");
    if (waste.length) add(`${waste.length} unintended host(s) received a copy and dropped it at the NIC.`, "warn");
    setStats((x) => ({
      sent: x.sent + 1,
      flood: x.flood + (hubMode || dec === "flood" || bc ? 1 : 0),
      fwd: x.fwd + (!hubMode && !bc && dec === "forward" ? 1 : 0),
      filt: x.filt + (!hubMode && !bc && dec === "filter" ? 1 : 0),
      waste: x.waste + waste.length,
    }));
    await sleep(1100);
    setSt({});
    setFresh(null);
    busyRef.current = false;
    setBusy(false);
  };

  const trigger = (s: string, d: string) => {
    if (busyRef.current || s === d) return;
    if (predict) setPending({ s, d });
    else run(s, d);
  };
  const answer = (g: Dec | "repeat") => {
    if (!pending) return;
    const real = decide(pending.s, pending.d);
    const right = (hubMode && g === "flood") || g === real;
    setScore((x) => ({ ok: x.ok + (right ? 1 : 0), n: x.n + 1 }));
    add(right ? `Prediction correct: the switch will ${real.toUpperCase()}.` : `Prediction was ${g.toUpperCase()}, but the switch will ${real.toUpperCase()}.`, right ? "ok" : "bad");
    const { s, d } = pending;
    setPending(null);
    run(s, d);
  };
  const reset = () => { clear(); clr(); setTable({}); setSt({}); setDecision(""); setStats({ sent: 0, flood: 0, fwd: 0, filt: 0, waste: 0 }); setGuide(0); setPending(null); busyRef.current = false; setBusy(false); };
  const step = () => {
    const [s, d] = GUIDE[guide % GUIDE.length];
    if (guide >= GUIDE.length) return;
    setSrc(s); setDst(d);
    add("📘 " + GUIDE[guide][2], "info");
    setGuide(guide + 1);
    trigger(s, d);
  };

  const decCol = decision === "FORWARD" ? "#34d399" : decision === "FILTER" ? "#94a3b8" : "#fbbf24";
  const ports = [
    { id: "Fa0/1", p: HOSTS[0].p },
    { id: "Fa0/2", p: HOSTS[1].p },
    { id: "Fa0/3", p: HUB },
    { id: "Fa0/4", p: HOSTS[2].p },
  ];

  return (
    <div className="space-y-6">
      <ModuleHeader
        n={5}
        title="Ethernet Switching & Bridging"
        subtitle="A Layer 2 switch learns source MAC addresses, looks up destinations, and decides to forward, flood or filter every frame. Watch it build its forwarding database."
        outcomes={["MAC learning", "Forward / flood / filter", "Hub vs switch", "Bridges"]}
      />

      <Card>
        <Controls>
          <Field label="From"><select value={src} onChange={(e) => setSrc(e.target.value)}>{HOSTS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
          <Field label="To">
            <select value={dst} onChange={(e) => setDst(e.target.value)}>
              {HOSTS.filter((h) => h.id !== src).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              <option value="*">Broadcast (FF:FF…)</option>
            </select>
          </Field>
          <Btn disabled={busy || src === dst} onClick={() => trigger(src, dst)}>▶ Send frame</Btn>
          <Btn variant="amber" disabled={busy || guide >= GUIDE.length} onClick={step}>🎓 Guided step {Math.min(guide + 1, GUIDE.length)}/{GUIDE.length}</Btn>
          <Btn variant="ghost" onClick={reset}>↺ Reset</Btn>
        </Controls>
        <Controls>
          <Toggle on={hubMode} onChange={(v) => { reset(); setHubMode(v); }} label="Replace switch with a HUB" />
          <Toggle on={predict} onChange={setPredict} label="Predict first (quiz mode)" />
          {score.n > 0 && <span className="text-xs font-bold text-emerald-300">Predictions: {score.ok}/{score.n}</span>}
        </Controls>

        <Stage w={800} h={440}>
          {HOSTS.filter((h) => !h.viaHub).map((h) => <Link key={h.id} a={SW} b={h.p} />)}
          <Link a={SW} b={HUB} />
          <Link a={HUB} b={HOSTS[3].p} />
          <Link a={HUB} b={HOSTS[4].p} />
          {!hubMode && ports.map((p) => {
            const l = lerp(SW, p.p, 0.28);
            return (
              <g key={p.id} transform={`translate(${l.x},${l.y})`}>
                <rect x={-21} y={-9} width={42} height={16} rx={5} fill="#0b1527" stroke="#3b5278" />
                <text y={3} textAnchor="middle" fontSize={9.5} className="mono" fill="#8aa0c4">{p.id}</text>
              </g>
            );
          })}
          <Device type={hubMode ? "hub" : "switch"} {...SW} label={hubMode ? "HUB (central)" : "Switch"} scale={1.35} glow={decision ? decCol : undefined} />
          <Device type="hub" {...HUB} label="Hub" sub="Fa0/3 segment" scale={0.9} />
          {HOSTS.map((h) => (
            <Device
              key={h.id}
              type={h.type}
              {...h.p}
              label={h.name}
              sub={h.mac.slice(0, 5) + "…" + h.mac.slice(-2)}
              glow={st[h.id] === "accept" ? "#34d399" : st[h.id] === "src" ? "#22d3ee" : st[h.id] === "discard" ? "#64748b" : undefined}
              tag={st[h.id] === "accept" ? "ACCEPT" : st[h.id] === "discard" ? "DROPPED" : undefined}
              tagColor={st[h.id] === "accept" ? "#34d399" : "#94a3b8"}
            />
          ))}
          {decision && (
            <g transform={`translate(${SW.x},${SW.y - 62})`}>
              <rect x={-52} y={-14} width={104} height={28} rx={14} fill={decCol} />
              <text y={5} textAnchor="middle" fontWeight={800} fontSize={14} fill="#04101f">{decision}</text>
            </g>
          )}
          <PacketLayer packets={packets} />
        </Stage>

        {pending && (
          <div className="mt-3 rounded-xl border border-violet-400/50 bg-violet-400/10 p-4">
            <p className="mb-2 font-semibold text-white">🔮 {host(pending.s).name} → {pending.d === "*" ? "broadcast" : host(pending.d).name}: what will the {hubMode ? "hub" : "switch"} do?</p>
            <div className="flex gap-2">
              <Btn onClick={() => answer("forward")}>Forward</Btn>
              <Btn variant="amber" onClick={() => answer("flood")}>Flood</Btn>
              <Btn variant="ghost" onClick={() => answer("filter")}>Filter</Btn>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          <Stat label="Frames" value={stats.sent} />
          <Stat label="Flooded" value={stats.flood} tone="amber" />
          <Stat label="Forwarded" value={stats.fwd} tone="emerald" />
          <Stat label="Filtered" value={stats.filt} tone="violet" />
          <Stat label="Wasted copies" value={stats.waste} tone="rose" />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="MAC address table (CAM / FDB)" icon="🗃️">
          {hubMode ? (
            <Callout kind="warn">A hub is a Layer 1 repeater — it has no MAC table and one shared collision domain.</Callout>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-400"><th className="py-1">MAC address</th><th>Port</th><th>VLAN</th></tr></thead>
                <tbody className="mono text-xs">
                  {Object.entries(table).map(([m, p]) => (
                    <tr key={m} className={cn("border-t border-ink-600/50 transition", fresh === m && "bg-emerald-400/20 text-emerald-200")}>
                      <td className="py-1.5">{m}</td><td>{p}</td><td>1</td>
                    </tr>
                  ))}
                  {Object.keys(table).length === 0 && <tr><td colSpan={3} className="py-3 text-slate-500">Empty — send a frame to start learning.</td></tr>}
                </tbody>
              </table>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">Entries age out (typically 300 s) if the host stays silent.</span>
                <Btn small variant="ghost" onClick={() => setTable({})}>Clear table</Btn>
              </div>
              <p className="mono mt-2 rounded-lg bg-ink-950 p-2 text-[11px] text-slate-400">Switch# show mac address-table dynamic</p>
            </>
          )}
        </Card>
        <Card title="Event log" icon="📜"><LogPanel lines={lines} className="h-56" /></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["FORWARD", "Destination MAC is known → send only through the mapped port.", "#34d399"],
          ["FLOOD", "Destination unknown (or broadcast) → send out of all ports in the VLAN except the incoming one.", "#fbbf24"],
          ["FILTER", "Destination is reachable through the incoming port → do not send it back.", "#94a3b8"],
        ].map(([t, d, c]) => (
          <div key={t} className="rounded-2xl border p-4" style={{ borderColor: c + "66", background: c + "10" }}>
            <div className="text-lg font-extrabold" style={{ color: c }}>{t}</div>
            <p className="mt-1 text-sm text-slate-300">{d}</p>
          </div>
        ))}
      </div>
      <Callout kind="key" title="Remember:">the switch learns from the <b>SOURCE</b> MAC address, never from the destination.</Callout>

      <Card title="Hub versus switch" icon="⚔️">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-400"><th className="py-2">Feature</th><th>Hub</th><th>Switch</th></tr></thead>
            <tbody className="text-slate-200">
              {[
                ["OSI layer", "Layer 1 – Physical", "Primarily Layer 2 – Data Link"],
                ["Traffic handling", "Repeats signals to all ports", "Forwards frames using the MAC table"],
                ["Collision domains", "One shared domain", "Separate per switch port"],
                ["Duplex", "Typically half-duplex", "Typically full-duplex"],
                ["Efficiency", "Unnecessary traffic to all ports", "Targeted forwarding"],
                ["Security", "No traffic segmentation", "Supports VLANs and port controls"],
              ].map((r) => (<tr key={r[0]} className="border-t border-ink-600/50"><td className="py-2 font-semibold text-cyan-300">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Bridges and bridged LANs" icon="🌉">
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          {[
            ["Transparent bridge", "Learns MAC addresses and forwards automatically — the basis of Ethernet bridging."],
            ["Source-route bridge", "Uses route information carried inside frames; historically linked to Token Ring."],
            ["Translational bridge", "Connects LAN technologies with different frame formats."],
          ].map(([t, d]) => (<div key={t} className="rounded-xl bg-ink-900 p-3"><b className="text-cyan-300">{t}</b><p className="mt-1 text-slate-300">{d}</p></div>))}
        </div>
        <p className="mt-3 text-sm text-slate-300">A modern Ethernet switch performs the same basic bridging function across many ports. Bridges filter unnecessary traffic but do <b>not</b> normally stop broadcasts within the same VLAN — routers do.</p>
      </Card>

      <MiniQuiz
        q="PC-A sends a frame to a MAC address that is NOT in the switch's table. What happens?"
        options={["The frame is dropped", "It is flooded out of all ports except the incoming one", "It is sent back to PC-A", "The switch asks DNS"]}
        answer={1}
        why="Unknown unicast frames are flooded within the VLAN. When the real destination replies, the switch learns its port from the reply's source MAC."
      />
      <CompleteBar id="switching" />
    </div>
  );
}
