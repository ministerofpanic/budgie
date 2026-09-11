import { colors } from "../theme";

// Exact recreation of apps/web/src/app/icon.svg for brand consistency.
const BirdMark = ({ size = 120 }: { readonly size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill={colors.primary} />
    <path
      d="M9 20c0-5 3.5-9 9-9 2.8 0 4.5 1.4 4.5 1.4l-2 1.6 2 .8s-1 3.3-4.5 4.4C16.5 22 13 23.5 9 23.5c1.3-1 2-2 2.3-3.1C10.2 20.9 9 20 9 20Z"
      fill="white"
    />
    <circle cx="19.5" cy="13" r="1" fill={colors.primary} />
  </svg>
);

export { BirdMark };
