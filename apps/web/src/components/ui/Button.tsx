import React from 'react';
import Link from 'next/link';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'on-dark';
  href?: string;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', href, children, className = '', ...props }: ButtonProps) {
  const baseClass = 'btn';
  const combinedClass = `${baseClass} ${variant} ${className}`.trim();

  if (href) {
    return (
      <Link href={href} className={combinedClass}>
        {children}
      </Link>
    );
  }

  return (
    <button className={combinedClass} {...props}>
      {children}
    </button>
  );
}
