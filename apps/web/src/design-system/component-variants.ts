export const surfaceClasses = {
  quiet: "ns-surface-quiet",
  panel: "ns-surface-panel",
  signal: "ns-signal-halo",
} as const;

export const buttonClasses = {
  primary: "nd-primary-action",
  secondary: "nd-secondary-action",
  shell: "ns-shell-button",
} as const;

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-[var(--signal-mint)] focus-visible:outline-offset-2";
