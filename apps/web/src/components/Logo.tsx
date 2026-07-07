import React from "react";

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 36, showText = true, className = "" }: LogoProps) {
  return (
    <div className={`logo ${className}`}>
      <svg
        viewBox="0 0 60 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
      >
        <polyline
          points="8,30 30,10 52,30"
          stroke="#1EE67A"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect
          x="14"
          y="30"
          width="32"
          height="20"
          rx="1"
          stroke="#1EE67A"
          strokeWidth="3.5"
          fill="none"
        />
        <path
          d="M23 50 L23 38 Q30 30 37 38 L37 50"
          stroke="#1EE67A"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {showText && <span className="logo-wordmark">MIDEVELA</span>}
    </div>
  );
}
