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
        boxShadow: `
          ${depth === "heavy" ? "0 8px 32px rgba(0, 0, 0, 0.6)," : ""}
          ${depth === "medium" ? "0 4px 16px rgba(0, 0, 0, 0.5)," : ""}
          0 2px 8px rgba(0, 0, 0, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.05)
        `.trim(),
      }}
    >
      {children}
    </div>
  );
}
