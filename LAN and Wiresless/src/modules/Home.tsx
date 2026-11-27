import { useEffect } from "react";
import { Device, Link, PacketLayer, Stage } from "../components/svg";
import { useProgress, Card } from "../components/ui";
import { sleep, usePackets } from "../lib/anim";
import type { ModuleDef } from "../App";

const P = {
  sw: { x: 400, y: 120 },
  a: { x: 150, y: 50 },
  b: { x: 150, y: 190 },
  c: { x: 650, y: 50 },
  r: { x: 650, y: 190 },
  ap: { x: 400, y: 240 },
};

function Hero() {
  const { packets, fly } = usePackets();
  useEffect(() => {
    let on = true;
    (async () => {
      const seq: [keyof typeof P, keyof typeof P, string, string][] = [
        ["a", "c", "#22d3ee", "ping"],
        ["b", "r", "#a78bfa", "HTTP"],
        ["ap", "a", "#34d399", "Wi-Fi"],
        ["c", "b", "#fbbf24", "ARP"],
      ];
      let i = 0;
      while (on) {
        const [s, d, col, lab] = seq[i++ % seq.length];
        await fly([P[s], P.sw, P[d]], { color: col, label: lab, speed: 200 });
        await sleep(250);
      }
    })();
    return () => {
      on = false;
    };
  }, [fly]);
  return (
    <Stage w={800} h={290}>
      {(["a", "b", "c", "r", "ap"] as const).map((k) => (
        <Link key={k} a={P.sw} b={P[k]} flow={k === "ap"} dashed={k === "ap"} color={k === "ap" ? "#34d399" : undefined} />
      ))}
      <Device type="switch" {...P.sw} label="Switch" scale={1.2} glow="#22d3ee" />
      <Device type="pc" {...P.a} label="PC-A" />
      <Device type="laptop" {...P.b} label="Laptop" />
      <Device type="server" {...P.c} label="Server" />
      <Device type="router" {...P.r} label="Router" />
      <Device type="ap" {...P.ap} label="Wi-Fi AP" />
      <PacketLayer packets={packets} />
    </Stage>
  );
}

export default function Home({ go, modules }: { go: (id: string) => void; modules: ModuleDef[] }) {
  const { done, visited } = useProgress();
  const outcomes = [
    ["Define a LAN", "Characteristics, benefits, limits and how a LAN differs from a WAN."],
    ["Compare topologies", "Bus, star, ring and mesh — physical vs logical — with failures."],
    ["Master access methods", "CSMA/CD, token passing, CSMA/CA and channelisation, live."],
    ["Switch like a switch", "MAC learning, forward / flood / filter, VLANs, trunks, STP."],
    ["Go wireless", "SSID/BSS/ESS, roaming, channels, Wi-Fi security."],
    ["Design real LANs", "Configure a switch CLI and design a lab and campus network."],
  ];
  return (
    <div className="fade-up">
      <section className="mb-8">
        <div className="mb-3 inline-block rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[.18em] text-cyan-300">
          Computer Networks & Communication Technology
        </div>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl">
          Learn LANs by <span className="bg-gradient-to-r from-cyan-300 to-violet-400 bg-clip-text text-transparent">watching every frame move.</span>
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-slate-300">
          An interactive course on Local Area Networks, topologies, Ethernet, switching, VLANs, Spanning Tree and Wi-Fi. Every concept has a live simulator —
          send frames, break cables, cause collisions, then check your understanding.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => go("basics")} className="rounded-xl bg-cyan-400 px-6 py-3 font-bold text-ink-950 shadow-lg shadow-cyan-500/25 hover:bg-cyan-300">
            Start learning →
          </button>
          <button onClick={() => go("topologies")} className="rounded-xl border border-ink-600 bg-ink-800 px-6 py-3 font-semibold text-slate-100 hover:border-cyan-400">
            Jump to simulators
          </button>
        </div>
      </section>

      <Hero />

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold text-white">What you will be able to do</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {outcomes.map(([t, d]) => (
            <Card key={t}>
              <div className="mb-1 font-bold text-cyan-300">{t}</div>
              <div className="text-sm text-slate-300">{d}</div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-bold text-white">Course map</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {modules.map((m, i) => (
            <button
              key={m.id}
              onClick={() => go(m.id)}
              className="group flex items-start gap-3 rounded-2xl border border-ink-600/60 bg-ink-800/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-400/70"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-ink-700 text-2xl">{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-widest text-slate-500">{m.group}</span>
                <span className="block font-bold text-white group-hover:text-cyan-300">
                  {i + 1}. {m.title}
                </span>
                <span className="text-xs text-slate-400">
                  {done.includes(m.id) ? "✔ Completed" : visited.includes(m.id) ? "In progress" : "Not started"}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 p-6">
        <div className="text-xs font-bold uppercase tracking-widest text-violet-300">Final challenge</div>
        <p className="mt-1 text-lg font-semibold text-white">
          How can a university combine Ethernet switching, VLAN segmentation, STP and secure Wi-Fi to build a reliable campus network?
        </p>
        <p className="mt-1 text-sm text-slate-300">You will answer this at the end — by building it in the Lab module.</p>
      </section>
    </div>
  );
}
