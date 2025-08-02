"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";

export default function LogoutPage() {
    const router = useRouter();

    useEffect(() => {
        const logout = async () => {
            await authClient.signOut();
            router.push("/login");
        };
        logout();
    }, [router]);

    return (
        <div>
            <h1>Logout</h1>
            <p>You are being logged out.</p>
        </div>
    );
}
