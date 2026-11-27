import type { ReactNode } from "react";
import type { Pkt, Pt } from "../lib/anim";

export type DevType =
  | "pc" | "laptop" | "switch" | "hub" | "router" | "ap" | "server" | "printer" | "phone" | "cloud" | "bridge";

export const DEV_COLOR: Record<DevType, string> = {
  pc: "#94a3b8", laptop: "#94a3b8", switch: "#22d3ee", hub: "#fbbf24", router: "#a78bfa",
  ap: "#34d399", server: "#60a5fa", printer: "#f0abfc", phone: "#94a3b8", cloud: "#7dd3fc", bridge: "#22d3ee",
};

function Icon({ type, c }: { type: DevType; c: string }) {
  const f = "#0b1527";
  switch (type) {
    case "pc":
      return (<g><rect x={-18} y={-16} width={36} height={24} rx={3} fill={f} stroke={c} strokeWidth={2} /><rect x={-14} y={-12} width={28} height={16} rx={1} fill={c} opacity={0.18} /><path d="M-8 16h16M0 8v8" stroke={c} strokeWidth={2.5} strokeLinecap="round" /></g>);
    case "laptop":
      return (<g><rect x={-15} y={-14} width={30} height={20} rx={2} fill={f} stroke={c} strokeWidth={2} /><path d="M-22 12h44l-4-6h-36z" fill={f} stroke={c} strokeWidth={2} strokeLinejoin="round" /></g>);
    case "phone":
      return (<g><rect x={-9} y={-16} width={18} height={32} rx={4} fill={f} stroke={c} strokeWidth={2} /><circle cx={0} cy={11} r={1.6} fill={c} /></g>);
    case "switch":
    case "bridge":
      return (<g><rect x={-26} y={-11} width={52} height={22} rx={4} fill={f} stroke={c} strokeWidth={2} />{[-18, -9, 0, 9, 18].map((x) => (<rect key={x} x={x - 3} y={-3} width={6} height={7} rx={1} fill={c} opacity={0.8} />))}<path d="M-20 -7h40" stroke={c} strokeWidth={1} opacity={0.5} /></g>);
    case "hub":
      return (<g><rect x={-24} y={-10} width={48} height={20} rx={3} fill={f} stroke={c} strokeWidth={2} />{[-16, -8, 0, 8, 16].map((x) => (<circle key={x} cx={x} cy={0} r={2.6} fill={c} />))}</g>);
    case "router":
      return (<g><circle r={19} fill={f} stroke={c} strokeWidth={2} /><path d="M-10 -3h20m-6 -5 6 5-6 5M10 5h-20m6 -5-6 5 6 5" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>);
    case "ap":
      return (<g><rect x={-17} y={2} width={34} height={11} rx={4} fill={f} stroke={c} strokeWidth={2} /><path d="M-10 -4a14 14 0 0 1 20 0M-17 -11a24 24 0 0 1 34 0" stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" /><circle cx={0} cy={-1} r={1.8} fill={c} /></g>);
    case "server":
      return (<g>{[-17, -5, 7].map((y) => (<g key={y}><rect x={-17} y={y} width={34} height={10} rx={2} fill={f} stroke={c} strokeWidth={2} /><circle cx={-10} cy={y + 5} r={1.6} fill={c} /></g>))}</g>);
    case "printer":
      return (<g><rect x={-12} y={-16} width={24} height={10} fill={f} stroke={c} strokeWidth={2} /><rect x={-18} y={-7} width={36} height={16} rx={3} fill={f} stroke={c} strokeWidth={2} /><rect x={-10} y={4} width={20} height={11} fill={c} opacity={0.25} stroke={c} strokeWidth={1.5} /></g>);
    case "cloud":
      return (<path d="M-16 10a10 10 0 0 1-1-20 14 14 0 0 1 27-3 11 11 0 0 1 3 23z" fill={f} stroke={c} strokeWidth={2} />);
  }
}

export interface DeviceProps {
  type: DevType;
  x: number;
  y: number;
  label?: string;
  sub?: string;
  down?: boolean;
  glow?: string; // ring color
  tag?: string; // small text badge
  tagColor?: string;
  scale?: number;
  onClick?: () => void;
  labelDy?: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  cursor?: string;
}

export function Device({ type, x, y, label, sub, down, glow, tag, tagColor, scale = 1, onClick, labelDy = 34, onPointerDown, cursor }: DeviceProps) {
  const c = down ? "#ef4444" : DEV_COLOR[type];
  return (
    <g transform={`translate(${x},${y})`} onClick={onClick} onPointerDown={onPointerDown} style={{ cursor: cursor ?? (onClick ? "pointer" : "default"), touchAction: "none" }}>
      {glow && <circle r={30 * scale} fill={glow} opacity={0.18} stroke={glow} strokeWidth={2} />}
      <g transform={`scale(${scale})`} opacity={down ? 0.55 : 1}>
        <Icon type={type} c={c} />
      </g>
      {down && <path d="M-14 -14l28 28M14 -14l-28 28" stroke="#ef4444" strokeWidth={3} strokeLinecap="round" />}
      {label && (
        <text y={labelDy} textAnchor="middle" fontSize={12} fontWeight={600} fill="#e6eefc">{label}</text>
      )}
      {sub && (
        <text y={labelDy + 13} textAnchor="middle" fontSize={10} fill="#8aa0c4" className="mono">{sub}</text>
      )}
      {tag && (
        <g transform={`translate(0,${-labelDy + 2})`}>
          <rect x={-tag.length * 3.3 - 6} y={-9} width={tag.length * 6.6 + 12} height={17} rx={8} fill={tagColor ?? "#22d3ee"} />
          <text y={3} textAnchor="middle" fontSize={10} fontWeight={700} fill="#04101f">{tag}</text>
        </g>
      )}
    </g>
  );
}

export function Link({ a, b, down, color, width = 2.5, dashed, label, onClick, flow, opacity = 1, labelColor }: {
  a: Pt; b: Pt; down?: boolean; color?: string; width?: number; dashed?: boolean; label?: string; onClick?: () => void; flow?: boolean; opacity?: number; labelColor?: string;
}) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  return (
    <g onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }} opacity={opacity}>
      {onClick && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={16} />}
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={down ? "#ef4444" : color ?? "#3b5278"} strokeWidth={width}
        strokeDasharray={down ? "5 6" : dashed ? "6 5" : undefined} className={flow ? "flow-dash" : undefined} strokeLinecap="round" />
      {down && (<g transform={`translate(${mx},${my})`}><circle r={8} fill="#1b0b10" stroke="#ef4444" strokeWidth={1.5} /><path d="M-3.5 -3.5l7 7M3.5 -3.5l-7 7" stroke="#ef4444" strokeWidth={2} strokeLinecap="round" /></g>)}
      {label && !down && (
        <text x={mx} y={my - 6} textAnchor="middle" fontSize={10} fill={labelColor ?? "#8aa0c4"} className="mono">{label}</text>
      )}
    </g>
  );
}

export function PacketLayer({ packets }: { packets: Pkt[] }) {
  return (
    <g pointerEvents="none">
      {packets.map((p) => (
        <g key={p.id} transform={`translate(${p.x},${p.y})`}>
          {p.shape === "env" ? (
            <g><rect x={-9} y={-6} width={18} height={12} rx={2} fill={p.color} stroke="#04101f" strokeWidth={1.2} /><path d="M-9 -6l9 7 9-7" stroke="#04101f" strokeWidth={1.2} fill="none" /></g>
          ) : p.shape === "token" ? (
            <g><circle r={9} fill={p.color} stroke="#04101f" strokeWidth={1.5} /><text y={4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#04101f">T</text></g>
          ) : p.shape === "x" ? (
            <g><circle r={10} fill="#1b0b10" stroke="#ef4444" strokeWidth={2} /><path d="M-4 -4l8 8M4 -4l-8 8" stroke="#ef4444" strokeWidth={2.4} strokeLinecap="round" /></g>
          ) : (
            <g><circle r={11} fill={p.color} opacity={0.25} /><circle r={6} fill={p.color} stroke="#04101f" strokeWidth={1.2} /></g>
          )}
          {p.label && (
            <g transform="translate(0,-17)">
              <rect x={-p.label.length * 3.1 - 5} y={-9} width={p.label.length * 6.2 + 10} height={15} rx={4} fill="#04101f" opacity={0.85} />
              <text y={2} textAnchor="middle" fontSize={9.5} fontWeight={600} fill={p.color} className="mono">{p.label}</text>
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

export function Stage({ w = 800, h = 420, children, className = "", svgRef }: { w?: number; h?: number; children: ReactNode; className?: string; svgRef?: React.Ref<SVGSVGElement> }) {
  return (
    <div className={`rounded-2xl border border-ink-600/70 bg-ink-900 grid-bg overflow-hidden ${className}`}>
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="w-full h-auto block select-none" style={{ touchAction: "none" }}>
        {children}
      </svg>
    </div>
  );
}
