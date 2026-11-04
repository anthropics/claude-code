"use client";

import { motion, HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  variant?: "default" | "elevated" | "bordered";
  hover?: boolean;
}

const variantStyles = {
  default: "bg-white",
  elevated: "bg-white shadow-[0_4px_6px_rgba(50,50,93,0.1),0_1px_3px_rgba(0,0,0,0.06)]",
  bordered: "bg-white border border-[#E6EBF1]",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "bordered", hover = false, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          "rounded-xl p-6",
          variantStyles[variant],
          className
        )}
        whileHover={
          hover
            ? {
                y: -4,
                boxShadow:
                  "0 13px 27px -5px rgba(50, 50, 93, 0.15), 0 8px 16px -8px rgba(0, 0, 0, 0.2)",
              }
            : undefined
        }
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = "Card";

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className={cn("text-lg font-semibold text-[#32325D]", className)}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={cn("text-sm text-[#525F7F] mt-1", className)}>{children}</p>
  );
}

export function CardContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("", className)}>{children}</div>;
}
