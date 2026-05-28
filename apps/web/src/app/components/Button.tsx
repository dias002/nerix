import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
}

export default function Button({
  children,
  variant = "primary",
  onClick,
  type = "button",
  disabled = false,
  className = "",
}: ButtonProps) {
  const variants = {
    primary: `
      bg-white text-black
      hover:bg-gray-200
      disabled:opacity-20
    `,
    secondary: `
      bg-white/[0.04] text-white border border-white/[0.08]
      hover:bg-white/[0.06]
      disabled:opacity-20
    `,
    ghost: `
      bg-transparent text-white
      hover:bg-white/[0.03]
      disabled:opacity-20
    `,
  };

  const shadowStyles = {
    primary: {
      boxShadow: "0 4px 16px rgba(255, 255, 255, 0.12), 0 2px 6px rgba(255, 255, 255, 0.08)",
    },
    secondary: {
      boxShadow: "inset 0 1px 2px rgba(255, 255, 255, 0.05), 0 2px 8px rgba(0, 0, 0, 0.4)",
    },
    ghost: {},
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        px-6 py-3 rounded-[20px]
        font-medium text-[14px]
        transition-all duration-200
        disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-black
        ${variants[variant]}
        ${className}
      `}
      style={shadowStyles[variant]}
    >
      {children}
    </button>
  );
}
