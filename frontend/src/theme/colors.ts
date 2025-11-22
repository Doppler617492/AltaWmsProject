export const colors = {
  // background surfaces
  bgBody: "#0a0a0a", // main background
  bgPanel: "#1a1a1a", // cards / panels
  bgPanelAlt: "#2f3440", // header sections

  // brand / accent
  brandYellow: "#FFD400", // Alta industrial yellow
  brandYellowDim: "rgba(255,212,0,0.4)",
  brandOrange: "#E67E22", // shipping area
  brandBlueDock: "#3A26FF", // dock
  brandMaterial: "#F8E04E", // materials warehouse

  // text
  textPrimary: "#FFFFFF",
  textSecondary: "#9CA3AF",
  textOnDarkStrong: "#FFD400",

  // status
  statusOk: "#28a745",
  statusWarn: "#FFC107",
  statusErr: "#dc3545",
  statusOffline: "#6c757d",

  borderDefault: "rgba(255,212,0,0.5)",
  borderStrong: "#FFD400",
  borderCard: "#2f2f2f",
} as const;

export type Colors = typeof colors;


