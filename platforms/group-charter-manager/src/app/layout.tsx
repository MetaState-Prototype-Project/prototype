import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/components/auth/auth-provider";
import DisclaimerModal from "@/components/disclaimer-modal";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Group Charter Manager",
    description: "Manage your group charters and memberships",
    icons: {
        icon: "/logo.png"
    }
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <MaintenanceBanner />
                <AuthProvider>
                    {children}
                    <Toaster />
                    <DisclaimerModal />
                </AuthProvider>
            </body>
        </html>
    );
}
