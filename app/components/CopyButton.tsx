"use client";

import { useEffect, useState } from "react";

type CopyState = "idle" | "copied" | "failed";

export default function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied!",
  className = "small-action-button",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timeout = window.setTimeout(() => setState("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [state]);

  const copy = async () => {
    const copyWithSelectionFallback = () => {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    };

    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          if (!copyWithSelectionFallback()) throw new Error("Copy was blocked");
        }
      } else {
        if (!copyWithSelectionFallback()) throw new Error("Copy was blocked");
      }
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <button
      className={`${className} copy-state-button ${state}`}
      type="button"
      onClick={copy}
      aria-live="polite"
      title={state === "failed" ? "Clipboard access was blocked. Select the text and copy it manually." : undefined}
    >
      {state === "copied" ? `✓ ${copiedLabel}` : state === "failed" ? "Copy failed" : label}
    </button>
  );
}
