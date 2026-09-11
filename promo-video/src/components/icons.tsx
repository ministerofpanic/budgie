// Minimal hand-drawn icon set - no external asset/font dependency, keeps this
// package genuinely self-contained the way the isolation was meant to work.
import type { CSSProperties } from "react";

type IconProps = { readonly size?: number; readonly color?: string; readonly style?: CSSProperties };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const BankIcon = ({ size = 40, color = "white", style }: IconProps) => (
  <svg {...base(size)} color={color} style={style}>
    <path d="M3 10 12 4l9 6" />
    <path d="M4 10v9M9 10v9M15 10v9M20 10v9" />
    <path d="M2 21h20" />
  </svg>
);

export const GlobeIcon = ({ size = 40, color = "white", style }: IconProps) => (
  <svg {...base(size)} color={color} style={style}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
  </svg>
);

export const WifiOffIcon = ({ size = 40, color = "white", style }: IconProps) => (
  <svg {...base(size)} color={color} style={style}>
    <path d="M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 3.5-2.4M19 13a10 10 0 0 0-3-2.2M2 8.5A15 15 0 0 1 6 6M22 8.5a15 15 0 0 0-2.5-1.8" />
    <circle cx="12" cy="19.5" r="1" fill={color} stroke="none" />
    <path d="M2 2l20 20" />
  </svg>
);

export const FingerprintIcon = ({ size = 40, color = "white", style }: IconProps) => (
  <svg {...base(size)} color={color} style={style}>
    <path d="M12 3a7 7 0 0 1 7 7c0 3-1 5-1 7" />
    <path d="M12 3a7 7 0 0 0-7 7c0 4 1.5 6 1.5 9" />
    <path d="M9 10a3 3 0 0 1 6 0c0 4 1 6 2 8" />
    <path d="M12 10v3c0 3.5 1 5.5 2.5 7.5" />
    <path d="M6 10.5c0 4.5 1.2 6.7 2.5 9" />
  </svg>
);

export const UsersIcon = ({ size = 40, color = "white", style }: IconProps) => (
  <svg {...base(size)} color={color} style={style}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <circle cx="17" cy="8.5" r="2.6" />
    <path d="M15.5 14.2c2.5.4 4.5 2.6 4.5 5.8" />
  </svg>
);

export const DownloadIcon = ({ size = 40, color = "white", style }: IconProps) => (
  <svg {...base(size)} color={color} style={style}>
    <path d="M12 3v13" />
    <path d="M6.5 11.5 12 17l5.5-5.5" />
    <path d="M3 21h18" />
  </svg>
);

export const CheckIcon = ({ size = 24, color = "white", style }: IconProps) => (
  <svg {...base(size)} color={color} style={style}>
    <path d="M4 12.5 9.5 18 20 6" />
  </svg>
);
