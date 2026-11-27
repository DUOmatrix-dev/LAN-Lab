import { useMemo, useState } from "react";
import { Btn, Callout, Card, CompleteBar, ModuleHeader, Tabs, useProgress } from "../components/ui";
import { TERMS } from "../lib/terms";
import { cn } from "../utils/cn";

interface Q { q: string; o: string[]; a: number; why: string }
const BANK: Q[] = [
  { q: "Which address does a Layer 2 switch learn from an incoming frame?", o: ["Destination IP", "Source MAC", "Destination port", "DNS name"], a: 1, why: "A switch learns from the SOURCE MAC address, recording it against the incoming port and VLAN." },
  { q: "Which standard adds VLAN tags to Ethernet frames?", o: ["802.11", "802.1Q", "802.3af", "802.15"], a: 1, why: "IEEE 802.1Q inserts a tag containing a 12-bit VLAN ID on trunk links." },
  { q: "What is the main purpose of STP?", o: ["Encrypt frames", "Assign IP addresses", "Prevent Layer 2 loops", "Increase Wi-Fi range"], a: 2, why: "Spanning Tree blocks redundant ports to keep the Layer 2 topology loop-free." },
  { q: "Which device bridges wireless clients to a wired LAN?", o: ["Hub", "Access point", "Modem", "Repeater"], a: 1, why: "An access point bridges 802.11 clients onto the wired Ethernet LAN." },
  { q: "What does SSID identify?", o: ["Wireless network name", "MAC table", "IP subnet", "Encryption key"], a: 0, why: "The SSID is the name users see when selecting Wi-Fi. It is not a password." },
  { q: "For n devices, a full mesh requires how many links?", o: ["n", "n − 1", "n(n − 1) / 2", "2n"], a: 2, why: "Each of n devices links to n − 1 others, and each link is counted twice → n(n − 1)/2." },
  { q: "Which topology has a single shared backbone cable terminated at both ends?", o: ["Star", "Ring", "Bus", "Mesh"], a: 2, why: "Traditional bus networks share one backbone with terminators to reduce signal reflection." },
  { q: "Why is CSMA/CD not normally used on modern switched Ethernet?", o: ["Frames are too small", "Links are full-duplex with dedicated paths, so there is no shared medium to collide on", "Switches cannot detect errors", "Fibre does not allow it"], a: 1, why: "Each switch port is its own collision domain operating full-duplex; collisions do not occur." },
  { q: "Wi-Fi uses which access method?", o: ["CSMA/CD", "Token passing", "CSMA/CA", "TDMA only"], a: 2, why: "Wi-Fi listens, backs off randomly, transmits and waits for ACKs — collision avoidance." },
  { q: "A switch receives a frame with an unknown destination MAC. It will…", o: ["Drop it", "Flood it out all ports except the incoming one", "Send it back", "Broadcast to the router only"], a: 1, why: "Unknown unicast is flooded within the VLAN until the destination replies and is learned." },
  { q: "In IEEE 802 the MAC is a sublayer of which layer?", o: ["Physical", "Data link", "Network", "Transport"], a: 1, why: "MAC (with LLC) makes up the data-link layer in the IEEE 802 architecture." },
  { q: "Which PDU name belongs to the data-link layer?", o: ["Segment", "Packet", "Frame", "Datagram"], a: 2, why: "The data-link PDU is the frame (Ethernet header + packet + FCS)." },
  { q: "A PC in VLAN 10 must reach a PC in VLAN 20. What is required?", o: ["A hub", "A router or Layer 3 switch", "A longer cable", "Nothing"], a: 1, why: "Different VLANs are different subnets and broadcast domains — routing is needed." },
  { q: "Which security option should you prefer for a modern home/office Wi-Fi?", o: ["WEP", "WPA (TKIP)", "WPA3 (or WPA2-AES)", "Open network with hidden SSID"], a: 2, why: "Use WPA3 where supported, otherwise WPA2 with AES. WEP is obsolete; hiding the SSID is not security." },
  { q: "Which device is the root bridge in STP?", o: ["Highest MAC address", "Lowest Bridge ID", "Most ports", "The router"], a: 1, why: "Lowest Bridge ID = lowest priority value, with MAC as tie-breaker." },
  { q: "What does a trunk port carry?", o: ["One VLAN only", "Multiple VLANs using tags", "Only management traffic", "Wi-Fi signals"], a: 1, why: "Trunks carry several VLANs over one link, with 802.1Q tags identifying membership." },
  { q: "A hub differs from a switch because a hub…", o: ["Repeats signals to all ports", "Builds a MAC table", "Supports VLANs", "Has separate collision domains"], a: 0, why: "A hub is a Layer 1 repeater with a single shared collision domain." },
  { q: "Which are the only non-overlapping 2.4 GHz channels (in most regions)?", o: ["1, 2, 3", "1, 6, 11", "2, 7, 12", "3, 8, 13"], a: 1, why: "Channels are 5 MHz apart but ~20 MHz wide, so 1, 6 and 11 avoid overlap." },
  { q: "What makes token passing different from CSMA/CD?", o: ["It is contention-based", "Only the token holder may transmit, so collisions are avoided", "It requires a hub", "It is used by Wi-Fi"], a: 1, why: "Token passing is controlled access — permission to transmit is granted by a token." },
];

const REVIEW: [string, string][] = [
  ["What is a LAN? State four characteristics.", "A Local Area Network connects devices in a limited area (room → small campus). Characteristics: limited coverage, high data rates / low delay, private ownership & administration, wired Ethernet and/or Wi-Fi, resource sharing, easy expansion."],
  ["Differentiate physical topology from logical topology.", "Physical = actual layout of cables and devices. Logical = how data flows between devices. A hub-based star is physically a star but logically a bus."],
  ["Explain one advantage and one disadvantage of bus, star, ring and mesh.", "Bus: cheap/simple — backbone failure stops all. Star: easy to manage — central switch is a single point of failure. Ring: orderly token access — a break can disrupt a single ring. Mesh: resilient — costly and complex."],
  ["What is the purpose of a MAC protocol?", "To decide who may transmit and when on a shared medium, managing collisions, sharing capacity fairly and using the medium efficiently."],
  ["Differentiate CSMA/CD from CSMA/CA.", "CSMA/CD detects collisions while transmitting (shared wired Ethernet) and retransmits after backoff. CSMA/CA avoids collisions with listening, random backoff and ACKs (Wi-Fi)."],
  ["Why is CSMA/CD not normally used on modern full-duplex switched Ethernet?", "Each port has a dedicated full-duplex link, so there is no shared medium and no collisions."],
  ["Compare Ethernet, Token Ring and WLAN.", "Ethernet (802.3): wired, fast, switched, ubiquitous. Token Ring (802.5): token passing, predictable, obsolete. WLAN (802.11): wireless, mobile, affected by interference and shared airtime."],
  ["What information does a switch use to build its forwarding database?", "The source MAC address of each incoming frame, with the incoming port and VLAN."],
  ["Why does a switch flood an unknown unicast frame?", "It does not yet know which port leads to the destination, so it sends the frame out of all other ports in the VLAN; the destination's reply teaches the switch its location."],
  ["How does a VLAN differ from a physical LAN?", "A VLAN is a logical Layer 2 broadcast domain created in software on shared physical switches; a physical LAN is defined by the cabling/hardware."],
  ["What is the difference between an access port and a trunk port?", "An access port carries one VLAN (usually untagged) to an end device; a trunk carries multiple VLANs with 802.1Q tags between network devices."],
  ["Why can redundant switch links create a broadcast storm?", "Ethernet frames have no TTL, so a broadcast can circulate forever around a loop, multiplying and consuming bandwidth."],
  ["What does the STP root bridge do?", "It is the reference point of the loop-free tree; all other switches calculate their lowest-cost path to it and ports are assigned roles accordingly."],
  ["How does an AP connect wireless users to a wired network?", "It bridges 802.11 frames from wireless clients onto the Ethernet LAN (usually via a switch)."],
  ["Name two ways to improve WLAN security.", "Use WPA3 / WPA2-AES with strong passphrases (or 802.1X), update firmware, separate guest access, change default admin credentials, monitor the network."],
];

function QuizTab() {
  const { setBest } = useProgress();
  const [seed, setSeed] = useState(0);
  const qs = useMemo(() => {
    const a = [...BANK];
    let s = seed * 7919 + 13;
    for (let i = a.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return seed === 0 ? BANK.slice(0, 10) : a.slice(0, 10);
  }, [seed]);
  const [i, setI] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [fin, setFin] = useState(false);
  const q = qs[i];
  const pick = (k: number) => { if (sel !== null) return; setSel(k); if (k === q.a) setScore((s) => s + 1); };
  const next = () => {
    if (i + 1 >= qs.length) { setFin(true); setBest(Math.round(((score) / qs.length) * 100)); }
    else { setI(i + 1); setSel(null); }
  };
  const restart = () => { setSeed((s) => s + 1); setI(0); setSel(null); setScore(0); setFin(false); };
  if (fin) {
    const pct = Math.round((score / qs.length) * 100);
    return (
      <Card>
        <div className="text-center">
          <div className="text-6xl">{pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "📚"}</div>
          <div className="mt-2 text-4xl font-extrabold text-white">{score} / {qs.length}</div>
          <p className="mt-1 text-slate-300">{pct >= 80 ? "Excellent! You have mastered the LAN fundamentals." : pct >= 50 ? "Good effort — revisit the simulators for the topics you missed." : "Keep practising — the simulations will help each concept stick."}</p>
          <Btn className="mt-4" onClick={restart}>Try a new question set</Btn>
        </div>
      </Card>
    );
  }
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-400">
        <span>Question {i + 1} of {qs.length}</span><span className="text-emerald-300">Score {score}</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className="h-full bg-cyan-400 transition-all" style={{ width: (i / qs.length) * 100 + "%" }} /></div>
      <p className="mb-4 text-lg font-semibold text-white">{q.q}</p>
      <div className="grid gap-2">
        {q.o.map((o, k) => (
          <button key={k} onClick={() => pick(k)} className={cn("rounded-xl border px-4 py-3 text-left text-sm transition",
            sel === null && "border-ink-600 bg-ink-900 hover:border-cyan-400",
            sel !== null && k === q.a && "border-emerald-400 bg-emerald-400/15 text-emerald-100",
            sel === k && k !== q.a && "border-rose-400 bg-rose-400/15 text-rose-100",
            sel !== null && k !== q.a && sel !== k && "border-ink-600 opacity-50")}>
            <b className="mr-2 text-cyan-300">{String.fromCharCode(65 + k)}</b>{o}
          </button>
        ))}
      </div>
      {sel !== null && (
        <div className="mt-4 space-y-3">
          <Callout kind={sel === q.a ? "good" : "bad"} title={sel === q.a ? "Correct!" : "Not quite."}>{q.why}</Callout>
          <Btn onClick={next}>{i + 1 >= qs.length ? "Finish" : "Next question →"}</Btn>
        </div>
      )}
    </Card>
  );
}

function Flash() {
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const [known, setKnown] = useState<string[]>([]);
  const [t, d] = TERMS[i];
  const go = (n: number) => { setI((i + n + TERMS.length) % TERMS.length); setFlip(false); };
  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-slate-400">Card {i + 1} / {TERMS.length} · known {known.length}</div>
      <button onClick={() => setFlip(!flip)} className={cn("grid h-60 w-full place-items-center rounded-3xl border-2 p-8 text-center transition-all", flip ? "border-violet-400 bg-violet-400/10" : "border-cyan-400 bg-cyan-400/10")}>
        {flip ? <p className="text-lg text-slate-100">{d}</p> : <div><div className="text-3xl font-extrabold text-white">{t}</div><div className="mt-2 text-xs text-slate-400">Click to reveal the definition</div></div>}
      </button>
      <div className="flex flex-wrap gap-2">
        <Btn variant="ghost" onClick={() => go(-1)}>← Prev</Btn>
        <Btn variant="good" onClick={() => { setKnown((k) => (k.includes(t) ? k : [...k, t])); go(1); }}>✔ I knew it</Btn>
        <Btn variant="ghost" onClick={() => go(1)}>Next →</Btn>
        <Btn variant="amber" onClick={() => { setI(Math.floor(Math.random() * TERMS.length)); setFlip(false); }}>🔀 Random</Btn>
      </div>
    </div>
  );
}

function Review() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      <Callout kind="info">Try to answer each question yourself first, then reveal the model answer.</Callout>
      {REVIEW.map(([q, a], i) => (
        <div key={q} className="rounded-xl border border-ink-600/60 bg-ink-800/70">
          <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
            <span className="font-semibold text-white"><span className="mr-2 text-cyan-400">{i + 1}.</span>{q}</span>
            <span className="text-cyan-300">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <div className="border-t border-ink-600/60 p-4 text-sm text-slate-300">{a}</div>}
        </div>
      ))}
    </div>
  );
}

export default function Quiz() {
  const [tab, setTab] = useState<"quiz" | "flash" | "review">("quiz");
  const { best } = useProgress();
  return (
    <div className="space-y-6">
      <ModuleHeader n={11} title="Quiz & Flashcards" subtitle={`Test yourself with 10 randomised questions, drill key terms with flashcards, and rehearse the lecture review questions. Best score so far: ${best}%.`} />
      <Tabs tabs={[{ id: "quiz", label: "Knowledge check", icon: "🧠" }, { id: "flash", label: "Flashcards", icon: "🃏" }, { id: "review", label: "Review questions", icon: "📝" }]} value={tab} onChange={setTab} />
      {tab === "quiz" && <QuizTab />}
      {tab === "flash" && <Flash />}
      {tab === "review" && <Review />}
      <CompleteBar id="quiz" />
    </div>
  );
}
