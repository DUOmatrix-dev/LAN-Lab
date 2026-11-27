import { useCallback, useEffect, useRef, useState } from "react";

export type Pt = { x: number; y: number };
export interface Pkt {
  id: number;
  x: number;
  y: number;
  color: string;
  label?: string;
  shape?: "dot" | "env" | "x" | "token";
}

let speedMult = 1;
export const setSpeedMult = (v: number) => {
  speedMult = v;
};
export const getSpeedMult = () => speedMult;
export const sleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms / speedMult));

export interface FlyOpts {
  color?: string;
  label?: string;
  speed?: number; // px per second
  shape?: Pkt["shape"];
}

/** Hook that animates small packets along polylines in an SVG coordinate space. */
export function usePackets() {
  const [packets, setPackets] = useState<Pkt[]>([]);
  const idc = useRef(0);
  const alive = useRef(true);
  const epoch = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const clear = useCallback(() => {
    epoch.current++;
    setPackets([]);
  }, []);

  const fly = useCallback((pts: Pt[], o: FlyOpts = {}) => {
    return new Promise<void>((resolve) => {
      if (pts.length < 2) return resolve();
      const id = ++idc.current;
      const myEpoch = epoch.current;
      const lens: number[] = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        lens.push(l);
        total += l;
      }
      const base = o.speed ?? 240;
      let last = performance.now();
      let dist = 0;
      const finish = () => {
        setPackets((p) => p.filter((k) => k.id !== id));
        resolve();
      };
      const step = (t: number) => {
        if (!alive.current || myEpoch !== epoch.current) return finish();
        const dt = Math.min((t - last) / 1000, 0.1);
        last = t;
        dist += dt * base * speedMult;
        if (dist >= total) return finish();
        let d = dist;
        let i = 0;
        while (i < lens.length - 1 && d > lens[i]) {
          d -= lens[i];
          i++;
        }
        const f = lens[i] === 0 ? 0 : d / lens[i];
        const x = pts[i].x + (pts[i + 1].x - pts[i].x) * f;
        const y = pts[i].y + (pts[i + 1].y - pts[i].y) * f;
        const pk: Pkt = {
          id,
          x,
          y,
          color: o.color ?? "#22d3ee",
          label: o.label,
          shape: o.shape ?? "dot",
        };
        setPackets((p) => {
          const idx = p.findIndex((k) => k.id === id);
          if (idx === -1) return [...p, pk];
          const c = p.slice();
          c[idx] = pk;
          return c;
        });
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, []);

  return { packets, fly, clear };
}

export function useAlive() {
  const a = useRef(true);
  useEffect(() => {
    a.current = true;
    return () => {
      a.current = false;
    };
  }, []);
  return a;
}
