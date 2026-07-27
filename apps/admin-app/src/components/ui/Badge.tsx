import type { ReactNode } from "react";

const variants = {
  default: "bg-black/5 text-ink-soft",
  teal: "bg-teal/10 text-teal-deep",
  rust: "bg-rust/10 text-rust",
  gold: "bg-gold/10 text-amber-800",
  sage: "bg-sage/20 text-green-800",
  outline: "bg-transparent border border-border text-ink-soft",
};

const sizes = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-[11px]",
  lg: "px-3 py-1.5 text-xs",
};

interface BadgeProps {
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
}

export function Badge({ children, variant = "default", size = "md", className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center font-mono font-semibold uppercase tracking-wider rounded-full ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </span>
  );
}
