"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ReelAnimationProps {
  text: string;
  className?: string;
  animateOnHover?: boolean;
}

export function ReelAnimation({
  text,
  className = "",
  animateOnHover = true,
}: ReelAnimationProps) {
  const [hoverKey, setHoverKey] = useState(0);

  const characters = String(text).split("");

  const handleHover = useCallback(() => {
    if (animateOnHover) {
      setHoverKey((prev) => prev + 1);
    }
  }, [animateOnHover]);

  return (
    <span
      className={`inline-flex overflow-hidden cursor-default ${className}`}
      onMouseEnter={handleHover}
    >
      <AnimatePresence mode="popLayout" initial={true}>
        {characters.map((char, index) => (
          <motion.span
            key={`${hoverKey}-${index}-${char}`}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "-100%", opacity: 0 }}
            transition={{
              duration: 0.5,
              ease: [0.32, 0.72, 0, 1],
              delay: index * 0.02,
            }}
            className="inline-block"
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}
