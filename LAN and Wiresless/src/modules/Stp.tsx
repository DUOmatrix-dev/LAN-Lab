import { useMemo, useRef, useState } from "react";
import { Device, Link, PacketLayer, Stage } from "../components/svg";
import { Btn, Callout, Card, CompleteBar, Controls, LogPanel, MiniQuiz, ModuleHeader, Stat, Toggle, useLog } from "../components/ui";
import { sleep, usePackets, type Pt } from "../lib/anim";

const SWS: Record<string, { p: Pt; mac: string }> = {
  CORE: { p: { x: 400, y: 80 }, mac: "00:1A:2B:00:00:0C" },
  ADMIN: { p: { x: 160, y: 270 }, mac: "00:1A:2B:00:00:0A" },
  LAB: { p: { x: 640, y: 270 }, mac: "00:1A:2B:00:00:0B" },
};
const NAMES = Object.keys(SWS);
const PC1: Pt = { x: 160, y: 385 };
const PC2: Pt = { x: 640, y: 385 };
interface L { id: string; a: string; b: string }
const LINKS: L[] = [
  { id: "L1", a: "CORE", b: "ADMIN" },
  { id: "L2", a: "CORE", b: "LAB" },
  { id: "L3", a: "ADMIN", b: "LAB" },
];
const lerp = (a: Pt, b: Pt, f: number): Pt => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
const PRIOS = [4096, 8192, 16384, 24576, 32768, 40960, 61440];
const COSTS = [19, 4, 0]; // 0 = failed

type Role = "root" | "designated" | "blocked";

function computeStp(prio: Record<string, number>, cost: Record<string, number>) {
  const bid = (s: string) => prio[s] * 1e15 + parseInt(SWS[s].mac.replace(/:/g, ""), 16);
  const root = NAMES.reduce((a, b) => (bid(b) < bid(a) ? b : a));
  const up = LINKS.filter((l) => cost[l.id] > 0);
  const dist: Record<string, number> = {};
  NAMES.forEach((n) => (dist[n] = n === root ? 0 : Infinity));
  for (let i = 0; i < 4; i++) up.forEach((l) => {
    if (dist[l.a] + cost[l.id] < dist[l.b]) dist[l.b] = dist[l.a] + cost[l.id];
    if (dist[l.b] + cost[l.id] < dist[l.a]) dist[l.a] = dist[l.b] + cost[l.id];
  });
  const rootPort: Record<string, string | null> = {};
  NAMES.forEach((s) => {
    if (s === root) { rootPort[s] = null; return; }
    let best: L | null = null;
    let bc = Infinity;
    up.filter((l) => l.a === s || l.b === s).forEach((l) => {
      const n = l.a === s ? l.b : l.a;
      const c = dist[n] + cost[l.id];
      if (c < bc || (c === bc && best && bid(n) < bid(best.a === s ? best.b : best.a))) { bc = c; best = l; }
    });
    rootPort[s] = best ? (best as L).id : null;
  });
  const roles: Record<string, Role> = {};
  up.forEach((l) => {
    [l.a, l.b].forEach((s) => {
      const o = l.a === s ? l.b : l.a;
      let r: Role;
      if (s === root) r = "designated";
      else if (rootPort[s] === l.id) r = "root";
      else if (rootPort[o] === l.id) r = "designated";
      else r = dist[s] < dist[o] || (dist[s] === dist[o] && bid(s) < bid(o)) ? "designated" : "blocked";
      roles[l.id + s] = r;
    });
  });
  return { root, dist, rootPort, roles };
}

export default function Stp() {
  const [prio, setPrio] = useState<Record<string, number>>({ CORE: 32768, ADMIN: 32768, LAB: 32768 });
  const [cost, setCost] = useState<Record<string, number>>({ L1: 19, L2: 19, L3: 19 });
  const [stpOn, setStpOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ frames: 0, dup: 0, flaps: 0 });
  const [storm, setStorm] = useState(false);
  const { packets, fly, clear } = usePackets();
  const { lines, add, clear: clr } = useLog();
  const busyRef = useRef(false);

  const stp = useMemo(() => computeStp(prio, cost), [prio, cost]);
  const forwarding = (l: L) => cost[l.id] > 0 && (!stpOn || (stp.roles[l.id + l.a] !== "blocked" && stp.roles[l.id + l.b] !== "blocked"));

  const cycleCost = (id: string) => {
    if (busyRef.current) return;
    setCost((c) => ({ ...c, [id]: COSTS[(COSTS.indexOf(c[id]) + 1) % COSTS.length] }));
  };

  const bpdu = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    add(`Root bridge = ${stp.root}. It originates a BPDU (cost 0) every 2 s.`, "info");
    const order = [...LINKS].filter((l) => cost[l.id] > 0).sort((x, y) => {
      const dx = Math.min(stp.dist[x.a], stp.dist[x.b]), dy = Math.min(stp.dist[y.a], stp.dist[y.b]);
      return dx - dy;
    });
    const phases = [...new Set(order.map((l) => Math.min(stp.dist[l.a], stp.dist[l.b])))];
    for (const ph of phases) {
      await Promise.all(order.filter((l) => Math.min(stp.dist[l.a], stp.dist[l.b]) === ph).map((l) => {
        const from = stp.roles[l.id + l.a] === "designated" ? l.a : l.b;
        const to = from === l.a ? l.b : l.a;
        return fly([SWS[from].p, SWS[to].p], { color: "#fbbf24", label: `BPDU root=${stp.root} cost=${stp.dist[from]}`, speed: 200 });
      }));
    }
    add("BPDUs reach every switch. Ports receiving inferior BPDUs on a redundant link are put in the BLOCKING/alternate state.", "ok");
    busyRef.current = false; setBusy(false);
  };

  const broadcast = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setStorm(false);
    clr();
    let frames = 0, dup = 0, flaps = 0;
    const CAP = 80;
    const seen: Record<string, string> = {};
    add(`PC1 sends one broadcast frame. STP is ${stpOn ? "ENABLED" : "DISABLED"}.`, "info");
    const upd = () => setCounts({ frames, dup, flaps });
    const spread = async (sw: string, via: string | null, depth: number): Promise<void> => {
      const tasks: Promise<void>[] = [];
      LINKS.filter((l) => (l.a === sw || l.b === sw) && l.id !== via && forwarding(l)).forEach((l) => {
        if (frames >= CAP) return;
        frames++;
        const to = l.a === sw ? l.b : l.a;
        tasks.push(
          fly([SWS[sw].p, SWS[to].p], { color: stpOn ? "#34d399" : "#f87171", label: "bcast", speed: 330 }).then(() => {
            if (seen[to] && seen[to] !== l.id) flaps++;
            seen[to] = l.id;
            upd();
            if (frames > 30 && !stpOn) setStorm(true);
            return spread(to, l.id, depth + 1);
          })
        );
      });
      if (sw === "LAB") {
        frames++;
        tasks.push(fly([SWS.LAB.p, PC2], { color: stpOn ? "#34d399" : "#f87171", speed: 330 }).then(() => { dup++; upd(); }));
      }
      await Promise.all(tasks);
    };
    await fly([PC1, SWS.ADMIN.p], { color: "#22d3ee", label: "bcast", speed: 330 });
    seen.ADMIN = "host";
    await spread("ADMIN", null, 0);
    upd();
    if (stpOn) add(`Loop-free tree: PC2 received ${dup} copy. No storm.`, "ok");
    else {
      add(`Frames keep circulating: ${frames} copies generated and I stopped counting at ${CAP}! PC2 got ${dup} duplicates.`, "bad");
      add(`MAC instability: switches saw PC1's MAC on different ports ${flaps} times.`, "bad");
    }
    await sleep(800);
    setStorm(false);
    busyRef.current = false; setBusy(false);
  };

  const reset = () => { clear(); clr(); setCounts({ frames: 0, dup: 0, flaps: 0 }); setStorm(false); busyRef.current = false; setBusy(false); };
  const roleCol = { root: "#34d399", designated: "#38bdf8", blocked: "#ef4444" };
  const roleTxt = { root: "RP", designated: "DP", blocked: "BLK" };

  return (
    <div className="space-y-6">
      <ModuleHeader
        n={7}
        title="Spanning Tree Protocol"
        subtitle="Redundant switch links protect against failure — but create Layer 2 loops. STP (IEEE 802.1D) elects a root bridge and blocks just enough ports to leave a loop-free tree."
        outcomes={["Layer 2 loop dangers", "Root bridge election", "Port roles", "Reconvergence"]}
      />

      <Card>
        <Controls>
          <Toggle on={stpOn} onChange={(v) => { reset(); setStpOn(v); }} label="Spanning Tree enabled" />
          <Btn disabled={busy} onClick={broadcast} variant="amber">📢 PC1 sends a broadcast</Btn>
          <Btn disabled={busy || !stpOn} onClick={bpdu}>📨 Show BPDUs</Btn>
          <Btn variant="ghost" onClick={reset}>↺ Clear</Btn>
        </Controls>
        <Callout kind="info">Click a <b>link</b> to cycle its speed/cost (Fast Ethernet 19 → Gigabit 4 → failed). Change <b>bridge priorities</b> below to move the root.</Callout>
        <div className="mt-3" />
        <div className="relative">
          <Stage w={800} h={450}>
            {LINKS.map((l) => {
              const A = SWS[l.a].p, B = SWS[l.b].p;
              const fw = forwarding(l);
              return (
                <g key={l.id}>
                  <Link a={A} b={B} down={cost[l.id] === 0} onClick={() => cycleCost(l.id)} width={fw ? 4 : 3} color={fw ? "#5b7fb5" : "#7f1d1d"} dashed={!fw && cost[l.id] > 0} />
                  {cost[l.id] > 0 && (
                    <g transform={`translate(${lerp(A, B, 0.5).x},${lerp(A, B, 0.5).y + (l.id === "L3" ? 16 : -2)})`} pointerEvents="none">
                      <rect x={-34} y={-10} width={68} height={17} rx={8} fill="#0b1527" stroke="#3b5278" />
                      <text y={2.5} textAnchor="middle" fontSize={10} className="mono" fill="#cbd5e1">cost {cost[l.id]} · {cost[l.id] === 19 ? "100M" : "1G"}</text>
                    </g>
                  )}
                  {stpOn && cost[l.id] > 0 && [l.a, l.b].map((s) => {
                    const o = s === l.a ? l.b : l.a;
                    const role = stp.roles[l.id + s];
                    const p = lerp(SWS[s].p, SWS[o].p, 0.2);
                    return (
                      <g key={s} transform={`translate(${p.x},${p.y})`} pointerEvents="none">
                        <circle r={13} fill="#0b1527" stroke={roleCol[role]} strokeWidth={2.5} />
                        <text y={3.5} textAnchor="middle" fontSize={9} fontWeight={800} fill={roleCol[role]}>{roleTxt[role]}</text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
            <Link a={SWS.ADMIN.p} b={PC1} />
            <Link a={SWS.LAB.p} b={PC2} />
            {NAMES.map((n) => (
              <Device key={n} type="switch" {...SWS[n].p} scale={1.3} label={n + "-SW"} sub={`${prio[n]} · ${SWS[n].mac.slice(-5)}`} glow={stpOn && stp.root === n ? "#fbbf24" : undefined} tag={stpOn && stp.root === n ? "ROOT BRIDGE" : undefined} tagColor="#fbbf24" labelDy={36} />
            ))}
            <Device type="pc" {...PC1} label="PC1" labelDy={32} />
            <Device type="pc" {...PC2} label="PC2" labelDy={32} />
            <PacketLayer packets={packets} />
            {storm && (
              <g transform="translate(400,215)">
                <rect x={-140} y={-24} width={280} height={48} rx={12} fill="#450a0a" stroke="#ef4444" strokeWidth={2} />
                <text y={7} textAnchor="middle" fontWeight={800} fontSize={20} fill="#fca5a5">⚠ BROADCAST STORM</text>
              </g>
            )}
          </Stage>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat label="Frame copies generated" value={counts.frames} tone={counts.frames > 12 ? "rose" : "emerald"} />
          <Stat label="Duplicates at PC2" value={counts.dup} tone={counts.dup > 1 ? "rose" : "emerald"} />
          <Stat label="MAC table flaps" value={counts.flaps} tone={counts.flaps > 0 ? "rose" : "emerald"} />
        </div>
        <div className="mt-3"><LogPanel lines={lines} /></div>
      </Card>

      <Card title="Bridge IDs and root election" icon="🗳️">
        <p className="mb-3 text-sm text-slate-300">Bridge ID = <b>priority</b> + <b>MAC address</b>. The lowest Bridge ID becomes the <b>root bridge</b>. With equal default priorities, the lowest MAC wins — usually not the switch you want!</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-400"><th className="py-2">Switch</th><th>Priority</th><th>MAC</th><th>Cost to root</th><th>Root port</th><th>Result</th></tr></thead>
            <tbody>
              {NAMES.map((n) => (
                <tr key={n} className="border-t border-ink-600/50">
                  <td className="py-2 font-bold text-cyan-300">{n}-SW</td>
                  <td><select value={prio[n]} onChange={(e) => setPrio((p) => ({ ...p, [n]: +e.target.value }))}>{PRIOS.map((p) => <option key={p} value={p}>{p}{p === 32768 ? " (default)" : ""}</option>)}</select></td>
                  <td className="mono text-xs">{SWS[n].mac}</td>
                  <td className="mono">{stp.dist[n] === Infinity ? "∞" : stp.dist[n]}</td>
                  <td className="mono text-xs">{stp.rootPort[n] ? `${stp.rootPort[n]} (toward ${(() => { const l = LINKS.find((x) => x.id === stp.rootPort[n])!; return l.a === n ? l.b : l.a; })()})` : "—"}</td>
                  <td>{stp.root === n ? <span className="font-bold text-amber-300">★ Root bridge</span> : <span className="text-slate-400">non-root</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn small variant="good" onClick={() => setPrio({ CORE: 4096, ADMIN: 32768, LAB: 32768 })}>Best practice: CORE priority 4096</Btn>
          <Btn small variant="ghost" onClick={() => setPrio({ CORE: 32768, ADMIN: 32768, LAB: 32768 })}>Reset to defaults</Btn>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Root port (RP)", "On each non-root switch: the single port with the lowest path cost to the root.", "#34d399"],
          ["Designated port (DP)", "On each segment: the port with the best path to the root; it forwards frames. All ports on the root bridge are designated.", "#38bdf8"],
          ["Blocked / alternate", "Remaining redundant ports. They receive BPDUs but do not forward — they break the loop and spring to life if a link fails.", "#ef4444"],
        ].map(([t, d, c]) => (
          <div key={t} className="rounded-2xl border p-4" style={{ borderColor: c + "66", background: c + "10" }}>
            <div className="font-extrabold" style={{ color: c }}>{t}</div>
            <p className="mt-1 text-sm text-slate-300">{d}</p>
          </div>
        ))}
      </div>

      <Card title="What can a Layer 2 loop cause?" icon="🌪️">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {[
            ["Broadcast storm", "Broadcast frames circulate repeatedly and consume link capacity."],
            ["Duplicate frames", "The same frame may reach a destination more than once."],
            ["MAC instability", "A switch learns the same source MAC on different ports repeatedly."],
            ["Service disruption", "High utilisation and unstable forwarding make the LAN unusable."],
          ].map(([t, d]) => <div key={t} className="rounded-xl bg-ink-900 p-3"><b className="text-rose-300">{t}</b><p className="mt-1 text-slate-300">{d}</p></div>)}
        </div>
        <p className="mt-3 text-sm text-slate-300">Ethernet frames have no TTL (unlike IP packets), so nothing ever removes a looping frame.</p>
      </Card>

      <Card title="Try this" icon="🧪">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
          <li>Switch STP <b>off</b> and send a broadcast — watch the storm and MAC flaps.</li>
          <li>Switch STP <b>on</b> — one copy only; one link shows a red <b>BLK</b> port.</li>
          <li>Click the active link between the root and a switch to <b>fail</b> it — the blocked port takes over (reconvergence).</li>
          <li>Set CORE priority to 4096 — CORE becomes root and the topology re-forms.</li>
        </ol>
      </Card>

      <MiniQuiz
        q="Which switch becomes the root bridge?"
        options={["The one with the highest MAC", "The one with the lowest Bridge ID (priority, then MAC)", "The one with most ports", "The newest switch"]}
        answer={1}
        why="The lowest Bridge ID wins: priority is compared first (default 32768), and the MAC address breaks ties."
      />
      <CompleteBar id="stp" />
    </div>
  );
}
