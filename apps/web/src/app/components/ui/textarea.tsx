import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "field-sizing-content flex min-h-16 w-full resize-none rounded-[var(--radius-input)] border border-[var(--line-subtle)] bg-[var(--surface-1)] px-3 py-2 text-base text-[var(--text-primary)] outline-none transition-[background-color,border-color,box-shadow,color] duration-[var(--duration-fast)] placeholder:text-[var(--text-tertiary)] focus-visible:border-[rgba(115,230,194,0.38)] focus-visible:shadow-[var(--shadow-signal)] focus-visible:outline-2 focus-visible:outline-[var(--signal-mint)] focus-visible:outline-offset-2 aria-invalid:border-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
