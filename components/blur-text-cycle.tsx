"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`";

interface BlurTextCycleProps {
  texts: string[];
  className?: string;
  scrambleDuration?: number;
  scrambleDelay?: number;
  cycleInterval?: number;
}

export function BlurTextCycle({
  texts,
  className,
  scrambleDuration = 1200,
  scrambleDelay = 600,
  cycleInterval = 3000,
}: BlurTextCycleProps) {
  const [index, setIndex] = useState(0);
  const [scrambleDone, setScrambleDone] = useState(false);
  const [display, setDisplay] = useState(texts[0]);
  const frameRef = useRef<number>(0);

  // Scramble function for the first text
  const runScramble = useCallback(() => {
    const text = texts[0];
    const chars = text.split("");
    const totalFrames = Math.round(scrambleDuration / 16);
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
        setScrambleDone(true);
      }
    };

    // Start fully scrambled
    setDisplay(
      chars
        .map((c) => (c === " " ? " " : CHARS[Math.floor(Math.random() * CHARS.length)]))
        .join("")
    );
    frameRef.current = requestAnimationFrame(tick);
  }, [texts, scrambleDuration]);

  // Handle mount and initial scramble
  useEffect(() => {
    // Initial scrambled text immediately
    const chars = texts[0].split("");
    setDisplay(
      chars
        .map((c) => (c === " " ? " " : CHARS[Math.floor(Math.random() * CHARS.length)]))
        .join("")
    );

    const timeout = setTimeout(() => {
      runScramble();
    }, scrambleDelay);

    return () => {
      clearTimeout(timeout);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [runScramble, texts, scrambleDelay]);

  // Handle cycling after scramble is done
  useEffect(() => {
    if (!scrambleDone) return;

    const intervalTimer = setInterval(() => {
      setIndex((prevIndex) => (prevIndex + 1) % texts.length);
    }, cycleInterval);

    return () => clearInterval(intervalTimer);
  }, [scrambleDone, texts.length, cycleInterval]);

  return (
    <span className="inline-block">
      {!scrambleDone ? (
        <span className={className} style={{ cursor: "default" }}>
          {display}
        </span>
      ) : (
        <AnimatePresence mode="wait">
          <motion.span
            key={index}
            initial={index === 0 ? { filter: "blur(0px)", opacity: 1, y: 0 } : { filter: "blur(10px)", opacity: 0, y: 15 }}
            animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
            exit={{ filter: "blur(10px)", opacity: 0, y: -15 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`inline-block ${className}`}
            style={{ cursor: "default" }}
          >
            {texts[index]}
          </motion.span>
        </AnimatePresence>
      )}
    </span>
  );
}
