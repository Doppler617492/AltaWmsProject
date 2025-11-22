import React from "react";
import { colors } from '../../theme/colors';

export const IconCycleCount: React.FC<{ size?: number; color?: string }> = ({
  size = 24,
  color = colors.brandYellow,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
    <path d="M8 2h8M16 22H8" />
    <path d="M12 2v2M12 20v2" />
  </svg>
);

