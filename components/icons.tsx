import type { SVGProps } from "react";

type IconName =
  | "game"
  | "tickets"
  | "user"
  | "arrow"
  | "plus"
  | "check"
  | "refresh"
  | "logout"
  | "menu"
  | "close"
  | "clock"
  | "globe";

const paths: Record<IconName, React.ReactNode> = {
  game: (
    <>
      <path d="M6 7h12a3 3 0 0 1 3 2.6l1 7a2.5 2.5 0 0 1-4.2 2.2L14 16h-4l-3.8 2.8A2.5 2.5 0 0 1 2 16.6l1-7A3 3 0 0 1 6 7Z" />
      <path d="M7 10v5m-2.5-2.5h5M16 11h.01M19 14h.01" />
    </>
  ),
  tickets: (
    <>
      <path d="M4 4h16v5a3 3 0 0 0 0 6v5H4v-5a3 3 0 0 0 0-6V4Z" />
      <path d="M14 4v3m0 3v4m0 3v3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12 4 4L19 6" />,
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6 6a8 8 0 0 1 13 2l1 4M4 12l1 4a8 8 0 0 0 13 2" />
    </>
  ),
  logout: (
    <>
      <path d="M9 4H4v16h5m5-13 5 5-5 5m-5-5h10" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </>
  ),
};

export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
