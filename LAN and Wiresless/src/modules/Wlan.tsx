import { useEffect, useRef, useState } from "react";
import { Device, Link, PacketLayer, Stage } from "../components/svg";
import { Btn, Callout, Card, CompleteBar, Controls, Field, LogPanel, MiniQuiz, ModuleHeader, Pill, Tabs, Toggle, useLog } from "../components/ui";
import { usePackets, type Pt } from "../lib/anim";
import { cn } from "../utils/cn";

/* ------------------------------------------------------------- Roaming */
const APS = [
  { id: "AP1", p: { x: 130, y: 150 } as Pt, ch: 1, mac: "A4:11:00:01" },
  { id: "AP2", p: { x: 400, y: 150 } as Pt, ch: 6, mac: "A4:11:00:02" },
  { id: "AP3", p: { x: 670, y: 150 } as Pt, ch: 11, mac: "A4:11:00:03" },
];
const SWP: Pt = { x: 400, y: 345 };
const SRV: Pt = { x: 640, y: 345 };
const WALLS = [265, 535];
const BAND = { "2.4": { pen: 0, max: 150, c: "#fbbf24" }, "5": { pen: 7, max: 600, c: "#38bdf8" }, "6": { pen: 10, max: 1200, c: "#a78bfa" } } as const;
type Band = keyof typeof BAND;
const quality = (r: number) => (r > -60 ? ["Excellent", "#34d399", 4] : r > -70 ? ["Good", "#a3e635", 3] : r > -78 ? ["Fair", "#fbbf24", 2] : r > -85 ? ["Poor", "#fb923c", 1] : ["No signal", "#ef4444", 0]) as [string, string, number];

function Roaming() {
  const [pos, setPos] = useState<Pt>({ x: 90, y: 250 });
  const [band, setBand] = useState<Band>("2.4");
  const [walls, setWalls] = useState(true);
  const [assoc, setAssoc] = useState<string | null>("AP1");
  const [drag, setDrag] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const { packets, fly } = usePackets();
  const { lines, add } = useLog();

  const rssi = (ap: (typeof APS)[number], p = pos) => {
    const d = Math.hypot(ap.p.x - p.x, ap.p.y - p.y);
    const w = walls ? WALLS.filter((x) => (x - ap.p.x) * (x - p.x) < 0).length : 0;
    return -35 - 40 * Math.log10(Math.max(d, 10) / 10) - BAND[band].pen - 10 * w;
  };
  const sig = APS.map((a) => ({ ...a, r: rssi(a) }));

  useEffect(() => {
    const best = sig.reduce((a, b) => (b.r > a.r ? b : a));
    const cur = sig.find((s) => s.id === assoc);
    if (!cur || cur.r < -85) {
      if (best.r >= -85) { setAssoc(best.id); add(`Client associates with ${best.id} (${best.r.toFixed(0)} dBm).`, "ok"); }
      else if (assoc) { setAssoc(null); add("Signal lost — client disconnected.", "bad"); }
    } else if (best.id !== cur.id && best.r > cur.r + 6) {
      setAssoc(best.id);
      add(`ROAM: ${cur.id} (${cur.r.toFixed(0)} dBm) → ${best.id} (${best.r.toFixed(0)} dBm). Same SSID, new BSSID.`, "warn");
    }
  }, [pos, band, walls]); // eslint-disable-line

  useEffect(() => {
    if (!drag) return;
    const mv = (e: PointerEvent) => {
      const r = svgRef.current!.getBoundingClientRect();
      setPos({ x: Math.min(775, Math.max(25, ((e.clientX - r.left) / r.width) * 800)), y: Math.min(300, Math.max(45, ((e.clientY - r.top) / r.height) * 400)) });
    };
    const up = () => setDrag(false);
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
  }, [drag]);

  const cur = sig.find((s) => s.id === assoc);
  const q = cur ? quality(cur.r) : quality(-99);
  const rate = cur ? Math.round(BAND[band].max * Math.max(0.03, Math.min(1, (cur.r + 88) / 30))) : 0;
  const radius = (pen: number) => 10 * Math.pow(10, (50 - pen) / 40);

  const ping = async () => {
    if (!cur) { add("Ping failed: client is not associated with any AP.", "bad"); return; }
    const ap = APS.find((a) => a.id === cur.id)!;
    add(`Ping: client → ${ap.id} (radio) → switch → server`, "info");
    await fly([pos, ap.p], { color: BAND[band].c, label: "802.11 frame", speed: 260 });
    await fly([ap.p, SWP, SRV], { color: "#22d3ee", label: "Ethernet", speed: 260 });
    await fly([SRV, SWP, ap.p], { color: "#34d399", label: "reply", speed: 300 });
    await fly([ap.p, pos], { color: BAND[band].c, label: "802.11 frame", speed: 260 });
    add("Reply received ✔ — the AP bridged the wireless client onto the wired LAN.", "ok");
  };

  return (
    <div className="space-y-4">
      <Card title="Infrastructure WLAN: one SSID, three access points" icon="📶">
        <Callout kind="info">Drag the laptop around the building. It stays associated with the strongest AP and <b>roams</b> when another is clearly better (+6 dB).</Callout>
        <div className="mt-3" />
        <Controls>
          <Field label="Band">
            <select value={band} onChange={(e) => setBand(e.target.value as Band)}>
              <option value="2.4">2.4 GHz</option><option value="5">5 GHz</option><option value="6">6 GHz (Wi-Fi 6E/7)</option>
            </select>
          </Field>
          <Toggle on={walls} onChange={setWalls} label="Walls between rooms (−10 dB each)" />
          <Btn onClick={ping}>▶ Ping wired server</Btn>
        </Controls>
        <Stage w={800} h={400} svgRef={svgRef}>
          {APS.map((a) => (
            <g key={a.id}>
              <circle {...a.p} r={radius(BAND[band].pen)} fill={BAND[band].c} fillOpacity={0.07} stroke={BAND[band].c} strokeOpacity={0.5} strokeDasharray="5 5" />
              <circle {...a.p} r={radius(BAND[band].pen) * 0.5} fill="none" stroke={BAND[band].c} strokeOpacity={0.2} />
            </g>
          ))}
          {walls && WALLS.map((x) => <rect key={x} x={x - 3} y={40} width={6} height={270} rx={2} fill="#64748b" />)}
          {APS.map((a) => <Link key={a.id} a={a.p} b={SWP} />)}
          <Link a={SWP} b={SRV} />
          {cur && <line x1={pos.x} y1={pos.y} x2={APS.find((a) => a.id === cur.id)!.p.x} y2={APS.find((a) => a.id === cur.id)!.p.y} stroke={BAND[band].c} strokeWidth={2.5} className="flow-dash" />}
          <Device type="switch" {...SWP} label="Switch" />
          <Device type="server" {...SRV} label="Server" />
          {APS.map((a) => <Device key={a.id} type="ap" {...a.p} label={a.id} sub={`ch ${a.ch}`} glow={assoc === a.id ? "#34d399" : undefined} tag={assoc === a.id ? "CONNECTED" : undefined} tagColor="#34d399" labelDy={30} />)}
          <Device type="laptop" {...pos} label="Client (drag me)" glow={drag ? "#22d3ee" : undefined} cursor="grab" onPointerDown={(e) => { e.preventDefault(); setDrag(true); }} />
          <text x={20} y={385} fontSize={11} fill="#8aa0c4">SSID: CAMPUS-WIFI on all APs → an Extended Service Set (ESS)</text>
          <PacketLayer packets={packets} />
        </Stage>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-ink-600/60 bg-ink-900 p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Signal per AP</div>
            {sig.map((s) => {
              const qq = quality(s.r);
              return (
                <div key={s.id} className="mb-1.5 flex items-center gap-2 text-xs">
                  <span className="w-10 font-bold text-white">{s.id}</span>
                  <div className="flex gap-0.5">{[1, 2, 3, 4].map((b) => <span key={b} className="inline-block w-1.5 rounded-sm" style={{ height: 4 + b * 4, background: b <= qq[2] ? qq[1] : "#22345a" }} />)}</div>
                  <span className="mono w-16 text-slate-300">{s.r.toFixed(0)} dBm</span>
                  <span style={{ color: qq[1] }}>{qq[0]}</span>
                  {assoc === s.id && <Pill color="#34d399">associated</Pill>}
                </div>
              );
            })}
          </div>
          <div className="rounded-xl border border-ink-600/60 bg-ink-900 p-3 text-sm">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Connection</div>
            <div className="mono text-xs leading-relaxed text-slate-300">
              SSID &nbsp;&nbsp;: CAMPUS-WIFI<br />
              BSSID &nbsp;: {cur ? cur.mac : "—"}<br />
              Channel: {cur ? cur.ch : "—"} ({band} GHz)<br />
              Link &nbsp;&nbsp;: <span style={{ color: q[1] }}>{q[0]}</span> · ≈ {rate} Mb/s
            </div>
            <p className="mt-2 text-xs text-slate-400">Rate is illustrative: real speed depends on channel width, spatial streams, interference and client capability.</p>
          </div>
        </div>
        <div className="mt-3"><LogPanel lines={lines} className="h-32" /></div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["SSID", "Service Set Identifier — the network name users see (CAMPUS-STAFF, CAMPUS-GUEST). An SSID is not a password.", "#38bdf8"],
          ["BSS / BSSID", "Basic Service Set: the fundamental 802.11 cell — an AP and its associated clients. The BSSID identifies one particular BSS (usually the AP's radio MAC).", "#34d399"],
          ["ESS", "Extended Service Set: several interconnected BSSs sharing an SSID to provide larger coverage and roaming — what you just dragged through.", "#a78bfa"],
        ].map(([t, d, c]) => (
          <div key={t} className="rounded-2xl border p-4" style={{ borderColor: c + "66", background: c + "10" }}>
            <div className="font-extrabold" style={{ color: c }}>{t}</div>
            <p className="mt-1 text-sm text-slate-300">{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Channels */
const CHCOL = ["#22d3ee", "#fbbf24", "#f472b6"];
function Channels() {
  const [ch, setCh] = useState([1, 3, 8]);
  const fx = (mhz: number) => 40 + ((mhz - 2395) / 90) * 720;
  const centre = (c: number) => 2412 + 5 * (c - 1);
  const pairs = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => {
    const d = Math.abs(ch[i] - ch[j]);
    return { i, j, d, k: d === 0 ? "co" : d < 5 ? "adj" : "ok" };
  });
  const score = pairs.reduce((s, p) => s + (p.k === "adj" ? 2 : p.k === "co" ? 1 : 0), 0);
  return (
    <div className="space-y-4">
      <Card title="2.4 GHz channel planner" icon="📻">
        <p className="mb-3 text-sm text-slate-300">Each 2.4 GHz channel is ~20 MHz wide but channels are only 5 MHz apart, so only <b>1, 6 and 11</b> do not overlap. Assign channels to three neighbouring APs.</p>
        <Controls>
          {ch.map((c, i) => (
            <Field key={i} label={`AP${i + 1}`}>
              <select value={c} onChange={(e) => setCh((o) => o.map((x, k) => (k === i ? +e.target.value : x)))} style={{ borderColor: CHCOL[i] }}>
                {Array.from({ length: 11 }, (_, k) => k + 1).map((n) => <option key={n} value={n}>Channel {n}</option>)}
              </select>
            </Field>
          ))}
          <Btn variant="good" small onClick={() => setCh([1, 6, 11])}>✨ Auto: 1 · 6 · 11</Btn>
          <Btn variant="danger" small onClick={() => setCh([6, 6, 6])}>All on 6</Btn>
        </Controls>
        <div className="rounded-2xl border border-ink-600/70 bg-ink-900 p-2">
          <svg viewBox="0 0 800 260" className="w-full">
            {ch.map((c, i) => {
              const m = centre(c);
              return <path key={i} d={`M${fx(m - 11)} 200 L${fx(m - 9)} 70 Q${fx(m)} 40 ${fx(m + 9)} 70 L${fx(m + 11)} 200 Z`} fill={CHCOL[i]} fillOpacity={0.3} stroke={CHCOL[i]} strokeWidth={2} />;
            })}
            <line x1={40} y1={200} x2={760} y2={200} stroke="#64748b" />
            {Array.from({ length: 11 }, (_, k) => k + 1).map((n) => (
              <g key={n}>
                <line x1={fx(centre(n))} y1={200} x2={fx(centre(n))} y2={206} stroke="#64748b" />
                <text x={fx(centre(n))} y={222} textAnchor="middle" fontSize={11} fill={[1, 6, 11].includes(n) ? "#34d399" : "#8aa0c4"} fontWeight={[1, 6, 11].includes(n) ? 800 : 400}>{n}</text>
              </g>
            ))}
            <text x={400} y={248} textAnchor="middle" fontSize={11} fill="#8aa0c4">Channel number (2.4 GHz band, 2412–2462 MHz)</text>
            {ch.map((c, i) => <text key={i} x={fx(centre(c))} y={60 - (i % 2) * 0} textAnchor="middle" fontSize={11} fontWeight={800} fill={CHCOL[i]} dy={-8 - i * 0}>{"AP" + (i + 1)}</text>)}
          </svg>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          {pairs.map((p) => (
            <div key={p.i + "-" + p.j} className={cn("rounded-xl border p-3 text-sm", p.k === "ok" ? "border-emerald-400/40 bg-emerald-400/10" : p.k === "co" ? "border-amber-400/40 bg-amber-400/10" : "border-rose-400/40 bg-rose-400/10")}>
              <b>AP{p.i + 1} ↔ AP{p.j + 1}</b>
              <p className="text-slate-300">{p.k === "ok" ? "✔ Non-overlapping channels — no interference." : p.k === "co" ? "⚠ Co-channel: they share airtime and take turns (CSMA/CA)." : "✖ Adjacent-channel overlap: partial interference corrupts frames — the worst case."}</p>
            </div>
          ))}
        </div>
        <div className="mt-3"><Callout kind={score === 0 ? "good" : score < 3 ? "warn" : "bad"} title={`Interference score ${score}:`}>{score === 0 ? "Perfect plan." : "Re-plan using 1, 6 and 11 and consider transmit power, channel width and building layout."}</Callout></div>
      </Card>

      <Card title="Wi-Fi frequency bands" icon="📡">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-slate-400"><th className="py-2">Band</th><th>General character</th><th>Planning considerations</th></tr></thead>
          <tbody className="text-slate-200">{[
            ["2.4 GHz", "Often reaches farther; crowded spectrum.", "Few non-overlapping 20 MHz channels; interference from other devices."],
            ["5 GHz", "More channel options, often less congestion.", "Shorter range through walls; local channel rules apply."],
            ["6 GHz", "Additional spectrum for Wi-Fi 6E/7.", "Needs compatible clients/APs; availability varies by country."],
          ].map((r) => <tr key={r[0]} className="border-t border-ink-600/50"><td className="py-2 font-bold text-cyan-300">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody></table></div>
      </Card>

      <Card title="IEEE 802.11 and Wi-Fi generations" icon="🧬">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["802.11n", "Wi-Fi 4", "Improved throughput", "2.4 & 5 GHz", "#94a3b8"],
            ["802.11ac", "Wi-Fi 5", "Wider channels, high throughput", "5 GHz", "#38bdf8"],
            ["802.11ax", "Wi-Fi 6 / 6E", "Efficiency in dense networks", "2.4/5 (+6 GHz for 6E)", "#34d399"],
            ["802.11be", "Wi-Fi 7", "Multi-link operation, very high throughput", "2.4/5/6 GHz", "#a78bfa"],
          ].map(([s, n, k, b, c]) => (
            <div key={s} className="rounded-xl border p-3" style={{ borderColor: c + "66", background: c + "10" }}>
              <div className="text-xl font-extrabold" style={{ color: c }}>{n}</div>
              <div className="mono text-xs text-slate-400">{s}</div>
              <p className="mt-1 text-sm text-slate-200">{k}</p>
              <p className="text-xs text-slate-400">{b}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">Actual speed depends on channel width, spatial streams, signal quality, interference and client capability.</p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ Security */
const MODES = [
  { id: "open", name: "Open (no security)", lvl: 0, tag: "Insecure", c: "#ef4444", note: "No encryption or authentication. Anyone in range can read everything.", psk: false },
  { id: "wep", name: "WEP", lvl: 0, tag: "Insecure — do not use", c: "#ef4444", note: "Legacy encryption with fundamental flaws; keys can be recovered in minutes from captured traffic.", psk: false },
  { id: "wpa", name: "WPA (TKIP)", lvl: 1, tag: "Legacy — not recommended", c: "#fb923c", note: "Early improvement over WEP, but obsolete and weak by today's standards.", psk: true },
  { id: "wpa2", name: "WPA2-Personal (AES-CCMP)", lvl: 2, tag: "Good if passphrase is strong", c: "#fbbf24", note: "Widely deployed. Strong encryption, but an attacker who captures the handshake can try passphrases offline.", psk: true },
  { id: "wpa3", name: "WPA3-Personal (SAE)", lvl: 3, tag: "Preferred", c: "#34d399", note: "Simultaneous Authentication of Equals resists offline dictionary attacks and gives forward secrecy.", psk: true },
  { id: "ent", name: "WPA2/WPA3-Enterprise (802.1X + RADIUS)", lvl: 4, tag: "Best for organisations", c: "#38bdf8", note: "Each user authenticates with individual credentials via 802.1X and a RADIUS server — no shared password.", psk: false },
];

function cipher(text: string, key: string) {
  let h = 2166136261;
  for (const ch of key || "k") h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return Array.from(text).map((ch) => { h = Math.imul(h, 1103515245) + 12345; return ((ch.charCodeAt(0) ^ (h >>> 16)) & 255).toString(16).padStart(2, "0"); }).join(" ");
}
function entropy(p: string) {
  let pool = 0;
  if (/[a-z]/.test(p)) pool += 26;
  if (/[A-Z]/.test(p)) pool += 26;
  if (/[0-9]/.test(p)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(p)) pool += 32;
  const common = ["password", "12345678", "qwerty", "admin", "letmein", "wifi", "11111111"];
  if (common.some((c) => p.toLowerCase().includes(c))) return 8;
  return p.length * Math.log2(pool || 1);
}
function human(sec: number) {
  if (sec < 1) return "instantly";
  if (sec < 60) return Math.round(sec) + " seconds";
  if (sec < 3600) return Math.round(sec / 60) + " minutes";
  if (sec < 86400) return Math.round(sec / 3600) + " hours";
  if (sec < 31536000) return Math.round(sec / 86400) + " days";
  if (sec < 3.15e9) return Math.round(sec / 31536000) + " years";
  return "centuries (practically never)";
}

function Security() {
  const [mode, setMode] = useState("wpa2");
  const [pw, setPw] = useState("campus2024");
  const [cap, setCap] = useState(false);
  const [checks, setChecks] = useState<boolean[]>([false, false, false, false, false, false]);
  const m = MODES.find((x) => x.id === mode)!;
  const msg = "user=alice&pass=S3cret!";
  const ent = entropy(pw);
  const crack = Math.pow(2, ent) / 2 / 1e7;
  const readable = m.lvl === 0;
  const GOOD = ["Use WPA3 (or WPA2 with AES) — never WEP/WPA", "Strong, unique Wi-Fi password (12+ chars)", "Change default admin credentials", "Keep router and AP firmware updated", "Separate guest Wi-Fi from internal systems", "Monitor the network and apply access controls"];
  const score = checks.filter(Boolean).length;
  return (
    <div className="space-y-4">
      <Card title="Wireless eavesdropping lab" icon="🕵️">
        <Controls>
          <Field label="Security mode">
            <select value={mode} onChange={(e) => { setMode(e.target.value); setCap(false); }}>{MODES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </Field>
          {m.psk && <Field label="Passphrase"><input type="text" className="mono" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>}
          <Btn onClick={() => setCap(true)}>🛰️ Attacker captures traffic</Btn>
        </Controls>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-center">
          <div className="rounded-xl border border-ink-600 bg-ink-900 p-3"><div className="mb-1 text-xs font-bold uppercase text-slate-400">💻 Client sends</div><div className="mono text-sm text-cyan-200">{msg}</div></div>
          <div className="text-center text-2xl">📡➜</div>
          <div className="rounded-xl border p-3" style={{ borderColor: cap ? (readable ? "#ef4444" : "#34d399") : "#22345a", background: "#060b16" }}>
            <div className="mb-1 text-xs font-bold uppercase text-slate-400">🕵️ Attacker sees</div>
            {!cap ? <div className="text-sm text-slate-500">Press “capture” …</div> : readable ? (
              <div className="mono break-all text-sm text-rose-300">{msg}<div className="mt-1 text-xs text-rose-400">⚠ Plain text readable{mode === "wep" ? " (after cracking the key in minutes)" : ""}</div></div>
            ) : (
              <div className="mono break-all text-xs text-emerald-300">{cipher(msg, mode + pw)}<div className="mt-1 text-xs text-slate-400">{mode === "wpa" ? "Encrypted with TKIP — known weaknesses remain." : "🔒 Encrypted — unreadable without the key."}</div></div>
            )}
          </div>
        </div>
        <div className="mt-3 rounded-xl border p-3" style={{ borderColor: m.c + "77", background: m.c + "12" }}>
          <div className="flex flex-wrap items-center gap-2"><b className="text-white">{m.name}</b><Pill color={m.c}>{m.tag}</Pill></div>
          <p className="mt-1 text-sm text-slate-300">{m.note}</p>
          {m.psk && (mode === "wpa2" || mode === "wpa") && (
            <p className="mt-2 text-sm text-slate-200">Offline guessing of <span className="mono text-cyan-300">“{pw}”</span> (~{ent.toFixed(0)} bits, 10 M guesses/s): <b className="text-amber-300">{human(crack)}</b></p>
          )}
          {mode === "wpa3" && <p className="mt-2 text-sm text-emerald-200">SAE forces an attacker to make live attempts for every guess — offline cracking of the captured exchange is not possible.</p>}
          <div className="mt-2 flex gap-1">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-2 flex-1 rounded-full" style={{ background: i <= m.lvl ? m.c : "#22345a" }} />)}</div>
        </div>
      </Card>

      <Card title="WLAN hardening checklist" icon="🛡️">
        <div className="grid gap-2 sm:grid-cols-2">
          {GOOD.map((g, i) => (
            <label key={g} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition", checks[i] ? "border-emerald-400/60 bg-emerald-400/10" : "border-ink-600 bg-ink-900")}>
              <input type="checkbox" checked={checks[i]} onChange={() => setChecks((c) => c.map((x, k) => (k === i ? !x : x)))} />
              {g}
            </label>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3"><div className="h-3 flex-1 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400 transition-all" style={{ width: (score / 6) * 100 + "%" }} /></div><span className="mono font-bold text-white">{score}/6</span></div>
      </Card>

      <Card title="Wireless security standards" icon="🔐">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-slate-400"><th className="py-2">Standard</th><th>Overview</th><th>Teaching point</th></tr></thead>
          <tbody className="text-slate-200">{[
            ["WEP", "Legacy wireless encryption", "Insecure; do not use"],
            ["WPA", "Early improvement over WEP", "Legacy; not recommended"],
            ["WPA2", "Widely deployed; commonly AES-CCMP", "Secure config + strong credentials"],
            ["WPA3", "Newer; SAE for Personal mode", "Prefer where AP and clients support it"],
            ["Enterprise", "802.1X authentication, often with RADIUS", "Individual credentials for managed organisations"],
          ].map((r) => <tr key={r[0]} className="border-t border-ink-600/50"><td className="py-2 font-bold text-cyan-300">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody></table></div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ Modes */
function Modes() {
  const { packets, fly } = usePackets();
  const [mode, setMode] = useState<"infra" | "adhoc">("infra");
    const A = { x: 120, y: 90 }, B = { x: 120, y: 260 }, AP = { x: 400, y: 175 }, C = { x: 680, y: 90 }, SW = { x: 680, y: 260 };
  const go = async () => {
    if (mode === "infra") {
      await fly([A, AP], { label: "to AP", color: "#34d399", speed: 220 });
      await Promise.all([fly([AP, B], { label: "to STA-B", color: "#34d399", speed: 220 }), fly([AP, SW, C], { label: "wired", color: "#22d3ee", speed: 220 })]);
    } else await fly([A, B], { label: "direct", color: "#fbbf24", speed: 160 });
  };
  return (
    <Card title="Infrastructure mode vs ad hoc mode" icon="🔁">
      <Tabs tabs={[{ id: "infra", label: "Infrastructure" }, { id: "adhoc", label: "Ad hoc" }]} value={mode} onChange={setMode} />
      <Stage w={800} h={340}>
        {mode === "infra" ? (
          <>
            <Link a={A} b={AP} dashed color="#34d399" flow /><Link a={B} b={AP} dashed color="#34d399" flow />
            <Link a={AP} b={SW} /><Link a={SW} b={C} />
            <Device type="ap" {...AP} label="Access point" scale={1.3} />
            <Device type="switch" {...SW} label="Wired switch" /><Device type="server" {...C} label="Wired server" />
          </>
        ) : <Link a={A} b={B} dashed color="#fbbf24" flow />}
        <Device type="laptop" {...A} label="STA-A" /><Device type="phone" {...B} label="STA-B" />
        <PacketLayer packets={packets} />
      </Stage>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Btn onClick={go}>▶ Send frame from STA-A</Btn>
        <p className="min-w-[240px] flex-1 text-sm text-slate-300">{mode === "infra" ? "Wireless stations communicate through an access point, which also bridges them to the wired LAN. Common for campus, home and office WLANs." : "Devices communicate directly with no central access point. Handy for temporary peer-to-peer links; less common in managed WLANs."}</p>
      </div>
    </Card>
  );
}

export default function Wlan() {
  const [tab, setTab] = useState<"roam" | "modes" | "chan" | "sec">("roam");
  return (
    <div className="space-y-6">
      <ModuleHeader
        n={8}
        title="Wireless LANs (Wi-Fi)"
        subtitle="A WLAN connects devices over radio signals rather than an Ethernet cable to each client. Wi-Fi, based on the IEEE 802.11 family, trades cabling for mobility — but radio conditions and shared airtime shape performance."
        outcomes={["WLAN architecture", "SSID / BSS / ESS", "Roaming & channels", "Wi-Fi security"]}
      />
      <Card title="WLAN components" icon="🧩">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {[["Wireless client", "Laptop, phone, tablet or other Wi-Fi device."], ["Access point", "Provides wireless access and bridges clients to the LAN."], ["Switch / router", "Connects APs to the wired LAN and routes between networks."], ["Wireless NIC", "Radio interface that transmits and receives 802.11 frames."], ["Wireless controller", "Centrally manages many APs in enterprise deployments."], ["Authentication service", "802.1X and RADIUS verify enterprise users."]].map(([t, d]) => (
            <div key={t} className="rounded-xl bg-ink-900 p-3"><b className="text-cyan-300">{t}</b><p className="mt-0.5 text-slate-300">{d}</p></div>
          ))}
        </div>
      </Card>
      <Tabs tabs={[{ id: "roam", label: "Roaming & signal", icon: "📶" }, { id: "modes", label: "Infrastructure vs ad hoc", icon: "🔁" }, { id: "chan", label: "Channels & bands", icon: "📻" }, { id: "sec", label: "Security", icon: "🔐" }]} value={tab} onChange={setTab} />
      {tab === "roam" && <Roaming />}
      {tab === "modes" && <Modes />}
      {tab === "chan" && <Channels />}
      {tab === "sec" && <Security />}

      <Card title="What affects WLAN performance?" icon="📉">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          {[["Distance & obstacles", "Walls, floors and distance reduce signal quality."], ["Client density", "Many active devices share airtime."], ["Interference", "Other WLANs and radio devices add noise."], ["Channel config", "Channel width and reuse affect capacity."], ["AP capability", "Radio generation, antennas and spatial streams."]].map(([t, d]) => (
            <div key={t} className="rounded-xl bg-ink-900 p-3"><b className="text-amber-300">{t}</b><p className="mt-0.5 text-slate-300">{d}</p></div>
          ))}
        </div>
      </Card>

      <Card title="Switched Ethernet vs WLAN" icon="⚖️">
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wider text-slate-400"><th className="py-2">Feature</th><th>Switched Ethernet</th><th>Wireless LAN</th></tr></thead>
          <tbody className="text-slate-200">{[
            ["Medium", "Copper or fibre cable", "Radio frequency"], ["Access device", "Switch", "Wireless access point"], ["Mobility", "Limited by cable", "Supported within coverage"],
            ["Interference", "Little radio interference", "Affected by RF interference and obstacles"], ["Capacity", "Dedicated link rate per port", "Shared airtime among clients"], ["Typical use", "Servers, desktops, fixed devices", "Laptops, phones, mobile users"],
          ].map((r) => <tr key={r[0]} className="border-t border-ink-600/50"><td className="py-2 font-semibold text-cyan-300">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}</tbody></table></div>
        <div className="mt-3"><Callout kind="key">Most real networks use both technologies.</Callout></div>
      </Card>

      <MiniQuiz
        q="Which device bridges wireless clients to a wired LAN?"
        options={["Hub", "Access point", "Modem", "Repeater"]}
        answer={1}
        why="An access point provides wireless connectivity and bridges 802.11 clients onto the wired Ethernet LAN."
      />
      <CompleteBar id="wlan" />
    </div>
  );
}
