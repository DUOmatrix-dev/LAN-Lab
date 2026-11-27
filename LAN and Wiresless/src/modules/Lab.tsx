import { useEffect, useMemo, useRef, useState } from "react";
import { Btn, Callout, Card, CompleteBar, ModuleHeader, Pill, Tabs } from "../components/ui";
import { cn } from "../utils/cn";

/* ================================================================ CLI */
interface Port { mode: "access" | "trunk"; vlan: number; allowed: string; shut: boolean }
interface Cfg { host: string; vlans: Record<number, string>; ports: Record<string, Port>; saved: boolean }
const PORTS = [...Array.from({ length: 8 }, (_, i) => `Fa0/${i + 1}`), "Gi0/1"];
const initCfg = (): Cfg => ({
  host: "Switch",
  vlans: { 1: "default" },
  ports: Object.fromEntries(PORTS.map((p) => [p, { mode: "access", vlan: 1, allowed: "all", shut: false } as Port])),
  saved: false,
});
type Mode = "user" | "priv" | "config" | "vlan" | "if";
const HOSTS_ON: Record<string, string> = { "Fa0/1": "0001.A1A1.A101", "Fa0/2": "0002.B2B2.B202", "Fa0/3": "0003.C3C3.C303", "Fa0/4": "0004.D4D4.D404" };

function normPort(s: string): string | null {
  const m = s.toLowerCase().replace(/\s+/g, "").match(/^(fa|fastethernet|f|gi|gigabitethernet|g)[a-z]*(\d+\/\d+)$/);
  if (!m) return null;
  const n = (m[1][0] === "f" ? "Fa" : "Gi") + m[2];
  return PORTS.includes(n) ? n : null;
}
const pre = (tok: string, full: string) => tok.length > 0 && full.startsWith(tok);
function match(t: string[], pat: string[]): string[] | null {
  if (t.length !== pat.length) return null;
  const args: string[] = [];
  for (let i = 0; i < pat.length; i++) {
    if (pat[i] === "*") args.push(t[i]);
    else if (!pre(t[i], pat[i])) return null;
  }
  return args;
}
const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);

const TASKS: { t: string; hint: string; ok: (c: Cfg) => boolean }[] = [
  { t: "Create VLAN 10 named ADMIN", hint: "configure terminal → vlan 10 → name ADMIN", ok: (c) => c.vlans[10]?.toUpperCase() === "ADMIN" },
  { t: "Create VLAN 20 named COMPUTING", hint: "vlan 20 → name COMPUTING", ok: (c) => c.vlans[20]?.toUpperCase() === "COMPUTING" },
  { t: "Make Fa0/1 an access port in VLAN 10", hint: "interface fa0/1 → switchport mode access → switchport access vlan 10", ok: (c) => c.ports["Fa0/1"].mode === "access" && c.ports["Fa0/1"].vlan === 10 },
  { t: "Make Fa0/2 an access port in VLAN 20", hint: "interface fa0/2 → switchport mode access → switchport access vlan 20", ok: (c) => c.ports["Fa0/2"].mode === "access" && c.ports["Fa0/2"].vlan === 20 },
  { t: "Configure Gi0/1 as a trunk allowing VLANs 10 and 20", hint: "interface gi0/1 → switchport mode trunk → switchport trunk allowed vlan 10,20", ok: (c) => c.ports["Gi0/1"].mode === "trunk" && c.ports["Gi0/1"].allowed.split(",").includes("10") && c.ports["Gi0/1"].allowed.split(",").includes("20") },
  { t: "Save the configuration", hint: "end → write memory (or copy running-config startup-config)", ok: (c) => c.saved },
];

function Cli() {
  const [cfg, setCfg] = useState<Cfg>(initCfg);
  const [mode, setMode] = useState<Mode>("user");
  const [ctx, setCtx] = useState<{ vlan?: number; ifc?: string }>({});
  const [out, setOut] = useState<{ k: "cmd" | "out"; t: string }[]>([{ k: "out", t: "Press RETURN to get started.\n\nType '?' for the commands available in the current mode." }]);
  const [inp, setInp] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hp, setHp] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLInputElement>(null);

  useEffect(() => { box.current?.scrollTo({ top: 1e9 }); }, [out]);

  const prompt = useMemo(() => cfg.host + ({ user: ">", priv: "#", config: "(config)#", vlan: "(config-vlan)#", if: "(config-if)#" }[mode]), [cfg.host, mode]);

  const showVlan = (c: Cfg) => {
    let s = "VLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n";
    Object.keys(c.vlans).map(Number).sort((a, b) => a - b).forEach((v) => {
      const ps = PORTS.filter((p) => c.ports[p].mode === "access" && c.ports[p].vlan === v).join(", ");
      s += `${pad(String(v), 5)}${pad(c.vlans[v], 33)}${pad("active", 10)}${ps}\n`;
    });
    return s.trimEnd();
  };
  const showTrunk = (c: Cfg) => {
    const tr = PORTS.filter((p) => c.ports[p].mode === "trunk");
    if (!tr.length) return "";
    let s = "Port        Mode         Encapsulation  Status        Native vlan\n";
    tr.forEach((p) => (s += `${pad(p, 12)}${pad("on", 13)}${pad("802.1q", 15)}${pad("trunking", 14)}1\n`));
    s += "\nPort        Vlans allowed on trunk\n";
    tr.forEach((p) => (s += `${pad(p, 12)}${c.ports[p].allowed === "all" ? "1-4094" : c.ports[p].allowed}\n`));
    return s.trimEnd();
  };
  const showMac = (c: Cfg) => {
    let s = "          Mac Address Table\n-------------------------------------------\n\nVlan    Mac Address       Type        Ports\n----    -----------       --------    -----\n";
    Object.entries(HOSTS_ON).forEach(([p, m]) => {
      if (c.ports[p].mode === "access" && !c.ports[p].shut) s += `${pad(String(c.ports[p].vlan), 8)}${pad(m, 18)}${pad("DYNAMIC", 12)}${p}\n`;
    });
    return s.trimEnd();
  };
  const showRun = (c: Cfg) => {
    let s = `Building configuration...\n\nhostname ${c.host}\n!\n`;
    Object.keys(c.vlans).map(Number).filter((v) => v !== 1).forEach((v) => (s += `vlan ${v}\n name ${c.vlans[v]}\n!\n`));
    PORTS.forEach((p) => {
      const q = c.ports[p];
      const full = p.startsWith("Fa") ? "FastEthernet" + p.slice(2) : "GigabitEthernet" + p.slice(2);
      s += `interface ${full}\n`;
      if (q.mode === "trunk") { s += " switchport mode trunk\n"; if (q.allowed !== "all") s += ` switchport trunk allowed vlan ${q.allowed}\n`; }
      else if (q.vlan !== 1) s += ` switchport access vlan ${q.vlan}\n switchport mode access\n`;
      if (q.shut) s += " shutdown\n";
      s += "!\n";
    });
    return s + "end";
  };

  const exec = (raw: string) => {
    const line = raw.trim();
    const lines: { k: "cmd" | "out"; t: string }[] = [{ k: "cmd", t: prompt + " " + raw }];
    const say = (t: string) => t && lines.push({ k: "out", t });
    if (!line) { setOut((o) => [...o, ...lines]); return; }
    const t = line.toLowerCase().split(/\s+/);
    let c = cfg;
    let md: Mode = mode;
    let cx = ctx;
    const upd = (f: (x: Cfg) => Cfg) => { c = f(c); };
    const bad = () => say("% Invalid input detected at '^' marker.");

    if (t[0] === "?") {
      const help: Record<Mode, string> = {
        user: "enable   exit   show",
        priv: "configure terminal   show vlan brief   show interfaces trunk   show mac address-table   show running-config   write memory   disable   exit",
        config: "hostname <name>   vlan <id>   interface <port>   end   exit",
        vlan: "name <name>   exit   end",
        if: "switchport mode access|trunk   switchport access vlan <id>   switchport trunk allowed vlan <list>   shutdown   no shutdown   exit   end",
      };
      say("Commands: " + help[md]);
    } else if (t[0] === "clear" || t[0] === "cls") { setOut([]); return; }
    else if (md === "user") {
      if (match(t, ["enable"])) md = "priv";
      else if (match(t, ["exit"])) say("(Closing session — just kidding. Type 'enable' to continue.)");
      else if (t[0].startsWith("sh")) say("% Command requires privileged mode — type 'enable'.");
      else bad();
    } else if (md === "priv") {
      if (match(t, ["configure", "terminal"]) || match(t, ["configure"])) { md = "config"; say("Enter configuration commands, one per line.  End with CNTL/Z."); }
      else if (match(t, ["show", "vlan", "brief"]) || match(t, ["show", "vlan"])) say(showVlan(c));
      else if (match(t, ["show", "interfaces", "trunk"])) say(showTrunk(c) || "(no trunking ports)");
      else if (match(t, ["show", "mac", "address-table"]) || match(t, ["show", "mac-address-table"])) say(showMac(c));
      else if (match(t, ["show", "mac", "address-table", "dynamic"])) say(showMac(c));
      else if (match(t, ["show", "running-config"])) say(showRun(c));
      else if (match(t, ["write", "memory"]) || match(t, ["write"]) || match(t, ["copy", "running-config", "startup-config"])) { upd((x) => ({ ...x, saved: true })); say("Building configuration...\n[OK]"); }
      else if (match(t, ["disable"])) md = "user";
      else if (match(t, ["exit"])) md = "user";
      else if (t[0] === "show") say("% Incomplete or unknown show command. Try: show vlan brief | show interfaces trunk | show mac address-table | show running-config");
      else bad();
    } else if (md === "config") {
      let a;
      if ((a = match(t, ["hostname", "*"]))) upd((x) => ({ ...x, host: line.split(/\s+/)[1] }));
      else if ((a = match(t, ["vlan", "*"]))) {
        const id = parseInt(a[0]);
        if (!(id >= 1 && id <= 4094)) say("% Invalid input: VLAN ID must be 1-4094.");
        else { upd((x) => (x.vlans[id] ? x : { ...x, vlans: { ...x.vlans, [id]: `VLAN${String(id).padStart(4, "0")}` } })); md = "vlan"; cx = { vlan: id }; }
      } else if (t[0].startsWith("int") && t.length >= 2) {
        const p = normPort(t.slice(1).join(""));
        if (p) { md = "if"; cx = { ifc: p }; } else say("% Invalid interface. Try: interface fa0/1  or  interface gi0/1");
      } else if (match(t, ["end"])) md = "priv";
      else if (match(t, ["exit"])) md = "priv";
      else bad();
    } else if (md === "vlan") {
      if (match(t, ["name", "*"])) { const nm = line.split(/\s+/)[1]; upd((x) => ({ ...x, vlans: { ...x.vlans, [cx.vlan!]: nm } })); }
      else if (match(t, ["exit"])) md = "config";
      else if (match(t, ["end"])) md = "priv";
      else bad();
    } else if (md === "if") {
      const p = cx.ifc!;
      const setP = (f: (q: Port) => Port) => upd((x) => ({ ...x, ports: { ...x.ports, [p]: f(x.ports[p]) } }));
      let a;
      if (match(t, ["switchport", "mode", "access"])) setP((q) => ({ ...q, mode: "access" }));
      else if (match(t, ["switchport", "mode", "trunk"])) setP((q) => ({ ...q, mode: "trunk" }));
      else if ((a = match(t, ["switchport", "access", "vlan", "*"]))) {
        const id = parseInt(a[0]);
        if (!(id >= 1 && id <= 4094)) say("% Invalid VLAN.");
        else {
          if (!c.vlans[id]) { upd((x) => ({ ...x, vlans: { ...x.vlans, [id]: `VLAN${String(id).padStart(4, "0")}` } })); say(`% Access VLAN does not exist. Creating vlan ${id}`); }
          setP((q) => ({ ...q, vlan: id }));
        }
      } else if ((a = match(t, ["switchport", "trunk", "allowed", "vlan", "*"]))) setP((q) => ({ ...q, allowed: a![0] }));
      else if (match(t, ["shutdown"])) setP((q) => ({ ...q, shut: true }));
      else if (match(t, ["no", "shutdown"])) setP((q) => ({ ...q, shut: false }));
      else if (match(t, ["exit"])) md = "config";
      else if (match(t, ["end"])) md = "priv";
      else if (t[0].startsWith("int") && t.length >= 2) { const q = normPort(t.slice(1).join("")); if (q) cx = { ifc: q }; else say("% Invalid interface."); }
      else bad();
    }
    if (c !== cfg && c.saved === cfg.saved && t[0] !== "write" && t[0] !== "copy") c = { ...c, saved: false };
    setCfg(c); setMode(md); setCtx(cx);
    setOut((o) => [...o, ...lines]);
  };

  const done = TASKS.map((x) => x.ok(cfg));
  const next = done.findIndex((d) => !d);
  const sol = "enable\nconfigure terminal\nvlan 10\nname ADMIN\nexit\nvlan 20\nname COMPUTING\nexit\ninterface fa0/1\nswitchport mode access\nswitchport access vlan 10\nexit\ninterface fa0/2\nswitchport mode access\nswitchport access vlan 20\nexit\ninterface gi0/1\nswitchport mode trunk\nswitchport trunk allowed vlan 10,20\nend\nwrite memory\nshow vlan brief\nshow interfaces trunk";
  const [showSol, setShowSol] = useState(false);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border border-ink-600 bg-black shadow-xl">
          <div className="flex items-center gap-2 border-b border-ink-600 bg-ink-800 px-3 py-2">
            <span className="h-3 w-3 rounded-full bg-rose-500" /><span className="h-3 w-3 rounded-full bg-amber-400" /><span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="mono ml-2 text-xs text-slate-400">{cfg.host} — console (Packet-Tracer-style simulator)</span>
          </div>
          <div ref={box} onClick={() => inRef.current?.focus()} className="mono h-[430px] cursor-text overflow-y-auto p-3 text-[13px] leading-relaxed">
            {out.map((l, i) => (
              <pre key={i} className={cn("whitespace-pre-wrap break-words", l.k === "cmd" ? "text-cyan-300" : "text-emerald-200/90")}>{l.t}</pre>
            ))}
            <div className="flex items-center text-cyan-300">
              <span className="whitespace-pre">{prompt} </span>
              <input
                ref={inRef}
                autoFocus
                value={inp}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                onChange={(e) => setInp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { exec(inp); if (inp.trim()) setHist((h) => [inp, ...h]); setHp(-1); setInp(""); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); const n = Math.min(hist.length - 1, hp + 1); if (hist[n] !== undefined) { setHp(n); setInp(hist[n]); } }
                  else if (e.key === "ArrowDown") { e.preventDefault(); const n = hp - 1; setHp(n); setInp(n >= 0 ? hist[n] : ""); }
                }}
                className="mono !m-0 flex-1 !border-0 !bg-transparent !p-0 text-[13px] text-white !outline-none"
              />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <Card title="Lab tasks" icon="✅">
            <ul className="space-y-2">
              {TASKS.map((x, i) => (
                <li key={x.t} className={cn("flex items-start gap-2 text-sm", done[i] ? "text-emerald-300" : "text-slate-300")}>
                  <span>{done[i] ? "✔" : "○"}</span><span>{x.t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700"><div className="h-full bg-emerald-400 transition-all" style={{ width: (done.filter(Boolean).length / TASKS.length) * 100 + "%" }} /></div>
            {next >= 0 ? <div className="mt-3 rounded-lg bg-ink-900 p-2.5 text-xs text-slate-300"><b className="text-amber-300">Hint:</b> <span className="mono">{TASKS[next].hint}</span></div> : <div className="mt-3"><Callout kind="good">All tasks complete. Verify with <span className="mono">show vlan brief</span>.</Callout></div>}
            <div className="mt-3 flex gap-2">
              <Btn small variant="ghost" onClick={() => setShowSol((v) => !v)}>{showSol ? "Hide" : "Show"} solution</Btn>
              <Btn small variant="ghost" onClick={() => { setCfg(initCfg()); setMode("user"); setCtx({}); setOut([{ k: "out", t: "Switch reloaded to factory defaults." }]); }}>Reload switch</Btn>
            </div>
            {showSol && <pre className="mono mt-2 max-h-40 overflow-auto rounded-lg bg-ink-950 p-2 text-[11px] text-slate-300">{sol}</pre>}
          </Card>
          <Card title="Quick reference" icon="📋">
            <div className="mono space-y-1 text-[11px] text-slate-300">
              {["enable", "configure terminal", "vlan 10", "name ADMIN", "interface fa0/1", "switchport mode access", "switchport access vlan 10", "switchport mode trunk", "show vlan brief", "show mac address-table"].map((c) => (
                <button key={c} onClick={() => setInp(c)} className="block w-full rounded bg-ink-900 px-2 py-1 text-left hover:bg-ink-700">{c}</button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Abbreviations work: <span className="mono">conf t</span>, <span className="mono">int fa0/1</span>, <span className="mono">sh vlan br</span>. ↑/↓ for history.</p>
          </Card>
        </div>
      </div>
      <Callout kind="info">Syntax varies by switch model and software. This simulator mimics a Cisco IOS Catalyst switch with ports Fa0/1–Fa0/8 and Gi0/1. Hosts are attached to Fa0/1–Fa0/4 so <span className="mono">show mac address-table</span> shows them.</Callout>
    </div>
  );
}

/* ===================================================== Design challenge */
function Design() {
  const [a, setA] = useState<{ topo: string; dev: string; ports: string; how: string; rel: string[]; sec: string[] }>({ topo: "", dev: "", ports: "", how: "", rel: [], sec: [] });
  const [res, setRes] = useState<null | { s: number; fb: [boolean, string][] }>(null);
  const tog = (k: "rel" | "sec", v: string) => setA((o) => ({ ...o, [k]: o[k].includes(v) ? o[k].filter((x) => x !== v) : [...o[k], v] }));
  const REL = [["stp", "Redundant uplinks protected by Spanning Tree", true], ["ups", "UPS (battery backup) for switches and server", true], ["bak", "Regular server backups", true], ["hub", "Replace the switch with a hub to save money", false]] as const;
  const SEC = [["vlan", "Put server/printer and lab PCs in suitable VLANs", true], ["ps", "Disable unused ports / port security", true], ["pw", "Use one shared admin password everywhere", false], ["def", "Keep default switch credentials", false], ["wpa", "WPA3 / WPA2-AES for any Wi-Fi", true]] as const;
  const evaluate = () => {
    const fb: [boolean, string][] = [];
    fb.push([a.topo === "star", a.topo === "star" ? "Topology: a physical star (all devices to a central switch) is easy to install, expand and troubleshoot." : "Topology: the practical choice is a star — a bus or ring has a shared failure point and is obsolete for labs; a full mesh would need 325 links."]);
    fb.push([a.dev === "switch", a.dev === "switch" ? "Central device: a managed switch gives each port its own collision domain and full-duplex link." : "Central device: you need a (managed) switch — a hub shares one collision domain and a router/AP alone is not a port aggregator."]);
    fb.push([a.ports === "27", a.ports === "27" ? "Ports: 24 PCs + printer + server + 1 uplink = 27 → use two 24-port switches or one 48-port switch." : "Ports: count 24 PCs + 1 printer + 1 server = 26, plus an uplink to the router/core = 27 (so a single 24-port switch is not enough)."]);
    fb.push([a.how === "mac", a.how === "mac" ? "Delivery: the switch learns source MACs and forwards frames by destination MAC address." : "Delivery: frames reach the right computer because the switch looks up the destination MAC in its MAC address table."]);
    const relOk = a.rel.filter((x) => REL.find((r) => r[0] === x)?.[2]).length, relBad = a.rel.length - relOk;
    fb.push([relOk >= 2 && relBad === 0, relOk >= 2 && relBad === 0 ? "Reliability: good measures (redundancy + STP, UPS, backups)." : "Reliability: pick at least two sound measures (redundant links with STP, UPS, backups) and avoid hubs."]);
    const secOk = a.sec.filter((x) => SEC.find((r) => r[0] === x)?.[2]).length, secBad = a.sec.length - secOk;
    fb.push([secOk >= 2 && secBad === 0, secOk >= 2 && secBad === 0 ? "Security: VLAN segmentation, port hardening and strong Wi-Fi encryption reduce risk." : "Security: choose at least two sound measures (VLANs, port security, WPA3) and avoid shared/default passwords."]);
    setRes({ s: fb.filter((f) => f[0]).length, fb });
  };
  const sel = (v: string, k: keyof typeof a, opts: [string, string][]) => (
    <select value={v} onChange={(e) => setA((o) => ({ ...o, [k]: e.target.value }))} className="w-full">
      <option value="">— choose —</option>{opts.map(([val, l]) => <option key={val} value={val}>{l}</option>)}
    </select>
  );
  return (
    <div className="space-y-4">
      <Card title="Class activity: design a laboratory LAN" icon="🧪">
        <Callout kind="info" title="Scenario:">a laboratory has <b>24 desktop computers, one network printer and one server</b>. Design the network, then evaluate your design.</Callout>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-semibold text-slate-300">1. Physical topology{sel(a.topo, "topo", [["bus", "Bus"], ["star", "Star"], ["ring", "Ring"], ["mesh", "Full mesh"]])}</label>
          <label className="text-sm font-semibold text-slate-300">2. Central device{sel(a.dev, "dev", [["hub", "Hub"], ["switch", "Managed switch"], ["router", "Single router, no switch"], ["ap", "Wi-Fi access point only"]])}</label>
          <label className="text-sm font-semibold text-slate-300">3. Access ports needed (incl. one uplink){sel(a.ports, "ports", [["24", "24"], ["26", "26"], ["27", "27"], ["48", "48 (all spare)"]])}</label>
          <label className="text-sm font-semibold text-slate-300">4. How do frames reach the correct computer?{sel(a.how, "how", [["mac", "Switch MAC-address table lookup"], ["tok", "A token circulates and the owner grabs it"], ["bus", "Every PC listens to everything on a shared cable"], ["ip", "The switch reads the IP address"]])}</label>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div><div className="mb-2 text-sm font-semibold text-slate-300">5. Reliability measures (choose 2+)</div>{REL.map(([id, l]) => <label key={id} className="mb-1 flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={a.rel.includes(id)} onChange={() => tog("rel", id)} />{l}</label>)}</div>
          <div><div className="mb-2 text-sm font-semibold text-slate-300">6. Security measures (choose 2+)</div>{SEC.map(([id, l]) => <label key={id} className="mb-1 flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={a.sec.includes(id)} onChange={() => tog("sec", id)} />{l}</label>)}</div>
        </div>
        <div className="mt-4"><Btn onClick={evaluate}>Evaluate my design</Btn></div>
        {res && (
          <div className="mt-4 space-y-2">
            <div className="text-lg font-extrabold text-white">Score: <span className={res.s >= 5 ? "text-emerald-300" : "text-amber-300"}>{res.s}/6</span></div>
            {res.fb.map(([ok, t], i) => <Callout key={i} kind={ok ? "good" : "bad"}>{t}</Callout>)}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================================================ Campus */
const CONCEPTS: [string, RegExp][] = [
  ["Switching (MAC learning / managed access switches)", /switch|mac/i],
  ["VLAN segmentation (per department, guest)", /vlan/i],
  ["Trunk links / 802.1Q", /trunk|802\.1q|dot1q/i],
  ["Inter-VLAN routing / Layer 3 / ACLs", /rout|layer 3|acl|firewall/i],
  ["Spanning Tree for redundant links", /stp|spanning/i],
  ["Secure Wi-Fi (WPA3 / WPA2 / 802.1X)", /wpa|802\.1x|radius|wi-?fi.*secur|secur.*wi-?fi/i],
  ["Redundancy & reliability", /redundan|reliab|failover|backup/i],
  ["Monitoring / management VLAN", /monitor|management/i],
];
function Campus() {
  const [txt, setTxt] = useState("");
  const [shown, setShown] = useState(false);
  const hits = CONCEPTS.map(([, r]) => r.test(txt));
  return (
    <div className="space-y-4">
      <Card title="Case study: design a campus LAN" icon="🏛️">
        <p className="mb-3 text-sm text-slate-300">A campus has Administration, Computer Science, Finance, a computer laboratory (25 PCs), a shared file server, network printers, staff & student Wi-Fi and guest Internet access.</p>
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          {[
            ["Requirements", ["3 departments", "25 lab computers", "Shared file server", "Network printers", "Staff and student Wi-Fi", "Guest internet access"], "#22d3ee"],
            ["Design decisions", ["VLAN per department", "Separate guest VLAN", "Managed access switches", "Trunk links between switches", "APs mapped to SSIDs/VLANs"], "#a78bfa"],
            ["Protection", ["Inter-VLAN ACLs", "WPA2/WPA3 or 802.1X", "STP on redundant links", "Management VLAN", "Monitoring and backups"], "#34d399"],
          ].map(([t, items, c]) => (
            <div key={t as string} className="rounded-xl border p-3" style={{ borderColor: (c as string) + "66", background: (c as string) + "10" }}>
              <b style={{ color: c as string }}>{t as string}</b>
              <ul className="mt-1 space-y-1 text-slate-300">{(items as string[]).map((i) => <li key={i}>• {i}</li>)}</ul>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Final challenge" icon="🏆">
        <p className="mb-2 font-semibold text-white">How can a university combine Ethernet switching, VLAN segmentation, STP and secure Wi-Fi to build a reliable campus network?</p>
        <textarea value={txt} onChange={(e) => { setTxt(e.target.value); setShown(false); }} rows={6} placeholder="Write your answer in your own words…" className="w-full rounded-xl border border-ink-600 bg-ink-900 p-3 text-sm text-white outline-none focus:border-cyan-400" />
        <div className="mt-2 flex items-center gap-3"><Btn onClick={() => setShown(true)} disabled={txt.trim().length < 20}>Check coverage</Btn><span className="text-xs text-slate-400">The checker looks for key concepts in your answer.</span></div>
        {shown && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {CONCEPTS.map(([n], i) => <div key={n} className={cn("rounded-lg border px-3 py-2 text-sm", hits[i] ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-100" : "border-ink-600 bg-ink-900 text-slate-400")}>{hits[i] ? "✔" : "○"} {n}</div>)}
          </div>
        )}
        {shown && <div className="mt-3"><Callout kind={hits.filter(Boolean).length >= 6 ? "good" : "warn"} title={`${hits.filter(Boolean).length}/${CONCEPTS.length} concepts covered.`}>{hits.filter(Boolean).length >= 6 ? "Excellent — a well-rounded design." : "Try adding the missing concepts above."}</Callout></div>}
        <details className="mt-3 rounded-xl bg-ink-900 p-3 text-sm text-slate-300">
          <summary className="cursor-pointer font-semibold text-cyan-300">Model answer</summary>
          <p className="mt-2">Use managed Ethernet access switches in a star towards a core switch; give each department and the guest network its own VLAN (and a management VLAN); carry them between switches over 802.1Q trunks; route between VLANs on a Layer 3 core and filter with ACLs; add redundant uplinks and let Spanning Tree block the extra paths to prevent loops while keeping failover; map Wi-Fi SSIDs to VLANs with WPA3/WPA2-AES or 802.1X, separate guest Wi-Fi, and keep firmware, monitoring and backups in place.</p>
        </details>
      </Card>
    </div>
  );
}

export default function Lab() {
  const [tab, setTab] = useState<"cli" | "design" | "campus">("cli");
  return (
    <div className="space-y-6">
      <ModuleHeader n={10} title="Practical Lab" subtitle="Apply what you learned: configure a switch from the command line, design a laboratory LAN, and answer the campus-network challenge." outcomes={["Configure VLANs & trunks", "Verify with show commands", "Design & justify a LAN"]} />
      <Tabs tabs={[{ id: "cli", label: "Switch CLI", icon: "⌨️" }, { id: "design", label: "Lab design", icon: "🧪" }, { id: "campus", label: "Campus challenge", icon: "🏛️" }]} value={tab} onChange={setTab} />
      {tab === "cli" && <Cli />}
      {tab === "design" && <Design />}
      {tab === "campus" && <Campus />}
      <Card title="Packet Tracer practicals (offline)" icon="💾">
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          {[
            ["Practical 1 · Switching & MAC learning", "One 2960 switch + four PCs in 192.168.1.0/24. Ping PC0 from PC2, then run show mac address-table before and after traffic."],
            ["Practical 2 · VLAN configuration", "VLAN 10 (ADMIN): PC0, PC1 — VLAN 20 (FINANCE): PC2, PC3. Test same-VLAN vs cross-VLAN connectivity; add a trunk to a second switch."],
            ["Practical 4 · Basic WLAN", "SSID CAMPUS_WIFI with WPA2-AES/WPA3 and a strong passphrase; connect two clients, verify IPs, ping a wired host, create a guest network."],
          ].map(([t, d]) => <div key={t} className="rounded-xl bg-ink-900 p-3"><b className="text-cyan-300">{t}</b><p className="mt-1 text-slate-300">{d}</p></div>)}
        </div>
        <div className="mt-3 flex flex-wrap gap-2"><Pill>Observe packet path in Simulation Mode</Pill><Pill color="#34d399">Disconnect a cable and note what still works</Pill></div>
      </Card>
      <CompleteBar id="lab" />
    </div>
  );
}
