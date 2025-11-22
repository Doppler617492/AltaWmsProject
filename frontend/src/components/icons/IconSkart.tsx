import React from "react";

interface IconSkartProps {
  size?: number;
  color?: string;
}

export const IconSkart: React.FC<IconSkartProps> = ({ size = 18, color = "#FFC300" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
  >
    <path
      d="M12 3L3 19H21L12 3Z"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="rgba(255,212,0,0.12)"
    />
    <path
      d="M12 9V13"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <circle cx="12" cy="16" r="1.2" fill={color} />
  </svg>
);

export default IconSkart;

