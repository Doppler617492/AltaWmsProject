import React from "react";
import { colors } from '../../theme/colors';

export const IconPutaway: React.FC<{ size?: number; color?: string }> = ({
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
    <path d="M4 4h6v6H4z" />
    <path d="M14 4h6v6h-6z" />
    <path d="M4 14h6v6H4z" />
    <path d="M14 14h6v6h-6z" />
    <path d="M9 2v20M2 9h20" />
    <path d="M15 2v20M2 15h20" />
  </svg>
);

