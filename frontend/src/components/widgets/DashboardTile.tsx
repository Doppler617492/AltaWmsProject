import React from "react";
import { colors } from '../../theme/colors';
import { typography } from "../../../src/theme/typography";

type DashboardTileProps = {
  title: string;
  icon?: React.ReactNode;
  lines: Array<{ label: string; value: string; color?: string }>;
  footerActionLabel?: string;
  onFooterAction?: () => void;
};

export const DashboardTile: React.FC<DashboardTileProps> = ({
  title,
  icon,
  lines,
  footerActionLabel,
  onFooterAction,
}) => {
  return (
    <div
      style={{
        background: "linear-gradient(175deg,#151922 0%,#090b11 100%)",
        borderRadius: "18px",
        border: "1px solid rgba(255,255,255,0.05)",
        padding: "1.35rem",
        minWidth: 260,
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        gap: "0.8rem",
        fontFamily: typography.fontFamily,
        boxShadow: "0 18px 35px rgba(0,0,0,0.55)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        {icon && (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </div>
        )}
        <div style={{ ...typography.h2, color: "#ffffff", lineHeight: 1.2, fontSize: 18 }}>{title}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
        {lines.map((l, idx) => (
          <div
            key={idx}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 15,
              fontWeight: 600,
              color: l.color ?? "#e5e7eb",
            }}
          >
            <span style={{ color: "rgba(229,231,235,0.65)", fontWeight: 400 }}>{l.label}</span>
            <span>{l.value}</span>
          </div>
        ))}
      </div>

      {footerActionLabel && (
        <button
          type="button"
          onClick={onFooterAction}
          style={{
            marginTop: "0.5rem",
            fontSize: 12,
            color: colors.brandYellow,
            textAlign: "right",
            cursor: "pointer",
            background: "transparent",
            border: "none",
            alignSelf: "flex-end",
            padding: 0,
            letterSpacing: 0.5,
          }}
        >
          {footerActionLabel} →
        </button>
      )}
    </div>
  );
};


