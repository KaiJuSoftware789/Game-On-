import type { CSSProperties } from "react";

const paths = {
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M7 3v4m10-4v4M3 11h18M7 15h3m4 0h3m-10 3h3" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m9 10.5 6-4m-6 7 6 4" />
    </>
  ),
  edit: (
    <>
      <path d="m16 3 5 5M4 16 17 3a2 2 0 0 1 3 3L7 19l-4 1 1-4ZM12 21h9" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 2v5m-4 3h8m-8 0v-3h8v3" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  players: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M6 11v1a6 6 0 0 0 12 0v-1m-6 7v3m-3 0h6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  gamepad: (
    <>
      <path d="M8 7h8c3 0 4 2 5 8s-2 6-5 2H8c-3 4-6 4-5-2s2-8 5-8Z" />
      <path d="M6 11v4m-2-2h4m8-2h.01m2 3h.01" />
    </>
  ),
  spark: (
    <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h8m4 0h4M4 17h3m4 0h9" />
      <circle cx="14" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
};

export function Icon({
  name,
  className = "",
  style,
}: {
  name: keyof typeof paths;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={`icon ${className}`}
      style={style}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
