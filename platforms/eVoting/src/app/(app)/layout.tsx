"use client";
import Navigation from "@/components/navigation";
import { authClient } from "@/lib/auth-client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AppLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const router = useRouter();
    const session = authClient.useSession(); // ✅ correct usage of hook

    useEffect(() => {
        if (!session.data && !session.isPending) {
            router.push("/login");
        }
    }, [session.data, session.isPending, router]);

    if (session.isPending) {
        return <div>Loading...</div>; // Optional: show loading UI
    }

    return (
        <>
            <Navigation />
            {children}
        </>
    );
}
