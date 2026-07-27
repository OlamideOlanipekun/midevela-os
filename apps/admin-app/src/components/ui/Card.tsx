import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg";
  hover?: boolean;
}

export function Card({ children, className = "", padding = "md", hover = false }: CardProps) {
  const pads = { sm: "p-4", md: "p-5", lg: "p-6" };
  return (
    <div
      className={`bg-paper-raised border border-border rounded-xl ${pads[padding]} ${hover ? "transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-ink/10" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between mb-4 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h3 className={`font-display text-lg font-bold text-ink ${className}`}>{children}</h3>;
}
