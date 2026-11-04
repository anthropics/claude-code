"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "accent" | "success" | "outline";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  animated?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default:
    "bg-[#635BFF]/10 text-[#635BFF] border-[#635BFF]/20",
  accent:
    "bg-[#DA7756]/10 text-[#DA7756] border-[#DA7756]/20",
  success:
    "bg-[#24B47E]/10 text-[#24B47E] border-[#24B47E]/20",
  outline:
    "bg-transparent text-[#525F7F] border-[#E6EBF1]",
};

export function Badge({
  children,
  variant = "default",
  className,
  animated = true,
}: BadgeProps) {
  const Component = animated ? motion.span : "span";
  const animationProps = animated
    ? {
        initial: { opacity: 0, y: -10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, delay: 0.2 },
      }
    : {};

  return (
    <Component
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        variantStyles[variant],
        className
      )}
      {...animationProps}
    >
      {children}
    </Component>
  );
}
