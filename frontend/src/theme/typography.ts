export const typography = {
  fontFamily:
    "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif",

  h1: {
    fontSize: "1.25rem",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  h2: {
    fontSize: "1rem",
    fontWeight: 600,
    lineHeight: 1.4,
  },
  body: {
    fontSize: "0.875rem",
    fontWeight: 400,
    lineHeight: 1.4,
  },
  caption: {
    fontSize: "0.75rem",
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: "0.03em",
  },
} as const;

export type Typography = typeof typography;


