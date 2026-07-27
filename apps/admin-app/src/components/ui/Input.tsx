import { InputHTMLAttributes, forwardRef, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="font-mono text-[10.5px] uppercase tracking-wider text-ink-soft">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-all duration-150 placeholder:text-ink-soft/60 focus:border-teal focus:ring-3 focus:ring-teal/10 ${error ? "border-rust" : "border-border"} ${className}`}
          {...props}
        />
        {error && <span className="text-xs text-rust">{error}</span>}
        {hint && !error && <span className="text-xs text-ink-soft">{hint}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";

interface PasswordInputProps extends Omit<InputProps, "type"> {
  showToggle?: boolean;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showToggle = true, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <Input ref={ref} type={visible ? "text" : "password"} {...props} />
        {showToggle && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3 top-[38px] text-xs font-mono text-ink-soft hover:text-ink transition-colors"
            tabIndex={-1}
          >
            {visible ? "Hide" : "Show"}
          </button>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
