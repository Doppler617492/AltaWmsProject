import React from "react";
import { colors } from '../../theme/colors';

export const IconAdmin: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
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
    {/* Shield + keyhole icon for Administration */}
    <path d="M12 2l7 4v6c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-4z" />
    <circle cx="12" cy="12" r="2" fill={colors.brandYellow} stroke="none" />
    <path d="M12 14v3" />
  </svg>
);
