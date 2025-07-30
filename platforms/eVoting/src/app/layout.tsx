import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "eVoting Platform",
    description: "A platform for creating and managing votes",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
