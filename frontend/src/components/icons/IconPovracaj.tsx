import React from "react";

interface IconPovracajProps {
  size?: number;
  color?: string;
}

export const IconPovracaj: React.FC<IconPovracajProps> = ({ size = 18, color = "#3b82f6" }) => (
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
      fill="rgba(59,130,246,0.12)"
    />
    <path
      d="M8 9L12 13L16 9"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 13V17"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export default IconPovracaj;

