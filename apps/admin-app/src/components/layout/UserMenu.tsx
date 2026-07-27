"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/Dropdown";

export function UserMenu() {
  const { admin, logout } = useAuth();
  const { toggle, theme } = useTheme();

  if (!admin) return null;

  const displayName = admin.lastName ? `${admin.firstName} ${admin.lastName}` : admin.firstName;

  return (
    <Dropdown
      trigger={
        <div className="flex items-center gap-2.5 cursor-pointer p-1.5 rounded-lg hover:bg-black/[0.03] transition-colors">
          <Avatar name={displayName} avatar={admin.avatar} size="sm" />
          <div className="hidden md:block text-left">
            <div className="text-sm font-medium text-ink leading-tight">{displayName}</div>
            <div className="text-[10px] font-mono text-ink-soft">{admin.email}</div>
          </div>
        </div>
      }
    >
      <div className="px-4 py-2.5 border-b border-border">
        <div className="text-sm font-medium text-ink">{displayName}</div>
        <div className="text-xs text-ink-soft">{admin.email}</div>
        <div className="flex flex-wrap gap-1 mt-2">
          {admin.roles.map((role) => (
            <span key={role} className="text-[9px] font-mono uppercase tracking-wider bg-teal/10 text-teal-deep px-1.5 py-0.5 rounded">
              {role}
            </span>
          ))}
        </div>
      </div>

      <DropdownItem onClick={toggle}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {theme === "light" ? <><path d="M21 12.79A9 9 0 1111.21 3A7 7 0 0021 12.8z" /></> : <><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></>}
        </svg>
        {theme === "light" ? "Dark mode" : "Light mode"}
      </DropdownItem>

      <DropdownSeparator />

      <DropdownItem onClick={() => window.location.href = "/settings"}>
        Settings
      </DropdownItem>

      <DropdownSeparator />

      <DropdownItem onClick={logout} danger>
        Sign out
      </DropdownItem>
    </Dropdown>
  );
}
