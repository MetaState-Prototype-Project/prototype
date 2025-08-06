import { useAuth } from "@lib/context/auth-context";
import type { User } from "@lib/types/user";
import { useRouter } from "next/router";
import { useEffect } from "react";

export function useRequireAuth(redirectUrl?: string): User | null {
    const { user, loading } = useAuth();
    const { replace } = useRouter();

    useEffect(() => {
        if (!loading && !user) void replace(redirectUrl ?? "/");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, loading]);

    return user;
}
