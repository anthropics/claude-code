import clsx from "clsx";

export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={clsx(
        "inline-block h-4 w-4 animate-spinSlow rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
