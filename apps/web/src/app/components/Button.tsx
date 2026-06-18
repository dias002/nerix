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
      boxShadow: "var(--button-shadow-primary)",
    },
    secondary: {
      boxShadow: "var(--button-shadow-secondary)",
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
