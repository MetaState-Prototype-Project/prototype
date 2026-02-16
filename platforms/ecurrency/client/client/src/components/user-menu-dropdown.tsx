import { useState } from "react";
import { ChevronDown, LogOut, User, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

interface UserMenuDropdownProps {
  accountContext: { type: "user" | "group"; id: string } | null;
  onAccountContextChange: (context: { type: "user" | "group"; id: string } | null) => void;
}

export default function UserMenuDropdown({ accountContext, onAccountContextChange }: UserMenuDropdownProps) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const { data: groups } = useQuery({
    queryKey: ["userGroups"],
    queryFn: async () => {
      const response = await apiClient.get("/api/groups/my");
      return response.data;
    },
    enabled: !!user,
  });

  const adminGroups = groups?.filter((g: any) => g.isAdmin) || [];
  const hasAdminGroups = adminGroups.length > 0;

  const currentAccountName = accountContext?.type === "user"
    ? (user?.name || user?.ename || "Personal Account")
    : (groups?.find((g: any) => g.id === accountContext?.id)?.name || "Group");

  if (!user) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
      >
        <span className="text-sm font-medium">Currently managing: {currentAccountName}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white border rounded-lg shadow-lg z-20 overflow-hidden">
            {/* User info */}
            <div className="px-4 py-3 border-b bg-gray-50">
              <div className="text-sm font-medium">{user?.name || user?.ename}</div>
              {user?.ename && (
                <div className="text-xs text-muted-foreground mt-1">{user.ename}</div>
              )}
            </div>

            {/* Account switcher section */}
            {hasAdminGroups && (
              <>
                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Switch Account
                </div>
                <button
                  onClick={() => {
                    onAccountContextChange({ type: "user", id: user.id });
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 hover:bg-accent transition-colors flex items-center gap-2 ${
                    accountContext?.type === "user" ? "bg-primary/10" : ""
                  }`}
                >
                  <User className="h-4 w-4" />
                  My Account
                </button>
                {adminGroups.map((group: any) => (
                  <button
                    key={group.id}
                    onClick={() => {
                      onAccountContextChange({ type: "group", id: group.id });
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-accent transition-colors flex items-center gap-2 ${
                      accountContext?.type === "group" && accountContext?.id === group.id ? "bg-primary/10" : ""
                    }`}
                  >
                    <Users className="h-4 w-4" />
                    {group.name}
                  </button>
                ))}
                <div className="border-t my-1" />
              </>
            )}

            {/* Logout button */}
            <button
              onClick={() => {
                logout();
                setIsOpen(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
}

