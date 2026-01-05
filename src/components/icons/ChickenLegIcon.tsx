type ChickenLegIconProps = {
  size?: number;
};

// Simple custom icon for a chicken drumstick
export function ChickenLegIcon({ size = 20 }: ChickenLegIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13 3.5c2.7-2 6.5-0.8 7.7 2.3 1.1 2.9-0.5 6.2-3.4 8.6-2.9 2.4-6.5 3.7-8.8 2-1.5 1.4-3.3 1.6-4.6 0.3-1.3-1.3-1.1-3.1 0.3-4.6-1.7-2.3-0.4-5.9 2-8.8C8.6 0.9 11.9-0.6 14.8 0.5" />
      <path d="M7.2 16.8 5 14.6" />
      <path d="M9.4 14.6 7.2 12.4" />
    </svg>
  );
}
