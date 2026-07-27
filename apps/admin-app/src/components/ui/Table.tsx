import type { ReactNode } from "react";

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className={`overflow-x-auto border border-border rounded-xl ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-black/[0.02] border-b border-border">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <th className={`text-left px-4 py-3 text-[10.5px] font-mono font-semibold uppercase tracking-wider text-ink-soft ${className}`}>
      {children}
    </th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children, onClick, className = "" }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-border last:border-b-0 hover:bg-black/[0.02] transition-colors ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-ink ${className}`}>{children}</td>;
}
