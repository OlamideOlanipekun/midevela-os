import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        paper: "var(--paper)",
        "paper-raised": "var(--paper-raised)",
        border: "var(--border)",
        line: "var(--line)",
        teal: "var(--teal)",
        "teal-deep": "var(--teal-deep)",
        rust: "var(--rust)",
        gold: "var(--gold)",
        sage: "var(--sage)",
        "pine-black": "var(--pine-black)",
        "pop-sage": "var(--pop-sage)",
      },
      fontFamily: {
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
        display: ["Playfair Display", "serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
      },
    },
  },
} satisfies Config;
