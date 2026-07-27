import { ButtonHTMLAttributes, forwardRef } from "react";

const variants = {
  primary: "bg-teal text-white hover:bg-teal-deep active:bg-teal-deep disabled:opacity-50",
  secondary: "bg-paper-raised text-ink border border-border hover:border-ink/30 active:bg-paper",
  ghost: "bg-transparent text-ink-soft hover:text-ink hover:bg-black/5",
  danger: "bg-rust text-white hover:opacity-90 active:opacity-80 disabled:opacity-50",
  outline: "bg-transparent text-ink border border-border hover:border-teal hover:text-teal",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, children, disabled, className = "", ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {loading && <Spinner size="sm" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

function Spinner({ size = "sm" }: { size?: "sm" | "md" | "lg" }) {
  const px = size === "sm" ? "h-4 w-4" : size === "md" ? "h-5 w-5" : "h-6 w-6";
  return (
    <svg className={`animate-spin ${px}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
