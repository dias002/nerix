import { cn } from "./utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-[var(--radius-control)] bg-[var(--surface-2)]", className)}
      {...props}
    />
  );
}

export { Skeleton };
