import { ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  depth?: "subtle" | "medium" | "heavy";
}

export default function GlassPanel({ children, className = "", depth = "medium" }: GlassPanelProps) {
  const depthClasses = {
    subtle: "shadow-[0_2px_8px_rgba(0,0,0,0.4)]",
    medium: "shadow-[0_4px_16px_rgba(0,0,0,0.5)]",
    heavy: "shadow-[0_8px_32px_rgba(0,0,0,0.6)]",
  };
  const depthStyles = {
    subtle: "var(--panel-shadow-subtle)",
    medium: "var(--panel-shadow-medium)",
    heavy: "var(--panel-shadow-heavy)",
  };

  return (
    <div
      className={`
        relative backdrop-blur-xl
        bg-gradient-to-br from-white/[0.04] to-white/[0.01]
        border border-white/[0.06]
        ${depthClasses[depth]}
        ${className}
      `}
      style={{
        boxShadow: depthStyles[depth],
      }}
    >
      {children}
    </div>
  );
}
