"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const BASE_R = 7; // px radius for the cursor dot
const RIPPLE_R = 16; // base radius for the click ripple

type Ripple = { id: number; x: number; y: number };

export function ClickEffects() {
  const wrapRef = useRef<HTMLDivElement>(null);

  const target = useRef({ x: -100, y: -100 });
  const pos = useRef({ x: -100, y: -100 });
  const scale = useRef(1);
  const hovering = useRef(false);
  const pressed = useRef(false);
  const rid = useRef(0);

  const [ready, setReady] = useState(false);
  const [fine, setFine] = useState(false);
  const [ripples, setRipples] = useState<Ripple[]>([]);

  useEffect(() => {
    const isFine = window.matchMedia("(pointer: fine)").matches;
    setReady(true);
    setFine(isFine);
    if (isFine) document.body.classList.add("cursor-none");

    const down = (ev: PointerEvent) => {
      const id = rid.current++;
      setRipples((prev) => [...prev, { id, x: ev.clientX, y: ev.clientY }]);
      window.setTimeout(
        () => setRipples((prev) => prev.filter((r) => r.id !== id)),
        900
      );
      if (isFine) pressed.current = true;
    };
    window.addEventListener("pointerdown", down);

    let raf = 0;
    let move: ((e: PointerEvent) => void) | undefined;
    let up: (() => void) | undefined;

    if (isFine) {
      move = (ev) => {
        target.current.x = ev.clientX;
        target.current.y = ev.clientY;
        const el = ev.target as Element | null;
        hovering.current = Boolean(
          el?.closest?.("a, button, [role='button'], input, textarea, label, [onClick]")
        );
      };
      up = () => (pressed.current = false);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);

      const loop = () => {
        pos.current.x += (target.current.x - pos.current.x) * 0.18;
        pos.current.y += (target.current.y - pos.current.y) * 0.18;
        const targetScale = pressed.current ? 0.6 : hovering.current ? 1.8 : 1;
        scale.current += (targetScale - scale.current) * 0.2;

        if (wrapRef.current) {
          wrapRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%) scale(${scale.current})`;
          wrapRef.current.style.opacity = hovering.current ? "0.55" : "1";
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", down);
      if (move) window.removeEventListener("pointermove", move);
      if (up) window.removeEventListener("pointerup", up);
      document.body.classList.remove("cursor-none");
    };
  }, []);

  if (!ready) return null;

  return (
    <>
      {/* Circle ripples on click / tap */}
      <div className="pointer-events-none fixed inset-0 z-[9998] overflow-hidden">
        <AnimatePresence>
          {ripples.map((r) => (
            <div key={r.id} className="absolute" style={{ left: r.x, top: r.y }}>
              {/* Outer Primary Ripple (Emerald) */}
              <motion.div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.6px] border-primary"
                style={{ width: RIPPLE_R * 2, height: RIPPLE_R * 2 }}
                initial={{ scale: 0.5, opacity: 0.9 }}
                animate={{ scale: 6, opacity: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              />
              {/* Inner Secondary Ripple (Warm white) */}
              <motion.div
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/80"
                style={{ width: RIPPLE_R * 2, height: RIPPLE_R * 2 }}
                initial={{ scale: 0.5, opacity: 0.35 }}
                animate={{ scale: 8.5, opacity: 0 }}
                transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>

      {/* Custom cursor dot (mouse only) */}
      {fine && (
        <div
          ref={wrapRef}
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[9999] h-3.5 w-3.5 rounded-full bg-primary"
          style={{ transition: "opacity 0.2s ease, transform 0.05s linear", willChange: "transform" }}
        />
      )}
    </>
  );
}
