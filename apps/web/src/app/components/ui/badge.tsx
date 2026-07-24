import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const badgeVariants = cva(
  "inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-[var(--radius-pill)] border px-2 text-xs font-medium transition-[background-color,border-color,color] [&>svg]:size-3 [&>svg]:pointer-events-none focus-visible:outline-2 focus-visible:outline-[var(--signal-mint)] focus-visible:outline-offset-2 aria-invalid:border-[var(--danger)]",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--primary-button)] text-[var(--primary-button-text)] [a&]:hover:bg-[var(--primary-button-hover)]",
        secondary:
          "border-[var(--line-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)] [a&]:hover:bg-[var(--surface-hover)]",
        destructive:
          "border-transparent bg-[var(--danger)] text-white [a&]:hover:bg-[color-mix(in_srgb,var(--danger)_88%,white)]",
        outline:
          "border-[var(--line-default)] text-[var(--text-secondary)] [a&]:hover:bg-[var(--surface-1)] [a&]:hover:text-[var(--text-primary)]",
        signal:
          "border-[rgba(115,230,194,0.22)] bg-[rgba(115,230,194,0.10)] text-[var(--signal-mint)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
