"use client";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
// import { useQRCode } from "next-qrcode";

export default function LoginPage() {
    // const { SVG } = useQRCode();
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<null | string>(null);
    const handleSubmit = async () => {
        const res = await authClient.signIn.email({
            email,
            password,
        });
        if (res.error?.message) {
            console.error("Login failed:", res.error.message);
            setError(res.error.message);
            return;
        }
        console.log("Login successful:", res.data);
        router.push("/");
    };
    return (
        <div className="flex flex-col items-center justify-center gap-4 mt-4">
            <div className="flex flex-col items-center text-center gap-4">
                <div className="flex items-center gap-2 text-2xl font-bold">
                    <img src="/Logo.png" alt="eVoting Logo" className="h-12" />
                    eVoting
                </div>
                <p className="text-2xl">Secure voting in the W3DS</p>
            </div>
            <Card className="flex flex-col items-center gap-1 w-1/3 p-4 pt-2">
                <CardHeader className="text-foreground text-2xl font-black">
                    Welcome to eVoting
                </CardHeader>
                <div className="flex flex-col gap-4 text-muted-foreground items-center">
                    <div className="flex justify-center items-center text-xl space-x-1 whitespace-nowrap">
                        <span>Scan the QR using your</span>
                        <span className="font-bold underline">eID App</span>
                        <span>to login</span>
                    </div>
                    {error !== null && (
                        <div className="w-full text-red-500 text-center">
                            {error}
                        </div>
                    )}
                    {/* <SVG
                        text={"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}
                        options={{
                            margin: 2,
                            width: 200,
                            color: {
                                dark: "#000000",
                                light: "#FFFFFF",
                            },
                        }}
                    /> */}
                    <Input
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="text"
                    />
                    <Input
                        placeholder="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                    />
                    <Button onClick={handleSubmit}>Submit</Button>
                    {/* <p>Features you'll get access to:</p>
                    <ul className="flex flex-col gap-2 list-disc">
                        <li>Create public and blind votes</li>
                        <li>Vote on active polls</li>
                        <li>View real-time results</li>
                        <li>Manage your created votes</li>
                    </ul> */}
                    <span className="flex flex-col gap-2 items-center">
                        <p className="font-bold text-md">
                            The code is only valid for 60 seconds
                        </p>
                        <p>Please refresh the page if it expires</p>
                    </span>
                    <div className="bg-muted-foreground/20 p-4 rounded-md text-center">
                        You are entering eVoting - a voting platform built on
                        the Web 3.0 Data Space (WDS) architecture. This system
                        is designed around the principle of data-platform
                        separation, where all your personal content is stored in
                        your own sovereign eVault, not on centralised servers.
                    </div>
                </div>
            </Card>
            <img src="/W3DS.svg" alt="w3ds Logo" className="max-h-8" />
        </div>
    );
}
