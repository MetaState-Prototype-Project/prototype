"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { useQRCode } from "next-qrcode";

export default function LoginPage() {
    const { SVG } = useQRCode();
    return (
        <div className="flex flex-col h-screen items-center justify-center gap-8">
            <div className="flex flex-col items-center text-center gap-4">
                <div className="flex items-center gap-2 text-5xl font-bold">
                    <img src="/Logo.png" alt="eVoting Logo" />
                    eVoting
                </div>
                <p className="text-2xl">Secure voting in the W3DS</p>
            </div>
            <Card className="flex flex-col items-center gap-4 w-96 p-8">
                <CardHeader className="text-foreground text-3xl font-black">
                    Welcome to eVoting
                </CardHeader>
                <div className="flex flex-col gap-4 text-muted-foreground justify-center">
                    <p className="flex justify-center text-xl">
                        Scan QR to sign in
                    </p>
                    <SVG
                        text={"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
                        options={{
                            margin: 2,
                            width: 200,
                            color: {
                                dark: "#000000",
                                light: "#FFFFFF",
                            },
                        }}
                    />
                    <p>Features you'll get access to:</p>
                    <ul className="flex flex-col gap-2 list-disc">
                        <li>Create public and blind votes</li>
                        <li>Vote on active polls</li>
                        <li>View real-time results</li>
                        <li>Manage your created votes</li>
                    </ul>
                </div>
            </Card>
        </div>
    );
}
