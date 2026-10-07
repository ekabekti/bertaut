"use client";

/* Lapisan animasi sinematik BERTAUT — GSAP + ScrollTrigger.
 * Prinsip: konten tetap terlihat tanpa JS/animasi; GSAP hanya
 * mengatur state awal di dalam context lalu menganimasikannya.
 * Hormati prefers-reduced-motion. Aman StrictMode via ctx.revert().
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/* ---------- tabir pembuka sinematik: malam Hogwarts ---------- */
const VEIL_LETTERS = "BERTAUT".split("");

function Snitch() {
  return (
    <svg className="veil-snitch" viewBox="-40 -24 80 48" aria-hidden="true">
      <defs>
        <radialGradient id="snitchGold" cx=".35" cy=".35" r=".9">
          <stop offset="0" stopColor="#fff6d8" />
          <stop offset=".5" stopColor="#f0c75e" />
          <stop offset="1" stopColor="#8f6a22" />
        </radialGradient>
      </defs>
      <path className="snitch-wing-l" d="M-6-2 C-20-18 -32-20 -38-8 C-28-8 -18-4 -8 2Z" fill="#d8cfae" opacity=".92" />
      <path className="snitch-wing-r" d="M-6 2 C-20 18 -32 20 -38 8 C-28 8 -18 4 -8-2Z" fill="#b8ad88" opacity=".92" />
      <circle cx={0} cy={0} r={9} fill="url(#snitchGold)" stroke="#5a4217" strokeWidth={1.5} />
      <path d="M-3-4 A5 5 0 0 1 3-4" stroke="#5a4217" strokeWidth={1.2} fill="none" />
    </svg>
  );
}

function Castle() {
  const towers = [
    { x: 60, w: 46, top: 58, apex: 22 },
    { x: 190, w: 56, top: 44, apex: 8 },
    { x: 320, w: 64, top: 30, apex: 2 },
    { x: 470, w: 56, top: 44, apex: 8 },
    { x: 594, w: 46, top: 58, apex: 22 },
  ];
  const wins: Array<[number, number]> = [];
  for (const t of towers) {
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        const x = t.x + 10 + c * 14;
        if (x + 5 <= t.x + t.w - 6) wins.push([x, t.top + 12 + r * 14]);
      }
    }
  }
  const wallWins: Array<[number, number]> = [[150, 108], [286, 108], [442, 108], [598, 108], [36, 108], [664, 108]];
  return (
    <svg className="veil-castle" viewBox="0 0 700 140" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <ellipse cx={350} cy={152} rx={400} ry={30} fill="#04040a" />
      <circle cx={105} cy={30} r={17} fill="#e8e2c8" opacity={0.9} />
      <circle cx={105} cy={30} r={25} fill="none" stroke="#e8e2c8" strokeWidth={1} opacity={0.25} />
      <rect x={0} y={100} width={700} height={40} fill="#05050c" />
      {towers.map((t, i) => (
        <g key={i}>
          <rect x={t.x} y={t.top} width={t.w} height={140 - t.top} fill="#05050c" />
          <polygon points={`${t.x},${t.top} ${t.x + t.w},${t.top} ${t.x + t.w / 2},${t.apex}`} fill="#0a0a17" />
          <rect x={t.x + t.w / 2 - 1.5} y={t.apex - 8} width={3} height={10} fill="#0a0a17" />
        </g>
      ))}
      {wins.map(([x, y], i) => (
        <rect key={`w${i}`} x={x} y={y} width={5} height={9} rx={2.5} fill="#f0c75e" opacity={0.8} />
      ))}
      {wallWins.map(([x, y], i) => (
        <rect key={`v${i}`} x={x} y={y} width={5} height={9} rx={2.5} fill="#f0c75e" opacity={0.7} />
      ))}
    </svg>
  );
}

const STARS = Array.from({ length: 60 }, (_, i) => ({
  left: (i * 137.5) % 100,
  top: ((i * 89.3) % 100) * 0.6,
  size: 1 + ((i * 53.7) % 10) / 8,
  delay: ((i * 53.7) % 20) / 10,
}));

function Starfield() {
  return (
    <div className="veil-stars" aria-hidden="true">
      {STARS.map((s, i) => (
        <span
          key={i}
          style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
        />
      ))}
    </div>
  );
}

const CANDLES = [
  { left: 8, bottom: 300, h: 30, dur: 5.2, delay: 0 },
  { left: 16, bottom: 420, h: 24, dur: 6.1, delay: 1.2 },
  { left: 26, bottom: 250, h: 34, dur: 4.7, delay: 0.6 },
  { left: 38, bottom: 460, h: 22, dur: 5.8, delay: 2.1 },
  { left: 52, bottom: 280, h: 30, dur: 5.0, delay: 1.0 },
  { left: 63, bottom: 430, h: 26, dur: 6.4, delay: 0.3 },
  { left: 74, bottom: 260, h: 32, dur: 4.9, delay: 1.7 },
  { left: 84, bottom: 400, h: 24, dur: 5.5, delay: 0.9 },
  { left: 92, bottom: 290, h: 28, dur: 6.0, delay: 2.4 },
  { left: 45, bottom: 360, h: 20, dur: 5.3, delay: 1.5 },
];

function Candles() {
  return (
    <div className="veil-candles" aria-hidden="true">
      {CANDLES.map((c, i) => (
        <div
          key={i}
          className="veil-candle"
          style={{ left: `${c.left}%`, bottom: c.bottom, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}
        >
          <span className="vc-flame" style={{ animationDelay: `${c.delay}s` }} />
          <span className="vc-body" style={{ height: c.h }} />
        </div>
      ))}
    </div>
  );
}

export function MegahVeil({ onDone }: { onDone: () => void }) {
  const scope = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    doneRef.current = onDone;
  });

  useLayoutEffect(() => {
    const el = scope.current;
    if (!el) return;
    // Tab tersembunyi (rAF beku) atau gerak dibatasi: lewati sinematik.
    let skip = false;
    try {
      skip = document.hidden;
    } catch {}
    if (skip || reducedMotion()) {
      const t = window.setTimeout(() => {
        setGone(true);
        doneRef.current();
      }, 0);
      return () => window.clearTimeout(t);
    }
    const snitch = el.querySelector<HTMLElement>(".veil-snitch");
    const ctx = gsap.context(() => {
      const counter = { v: 0 };
      const num = el.querySelector(".veil-count");
      const tl = gsap.timeline({
        defaults: { ease: "expo.out" },
        onComplete: () => {
          setGone(true);
          doneRef.current();
        },
      });
      // Kepak sayap + lintasan Snitch melintasi malam.
      gsap.to(".snitch-wing-l", { rotation: -28, transformOrigin: "right center", duration: 0.16, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.to(".snitch-wing-r", { rotation: 28, transformOrigin: "right center", duration: 0.16, yoyo: true, repeat: -1, ease: "sine.inOut" });
      gsap.set(snitch, { x: "-12vw", y: "12vh" });
      tl.to(snitch, { x: "108vw", duration: 2.3, ease: "power1.inOut" }, 0.15).to(
        snitch,
        { keyframes: [{ y: "-10vh" }, { y: "12vh" }, { y: "-6vh" }, { y: "8vh" }], duration: 2.3, ease: "sine.inOut" },
        0.15
      );
      // Jejak cahaya di ekor Snitch.
      tl.add(() => {
        let n = 0;
        const max = 46;
        const tick = () => {
          if (!snitch || n >= max) {
            gsap.ticker.remove(tick);
            return;
          }
          n += 1;
          const vr = el.getBoundingClientRect();
          const sr = snitch.getBoundingClientRect();
          const s = document.createElement("span");
          s.className = "veil-trail";
          s.style.left = `${sr.left - vr.left + sr.width / 2}px`;
          s.style.top = `${sr.top - vr.top + sr.height / 2}px`;
          el.appendChild(s);
          gsap.to(s, { scale: 0, opacity: 0, duration: 0.8, ease: "power1.out", onComplete: () => s.remove() });
        };
        gsap.ticker.add(tick);
      }, 0.2);
      // Huruf menyala satu per satu dilewati cahaya.
      tl.fromTo(
        ".veil-letter",
        { yPercent: 115, opacity: 0.12, textShadow: "0 0 0px rgba(240,199,94,0)" },
        {
          yPercent: 0,
          opacity: 1,
          textShadow: "0 0 24px rgba(240,199,94,.6)",
          duration: 0.9,
          stagger: 0.24,
        },
        0.35
      )
        .fromTo(".veil-rule", { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: "expo.inOut" }, 0.6)
        .fromTo(".veil-sub", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.7 }, 1.0)
        .fromTo(".veil-castle", { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.4, ease: "power2.out" }, 0)
        .to(
          counter,
          {
            v: 100,
            duration: 1.9,
            ease: "power2.inOut",
            onUpdate: () => {
              if (num) num.textContent = String(Math.round(counter.v)).padStart(3, "0");
            },
          },
          0.4
        )
        .to(".veil-panel-top", { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "+=0.2")
        .to(".veil-panel-bottom", { yPercent: 100, duration: 0.9, ease: "expo.inOut" }, "<")
        .to(".veil-core", { opacity: 0, y: -30, duration: 0.5, ease: "power2.in" }, "<+0.1");
      const fast = () => tl.timeScale(3.2);
      el.addEventListener("click", fast);
      return () => el.removeEventListener("click", fast);
    }, el);
    return () => ctx.revert();
  }, []);

  if (gone) return null;
  return (
    <div ref={scope} className="veil" role="status" aria-label="Membuka portal">
      <div className="veil-panel veil-panel-top" aria-hidden="true" />
      <div className="veil-panel veil-panel-bottom" aria-hidden="true" />
      <Starfield />
      <div className="veil-fog fog-a" aria-hidden="true" />
      <Castle />
      <Candles />
      <div className="veil-fog fog-b" aria-hidden="true" />
      <Snitch />
      <div className="veil-core">
        <div className="veil-word" aria-hidden="true">
          {VEIL_LETTERS.map((ch, i) => (
            <span key={i} className="veil-mask">
              <span className="veil-letter">{ch}</span>
            </span>
          ))}
        </div>
        <div className="veil-rule" aria-hidden="true" />
        <p className="veil-sub">beranda aplikasi &amp; tautan terpadu</p>
        <p className="veil-countwrap">
          <span className="veil-count">000</span>
          <span className="veil-total"> / 100</span>
        </p>
      </div>
    </div>
  );
}

/* ---------- medan bara emas (kanvas ringan) ---------- */
export function EmberField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || reducedMotion()) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    type Mote = { x: number; y: number; r: number; s: number; o: number; ph: number };
    const motes: Mote[] = Array.from({ length: 70 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.8 + 0.4,
      s: Math.random() * 0.35 + 0.08,
      o: Math.random() * 0.5 + 0.15,
      ph: Math.random() * Math.PI * 2,
    }));
    // Lapisan bintang arkana: diam, berkelip perlahan.
    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 0.9 + 0.3,
      o: Math.random() * 0.35 + 0.12,
      ph: Math.random() * Math.PI * 2,
    }));
    const frame = () => {
      ctx2d.clearRect(0, 0, w, h);
      const t = performance.now() / 1000;
      for (const st of stars) {
        ctx2d.globalAlpha = st.o * (0.55 + 0.45 * Math.sin(t * 0.9 + st.ph));
        ctx2d.fillStyle = "#cdd6f4";
        ctx2d.beginPath();
        ctx2d.arc(st.x, st.y, st.r, 0, 7);
        ctx2d.fill();
      }
      for (const m of motes) {
        m.y -= m.s;
        if (m.y < -4) {
          m.y = h + 4;
          m.x = Math.random() * w;
        }
        const tw = 0.65 + 0.35 * Math.sin(t * 1.4 + m.ph);
        ctx2d.globalAlpha = m.o * tw;
        ctx2d.fillStyle = "#c9a86a";
        ctx2d.beginPath();
        ctx2d.arc(m.x, m.y, m.r, 0, 7);
        ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return <canvas ref={ref} className="ember-field" aria-hidden="true" />;
}

/* ---------- orkestrator intro + scroll + tilt ---------- */
export function useMegahFx(
  rootRef: React.RefObject<HTMLDivElement | null>,
  gridKey: string,
  veilDone: boolean
) {
  // Intro hero: sekali, setelah tabir selesai.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !veilDone) return;
    if (reducedMotion()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.fromTo(".topbar", { y: -26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8 }, 0)
        .fromTo(".ticker", { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.1)
        .fromTo(".hero .eyebrow", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 0.15)
        .fromTo(
          ".mg-line-inner",
          { yPercent: 112, rotate: 2.5 },
          { yPercent: 0, rotate: 0, duration: 1.05, stagger: 0.1 },
          0.22
        )
        .fromTo(".hero-note, .dial", { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.12 }, 0.55)
        .fromTo(".stat", { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.09 }, 0.65)
        .fromTo(".filters", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 }, 0.8);
      // Angka statistik mencacah naik.
      root.querySelectorAll<HTMLElement>(".stat b[data-count]").forEach((b) => {
        const target = Number(b.dataset.count || "0");
        const o = { v: 0 };
        tl.to(
          o,
          { v: target, duration: 1.1, ease: "power2.out", onUpdate: () => (b.textContent = String(Math.round(o.v))) },
          0.7
        );
      });
      // Cincin dial tersapu dari nol.
      const ring = root.querySelector<HTMLElement>(".dial-ring");
      if (ring) {
        const end = ring.dataset.p || "40%";
        tl.fromTo(ring, { "--p": "0%" } as gsap.TweenVars, { "--p": end, duration: 1.3, ease: "expo.out" } as gsap.TweenVars, 0.6);
      }
      // Parallax halus: hero melayang, dial berputar saat menggulir.
      gsap.to(".hero-left", {
        yPercent: -6,
        opacity: 0.55,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 },
      });
      gsap.to(".dial", {
        rotate: 24,
        ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.8 },
      });
    }, root);
    return () => ctx.revert();
  }, [rootRef, veilDone]);

  // Kartu: terungkap saat masuk viewport, tiap susunan baru.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !veilDone || reducedMotion()) return;
    const ctx = gsap.context(() => {
      const cards = gsap.utils.toArray<HTMLElement>(".grid .card");
      cards.forEach((card, i) => {
        // Catatan: JANGAN animasikan `filter` di sini — properti string tunggal
        // itu diperebutkan tween lain (pop saat segel pecah) dan bisa macet
        // di tengah jalan meninggalkan blur permanen. y/opacity aman karena
        // komponen transform terpisah.
        gsap.fromTo(
          card,
          { y: 34, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.85,
            ease: "expo.out",
            delay: Math.min(i * 0.05, 0.4),
            clearProps: "opacity,transform",
            scrollTrigger: { trigger: card, start: "top 92%", once: true },
          }
        );
      });
      ScrollTrigger.refresh();
    }, root);
    return () => ctx.revert();
  }, [rootRef, veilDone, gridKey]);

  // Segarkan pemicu scroll saat tab kembali terlihat (rAF sempat beku).
  useLayoutEffect(() => {
    const onVis = () => {
      if (!document.hidden) ScrollTrigger.refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Miring 3D + kilau pada kartu: delegasi sekali pasang.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion()) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const grid = root.querySelector(".grid");
    if (!grid) return;
    const tilts = new WeakMap<HTMLElement, { rx: (v: number) => void; ry: (v: number) => void }>();
    const onMove = (e: Event) => {
      const me = e as MouseEvent;
      const card = (me.target as HTMLElement).closest?.(".card") as HTMLElement | null;
      if (!card) return;
      let t = tilts.get(card);
      if (!t) {
        t = {
          rx: gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3" }),
          ry: gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3" }),
        };
        tilts.set(card, t);
        gsap.set(card, { transformPerspective: 850 });
      }
      const r = card.getBoundingClientRect();
      t.rx(((me.clientY - r.top) / r.height - 0.5) * -7);
      t.ry(((me.clientX - r.left) / r.width - 0.5) * 9);
      card.style.setProperty("--mx", `${((me.clientX - r.left) / r.width) * 100}%`);
      card.style.setProperty("--my", `${((me.clientY - r.top) / r.height) * 100}%`);
    };
    const onOut = (e: Event) => {
      const me = e as MouseEvent;
      const card = (me.target as HTMLElement).closest?.(".card") as HTMLElement | null;
      if (!card || (card.contains(me.relatedTarget as Node) )) return;
      const t = tilts.get(card);
      if (t) {
        t.rx(0);
        t.ry(0);
      } else {
        gsap.to(card, { rotationX: 0, rotationY: 0, duration: 0.6, ease: "power3" });
      }
    };
    grid.addEventListener("mousemove", onMove);
    grid.addEventListener("mouseout", onOut);
    return () => {
      grid.removeEventListener("mousemove", onMove);
      grid.removeEventListener("mouseout", onOut);
    };
  }, [rootRef]);
}
