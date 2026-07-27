interface AvatarProps {
  name: string;
  avatar?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Avatar({ name, avatar, size = "md", className = "" }: AvatarProps) {
  const px = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-11 w-11 text-base" }[size];
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (avatar) {
    return (
      <img
        src={avatar}
        alt={name}
        className={`rounded-full object-cover ${px} ${className}`}
      />
    );
  }

  return (
    <div className={`rounded-full bg-teal text-white flex items-center justify-center font-bold ${px} ${className}`}>
      {initial}
    </div>
  );
}
