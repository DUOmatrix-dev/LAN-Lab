import { useRef, useState } from "react";
import { Device, Link, PacketLayer, Stage } from "../components/svg";
import { Btn, Callout, Card, CompleteBar, Controls, Field, LogPanel, MiniQuiz, ModuleHeader, Pill, Toggle, useLog } from "../components/ui";
import { sleep, usePackets, type Pt } from "../lib/anim";
import { cn } from "../utils/cn";

const VL: Record<number, { name: string; c: string }> = {
  10: { name: "ADMIN", c: "#38bdf8" },
  20: { name: "COMPUTING", c: "#34d399" },
  30: { name: "GUEST", c: "#fb923c" },
};
const SW1: Pt = { x: 250, y: 175 };
const SW2: Pt = { x: 560, y: 175 };
const R: Pt = { x: 405, y: 355 };
interface H { id: string; name: string; sw: 1 | 2; port: string; p: Pt; n: number }
const HOSTS: H[] = [
  { id: "A", name: "PC-A", sw: 1, port: "Fa0/1", p: { x: 100, y: 70 }, n: 11 },
  { id: "B", name: "PC-B", sw: 1, port: "Fa0/2", p: { x: 100, y: 290 }, n: 12 },
  { id: "C", name: "PC-C", sw: 2, port: "Fa0/1", p: { x: 710, y: 70 }, n: 13 },
  { id: "D", name: "PC-D", sw: 2, port: "Fa0/2", p: { x: 710, y: 290 }, n: 14 },
];
const hh = (id: string) => HOSTS.find((h) => h.id === id)!;
const swp = (n: 1 | 2) => (n === 1 ? SW1 : SW2);
const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export default function Vlans() {
  const [vlan, setVlan] = useState<Record<string, number>>({ A: 10, B: 20, C: 10, D: 20 });
  const [router, setRouter] = useState(false);
  const [allowed, setAllowed] = useState<number[]>([10, 20, 30]);
  const [src, setSrc] = useState("A");
  const [dst, setDst] = useState("C");
  const [busy, setBusy] = useState(false);
  const [st, setSt] = useState<Record<string, "accept" | "src" | "none">>({});
  const [lastVid, setLastVid] = useState(10);
  const [marks, setMarks] = useState<Pt[]>([]);
  const { packets, fly, clear } = usePackets();
  const { lines, add, clear: clr } = useLog();
  const busyRef = useRef(false);

  const ip = (id: string) => `192.168.${vlan[id]}.${hh(id).n}`;
  const cycle = (id: string) => {
    if (busyRef.current) return;
    setVlan((v) => ({ ...v, [id]: v[id] === 10 ? 20 : v[id] === 20 ? 30 : 10 }));
  };
  const toggleAllowed = (v: number) => setAllowed((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));

  /** Fly one hop; returns false if dropped on the trunk. */
  const hop = async (a: Pt, b: Pt, vid: number | null, trunk: boolean, label?: string) => {
    const col = vid ? VL[vid].c : "#22d3ee";
    const lab = label ?? (trunk && vid ? `802.1Q VID ${vid}` : "untagged");
    if (trunk && vid && !allowed.includes(vid)) {
      await fly([a, mid(a, b)], { color: col, label: lab });
      setMarks((m) => [...m, mid(a, b)]);
      add(`DROPPED: VLAN ${vid} is not in the trunk's allowed list.`, "bad");
      return false;
    }
    if (trunk && vid) setLastVid(vid);
    await fly([a, b], { color: col, label: lab });
    return true;
  };

  const begin = () => {
    busyRef.current = true;
    setBusy(true);
    setMarks([]);
    setSt({});
  };
  const end = async () => {
    await sleep(1200);
    setSt({});
    busyRef.current = false;
    setBusy(false);
  };

  const ping = async () => {
    if (busyRef.current || src === dst) return;
    begin();
    const s = hh(src), d = hh(dst);
    const vs = vlan[src], vd = vlan[dst];
    add(`ping ${ip(dst)} from ${s.name} (${ip(src)})`, "info");
    setSt({ [src]: "src" });
    let ok = true;
    if (vs === vd) {
      add(`Same VLAN ${vs} → same Layer 2 broadcast domain: switched directly.`, "info");
      ok = await hop(s.p, swp(s.sw), null, false);
      if (ok && s.sw !== d.sw) ok = await hop(swp(s.sw), swp(d.sw), vs, true);
      if (ok) ok = await hop(swp(d.sw), d.p, null, false);
    } else if (!router) {
      add(`${s.name} is in VLAN ${vs}, ${d.name} in VLAN ${vd}: different broadcast domains and subnets.`, "warn");
      await hop(s.p, swp(s.sw), null, false);
      setMarks([swp(s.sw)]);
      add("Destination host unreachable — VLAN separation alone provides no path between subnets. A router or Layer 3 switch is needed.", "bad");
      ok = false;
    } else {
      add(`Different VLANs → ${s.name} sends to its default gateway 192.168.${vs}.1 (router-on-a-stick).`, "info");
      ok = await hop(s.p, swp(s.sw), null, false);
      if (ok && s.sw === 2) ok = await hop(SW2, SW1, vs, true);
      if (ok) ok = await hop(SW1, R, vs, true, `trunk VID ${vs}`);
      if (ok) {
        add(`Router: received on sub-interface Gi0/0.${vs}, routes 192.168.${vs}.0/24 → 192.168.${vd}.0/24, sends out Gi0/0.${vd}.`, "ok");
        ok = await hop(R, SW1, vd, true, `trunk VID ${vd}`);
      }
      if (ok && d.sw === 2) ok = await hop(SW1, SW2, vd, true);
      if (ok) ok = await hop(swp(d.sw), d.p, null, false);
    }
    if (ok) {
      setSt({ [src]: "src", [dst]: "accept" });
      add(`Reply received — ping succeeded ✔`, "ok");
    } else if (vs === vd || router) add("Ping failed ✖ — check the trunk configuration (allowed VLANs).", "bad");
    await end();
  };

  const bcast = async () => {
    if (busyRef.current) return;
    begin();
    const s = hh(src);
    const v = vlan[src];
    add(`${s.name} sends a broadcast (ARP request) in VLAN ${v}.`, "info");
    setSt({ [src]: "src" });
    const others = HOSTS.filter((h) => h.id !== src);
    const same = others.filter((h) => vlan[h.id] === v);
    const res: Record<string, "accept" | "none"> = {};
    others.forEach((h) => (res[h.id] = "none"));
    await fly([s.p, swp(s.sw)], { color: VL[v].c, label: "broadcast" });
    await Promise.all(
      same.map(async (h) => {
        if (h.sw === s.sw) {
          await fly([swp(s.sw), h.p], { color: VL[v].c, label: "broadcast" });
          res[h.id] = "accept";
        } else {
          setLastVid(v);
          if (!allowed.includes(v)) return;
          await fly([swp(s.sw), swp(h.sw), h.p], { color: VL[v].c, label: `VID ${v}` });
          res[h.id] = "accept";
        }
        setSt((o) => ({ ...o, [h.id]: "accept" }));
      })
    );
    setSt({ [src]: "src", ...res });
    const got = same.filter((h) => res[h.id] === "accept");
    add(`Received by: ${got.length ? got.map((h) => h.name).join(", ") : "nobody"}. Hosts in other VLANs never saw it.`, got.length ? "ok" : "warn");
    if (same.length && got.length < same.length) add("Some VLAN members are on the other switch but the trunk does not allow this VLAN.", "bad");
    await end();
  };

  const reset = () => { clear(); clr(); setMarks([]); setSt({}); busyRef.current = false; setBusy(false); };
  const ports = (sw: 1 | 2) => HOSTS.filter((h) => h.sw === sw);

  return (
    <div className="space-y-6">
      <ModuleHeader
        n={6}
        title="VLANs, Trunks & 802.1Q"
        subtitle="A VLAN is a logical Layer 2 broadcast domain inside a physical switched network: one physical infrastructure, multiple logical networks."
        outcomes={["Explain VLANs", "Access vs trunk ports", "802.1Q tagging", "Inter-VLAN routing"]}
      />

      <Card>
        <Callout kind="info">Click a PC to cycle its access-port VLAN (10 → 20 → 30). Then ping or broadcast and watch where frames go. Turn on the router to enable inter-VLAN routing.</Callout>
        <div className="mt-3" />
        <Controls>
          <Field label="From"><select value={src} onChange={(e) => setSrc(e.target.value)}>{HOSTS.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
          <Field label="To"><select value={dst} onChange={(e) => setDst(e.target.value)}>{HOSTS.filter((h) => h.id !== src).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
          <Btn disabled={busy || src === dst} onClick={ping}>▶ Ping</Btn>
          <Btn variant="amber" disabled={busy} onClick={bcast}>📢 Broadcast</Btn>
          <Btn variant="ghost" onClick={reset}>↺ Clear</Btn>
        </Controls>
        <Controls>
          <Toggle on={router} onChange={(v) => { reset(); setRouter(v); }} label="Router-on-a-stick (inter-VLAN routing)" />
          <span className="text-xs font-semibold text-slate-300">Trunk allowed VLANs:</span>
          {[10, 20, 30].map((v) => (
            <button key={v} onClick={() => toggleAllowed(v)} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-bold transition", allowed.includes(v) ? "text-ink-950" : "bg-transparent text-slate-500 line-through")}
              style={allowed.includes(v) ? { background: VL[v].c, borderColor: VL[v].c } : { borderColor: "#334155" }}>
              {v}
            </button>
          ))}
        </Controls>

        <Stage w={800} h={430}>
          <Link a={SW1} b={SW2} width={5} color="#6d8bc4" label="802.1Q TRUNK" labelColor="#9db6e4" />
          {router && <Link a={SW1} b={R} width={4} color="#a78bfa" label="trunk" labelColor="#c4b5fd" />}
          {HOSTS.map((h) => <Link key={h.id} a={swp(h.sw)} b={h.p} color={VL[vlan[h.id]].c} width={3} />)}
          {HOSTS.map((h) => {
            const l = { x: (swp(h.sw).x * 0.7 + h.p.x * 0.3), y: (swp(h.sw).y * 0.7 + h.p.y * 0.3) };
            return (
              <g key={"pl" + h.id} transform={`translate(${l.x},${l.y})`}>
                <rect x={-32} y={-8} width={64} height={15} rx={5} fill="#0b1527" stroke={VL[vlan[h.id]].c} />
                <text y={3} textAnchor="middle" fontSize={9} className="mono" fill="#cbd5e1">{h.port} · access</text>
              </g>
            );
          })}
          <Device type="switch" {...SW1} label="Switch 1" scale={1.3} />
          <Device type="switch" {...SW2} label="Switch 2" scale={1.3} />
          <g opacity={router ? 1 : 0.25}><Device type="router" {...R} label="Router" sub={router ? "Gi0/0.10 .20 .30" : "(disabled)"} /></g>
          {HOSTS.map((h) => {
            const v = vlan[h.id];
            const s = st[h.id];
            return (
              <Device
                key={h.id}
                type="pc"
                {...h.p}
                label={h.name}
                sub={ip(h.id)}
                glow={s === "accept" ? "#34d399" : s === "src" ? "#22d3ee" : VL[v].c}
                tag={`VLAN ${v}`}
                tagColor={VL[v].c}
                onClick={() => cycle(h.id)}
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
        <div className="mt-3"><LogPanel lines={lines} /></div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {([1, 2] as const).map((n) => (
          <Card key={n} title={`Switch ${n}# show vlan brief`} icon="🖥️">
            <table className="mono w-full text-xs">
              <thead><tr className="text-left text-slate-400"><th className="py-1">VLAN</th><th>Name</th><th>Ports</th></tr></thead>
              <tbody>
                <tr className="border-t border-ink-600/50"><td className="py-1">1</td><td>default</td><td className="text-slate-400">{ports(n).length ? "(unused ports)" : "all"}</td></tr>
                {[10, 20, 30].map((v) => (
                  <tr key={v} className="border-t border-ink-600/50">
                    <td className="py-1" style={{ color: VL[v].c }}>{v}</td><td>{VL[v].name}</td>
                    <td>{ports(n).filter((h) => vlan[h.id] === v).map((h) => h.port).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>

      <Card title="IEEE 802.1Q: the VLAN tag" icon="🏷️">
        <p className="mb-3 text-sm text-slate-300">On a trunk, the switch inserts a 4-byte tag into the Ethernet frame so the receiving device knows which VLAN it belongs to. Access ports normally carry untagged frames.</p>
        <div className="flex flex-wrap gap-1 text-center text-[11px] font-bold">
          {[["DEST MAC", "#22d3ee", 1], ["SOURCE MAC", "#a78bfa", 1], ["802.1Q TAG", "#fbbf24", 2], ["TYPE", "#94a3b8", 0.7], ["PAYLOAD", "#34d399", 2], ["FCS", "#fb7185", 0.7]].map(([n, c, f]) => (
            <div key={n as string} className={cn("rounded-lg border-2 px-2 py-3", n === "802.1Q TAG" && "ring-2 ring-amber-300/50")} style={{ borderColor: c as string, background: (c as string) + "18", color: c as string, flex: f as number, minWidth: 70 }}>{n}</div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
          {[["TPID", "16 bits", "0x8100", "#fbbf24"], ["PCP", "3 bits", "priority", "#94a3b8"], ["DEI", "1 bit", "drop eligible", "#94a3b8"], ["VID", "12 bits", `${lastVid} = ${lastVid.toString(2).padStart(12, "0")}`, VL[lastVid]?.c ?? "#38bdf8"]].map(([n, s, v, c]) => (
            <div key={n} className="rounded-lg bg-ink-900 p-2"><b style={{ color: c }}>{n}</b><div className="text-slate-400">{s}</div><div className="mono mt-1 text-slate-200">{v}</div></div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">12-bit VID → 4,096 possible bit patterns; some values are reserved (0 and 4095).</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Access port" icon="🔌" accent="#34d399">
          <p className="text-sm text-slate-300">Normally carries traffic for <b>one</b> assigned VLAN. Connects desktops, printers and other end-user devices. Frames to end devices are normally untagged.</p>
          <pre className="mono mt-2 overflow-x-auto rounded-lg bg-ink-950 p-3 text-xs text-emerald-200">{`interface fastEthernet 0/1
 switchport mode access
 switchport access vlan 10`}</pre>
        </Card>
        <Card title="Trunk port" icon="🛣️" accent="#a78bfa">
          <p className="text-sm text-slate-300">Carries <b>multiple</b> VLANs over one link: switch-to-switch, switch-to-router, switch to VLAN-aware AP/server. 802.1Q tags identify VLAN membership.</p>
          <pre className="mono mt-2 overflow-x-auto rounded-lg bg-ink-950 p-3 text-xs text-violet-200">{`interface gigabitEthernet 0/1
 switchport mode trunk
 switchport trunk allowed vlan 10,20`}</pre>
        </Card>
      </div>

      <Card title="Worked example: a university VLAN plan" icon="🏫">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-400"><th className="py-2">VLAN</th><th>Name</th><th>Users</th><th>Subnet</th><th>Gateway</th></tr></thead>
            <tbody className="mono text-xs text-slate-200">
              {[["10", "ADMIN", "Administration", "192.168.10.0/24", "192.168.10.1"], ["20", "COMPUTING", "Computer Science", "192.168.20.0/24", "192.168.20.1"], ["30", "FINANCE", "Finance", "192.168.30.0/24", "192.168.30.1"], ["40", "GUEST", "Visitors", "192.168.40.0/24", "192.168.40.1"]].map((r) => (
                <tr key={r[0]} className="border-t border-ink-600/50">{r.map((c, i) => <td key={i} className="py-2 pr-3">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3"><Callout kind="key">A PC in VLAN 10 and a PC in VLAN 20 are in different Layer 2 broadcast domains. A router or Layer 3 switch must route between their IP subnets.</Callout></div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Why use VLANs?" icon="🎯">
          <div className="flex flex-wrap gap-2">
            {["Segmentation", "Broadcast control", "Security design", "Flexibility", "Administration", "Service separation"].map((t) => <Pill key={t}>{t}</Pill>)}
          </div>
          <p className="mt-3 text-sm text-slate-300">Group users by role rather than location, limit broadcasts to the relevant VLAN, and separate voice, management and guest traffic. Combine with ACLs and firewalls — VLANs alone are not complete security.</p>
        </Card>
        <Card title="Inter-VLAN routing methods" icon="🧭">
          <ul className="space-y-2 text-sm text-slate-300">
            <li><b className="text-cyan-300">Router-on-a-stick:</b> one router interface with multiple VLAN sub-interfaces over a trunk (this simulator).</li>
            <li><b className="text-cyan-300">Layer 3 switch:</b> Switched Virtual Interfaces (SVIs) provide gateways and routing between VLANs.</li>
          </ul>
        </Card>
      </div>

      <MiniQuiz
        q="PC-A (VLAN 10) pings PC-B (VLAN 20) on the same switch, and no router exists. What happens?"
        options={["It works — same switch", "It fails — different broadcast domains need Layer 3 routing", "It works only with STP", "It works but is tagged"]}
        answer={1}
        why="VLANs create separate Layer 2 broadcast domains and subnets; a router or Layer 3 switch must route between them."
      />
      <CompleteBar id="vlans" />
    </div>
  );
}
