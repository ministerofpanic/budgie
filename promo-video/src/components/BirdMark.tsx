import { colors } from "../theme";

// Exact recreation of apps/web/src/app/icon.svg for brand consistency
// (lucide-react's "Bird" glyph, matching the app header).
const BirdMark = ({ size = 120 }: { readonly size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill={colors.primary} />
    <g
      transform="translate(6.5, 6.5) scale(0.79)"
      stroke="white"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path d="M16 7h.01" />
      <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
      <path d="m20 7 2 .5-2 .5" />
      <path d="M10 18v3" />
      <path d="M14 17.75V21" />
      <path d="M7 18a6 6 0 0 0 3.84-10.61" />
    </g>
  </svg>
);

export { BirdMark };
