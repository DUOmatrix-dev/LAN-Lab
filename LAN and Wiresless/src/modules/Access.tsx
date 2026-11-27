import { useEffect, useRef, useState, type JSX } from "react";
import { Device, Link, PacketLayer, Stage } from "../components/svg";
import { Btn, Callout, Card, CompleteBar, Controls, LogPanel, MiniQuiz, ModuleHeader, Stat, Tabs, Toggle, useLog } from "../components/ui";
import { getSpeedMult, sleep, usePackets, type Pt } from "../lib/anim";

/* ---------------------------------------------------------------- CSMA/CD */
const BX0 = 50, BX1 = 750, BY = 190, V = 520, FRAME = 2.4, SLOT = 0.5, JAM = 0.35;
const COLORS = ["#22d3ee", "#a78bfa", "#fbbf24", "#34d399"];
interface Wave { id: number; st: number; x0: number; t0: number; t1: number; color: string; jam: boolean }
interface Stn { name: string; x: number; state: "idle" | "wait" | "tx" | "jam" | "backoff"; attempts: number; txEnd: number; jamEnd: number; bo: number; k: number; wave?: Wave }
const mkStations = (): Stn[] => ["A", "B", "C", "D"].map((name, i) => ({ name, x: 130 + i * 180, state: "idle", attempts: 0, txEnd: 0, jamEnd: 0, bo: 0, k: 0 }));

function CsmaCD() {
  const S = useRef({ t: 0, st: mkStations(), waves: [] as Wave[], bursts: [] as { x: number; t: number }[], wid: 0, ok: 0, col: 0 });
  const [, setTick] = useState(0);
  const [sense, setSense] = useState(true);
  const senseRef = useRef(true);
  senseRef.current = sense;
  const { lines, add, clear } = useLog();

  const covers = (w: Wave, x: number, t: number) => {
    const d = Math.abs(x - w.x0);
    const front = (t - w.t0) * V;
    const tail = w.t1 === Infinity ? -1 : (t - w.t1) * V;
    return front >= d && tail < d;
  };

  useEffect(() => {
    const id = setInterval(() => {
      const s = S.current;
      s.t += 0.033 * getSpeedMult();
      const t = s.t;
      s.waves = s.waves.filter((w) => !(w.t1 !== Infinity && (t - w.t1) * V > BX1 - BX0));
      s.bursts = s.bursts.filter((b) => t - b.t < 1.6);
      s.st.forEach((c, i) => {
        const other = () => s.waves.some((w) => w.st !== i && covers(w, c.x, t));
        if (c.state === "wait") {
          if (!senseRef.current || !other()) {
            c.state = "tx";
            c.txEnd = t + FRAME;
            const w: Wave = { id: ++s.wid, st: i, x0: c.x, t0: t, t1: Infinity, color: COLORS[i], jam: false };
            c.wave = w;
            s.waves.push(w);
            add(`${c.name}: channel ${senseRef.current ? "idle" : "(not sensed)"} → start transmitting` + (c.attempts ? ` (attempt ${c.attempts + 1})` : ""), "info");
          }
        } else if (c.state === "tx") {
          if (other()) {
            c.state = "jam";
            c.jamEnd = t + JAM;
            if (c.wave) { c.wave.jam = true; c.wave.t1 = t + JAM; }
            s.col++;
            s.bursts.push({ x: c.x, t });
            add(`${c.name}: COLLISION detected! Sends jam signal and stops.`, "bad");
          } else if (t >= c.txEnd) {
            if (c.wave) c.wave.t1 = t;
            c.state = "idle";
            c.attempts = 0;
            s.ok++;
            add(`${c.name}: frame sent successfully ✔`, "ok");
          }
        } else if (c.state === "jam") {
          if (t >= c.jamEnd) {
            c.attempts++;
            if (c.attempts >= 16) {
              c.state = "idle";
              c.attempts = 0;
              add(`${c.name}: too many collisions — frame aborted.`, "bad");
            } else {
              const mx = Math.pow(2, Math.min(c.attempts, 10)) - 1;
              c.k = Math.floor(Math.random() * (mx + 1));
              c.bo = t + c.k * SLOT;
              c.state = "backoff";
              add(`${c.name}: binary exponential backoff — picks K=${c.k} from [0..${mx}] → waits ${c.k} slot(s).`, "warn");
            }
          }
        } else if (c.state === "backoff") {
          if (t >= c.bo) c.state = "wait";
        }
      });
      setTick((n) => n + 1);
    }, 33);
    return () => clearInterval(id);
  }, []); // eslint-disable-line

  const queue = (i: number) => {
    const c = S.current.st[i];
    if (c.state === "idle") { c.state = "wait"; c.attempts = 0; }
  };
  const reset = () => { S.current = { t: 0, st: mkStations(), waves: [], bursts: [], wid: 0, ok: 0, col: 0 }; clear(); };

  const s = S.current;
  const t = s.t;
  const label: Record<string, string> = { idle: "idle", wait: "sensing…", tx: "TRANSMITTING", jam: "JAM!", backoff: "" };
  const colour: Record<string, string> = { idle: "#64748b", wait: "#fbbf24", tx: "#34d399", jam: "#ef4444", backoff: "#a78bfa" };

  return (
    <div className="space-y-4">
      <Card title="CSMA/CD on a shared (half-duplex) bus" icon="💥">
        <p className="mb-3 text-sm text-slate-300">
          Signals take time to travel. If two stations both think the cable is idle, they transmit at nearly the same moment — and the waves collide. Click
          several <b>Send</b> buttons at once, or use the collision demo.
        </p>
        <Controls>
          {s.st.map((c, i) => (
            <Btn key={c.name} small onClick={() => queue(i)} disabled={c.state !== "idle"}>Send from {c.name}</Btn>
          ))}
          <Btn variant="amber" small onClick={() => { queue(0); queue(3); }}>💥 Collision demo (A + D)</Btn>
          <Btn variant="ghost" small onClick={reset}>↺ Reset</Btn>
          <Toggle on={sense} onChange={setSense} label="Carrier sense (CSMA)" />
        </Controls>
        <Stage w={800} h={290}>
          <rect x={BX0} y={BY - 5} width={BX1 - BX0} height={10} rx={5} fill="#22345a" />
          <text x={400} y={BY + 40} textAnchor="middle" fontSize={11} fill="#8aa0c4" fontWeight={700} letterSpacing={2}>SHARED BUS</text>
          {s.waves.map((w) => {
            const front = (t - w.t0) * V;
            const tail = Math.max(0, w.t1 === Infinity ? 0 : (t - w.t1) * V);
            const col = w.jam ? "#ef4444" : w.color;
            const L1 = Math.max(BX0, w.x0 - front), L2 = Math.max(BX0, w.x0 - tail);
            const R1 = Math.min(BX1, w.x0 + tail), R2 = Math.min(BX1, w.x0 + front);
            return (
              <g key={w.id} opacity={0.85}>
                {L2 > L1 && <rect x={L1} y={BY - 9} width={L2 - L1} height={18} rx={4} fill={col} />}
                {R2 > R1 && <rect x={R1} y={BY - 9} width={R2 - R1} height={18} rx={4} fill={col} />}
              </g>
            );
          })}
          {s.st.map((c, i) => (
            <g key={c.name}>
              <line x1={c.x} y1={90} x2={c.x} y2={BY} stroke="#3b5278" strokeWidth={2.5} />
              <Device type="pc" x={c.x} y={70} label={"Station " + c.name} glow={c.state === "tx" ? COLORS[i] : c.state === "jam" ? "#ef4444" : undefined} labelDy={-34} />
              <g transform={`translate(${c.x},${BY + 68})`}>
                <rect x={-52} y={-11} width={104} height={22} rx={11} fill={colour[c.state] + "26"} stroke={colour[c.state]} />
                <text textAnchor="middle" y={4} fontSize={10.5} fontWeight={700} fill={colour[c.state]}>
                  {c.state === "backoff" ? `backoff ${Math.max(0, Math.ceil((c.bo - t) / SLOT))} slot` : label[c.state]}
                </text>
              </g>
            </g>
          ))}
          {s.bursts.map((b, i) => {
            const age = (t - b.t) / 1.6;
            return (
              <g key={i} transform={`translate(${b.x},${BY})`} opacity={1 - age}>
                <circle r={14 + age * 40} fill="none" stroke="#ef4444" strokeWidth={3} />
                <text y={-22 - age * 10} textAnchor="middle" fontSize={16}>💥</text>
              </g>
            );
          })}
        </Stage>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Stat label="Successful frames" value={s.ok} tone="emerald" />
          <Stat label="Collisions detected" value={s.col} tone="rose" />
          <Stat label="Sim time" value={t.toFixed(1) + " s"} />
        </div>
        <div className="mt-3"><LogPanel lines={lines} /></div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="How CSMA/CD works" icon="📝">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-300">
            <li><b>Carrier Sense</b> — listen; if busy, wait.</li>
            <li><b>Multiple Access</b> — if idle, transmit.</li>
            <li><b>Collision Detection</b> — keep listening while sending.</li>
            <li>On collision: send a <b>jam signal</b>, stop, wait a random <b>backoff</b> (K slots, K ∈ [0, 2ⁿ−1]) and retry.</li>
          </ol>
        </Card>
        <Card title="Try this" icon="🧪">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-300">
            <li>Switch <b>Carrier sense off</b> and click two stations: they never defer → more collisions.</li>
            <li>Send from A then, a moment later, from B: B <i>defers</i> once the signal reaches it.</li>
            <li>Watch how backoff ranges grow after repeated collisions.</li>
          </ul>
          <div className="mt-3"><Callout kind="warn">Modern switched, full-duplex Ethernet links have no shared medium, so CSMA/CD is not normally used.</Callout></div>
        </Card>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Token passing */
const RN = ["A", "B", "C", "D", "E"];
const RP: Pt[] = RN.map((_, i) => {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / RN.length;
  return { x: 400 + 270 * Math.cos(a), y: 195 + 130 * Math.sin(a) };
});

function Token() {
  const { packets, fly, clear } = usePackets();
  const { lines, add, clear: clr } = useLog();
  const [queues, setQueues] = useState<number[][]>(RN.map(() => []));
  const qRef = useRef<number[][]>(RN.map(() => []));
  const [holder, setHolder] = useState(-1);
  const [mark, setMark] = useState<Record<number, string>>({});
  const [running, setRunning] = useState(false);
  const run = useRef(false);
  const pos = useRef(0);
  const [sent, setSent] = useState(0);

  useEffect(() => () => { run.current = false; }, []);

  const enqueue = (i: number) => {
    let d = Math.floor(Math.random() * RN.length);
    if (d === i) d = (d + 2) % RN.length;
    qRef.current[i].push(d);
    setQueues(qRef.current.map((q) => [...q]));
  };
  const ringPts = (a: number, b: number) => {
    const p = [RP[a]];
    let i = a;
    while (i !== b) { i = (i + 1) % RN.length; p.push(RP[i]); }
    return p;
  };
  const loop = async () => {
    while (run.current) {
      const j = (pos.current + 1) % RN.length;
      setHolder(-1);
      await fly([RP[pos.current], RP[j]], { shape: "token", color: "#fbbf24", speed: 300 });
      if (!run.current) break;
      pos.current = j;
      setHolder(j);
      const q = qRef.current[j];
      if (q.length) {
        const dest = q.shift()!;
        setQueues(qRef.current.map((x) => [...x]));
        add(`${RN[j]} captures the token and transmits a frame to ${RN[dest]}.`, "info");
        await fly(ringPts(j, dest), { shape: "env", color: "#22d3ee", label: `${RN[j]}→${RN[dest]}`, speed: 300 });
        setMark({ [dest]: "COPIED" });
        add(`${RN[dest]} copies the frame as it passes.`, "ok");
        await fly(ringPts(dest, j), { shape: "env", color: "#34d399", label: "returns", speed: 300 });
        setMark({});
        add(`${RN[j]} removes its frame and releases a new token.`, "ok");
        setSent((x) => x + 1);
      } else await sleep(250);
    }
  };
  const start = () => { if (run.current) return; run.current = true; setRunning(true); loop(); };
  const stop = () => { run.current = false; setRunning(false); };
  const reset = () => { stop(); clear(); clr(); qRef.current = RN.map(() => []); setQueues(RN.map(() => [])); setHolder(-1); setMark({}); setSent(0); pos.current = 0; };

  return (
    <div className="space-y-4">
      <Card title="Token passing (controlled access)" icon="🪙">
        <p className="mb-3 text-sm text-slate-300">
          Only the station holding the <b>token</b> may transmit — so collisions are impossible. Click a station to queue a frame, then start the ring.
        </p>
        <Controls>
          {!running ? <Btn onClick={start}>▶ Circulate token</Btn> : <Btn variant="danger" onClick={stop}>⏸ Pause</Btn>}
          <Btn variant="ghost" onClick={reset}>↺ Reset</Btn>
          <span className="text-xs text-slate-400">Click a station to add a frame to its queue.</span>
        </Controls>
        <Stage w={800} h={390}>
          {RP.map((p, i) => <Link key={i} a={p} b={RP[(i + 1) % RN.length]} flow={running} color="#3b5278" />)}
          {RP.map((p, i) => (
            <Device
              key={i}
              type="pc"
              x={p.x}
              y={p.y}
              label={"Station " + RN[i]}
              sub={queues[i].length ? `queue: ${queues[i].length}` : undefined}
              glow={holder === i ? "#fbbf24" : undefined}
              tag={holder === i ? "HAS TOKEN" : mark[i]}
              tagColor={holder === i ? "#fbbf24" : "#34d399"}
              onClick={() => enqueue(i)}
            />
          ))}
          <text x={400} y={190} textAnchor="middle" fontSize={13} fontWeight={700} fill="#8aa0c4">Logical ring</text>
          <text x={400} y={208} textAnchor="middle" fontSize={11} fill="#64748b">frames delivered: {sent}</text>
          <PacketLayer packets={packets} />
        </Stage>
        <div className="mt-3"><LogPanel lines={lines} /></div>
      </Card>
      <Callout kind="key" title="Token Ring (IEEE 802.5):">
        a station waits for the token, transmits its frame, then releases the token. Predictable under load — but now largely obsolete, replaced by Ethernet.
      </Callout>
    </div>
  );
}

/* ------------------------------------------------------------- CSMA/CA */
function Csma() {
  const { packets, fly, clear } = usePackets();
  const { lines, add, clear: clr } = useLog();
  const [status, setStatus] = useState<Record<string, string>>({});
  const [marks, setMarks] = useState<Pt[]>([]);
  const [busy, setBusy] = useState(false);
  const AP = { x: 400, y: 175 }, A = { x: 110, y: 175 }, B = { x: 690, y: 175 };
  const set = (o: Record<string, string>) => setStatus((s) => ({ ...s, ...o }));
  const countdown = async (id: string, n: number) => {
    for (let k = n; k >= 0; k--) { set({ [id]: `backoff: ${k}` }); await sleep(450); }
  };

  const normal = async () => {
    add("STA-1 has a frame for the AP.", "info");
    set({ A: "sensing channel…" }); await sleep(800);
    add("Channel idle for DIFS → STA-1 picks a random backoff (4).", "info");
    await countdown("A", 4);
    set({ A: "TX DATA" });
    await fly([A, AP], { label: "DATA", color: "#22d3ee" });
    set({ A: "waiting for ACK", AP: "SIFS…" }); await sleep(450);
    await fly([AP, A], { label: "ACK", color: "#34d399" });
    set({ A: "ACK ✔", AP: "" });
    add("ACK received — transmission successful.", "ok");
  };
  const hidden = async () => {
    add("STA-1 and STA-2 are out of each other's range (hidden nodes).", "warn");
    set({ A: "sensing: idle", B: "sensing: idle" }); await sleep(900);
    add("Both sense an idle channel and pick the same backoff (3).", "info");
    await Promise.all([countdown("A", 3), countdown("B", 3)]);
    set({ A: "TX DATA", B: "TX DATA" });
    await Promise.all([fly([A, AP], { label: "DATA", color: "#22d3ee", speed: 150 }), fly([B, AP], { label: "DATA", color: "#fbbf24", speed: 150 })]);
    setMarks([AP]);
    add("Frames collide AT THE ACCESS POINT — neither station could hear the other.", "bad");
    set({ A: "no ACK → timeout", B: "no ACK → timeout", AP: "garbled" }); await sleep(1200);
    add("Retry with a larger contention window: STA-1 backoff 2, STA-2 backoff 4.", "warn");
    setMarks([]); set({ AP: "" });
    await countdown("A", 2);
    set({ A: "TX DATA", B: "backoff continues (can't hear A)" });
    const f1 = fly([A, AP], { label: "DATA", color: "#22d3ee", speed: 70 });
    await sleep(900);
    set({ B: "TX DATA" });
    const f2 = fly([B, AP], { label: "DATA", color: "#fbbf24", speed: 150 });
    await Promise.all([f1, f2]);
    setMarks([AP]);
    add("Collision again: the hidden-node problem persists without RTS/CTS.", "bad");
    set({ A: "timeout", B: "timeout" });
  };
  const withRts = async () => {
    add("Same hidden-node layout, now with RTS/CTS enabled.", "warn");
    set({ A: "sensing: idle", B: "sensing: idle" }); await sleep(800);
    await countdown("A", 2);
    set({ A: "TX RTS" });
    await fly([A, AP], { label: "RTS", color: "#a78bfa", speed: 300 });
    add("AP receives RTS and, after SIFS, broadcasts CTS.", "info");
    set({ AP: "SIFS → CTS", A: "waiting for CTS" }); await sleep(400);
    await Promise.all([fly([AP, A], { label: "CTS", color: "#a78bfa", speed: 300 }), fly([AP, B], { label: "CTS", color: "#a78bfa", speed: 300 })]);
    set({ B: "NAV set → defers 🔒", AP: "" });
    add("STA-2 hears the CTS and sets its NAV (virtual carrier sense): it stays silent.", "ok");
    set({ A: "TX DATA" });
    await fly([A, AP], { label: "DATA", color: "#22d3ee", speed: 150 });
    set({ AP: "SIFS…", A: "waiting for ACK" }); await sleep(400);
    await fly([AP, A], { label: "ACK", color: "#34d399" });
    set({ A: "ACK ✔", AP: "", B: "NAV expired → backoff" });
    add("Transmission complete without collision. STA-2 may now contend for the channel.", "ok");
    await sleep(600);
    await countdown("B", 1);
    set({ B: "TX RTS" });
    await fly([B, AP], { label: "RTS", color: "#a78bfa", speed: 300 });
    set({ B: "…" });
    add("STA-2's turn begins with its own RTS/CTS exchange.", "info");
  };
  const reset = () => { clear(); clr(); setStatus({}); setMarks([]); };
  const go = async (f: () => Promise<void>) => { if (busy) return; reset(); setBusy(true); await f(); setBusy(false); };

  return (
    <div className="space-y-4">
      <Card title="Wi-Fi: CSMA/CA, ACKs and RTS/CTS" icon="📡">
        <p className="mb-3 text-sm text-slate-300">
          Wi-Fi radios cannot reliably detect collisions while transmitting, so they <b>avoid</b> them: listen, wait, random backoff, send, and wait for an <b>ACK</b>.
        </p>
        <Controls>
          <Btn disabled={busy} onClick={() => go(normal)}>1 · Normal transmission</Btn>
          <Btn disabled={busy} variant="amber" onClick={() => go(hidden)}>2 · Hidden node problem</Btn>
          <Btn disabled={busy} variant="good" onClick={() => go(withRts)}>3 · Fixed with RTS/CTS</Btn>
        </Controls>
        <Stage w={800} h={330}>
          <circle {...A} r={330} fill="#22d3ee" fillOpacity={0.05} stroke="#22d3ee" strokeOpacity={0.35} strokeDasharray="6 6" />
          <circle {...B} r={330} fill="#fbbf24" fillOpacity={0.05} stroke="#fbbf24" strokeOpacity={0.35} strokeDasharray="6 6" />
          <text x={30} y={310} fontSize={11} fill="#22d3ee">STA-1 radio range</text>
          <text x={770} y={310} fontSize={11} fill="#fbbf24" textAnchor="end">STA-2 radio range</text>
          <Device type="laptop" {...A} label="STA-1" />
          <Device type="ap" {...AP} label="Access point" scale={1.2} />
          <Device type="laptop" {...B} label="STA-2" />
          {(["A", "AP", "B"] as const).map((k) => {
            const p = k === "A" ? A : k === "B" ? B : AP;
            return status[k] ? (
              <g key={k} transform={`translate(${p.x},${p.y - 62})`}>
                <rect x={-status[k].length * 3.3 - 8} y={-11} width={status[k].length * 6.6 + 16} height={22} rx={11} fill="#0b1527" stroke="#64748b" />
                <text y={4} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="#e2e8f0">{status[k]}</text>
              </g>
            ) : null;
          })}
          {marks.map((m, i) => (
            <g key={i} transform={`translate(${m.x},${m.y + 50})`}>
              <circle r={14} fill="#1b0b10" stroke="#ef4444" strokeWidth={2.5} />
              <path d="M-6 -6l12 12M6 -6l-12 12" stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />
            </g>
          ))}
          <text x={400} y={22} textAnchor="middle" fontSize={11} fill="#8aa0c4">STA-1 and STA-2 are both in range of the AP, but not of each other</text>
          <PacketLayer packets={packets} />
        </Stage>
        <div className="mt-3"><LogPanel lines={lines} /></div>
      </Card>
      <Card title="CSMA/CA vs CSMA/CD" icon="⚖️">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-400"><th className="py-2"></th><th>CSMA/CD</th><th>CSMA/CA</th></tr></thead>
            <tbody className="text-slate-200">
              {[
                ["Goal", "Detect collisions and recover", "Avoid collisions in the first place"],
                ["Medium", "Shared wired (half-duplex Ethernet)", "Wireless (Wi-Fi, IEEE 802.11)"],
                ["Mechanism", "Listen while sending → jam → backoff", "Listen → random backoff → send → ACK (optional RTS/CTS)"],
                ["Today", "Not used on switched full-duplex links", "Used in every Wi-Fi network"],
              ].map((r) => (
                <tr key={r[0]} className="border-t border-ink-600/50"><td className="py-2 font-semibold text-cyan-300">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------- Channelisation */
function Channel() {
  const [mode, setMode] = useState<"FDMA" | "TDMA" | "CDMA">("FDMA");
  const cols = ["#22d3ee", "#a78bfa", "#fbbf24", "#34d399"];
  const cells: JSX.Element[] = [];
  const W = 560, H = 220, nx = 8, ny = 4, cw = W / nx, ch = H / ny;
  for (let x = 0; x < nx; x++)
    for (let y = 0; y < ny; y++) {
      const user = mode === "FDMA" ? y : mode === "TDMA" ? x % 4 : -1;
      if (mode === "CDMA") {
        cells.push(
          <g key={x + "-" + y}>
            {cols.map((c, k) => <rect key={k} x={x * cw + 2 + k * 3} y={H - (y + 1) * ch + 2 + k * 3} width={cw - 4 - 6} height={ch - 4 - 6} rx={4} fill={c} opacity={0.35} />)}
          </g>
        );
      } else cells.push(<rect key={x + "-" + y} x={x * cw + 2} y={H - (y + 1) * ch + 2} width={cw - 4} height={ch - 4} rx={4} fill={cols[user]} opacity={0.85} />);
    }
  const desc = {
    FDMA: "The medium's bandwidth is split into separate frequency bands; each user owns one band all the time (like radio stations).",
    TDMA: "All users share the same frequency but take turns in repeating time slots.",
    CDMA: "All users transmit at the same time on the same frequency, separated by unique spreading codes.",
  }[mode];
  return (
    <div className="space-y-4">
      <Card title="Channelisation: sharing by frequency, time or code" icon="🌈">
        <Tabs tabs={[{ id: "FDMA", label: "FDMA" }, { id: "TDMA", label: "TDMA" }, { id: "CDMA", label: "CDMA" }]} value={mode} onChange={setMode} />
        <div className="grid gap-4 md:grid-cols-[auto_1fr]">
          <svg viewBox={`-34 -10 ${W + 44} ${H + 40}`} className="w-full max-w-[600px]">
            {cells}
            <path d={`M0 0V${H}H${W}`} stroke="#64748b" fill="none" />
            <text x={W / 2} y={H + 22} textAnchor="middle" fontSize={12} fill="#8aa0c4">Time →</text>
            <text transform={`translate(-18,${H / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="#8aa0c4">Frequency →</text>
          </svg>
          <div>
            <p className="text-slate-200">{desc}</p>
            <div className="mt-3 flex gap-2">{cols.map((c, i) => <span key={c} className="rounded-md px-2 py-1 text-xs font-bold text-ink-950" style={{ background: c }}>User {i + 1}</span>)}</div>
          </div>
        </div>
      </Card>
      <Card title="Three families of access methods" icon="🗂️">
        <div className="grid gap-3 md:grid-cols-3 text-sm">
          {[
            ["Contention-based", "Devices compete; collisions or interference may occur.", "CSMA/CD · CSMA/CA", "#fbbf24"],
            ["Controlled access", "A device receives permission or a turn before transmitting.", "Token passing · polling", "#22d3ee"],
            ["Channelisation", "The medium is divided by frequency, time or code.", "FDMA · TDMA · CDMA", "#a78bfa"],
          ].map(([t, d, e, c]) => (
            <div key={t} className="rounded-xl border p-3" style={{ borderColor: c + "66", background: c + "10" }}>
              <b style={{ color: c }}>{t}</b>
              <p className="mt-1 text-slate-300">{d}</p>
              <p className="mono mt-2 text-xs text-slate-400">{e}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default function Access() {
  const [tab, setTab] = useState<"cd" | "token" | "ca" | "chan">("cd");
  return (
    <div className="space-y-6">
      <ModuleHeader
        n={3}
        title="Access Methods & MAC Protocols"
        subtitle="When several devices share one medium, rules decide who transmits and when. These Medium Access Control (MAC) rules reduce or manage collisions, share capacity fairly and use the medium efficiently."
        outcomes={["Explain access techniques", "Role of MAC protocols", "CSMA/CD vs CSMA/CA"]}
      />
      <Card title="Medium Access Control (MAC)" icon="🧭">
        <div className="grid gap-3 md:grid-cols-2 text-sm text-slate-300">
          <ul className="space-y-1.5">
            <li>• MAC is a <b>sublayer of the data-link layer</b> in the IEEE 802 architecture (above it: LLC; below: physical).</li>
            <li>• It governs access to a shared medium and identifies devices at the local-link level.</li>
          </ul>
          <ul className="space-y-1.5">
            <li>• A <b>MAC address</b> is a link-layer address commonly assigned to a network interface.</li>
            <li>• MAC protocols define how frames are sent and how access conflicts are handled — e.g. Ethernet MAC, Wi-Fi MAC.</li>
          </ul>
        </div>
      </Card>
      <Tabs
        tabs={[{ id: "cd", label: "CSMA/CD", icon: "💥" }, { id: "token", label: "Token passing", icon: "🪙" }, { id: "ca", label: "CSMA/CA (Wi-Fi)", icon: "📡" }, { id: "chan", label: "Channelisation", icon: "🌈" }]}
        value={tab}
        onChange={setTab}
      />
      {tab === "cd" && <CsmaCD />}
      {tab === "token" && <Token />}
      {tab === "ca" && <Csma />}
      {tab === "chan" && <Channel />}
      <MiniQuiz
        q="Why does Wi-Fi use CSMA/CA instead of CSMA/CD?"
        options={["Wi-Fi cables are too long", "A radio cannot reliably detect collisions while transmitting, so it avoids them", "CSMA/CD is only for fibre", "Wi-Fi has no MAC layer"]}
        answer={1}
        why="Wireless stations can't listen while they transmit, so Wi-Fi uses listening, random backoff and acknowledgements (plus optional RTS/CTS) to reduce collisions."
      />
      <CompleteBar id="access" />
    </div>
  );
}
