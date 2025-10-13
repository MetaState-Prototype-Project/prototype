import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";

export const metadata: Metadata = {
    title: "eVoting Platform",
    description: "A platform for creating and managing votes",
    icons: {
        icon: "/Logo.png",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                <MaintenanceBanner />
                <AuthProvider>
                    {children}
                </AuthProvider>
            </body>
        </html>
    );
}
