"use client";

import { useRef } from "react";

export function VerificationCode({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  function fill(text: string, index: number) {
    const digits = text.replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    const start = digits.length === 6 ? 0 : Math.min(index, value.length);
    const next = (value.slice(0, start) + digits + value.slice(start + digits.length)).slice(0, 6);
    onChange(next);
    inputs.current[Math.min(start + digits.length, 5)]?.focus();
  }
  return <fieldset className="verification-code" disabled={disabled}>
    <legend>Verification code</legend>
    <div className="verification-code-boxes">
      {Array.from({ length: 6 }, (_, index) => <input
        key={index}
        ref={(element) => { inputs.current[index] = element; }}
        aria-label={`Digit ${index + 1} of 6`}
        type="text" inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"}
        value={value[index] || ""} pattern="[0-9]" required
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          if (!event.target.value) onChange(value.slice(0, index) + value.slice(index + 1));
          else fill(event.target.value, index);
        }}
        onPaste={(event) => { event.preventDefault(); fill(event.clipboardData.getData("text"), index); }}
        onKeyDown={(event) => {
          if (event.key === "Backspace") {
            event.preventDefault();
            const target = value[index] ? index : Math.max(0, index - 1);
            onChange(value.slice(0, target) + value.slice(target + 1));
            inputs.current[target]?.focus();
          } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            inputs.current[Math.max(0, Math.min(5, index + (event.key === "ArrowLeft" ? -1 : 1)))]?.focus();
          }
        }}
      />)}
    </div>
  </fieldset>;
}
