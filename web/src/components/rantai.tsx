"use client";

/* Segel Arkana — gembok rantai ala game untuk relik bertanda SSO.
 * Empat rantai dari sudut kartu bertemu di hub + gembok emas.
 * Terbuka (breaking): aura → cincin rune → gembok menganga di engsel →
 * rantai beterbangan relatif dari posisinya + bunga api → kilat → lenyap.
 */
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";

const NS = "http://www.w3.org/2000/svg";
const CENTER: [number, number] = [150, 95];
const CORNERS: Array<[number, number]> = [
  [10, 10],
  [290, 10],
  [10, 180],
  [290, 180],
];
const HUB_R = 30;
const PITCH = 17;

type Link = { x: number; y: number; ang: number; flat: boolean };
type Chain = { links: Link[]; cx: number; cy: number; ux: number; uy: number };

function buildChains(): Chain[] {
  return CORNERS.map(([cx, cy]) => {
    const dx = CENTER[0] - cx;
    const dy = CENTER[1] - cy;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const span = len - HUB_R - 10;
    const n = Math.max(2, Math.round(span / PITCH));
    const step = span / (n - 1);
    const links: Link[] = [];
    for (let k = 0; k < n; k++) {
      const s = 8 + step * k;
      links.push({ x: cx + ux * s, y: cy + uy * s, ang, flat: k % 2 === 1 });
    }
    return { links, cx, cy, ux, uy };
  });
}

const CHAINS = buildChains();
const RUNES = Array.from({ length: 12 }, (_, i) => i);

function sparkIn(parent: SVGGElement, x: number, y: number, n: number, spread: number) {
  const cols = ["#f0c75e", "#ffe9a6", "#6ff0ff", "#b9a3ff"];
  for (let i = 0; i < n; i++) {
    const s = document.createElementNS(NS, "circle");
    const r = 1 + Math.random() * 1.8;
    s.setAttribute("cx", String(x));
    s.setAttribute("cy", String(y));
    s.setAttribute("r", String(r));
    s.setAttribute("fill", cols[i % cols.length]);
    parent.appendChild(s);
    const a = Math.random() * Math.PI * 2;
    const d = (0.3 + Math.random() * 0.7) * spread;
    gsap.to(s, {
      x: Math.cos(a) * d,
      y: Math.sin(a) * d + 10 + Math.random() * 30,
      opacity: 0,
      duration: 0.5 + Math.random() * 0.6,
      ease: "power2.out",
      onComplete: () => s.remove(),
    });
  }
}

function shockIn(parent: SVGGElement, x: number, y: number, col: string, r1: number) {
  const s = document.createElementNS(NS, "circle");
  s.setAttribute("cx", String(x));
  s.setAttribute("cy", String(y));
  s.setAttribute("r", "8");
  s.setAttribute("fill", "none");
  s.setAttribute("stroke", col);
  s.setAttribute("stroke-width", "4");
  parent.appendChild(s);
  gsap.to(s, {
    attr: { r: r1, "stroke-width": 0.5 },
    opacity: 0,
    duration: 0.9,
    ease: "power3.out",
    onComplete: () => s.remove(),
  });
}

export function ChainOverlay({
  breaking,
  name,
  onUnlock,
}: {
  breaking: boolean;
  name: string;
  onUnlock: () => void;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const sparks = useRef<SVGGElement>(null);

  useLayoutEffect(() => {
    const el = scope.current;
    if (!el || !breaking) return;
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {}
    if (reduced) return;
    const fx = sparks.current;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.to(".chain-aura", { opacity: 1, duration: 0.5, ease: "power2.out" }, 0)
        .fromTo(
          ".chain-ring",
          { opacity: 0, scale: 0.55, transformOrigin: "center" },
          { opacity: 1, scale: 1, duration: 0.65, ease: "back.out(1.6)" },
          0
        )
        .to(".chain-ring", { rotation: 200, duration: 2.2, ease: "power2.out" }, 0)
        .to(".chain-padlock", { x: 2, duration: 0.04, repeat: 11, yoyo: true, ease: "none" }, 0.2)
        .add(() => {
          if (fx) {
            shockIn(fx, 150, 100, "#6ff0ff", 80);
            sparkIn(fx, 150, 100, 12, 55);
          }
        }, 0.7)
        .to(".chain-shackle", { y: -9, duration: 0.16, ease: "power2.out" }, 0.7)
        .to(".chain-shackle", { rotation: 58, svgOrigin: "166 92", duration: 0.4, ease: "back.out(2)" }, 0.86);
      CHAINS.forEach((ch, ci) => {
        const order = [...ch.links].reverse();
        order.forEach((l, i) => {
          const t = 0.95 + i * 0.03 + ci * 0.02;
          const idx = ch.links.length - 1 - i;
          const sel = `.chain-link-${ci}-${idx}`;
          const dx = -ch.ux * (30 + Math.random() * 60) + (Math.random() * 60 - 30);
          const dy = -ch.uy * (15 + Math.random() * 50) + (130 + Math.random() * 80);
          tl.to(sel, { scale: 1.3, transformOrigin: "center", duration: 0.07, ease: "power2.out" }, t)
            .to(
              sel,
              {
                x: `+=${dx.toFixed(1)}`,
                rotation: l.ang + (Math.random() * 400 - 200),
                opacity: 0,
                scale: 0.9,
                duration: 0.8,
                ease: "power1.out",
              },
              t + 0.07
            )
            .to(sel, { y: `+=${dy.toFixed(1)}`, duration: 0.8, ease: "power2.in" }, t + 0.07)
            .add(() => {
              if (fx) sparkIn(fx, l.x, l.y, 2, 24);
            }, t + 0.08);
        });
        const ta = 0.95 + order.length * 0.03 + ci * 0.02;
        tl.to(`.chain-anchor-${ci}, .chain-clasp-${ci}`, { scale: 0, opacity: 0, duration: 0.28, ease: "back.in(3)" }, ta)
          .add(() => {
            if (fx) sparkIn(fx, ch.cx, ch.cy, 6, 36);
          }, ta + 0.12);
      });
      tl.to(".chain-padlock", { scale: 1.22, transformOrigin: "center", duration: 0.18, ease: "power2.out" }, 1.5)
        .add(() => {
          if (fx) {
            shockIn(fx, 150, 95, "#f0c75e", 170);
            shockIn(fx, 150, 95, "#9b7bff", 130);
            sparkIn(fx, 150, 95, 36, 130);
          }
        }, 1.62)
        .to(".chain-padlock", { scale: 1.6, opacity: 0, duration: 0.3, ease: "power2.in" }, 1.62)
        .to(".chain-hub", { scale: 1.45, opacity: 0, duration: 0.3, ease: "power2.in" }, 1.62)
        .to(".chain-flash", { opacity: 1, duration: 0.09, ease: "power2.out" }, 1.62)
        .to(".chain-flash", { opacity: 0, duration: 0.55 }, 1.71)
        .to(".chain-aura", { opacity: 0, duration: 0.5 }, 1.7)
        .to(".chain-ring", { opacity: 0, scale: 1.7, duration: 0.5, ease: "power2.in" }, 1.62)
        .to(".chain-veil", { opacity: 0, duration: 0.32 }, 1.85);
      // Catatan: JANGAN animasikan kartu di sini (scale/translate/filter).
      // Matriks transform kartu milik tween reveal + tilt; menyentuhnya dari
      // timeline ini terbukti meninggalkan sisa translate (kartu turun).
      // Kilat + ledakan bunga api sudah cukup sebagai klimaks.
    }, el);
    return () => ctx.revert();
  }, [breaking]);

  return (
    <div ref={scope} className="chain-veil" role="img" aria-label={`${name} terkunci, wajib masuk untuk membuka`} onClick={onUnlock}>
      <div className="chain-veil-inner">
        <svg className="chain-svg" viewBox="0 0 300 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <radialGradient id="arcAura">
              <stop offset="0" stopColor="#b9a3ff" stopOpacity=".9" />
              <stop offset=".5" stopColor="#6ff0ff" stopOpacity=".25" />
              <stop offset="1" stopColor="#6ff0ff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="arcGold" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe9a6" />
              <stop offset=".5" stopColor="#e0b24e" />
              <stop offset="1" stopColor="#8f6a22" />
            </linearGradient>
            <radialGradient id="arcHub">
              <stop offset="0" stopColor="#2d2160" />
              <stop offset="1" stopColor="#120c2c" />
            </radialGradient>
          </defs>
          <circle className="chain-aura" cx={150} cy={95} r={72} fill="url(#arcAura)" opacity={0} />
          <g className="chain-ring" opacity={0}>
            <circle cx={150} cy={95} r={40} fill="none" stroke="#9b7bff" strokeWidth={1.5} strokeDasharray="3 6" />
            <circle cx={150} cy={95} r={48} fill="none" stroke="#f0c75e" strokeWidth={1} opacity={0.7} />
            {RUNES.map((i) => {
              const a = (i * Math.PI) / 6;
              return (
                <path
                  key={i}
                  d="M0-4.5L2.6 0 0 4.5-2.6 0Z"
                  fill={i % 3 ? "#6ff0ff" : "#f0c75e"}
                  transform={`translate(${150 + Math.cos(a) * 44} ${95 + Math.sin(a) * 44}) rotate(${i * 30 + 90})`}
                />
              );
            })}
          </g>
          {CHAINS.map((ch, ci) => (
            <g key={ci}>
              {ch.links.map((l, i) =>
                l.flat ? (
                  <g key={i} className={`chain-link-${ci}-${i}`} transform={`translate(${l.x} ${l.y}) rotate(${l.ang})`}>
                    <rect x={-12.7} y={-2.2} width={25.4} height={4.4} rx={2.2} fill="url(#arcGold)" stroke="#3d2a0a" strokeWidth={1.4} />
                  </g>
                ) : (
                  <g key={i} className={`chain-link-${ci}-${i}`} transform={`translate(${l.x} ${l.y}) rotate(${l.ang})`}>
                    <rect x={-11} y={-5.5} width={22} height={11} rx={5.5} fill="none" stroke="#3d2a0a" strokeWidth={5.6} />
                    <rect x={-11} y={-5.5} width={22} height={11} rx={5.5} fill="none" stroke="url(#arcGold)" strokeWidth={3.4} />
                  </g>
                )
              )}
              <g className={`chain-anchor-${ci}`}>
                <circle cx={ch.cx} cy={ch.cy} r={8.5} fill="url(#arcGold)" stroke="#3d2a0a" strokeWidth={2.2} />
                <circle cx={ch.cx} cy={ch.cy} r={3.6} fill="#9b7bff" />
              </g>
              <g className={`chain-clasp-${ci}`}>
                <circle cx={150 - ch.ux * HUB_R} cy={95 - ch.uy * HUB_R} r={6.5} fill="url(#arcGold)" stroke="#3d2a0a" strokeWidth={2} />
                <circle cx={150 - ch.ux * HUB_R} cy={95 - ch.uy * HUB_R} r={2.4} fill="#6ff0ff" />
              </g>
            </g>
          ))}
          <g className="chain-hub">
            <circle cx={150} cy={95} r={HUB_R} fill="url(#arcHub)" stroke="url(#arcGold)" strokeWidth={3} />
            <circle cx={150} cy={95} r={24} fill="none" stroke="#9b7bff" strokeWidth={1} strokeDasharray="2 4" opacity={0.8} />
          </g>
          <g className="chain-padlock">
            <circle className="chain-glow" cx={150} cy={108} r={20} fill="url(#arcAura)" opacity={0.35} />
            <g className="chain-shackle" fill="none" strokeLinecap="round">
              <path d="M134 92V78a16 16 0 0 1 32 0V92" stroke="#4a4f73" strokeWidth={10} />
              <path d="M134 92V78a16 16 0 0 1 32 0V92" stroke="#e6e9f8" strokeWidth={5.5} />
            </g>
            <rect x={121} y={88} width={58} height={46} rx={9} fill="url(#arcGold)" stroke="#5a4217" strokeWidth={2.5} />
            <rect x={126} y={93} width={48} height={8} rx={4} fill="#fff" opacity={0.22} />
            <circle cx={150} cy={108} r={5.5} fill="#1b1233" />
            <path d="M147.5 110h5l1.5 13h-8z" fill="#1b1233" />
          </g>
          <g ref={sparks} />
        </svg>
        <div className="chain-flash" aria-hidden="true" />
        <p className="chain-label">
          <b>TERKUNCI</b>
          <span>{name} membutuhkan login SSO.</span>
          <em>● SSO</em>
        </p>
      </div>
    </div>
  );
}
