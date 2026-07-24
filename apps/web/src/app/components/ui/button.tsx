import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-sm font-medium transition-[background-color,border-color,color,opacity,transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-standard)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-2 focus-visible:outline-[var(--signal-mint)] focus-visible:outline-offset-2 aria-invalid:border-[var(--danger)]",
  {
    variants: {
      variant: {
        default: "bg-[var(--primary-button)] text-[var(--primary-button-text)] hover:bg-[var(--primary-button-hover)] hover:-translate-y-px active:translate-y-0 active:scale-[0.985]",
        destructive:
          "bg-[var(--danger)] text-white hover:bg-[color-mix(in_srgb,var(--danger)_88%,white)] hover:-translate-y-px active:translate-y-0 active:scale-[0.985]",
        outline:
          "border border-[var(--line-default)] bg-transparent text-[var(--text-primary)] hover:border-[var(--line-strong)] hover:bg-[var(--surface-hover)]",
        secondary:
          "bg-[var(--surface-2)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] hover:-translate-y-px active:translate-y-0 active:scale-[0.985]",
        ghost:
          "text-[var(--text-secondary)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]",
        quiet:
          "text-[var(--text-tertiary)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]",
        link: "min-h-0 rounded-none px-0 text-[var(--signal-blue)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-11 px-6 has-[>svg]:px-4",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
