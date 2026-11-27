import { useState } from "react";
import { Device, Link, PacketLayer, Stage, type DevType } from "../components/svg";
import { Btn, Callout, Card, CompleteBar, MiniQuiz, ModuleHeader, Pill } from "../components/ui";
import { usePackets } from "../lib/anim";
import { cn } from "../utils/cn";

const CHARS = [
  ["📍", "Limited area", "A room, lab, office, school building or small campus — much smaller than a WAN."],
  ["⚡", "High speed, low delay", "Typically 100 Mb/s to many Gb/s with very low latency."],
  ["🔑", "Privately owned", "Administered and controlled by one organisation or household."],
  ["🔌", "Wired + wireless", "Ethernet cabling and Wi-Fi are the two main access media."],
  ["🖨️", "Resource sharing", "Files, printers, applications, storage and Internet access."],
  ["📈", "Easy to expand", "Add switches, access points and end devices as the LAN grows."],
];

const DEVICES: { id: string; type: DevType; x: number; y: number; label: string; info: string; role: string }[] = [
  { id: "nic", type: "pc", x: 130, y: 70, label: "Desktop PC", role: "End device + NIC", info: "A Network Interface Card (NIC) connects the computer to the network and carries its unique MAC address." },
  { id: "sw", type: "switch", x: 400, y: 190, label: "Switch", role: "Layer 2 forwarding", info: "Connects devices in the LAN and forwards Ethernet frames to the correct port using MAC addresses." },
  { id: "srv", type: "server", x: 670, y: 70, label: "File server", role: "Shared resources", info: "Centralised storage, backups, applications and authentication — one of the key reasons for having a LAN." },
  { id: "prt", type: "printer", x: 130, y: 320, label: "Network printer", role: "Shared peripheral", info: "One printer shared by many users instead of one printer per computer." },
  { id: "ap", type: "ap", x: 400, y: 345, label: "Access point", role: "Wi-Fi bridge", info: "Provides wireless connectivity and bridges Wi-Fi clients onto the wired LAN." },
  { id: "rtr", type: "router", x: 670, y: 320, label: "Router", role: "LAN → Internet", info: "Connects different IP networks, e.g. this LAN to the Internet / WAN, and separates broadcast domains." },
];

const GAME: [string, "LAN" | "WAN", string][] = [
  ["Computers in one school laboratory", "LAN", "One room, one organisation."],
  ["A bank connecting branches in different countries", "WAN", "Large geographic area, leased/public links."],
  ["Home Wi-Fi shared by phones and a printer", "LAN", "Limited area, privately owned."],
  ["The public Internet", "WAN", "Global network of networks."],
  ["A university campus building network", "LAN", "Privately administered, high-speed local links."],
  ["A telecom provider's national backbone", "WAN", "Spans cities and regions."],
];

function Explorer() {
  const [sel, setSel] = useState("sw");
  const { packets, fly } = usePackets();
  const d = DEVICES.find((x) => x.id === sel)!;
  const sw = DEVICES[1];
  const ping = async () => {
    const t = DEVICES[0];
    await Promise.all([
      fly([t, sw, DEVICES[2]], { label: "file req", color: "#22d3ee" }),
      fly([DEVICES[4], sw, DEVICES[3]], { label: "print", color: "#f0abfc" }),
    ]);
    await fly([DEVICES[2], sw, DEVICES[5], { x: 790, y: 320 }], { label: "to Internet", color: "#a78bfa" });
  };
  return (
    <Card title="Anatomy of a LAN — click a device" icon="🔍">
      <Stage w={800} h={410}>
        {DEVICES.filter((x) => x.id !== "sw").map((x) => (
          <Link key={x.id} a={sw} b={x} dashed={x.id === "ap"} color={x.id === "ap" ? "#34d399" : undefined} />
        ))}
        <Link a={DEVICES[5]} b={{ x: 790, y: 320 }} dashed color="#7dd3fc" />
        <Device type="cloud" x={760} y={355} label="WAN / Internet" scale={0.9} labelDy={20} />
        {DEVICES.map((x) => (
          <Device key={x.id} {...x} glow={sel === x.id ? "#22d3ee" : undefined} onClick={() => setSel(x.id)} />
        ))}
        <rect x={20} y={20} width={760} height={375} rx={18} fill="none" stroke="#22d3ee" strokeOpacity={0.35} strokeDasharray="8 8" />
        <text x={36} y={42} fontSize={11} fill="#22d3ee" fontWeight={700}>LOCAL AREA NETWORK BOUNDARY</text>
        <PacketLayer packets={packets} />
      </Stage>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Btn onClick={ping}>▶ Show shared resources in use</Btn>
        <div className="min-w-[260px] flex-1 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3 text-sm">
          <b className="text-cyan-300">{d.label}</b> <Pill>{d.role}</Pill>
          <p className="mt-1 text-slate-300">{d.info}</p>
        </div>
      </div>
    </Card>
  );
}

function LanOrWan() {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [ans, setAns] = useState<null | "LAN" | "WAN">(null);
  const cur = GAME[i];
  const finished = i >= GAME.length;
  const pick = (a: "LAN" | "WAN") => {
    if (ans) return;
    setAns(a);
    if (a === cur[1]) setScore((s) => s + 1);
  };
  const next = () => {
    setAns(null);
    setI((v) => v + 1);
  };
  return (
    <Card title="Quick game: LAN or WAN?" icon="🎮">
      {finished ? (
        <div>
          <p className="text-lg font-bold text-white">
            Score: <span className="text-emerald-300">{score}</span> / {GAME.length}
          </p>
          <Btn className="mt-3" onClick={() => { setI(0); setScore(0); setAns(null); }}>Play again</Btn>
        </div>
      ) : (
        <div>
          <div className="mb-1 text-xs text-slate-400">Scenario {i + 1} of {GAME.length}</div>
          <p className="mb-3 text-lg font-semibold text-white">{cur[0]}</p>
          <div className="flex gap-3">
            {(["LAN", "WAN"] as const).map((o) => (
              <button
                key={o}
                onClick={() => pick(o)}
                className={cn(
                  "w-32 rounded-xl border-2 py-3 text-lg font-extrabold transition",
                  !ans && "border-ink-600 bg-ink-900 hover:border-cyan-400",
                  ans && o === cur[1] && "border-emerald-400 bg-emerald-400/15 text-emerald-200",
                  ans === o && o !== cur[1] && "border-rose-400 bg-rose-400/15 text-rose-200",
                  ans && o !== cur[1] && ans !== o && "border-ink-600 opacity-50"
                )}
              >
                {o}
              </button>
            ))}
          </div>
          {ans && (
            <div className="mt-3 flex items-center gap-3">
              <Callout kind={ans === cur[1] ? "good" : "bad"}>{cur[2]}</Callout>
              <Btn onClick={next}>Next →</Btn>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function LanBasics() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-6">
      <ModuleHeader
        n={1}
        title="What is a LAN?"
        subtitle="A Local Area Network connects computers and other devices within a limited geographical area — a room, laboratory, office, school building or small campus — so they can share files, printers, applications, storage and Internet access."
        outcomes={["Define a LAN", "Describe LAN characteristics", "Identify LAN components"]}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CHARS.map(([ic, t, d], i) => (
          <button
            key={t}
            onClick={() => setOpen(open === i ? null : i)}
            className={cn(
              "rounded-2xl border p-4 text-left transition",
              open === i ? "border-cyan-400 bg-cyan-400/10" : "border-ink-600/60 bg-ink-800/70 hover:border-cyan-400/50"
            )}
          >
            <div className="text-2xl">{ic}</div>
            <div className="mt-1 font-bold text-white">{t}</div>
            {open === i ? <p className="mt-1 text-sm text-slate-300">{d}</p> : <p className="mt-1 text-xs text-slate-500">Tap to expand</p>}
          </button>
        ))}
      </div>

      <Explorer />

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Benefits" icon="👍" accent="#34d399">
          <ul className="space-y-1.5 text-sm text-slate-300">
            <li>✔ Sharing printers, files, applications and Internet connections</li>
            <li>✔ Fast communication and collaboration between users</li>
            <li>✔ Centralised backups, security policies and administration</li>
          </ul>
        </Card>
        <Card title="Limitations" icon="⚠️" accent="#fb7185">
          <ul className="space-y-1.5 text-sm text-slate-300">
            <li>✖ Equipment, cabling and installation costs</li>
            <li>✖ Needs maintenance and appropriate security controls</li>
            <li>✖ A fault or attack on shared infrastructure may disrupt many users</li>
          </ul>
        </Card>
      </div>

      <Card title="LAN vs WAN at a glance" icon="⚖️">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="py-2">Feature</th><th>LAN</th><th>WAN</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              {[
                ["Coverage", "Room → small campus", "Cities, countries, global"],
                ["Speed / delay", "Usually high speed, low delay", "Often lower speed, higher delay"],
                ["Ownership", "Private, one organisation", "Often service providers / shared"],
                ["Media", "Ethernet cable, fibre, Wi-Fi", "Leased lines, fibre backbone, satellite"],
              ].map((r) => (
                <tr key={r[0]} className="border-t border-ink-600/50">
                  <td className="py-2 font-semibold text-cyan-300">{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <LanOrWan />

      <MiniQuiz
        q="Which of these is NOT a typical characteristic of a LAN?"
        options={["Limited geographic coverage", "Privately owned or administered", "Usually high data-transfer rates", "Spans several countries using leased lines"]}
        answer={3}
        why="Spanning countries over leased lines describes a WAN. LANs cover a limited area and are privately controlled."
      />
      <CompleteBar id="basics" />
    </div>
  );
}
