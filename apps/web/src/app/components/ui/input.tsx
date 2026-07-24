import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-1)] px-3 py-1 text-base text-[var(--text-primary)] outline-none transition-[background-color,border-color,box-shadow,color] duration-[var(--duration-fast)] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] selection:bg-[var(--signal-mint)] selection:text-[var(--text-inverse)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-[rgba(115,230,194,0.38)] focus-visible:shadow-[var(--shadow-signal)] focus-visible:outline-2 focus-visible:outline-[var(--signal-mint)] focus-visible:outline-offset-2",
        "aria-invalid:border-[var(--danger)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
