import { useMemo, useState } from "react";
import { Callout, Card, CompleteBar, MiniQuiz, ModuleHeader, Pill, Toggle } from "../components/ui";
import { cn } from "../utils/cn";

const crcTable = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
const crc32 = (bytes: number[]) => {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const hex = (n: number, w = 2) => n.toString(16).toUpperCase().padStart(w, "0");
const parseMac = (s: string) => {
  const p = s.trim().split(/[:\-.]/);
  if (p.length !== 6 || p.some((x) => !/^[0-9a-fA-F]{1,2}$/.test(x))) return null;
  return p.map((x) => parseInt(x, 16));
};

const FIELDS = [
  { k: "pre", name: "Preamble", size: "7 B", c: "#64748b", d: "Seven bytes of alternating 1s and 0s (10101010) that let the receiver's clock synchronise with the incoming bit stream." },
  { k: "sfd", name: "SFD", size: "1 B", c: "#94a3b8", d: "Start Frame Delimiter (10101011). Marks the end of the preamble: the next bit is the first bit of the destination address." },
  { k: "dst", name: "Destination MAC", size: "6 B", c: "#22d3ee", d: "Identifies the intended receiving interface. All-ones (FF:FF:FF:FF:FF:FF) means broadcast." },
  { k: "src", name: "Source MAC", size: "6 B", c: "#a78bfa", d: "Identifies the sending interface. Switches LEARN this address to build their MAC table." },
  { k: "typ", name: "Type / Length", size: "2 B", c: "#fbbf24", d: "Indicates the upper-layer protocol (e.g. 0x0800 = IPv4, 0x0806 = ARP, 0x86DD = IPv6) or the payload length." },
  { k: "dat", name: "Data + padding", size: "46–1500 B", c: "#34d399", d: "Carries the payload (e.g. an IP packet). Padding is added if the payload is shorter than 46 bytes so the frame meets the 64-byte minimum." },
  { k: "fcs", name: "FCS", size: "4 B", c: "#fb7185", d: "Frame Check Sequence: a CRC-32 over the header and data. The receiver recomputes it; a mismatch means the frame is corrupted and is discarded." },
];

function FrameLab() {
  const [dst, setDst] = useState("AA:BB:CC:DD:EE:02");
  const [src, setSrc] = useState("00:1A:2B:3C:4D:5E");
  const [msg, setMsg] = useState("Hello LAN!");
  const [sel, setSel] = useState("dst");
  const [corrupt, setCorrupt] = useState(false);

  const r = useMemo(() => {
    const d = parseMac(dst), s = parseMac(src);
    if (!d || !s) return null;
    const payload = Array.from(new TextEncoder().encode(msg)).slice(0, 1500);
    const padded = [...payload];
    while (padded.length < 46) padded.push(0);
    const type = [0x08, 0x00];
    const body = [...d, ...s, ...type, ...padded];
    const fcs = crc32(body);
    const rx = corrupt ? body.map((b, i) => (i === 20 ? b ^ 0x04 : b)) : body;
    const fcs2 = crc32(rx);
    return { d, s, payload, padded, body, fcs, size: body.length + 4, ok: fcs === fcs2, fcs2 };
  }, [dst, src, msg, corrupt]);

  const f = FIELDS.find((x) => x.k === sel)!;
  const val = (k: string) => {
    if (!r) return "—";
    switch (k) {
      case "pre": return "AA×7";
      case "sfd": return "AB";
      case "dst": return r.d.map((x) => hex(x)).join(":");
      case "src": return r.s.map((x) => hex(x)).join(":");
      case "typ": return "0800";
      case "dat": return `${r.payload.length} B + ${r.padded.length - r.payload.length} pad`;
      case "fcs": return hex(r.fcs, 8);
    }
  };

  return (
    <Card title="Ethernet frame lab (IEEE 802.3)" icon="🧱">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs font-semibold text-slate-300">Destination MAC<input type="text" className="mono mt-1 w-full" value={dst} onChange={(e) => setDst(e.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-300">Source MAC<input type="text" className="mono mt-1 w-full" value={src} onChange={(e) => setSrc(e.target.value)} /></label>
        <label className="text-xs font-semibold text-slate-300">Message (payload)<input type="text" className="mt-1 w-full" value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
      </div>
      {!r && <Callout kind="bad">Enter valid MAC addresses, e.g. 00:1A:2B:3C:4D:5E</Callout>}
      <div className="flex flex-wrap gap-1 overflow-x-auto">
        {FIELDS.map((x) => (
          <button
            key={x.k}
            onClick={() => setSel(x.k)}
            className={cn("min-w-[84px] flex-1 rounded-lg border-2 px-2 py-2.5 text-center transition", sel === x.k ? "scale-[1.03] shadow-lg" : "opacity-80 hover:opacity-100")}
            style={{ borderColor: x.c, background: x.c + (sel === x.k ? "33" : "14"), flexGrow: x.k === "dat" ? 3 : x.k === "dst" || x.k === "src" ? 1.6 : 1 }}
          >
            <div className="text-[11px] font-bold" style={{ color: x.c }}>{x.name}</div>
            <div className="mono mt-0.5 text-[11px] text-white">{val(x.k)}</div>
            <div className="text-[10px] text-slate-400">{x.size}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl border p-3 text-sm" style={{ borderColor: f.c + "88", background: f.c + "10" }}>
        <b style={{ color: f.c }}>{f.name}</b> — <span className="text-slate-200">{f.d}</span>
      </div>
      {r && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-ink-950 p-3">
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Frame size (without preamble/SFD)</div>
            <div className="mono text-2xl font-bold text-cyan-300">{r.size} bytes</div>
            <div className="text-xs text-slate-400">Minimum 64, maximum 1518 (standard frame){r.padded.length > r.payload.length ? " · padding added" : ""}</div>
          </div>
          <div className="rounded-xl bg-ink-950 p-3">
            <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
              <span>FCS check at the receiver</span>
              <Toggle on={corrupt} onChange={setCorrupt} label="Flip a bit in transit" />
            </div>
            <div className="mono text-sm text-slate-300">sent FCS = {hex(r.fcs, 8)} · computed = {hex(r.fcs2, 8)}</div>
            <div className={cn("mt-1 font-bold", r.ok ? "text-emerald-300" : "text-rose-300")}>{r.ok ? "✔ CRC matches — frame accepted" : "✖ CRC mismatch — frame discarded"}</div>
          </div>
        </div>
      )}
      {r && (
        <div className="mono mt-3 break-all rounded-xl bg-ink-950 p-3 text-xs leading-relaxed text-slate-300">
          <span className="text-slate-500">hex dump → </span>
          <span className="text-cyan-300">{r.d.map((x) => hex(x)).join(" ")}</span>{" "}
          <span className="text-violet-300">{r.s.map((x) => hex(x)).join(" ")}</span> <span className="text-amber-300">08 00</span>{" "}
          <span className="text-emerald-300">{r.padded.map((x) => hex(x)).join(" ")}</span> <span className="text-rose-300">{hex(r.fcs, 8).match(/../g)!.join(" ")}</span>
        </div>
      )}
    </Card>
  );
}

function MacAnatomy() {
  const [mac, setMac] = useState("00:1A:2B:3C:4D:5E");
  const p = parseMac(mac);
  const first = p ? p[0] : 0;
  const bits = first.toString(2).padStart(8, "0").split("");
  const bcast = p?.every((b) => b === 255);
  return (
    <Card title="Anatomy of a MAC address" icon="🏷️">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input type="text" className="mono w-64" value={mac} onChange={(e) => setMac(e.target.value)} />
        {["00:1A:2B:3C:4D:5E", "FF:FF:FF:FF:FF:FF", "01:00:5E:00:00:01", "02:42:AC:11:00:02"].map((m) => (
          <button key={m} className="mono rounded-md bg-ink-700 px-2 py-1 text-[11px] hover:bg-ink-600" onClick={() => setMac(m)}>{m}</button>
        ))}
      </div>
      {!p ? <Callout kind="bad">Invalid MAC address — use six hex octets.</Callout> : (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="flex gap-1.5">
              {p.map((b, i) => (
                <div key={i} className={cn("mono rounded-lg px-2.5 py-2 text-center text-lg font-bold", i < 3 ? "bg-violet-400/20 text-violet-200" : "bg-cyan-400/20 text-cyan-200")}>{hex(b)}</div>
              ))}
            </div>
            <div className="mt-2 flex text-[11px] font-semibold"><span className="w-1/2 text-violet-300">← OUI (vendor, 24 bits)</span><span className="w-1/2 text-right text-cyan-300">NIC-specific (24 bits) →</span></div>
            <div className="mt-4 text-xs font-semibold text-slate-400">First octet in binary:</div>
            <div className="mt-1 flex gap-1">
              {bits.map((b, i) => {
                const idx = 7 - i;
                return (
                  <div key={i} className={cn("mono w-9 rounded-md py-1.5 text-center font-bold", idx === 0 ? "bg-amber-400/30 text-amber-200" : idx === 1 ? "bg-emerald-400/30 text-emerald-200" : "bg-ink-700 text-slate-300")}>{b}</div>
                );
              })}
            </div>
            <div className="mt-1 flex gap-1 text-[10px] text-slate-500">{bits.map((_, i) => <div key={i} className="w-9 text-center">b{7 - i}</div>)}</div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="rounded-lg bg-ink-900 p-2.5"><Pill color="#fbbf24">b0 = {bits[7]}</Pill> <span className="text-slate-300">{bcast ? "Broadcast address: delivered to every device in the VLAN." : bits[7] === "0" ? "Individual (unicast) address — one NIC." : "Group (multicast) address — a set of NICs."}</span></div>
            <div className="rounded-lg bg-ink-900 p-2.5"><Pill color="#34d399">b1 = {bits[6]}</Pill> <span className="text-slate-300">{bits[6] === "0" ? "Universally administered — burned in by the manufacturer (OUI is meaningful)." : "Locally administered — set by software / admin / virtualisation."}</span></div>
            <div className="rounded-lg bg-ink-900 p-2.5 text-slate-300">48 bits = 6 octets, written as 12 hex digits.</div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Speeds() {
  const [size, setSize] = useState(1);
  const sp = [["10 Mb/s", 1e7, "Ethernet (10BASE-T)"], ["100 Mb/s", 1e8, "Fast Ethernet"], ["1 Gb/s", 1e9, "Gigabit Ethernet"], ["10 Gb/s", 1e10, "10 Gigabit"], ["100 Gb/s", 1e11, "Data-centre links"]] as const;
  const fmt = (s: number) => (s >= 3600 ? (s / 3600).toFixed(1) + " h" : s >= 60 ? (s / 60).toFixed(1) + " min" : s >= 1 ? s.toFixed(1) + " s" : (s * 1000).toFixed(0) + " ms");
  return (
    <Card title="Why speed matters: ideal file-transfer time" icon="⏱️">
      <div className="mb-3 flex items-center gap-3 text-sm">
        <span className="text-slate-300">File size:</span>
        {[0.1, 1, 10].map((s) => (
          <button key={s} onClick={() => setSize(s)} className={cn("rounded-lg px-3 py-1.5 font-semibold", size === s ? "bg-cyan-400 text-ink-950" : "bg-ink-700")}>{s} GB</button>
        ))}
      </div>
      <div className="space-y-2">
        {sp.map(([n, bps, d]) => {
          const t = (size * 8e9) / bps;
          const w = Math.max(2, (Math.log10(t * 1000) / Math.log10(8e10 * 1000 / 1e7)) * 100);
          return (
            <div key={n} className="flex items-center gap-3 text-sm">
              <div className="w-24 font-bold text-white">{n}</div>
              <div className="h-5 flex-1 overflow-hidden rounded-full bg-ink-700"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all" style={{ width: Math.min(100, w) + "%" }} /></div>
              <div className="mono w-24 text-right text-cyan-300">{fmt(t)}</div>
              <div className="hidden w-40 text-xs text-slate-400 md:block">{d}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-slate-400">Ideal figures — real throughput is lower because of headers, congestion and device limits.</p>
    </Card>
  );
}

function Selector() {
  const [mob, setMob] = useState(true);
  const [cable, setCable] = useState(false);
  const [perf, setPerf] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const rec: { t: string; why: string; c: string }[] = [];
  if (perf) rec.push({ t: "Switched Ethernet (802.3)", why: "Dedicated full-duplex link per port, lowest latency, no radio interference — ideal for desktops, servers and printers.", c: "#22d3ee" });
  if (mob || cable) rec.push({ t: "WLAN / Wi-Fi (802.11)", why: cable ? "Cabling is difficult, so use access points." : "Supports mobility for laptops and phones.", c: "#34d399" });
  if (legacy) rec.push({ t: "Token Ring (802.5) — study only", why: "Predictable token access, but obsolete. Mention it for history; deploy Ethernet instead.", c: "#fbbf24" });
  if (!rec.length) rec.push({ t: "Switched Ethernet", why: "The default choice for fixed devices.", c: "#22d3ee" });
  if (mob && perf) rec.push({ t: "Hybrid design ★", why: "Switched Ethernet for fixed devices + Wi-Fi for mobile users — the practical, common design.", c: "#a78bfa" });
  return (
    <Card title="Technology selector" icon="🎯">
      <div className="mb-3 flex flex-wrap gap-5">
        <Toggle on={mob} onChange={setMob} label="Users are mobile" />
        <Toggle on={cable} onChange={setCable} label="Cabling is difficult" />
        <Toggle on={perf} onChange={setPerf} label="Fixed endpoints need top performance" />
        <Toggle on={legacy} onChange={setLegacy} label="Studying legacy ring tech" />
      </div>
      <div className="grid gap-2">
        {rec.map((r) => (
          <div key={r.t} className="rounded-xl border p-3" style={{ borderColor: r.c + "77", background: r.c + "12" }}>
            <b style={{ color: r.c }}>{r.t}</b>
            <p className="text-sm text-slate-300">{r.why}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Ethernet() {
  return (
    <div className="space-y-6">
      <ModuleHeader
        n={4}
        title="Ethernet, Token Ring & WLAN"
        subtitle="Ethernet (IEEE 802.3) is the most widely deployed wired LAN technology. Inspect its frame, understand MAC addresses, and compare it with Token Ring and Wi-Fi."
        outcomes={["Describe Ethernet", "Read a frame", "Compare LAN technologies"]}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          ["Ethernet · IEEE 802.3", "Wired, twisted-pair or fibre. Switches forward frames by MAC address. Modern links are full-duplex from 10 Mb/s to 100 Gb/s+.", "#22d3ee"],
          ["Token Ring · IEEE 802.5", "Logical ring with token passing. Predictable under load, no collisions — but now largely obsolete.", "#fbbf24"],
          ["WLAN · IEEE 802.11", "Wireless Wi-Fi via access points. Mobility and flexible installation; affected by interference and shared airtime.", "#34d399"],
        ].map(([t, d, c]) => (
          <div key={t} className="rounded-2xl border p-4" style={{ borderColor: c + "66", background: c + "10" }}>
            <div className="font-bold" style={{ color: c }}>{t}</div>
            <p className="mt-1 text-sm text-slate-300">{d}</p>
          </div>
        ))}
      </div>

      <Card title="Ethernet building blocks" icon="🧰">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          {[
            ["NIC", "Connects a computer to the network; holds the MAC address."],
            ["Switch", "Forwards Ethernet frames to the appropriate port."],
            ["Twisted-pair copper", "Common for short building connections (up to ~100 m)."],
            ["Fibre-optic", "Longer distances and high-capacity links."],
            ["Router", "Connects different IP networks, e.g. LAN → Internet."],
            ["Patch panel & structured cabling", "Organise permanent building cabling."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl bg-ink-900 p-3"><b className="text-cyan-300">{t}</b><p className="mt-0.5 text-slate-300">{d}</p></div>
          ))}
        </div>
      </Card>

      <FrameLab />
      <MacAnatomy />
      <Speeds />

      <Card title="Comparing LAN technologies" icon="📋">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-400"><th className="py-2"></th><th>Ethernet</th><th>Token Ring</th><th>WLAN / Wi-Fi</th></tr></thead>
            <tbody className="text-slate-200">
              {[
                ["Standard", "IEEE 802.3", "IEEE 802.5", "IEEE 802.11"],
                ["Medium", "Copper / fibre", "Shielded/unshielded twisted pair", "Radio"],
                ["Access method", "Full-duplex switching (CSMA/CD on legacy shared)", "Token passing", "CSMA/CA"],
                ["Strength", "High performance, widespread", "Predictable access", "Mobility, no cabling"],
                ["Weakness", "Needs cabling", "Obsolete", "Interference, shared airtime"],
                ["Best for", "Fixed high-performance endpoints", "Historical study", "Mobile devices / hard-to-cable sites"],
              ].map((r) => (
                <tr key={r[0]} className="border-t border-ink-600/50"><td className="py-2 font-semibold text-cyan-300">{r[0]}</td>{r.slice(1).map((c) => <td key={c} className="pr-3">{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Selector />
      <MiniQuiz
        q="What does the Frame Check Sequence (FCS) do?"
        options={["Identifies the destination", "Detects transmission errors using a CRC", "Synchronises the receiver clock", "Encrypts the payload"]}
        answer={1}
        why="The FCS is a CRC-32 over the frame. If the receiver's computed value differs from the received FCS, the frame is discarded."
      />
      <CompleteBar id="ethernet" />
    </div>
  );
}
