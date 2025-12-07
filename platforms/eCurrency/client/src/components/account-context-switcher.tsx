import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

interface AccountContextSwitcherProps {
  value: { type: "user" | "group"; id: string } | null;
  onChange: (context: { type: "user" | "group"; id: string } | null) => void;
}

export default function AccountContextSwitcher({ value, onChange }: AccountContextSwitcherProps) {
  const { user } = useAuth();
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

  if (!user || adminGroups.length === 0) {
    return null;
  }

  const currentLabel = value?.type === "user"
    ? "My Account"
    : adminGroups.find((g: any) => g.id === value?.id)?.name || "My Account";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
      >
        <span className="text-sm font-medium">{currentLabel}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-20">
            <button
              onClick={() => {
                onChange({ type: "user", id: user.id });
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 hover:bg-accent transition-colors ${
                value?.type === "user" ? "bg-primary/10" : ""
              }`}
            >
              My Account
            </button>
            {adminGroups.map((group: any) => (
              <button
                key={group.id}
                onClick={() => {
                  onChange({ type: "group", id: group.id });
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-accent transition-colors ${
                  value?.type === "group" && value?.id === group.id ? "bg-primary/10" : ""
                }`}
              >
                {group.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

