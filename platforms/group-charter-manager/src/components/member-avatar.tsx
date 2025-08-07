interface MemberAvatarProps {
  name: string;
  role?: string;
  size?: "sm" | "md" | "lg";
}

export default function MemberAvatar({ name, role, size = "md" }: MemberAvatarProps) {
  // Handle undefined or empty name
  const displayName = name || "Unknown";
  
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  const gradients = [
    "gradient-primary",
    "gradient-secondary",
    "gradient-accent",
    "bg-linear-to-r from-indigo-500 to-purple-500",
    "bg-linear-to-r from-pink-500 to-red-500",
    "bg-linear-to-r from-teal-500 to-green-500",
  ];

  const gradient = gradients[displayName.length % gradients.length];

  return (
    <div className="flex items-center space-x-3">
      <div className={`${sizeClasses[size]} ${gradient} rounded-full flex items-center justify-center`}>
        <span className="text-white font-medium">{initials}</span>
      </div>
      {role && (
        <div>
          <p className="font-medium text-gray-800 text-sm">{displayName}</p>
          <p className="text-xs text-gray-600 capitalize">{role}</p>
        </div>
      )}
    </div>
  );
}
