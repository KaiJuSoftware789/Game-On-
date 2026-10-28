"use client";

import { useEffect, useRef, useState } from "react";

export function HoldCloseTicket({ busy, onConfirm }: { busy: boolean; onConfirm: () => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const input = useRef<"pointer" | "keyboard" | null>(null);
  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    input.current = null;
    setHolding(false);
  }
  function start(source: "pointer" | "keyboard") {
    if (busy || input.current) return;
    input.current = source;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onConfirm();
    }, 1000);
  }
  useEffect(() => {
    const abort = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      input.current = null;
      setHolding(false);
    };
    window.addEventListener("blur", abort);
    document.addEventListener("visibilitychange", abort);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("blur", abort);
      document.removeEventListener("visibilitychange", abort);
    };
  }, []);
  return <button ref={button} type="button" className={`button quiet hold-close-ticket ${holding ? "holding" : ""}`} disabled={busy}
    aria-label="Hold for 1 second to close ticket" title="Hold for 1 second to close"
    onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      start("pointer");
    }}
    onPointerMove={event => {
      if (input.current !== "pointer") return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) cancel();
    }}
    onPointerUp={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel} onBlur={cancel}
    onKeyDown={event => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      if (!event.repeat) start("keyboard");
    }}
    onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); cancel(); } }}
    onContextMenu={event => event.preventDefault()}
  ><span className="hold-close-progress" aria-hidden="true" /><span className="hold-close-label">{holding || busy ? "Closing ticket...." : "Close ticket"}</span></button>;
}
