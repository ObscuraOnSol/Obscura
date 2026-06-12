"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`";

interface TextScrambleProps {
  text: string;
  className?: string;
  /** How long the full scramble takes in ms */
  duration?: number;
  /** Delay before the scramble starts on mount (ms) */
  delay?: number;
}

export function TextScramble({
  text,
  className,
  duration = 1200,
  delay = 600,
}: TextScrambleProps) {
  const [display, setDisplay] = useState(text);
  const frameRef = useRef<number>(0);
  const hasPlayedRef = useRef(false);

  const scramble = useCallback(() => {
    // Cancel any running animation
    if (frameRef.current) cancelAnimationFrame(frameRef.current);

    const chars = text.split("");
    const totalFrames = Math.round(duration / 16); // ~60fps
    let frame = 0;

    const tick = () => {
      const progress = frame / totalFrames;
      const resolved = Math.floor(progress * chars.length);

      const output = chars
        .map((char, i) => {
          if (char === " ") return " ";
          if (i < resolved) return char;
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        })
        .join("");

      setDisplay(output);
      frame++;

      if (frame <= totalFrames) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
      }
    };

    // Start with fully scrambled
    setDisplay(
      chars
        .map((c) => (c === " " ? " " : CHARS[Math.floor(Math.random() * CHARS.length)]))
        .join("")
    );
    frameRef.current = requestAnimationFrame(tick);
  }, [text, duration]);

  // Play on mount with delay
  useEffect(() => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;

    // Start scrambled immediately
    const chars = text.split("");
    setDisplay(
      chars
        .map((c) => (c === " " ? " " : CHARS[Math.floor(Math.random() * CHARS.length)]))
        .join("")
    );

    const timeout = setTimeout(() => {
      scramble();
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [scramble, text, delay]);

  return (
    <span
      className={className}
      onMouseEnter={scramble}
      style={{ cursor: "default" }}
    >
      {display}
    </span>
  );
}
