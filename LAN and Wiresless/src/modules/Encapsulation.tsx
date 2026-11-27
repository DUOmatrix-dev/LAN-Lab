import { useEffect, useState } from "react";
import { Btn, Callout, Card, CompleteBar, Controls, MiniQuiz, ModuleHeader } from "../components/ui";
import { cn } from "../utils/cn";

const SEG = {
  data: { n: "DATA", c: "#34d399" },
  tcp: { n: "TCP hdr", c: "#fbbf24" },
  ip: { n: "IP hdr", c: "#a78bfa" },
  eth: { n: "ETH hdr", c: "#22d3ee" },
  fcs: { n: "FCS", c: "#fb7185" },
};
type K = keyof typeof SEG;

const LAYERS: { name: string; pdu: string; who: string; kinds: K[]; note: string }[] = [
  { name: "Application", pdu: "Data / message", who: "HTTP, DNS, email…", kinds: ["data"], note: "The application creates the message — e.g. a web request." },
  { name: "Transport", pdu: "Segment", who: "TCP / UDP", kinds: ["tcp", "data"], note: "TCP adds source & destination ports, sequence numbers and flags (20 bytes)." },
  { name: "Network", pdu: "Packet", who: "IP", kinds: ["ip", "tcp", "data"], note: "IP adds source & destination IP addresses and TTL (20 bytes) for end-to-end delivery." },
  { name: "Data link", pdu: "Frame", who: "Ethernet / Wi-Fi", kinds: ["eth", "ip", "tcp", "data"], note: "Ethernet adds a header with destination & source MAC addresses (14 bytes) and a trailer with the FCS (4 bytes) for hop-by-hop delivery." },
  { name: "Physical", pdu: "Bits", who: "Cable / radio", kinds: [], note: "The frame is converted to electrical, optical or radio signals on the medium." },
];

const STEPS = [
  "Sender · The application creates the data.",
  "Sender · Transport layer wraps the data in a TCP header → SEGMENT.",
  "Sender · Network layer adds an IP header → PACKET.",
  "Sender · Data-link layer adds an Ethernet header and FCS trailer → FRAME.",
  "Sender · Physical layer turns the frame into BITS / signals.",
  "Medium · Signals travel across the LAN to the receiver.",
  "Receiver · Physical layer reassembles BITS into a FRAME.",
  "Receiver · Data link checks the FCS & destination MAC, removes header + trailer → PACKET.",
  "Receiver · Network layer checks the IP address, removes the IP header → SEGMENT.",
  "Receiver · Transport layer removes the TCP header and hands DATA to the application. ✔",
];

function Row({ idx, step, msg }: { idx: number; step: number; msg: string }) {
  const L = LAYERS[idx];
  const show = step >= idx;
  const active = step === idx;
  const bits = idx === 4;
  const kinds = L.kinds;
  const bin = "01000101 00000000 01001000 01000101 01001100 01001100".replace(/ /g, "");
  return (
    <div className={cn("rounded-xl border p-2.5 transition-all duration-500", show ? "opacity-100" : "opacity-15", active ? "border-cyan-400 bg-cyan-400/10 shadow-lg shadow-cyan-500/10" : "border-ink-600/60 bg-ink-900")}>
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
        <span className="text-slate-300">{L.name}</span>
        <span className="text-cyan-300">{L.pdu}</span>
      </div>
      {bits ? (
        <svg viewBox="0 0 240 34" className="h-8 w-full">
          <path d={bin.slice(0, 40).split("").map((b, i) => `${i === 0 ? "M" : "L"}${i * 6} ${b === "1" ? 6 : 28} L${(i + 1) * 6} ${b === "1" ? 6 : 28}`).join(" ")} fill="none" stroke="#22d3ee" strokeWidth={1.8} />
        </svg>
      ) : (
        <div className="flex gap-1">
          {kinds.map((k) => (
            <div key={k} className="rounded-md px-1.5 py-1.5 text-center text-[11px] font-bold text-ink-950 transition-all" style={{ background: SEG[k].c, flex: k === "data" ? 2 : 1, animation: active ? "fade-up .4s both" : undefined }}>
              {k === "data" ? (msg.length > 14 ? msg.slice(0, 13) + "…" : msg) || "DATA" : SEG[k].n}
            </div>
          ))}
          {kinds.includes("eth") && <div className="rounded-md px-1.5 py-1.5 text-center text-[11px] font-bold text-ink-950" style={{ background: SEG.fcs.c }}>FCS</div>}
        </div>
      )}
    </div>
  );
}

export default function Encapsulation() {
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);
  const [msg, setMsg] = useState("GET /index.html");

  useEffect(() => {
    if (!auto) return;
    const id = setInterval(() => setStep((s) => { if (s >= 9) { setAuto(false); return s; } return s + 1; }), 1500);
    return () => clearInterval(id);
  }, [auto]);

  const len = new TextEncoder().encode(msg).length;
  const sizes: [string, number, string][] = [["Data", len, SEG.data.c], ["+ TCP header", 20, SEG.tcp.c], ["+ IP header", 20, SEG.ip.c], ["+ Ethernet header", 14, SEG.eth.c], ["+ FCS", 4, SEG.fcs.c]];
  const total = sizes.reduce((a, b) => a + b[1], 0);

  return (
    <div className="space-y-6">
      <ModuleHeader
        n={9}
        title="Layered Models & Encapsulation"
        subtitle="As data moves down the stack each layer wraps it with its own control information (encapsulation). The receiver unwraps it layer by layer (decapsulation)."
        outcomes={["Encapsulation", "Decapsulation", "PDU names"]}
      />
      <Card>
        <Controls>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">Message<input type="text" className="w-56" value={msg} maxLength={40} onChange={(e) => setMsg(e.target.value)} /></label>
          <Btn variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>← Back</Btn>
          <Btn disabled={step >= 9} onClick={() => setStep((s) => s + 1)}>Next step →</Btn>
          <Btn variant="amber" onClick={() => { setStep(0); setAuto(true); }}>▶ Auto-play</Btn>
          <Btn variant="ghost" onClick={() => { setStep(0); setAuto(false); }}>↺ Reset</Btn>
        </Controls>
        <div className="mb-3 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-50">
          <span className="mr-2 rounded-md bg-cyan-400 px-2 py-0.5 text-xs font-bold text-ink-950">Step {step + 1}/10</span>{STEPS[step]}
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
          <div>
            <div className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-emerald-300">💻 Sender — encapsulation ↓</div>
            <div className="space-y-2">{LAYERS.map((_, i) => <Row key={i} idx={i} step={step} msg={msg} />)}</div>
          </div>
          <div className="flex w-14 flex-col items-center justify-end pb-4">
            <div className={cn("h-1.5 w-full rounded-full transition-all", step === 5 ? "flow-dash bg-cyan-400" : step > 5 ? "bg-cyan-400/40" : "bg-ink-600")} style={step === 5 ? { backgroundImage: "repeating-linear-gradient(90deg,#22d3ee 0 8px,transparent 8px 16px)" } : undefined} />
            <span className="mt-1 text-[10px] text-slate-500">medium</span>
          </div>
          <div>
            <div className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-violet-300">🖥️ Receiver — decapsulation ↑</div>
            <div className="space-y-2">
              {LAYERS.map((_, i) => <RxRow key={i} idx={i} step={step} msg={msg} />)}
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">Each lower layer adds its own control information. At each receiving layer, the corresponding header (and link trailer) is examined and removed.</p>
      </Card>

      <Card title={`Frame size for "${msg}"`} icon="📏">
        <div className="flex h-9 overflow-hidden rounded-lg text-[11px] font-bold text-ink-950">
          {sizes.map(([n, s, c]) => <div key={n} className="flex items-center justify-center whitespace-nowrap px-1" style={{ background: c, flex: Math.max(s, 6) }}>{n}: {s} B</div>)}
        </div>
        <p className="mt-2 text-sm text-slate-300">Overhead: <b className="text-amber-300">{total - len} bytes</b> of headers/trailer around <b className="text-emerald-300">{len} bytes</b> of data = <b className="mono text-cyan-300">{total} bytes</b> (Ethernet pads the payload to 46 bytes minimum).</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Protocol Data Units" icon="📦">
          <div className="grid grid-cols-5 gap-1 text-center text-xs font-bold">
            {["DATA", "SEGMENT", "PACKET", "FRAME", "BITS"].map((p, i) => <div key={p} className="rounded-lg bg-ink-900 p-2 text-cyan-300">{p}<div className="mt-1 font-normal text-slate-400">{["App", "Trans.", "Net", "Link", "Phys"][i]}</div></div>)}
          </div>
          <p className="mt-3 text-sm text-slate-300">Sender: DATA ↓ SEGMENT ↓ PACKET ↓ FRAME ↓ BITS. Receiver: BITS ↓ FRAME ↓ PACKET ↓ SEGMENT ↓ DATA.</p>
        </Card>
        <Card title="Where does the switch work?" icon="🎯">
          <p className="text-sm text-slate-300">A Layer 2 switch reads only the <b className="text-cyan-300">Ethernet header</b> (MAC addresses) and FCS — it does not look inside at IP or TCP. A router strips the Ethernet header, reads the <b className="text-violet-300">IP header</b>, then builds a new frame for the next link.</p>
        </Card>
      </div>
      <Callout kind="key">MAC addresses change at every hop; IP addresses stay the same end to end.</Callout>
      <MiniQuiz
        q="What is the PDU name at the data-link layer?"
        options={["Segment", "Packet", "Frame", "Bits"]}
        answer={2}
        why="Data-link PDUs are frames: an Ethernet header + packet + trailer (FCS)."
      />
      <CompleteBar id="encap" />
    </div>
  );
}

/** Receiver row: as it climbs, headers disappear */
function RxRow({ idx, step, msg }: { idx: number; step: number; msg: string }) {
  const L = LAYERS[idx];
  const rxStep = [9, 8, 7, 6, 5][idx];
  const show = step >= rxStep;
  const active = step === rxStep;
  const bits = idx === 4;
  const bin = "01000101000000000100100001000101";
  return (
    <div className={cn("rounded-xl border p-2.5 transition-all duration-500", show ? "opacity-100" : "opacity-15", active ? "border-violet-400 bg-violet-400/10 shadow-lg shadow-violet-500/10" : "border-ink-600/60 bg-ink-900")}>
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
        <span className="text-slate-300">{L.name}</span>
        <span className="text-violet-300">{L.pdu}</span>
      </div>
      {bits ? (
        <svg viewBox="0 0 192 34" className="h-8 w-full">
          <path d={bin.split("").map((b, i) => `${i === 0 ? "M" : "L"}${i * 6} ${b === "1" ? 6 : 28} L${(i + 1) * 6} ${b === "1" ? 6 : 28}`).join(" ")} fill="none" stroke="#a78bfa" strokeWidth={1.8} />
        </svg>
      ) : (
        <div className="flex gap-1">
          {L.kinds.map((k) => (
            <div key={k} className="rounded-md px-1.5 py-1.5 text-center text-[11px] font-bold text-ink-950" style={{ background: SEG[k].c, flex: k === "data" ? 2 : 1 }}>
              {k === "data" ? (msg.length > 14 ? msg.slice(0, 13) + "…" : msg) || "DATA" : SEG[k].n}
            </div>
          ))}
          {L.kinds.includes("eth") && <div className="rounded-md px-1.5 py-1.5 text-center text-[11px] font-bold text-ink-950" style={{ background: SEG.fcs.c }}>FCS</div>}
        </div>
      )}
      {active && idx < 4 && idx !== 3 && <div className="mt-1 text-[10px] font-semibold text-violet-300">✂ header removed at previous layer</div>}
      {active && idx === 3 && <div className="mt-1 text-[10px] font-semibold text-violet-300">✔ FCS verified</div>}
    </div>
  );
}
