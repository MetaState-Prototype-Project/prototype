"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { apiClient } from "@/lib/apiClient";

function MigrateContent() {
    const searchParams = useSearchParams();
    const provisionerUrl = searchParams?.get("provisioner");
    const [migrationId, setMigrationId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [qrData, setQrData] = useState<string | null>(null);
    const [status, setStatus] = useState<string>("");
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!provisionerUrl) {
            setError("Provisioner URL is required");
            return;
        }

        const initiateMigration = async () => {
            try {
                const response = await apiClient.post("/api/migration/initiate", {
                    provisionerUrl,
                });
                setMigrationId(response.data.migrationId);
            } catch (error) {
                console.error("Error initiating migration:", error);
                setError("Failed to initiate migration");
            }
        };

        initiateMigration();
    }, [provisionerUrl]);

    useEffect(() => {
        if (!migrationId) return;

        const createSigningSession = async () => {
            try {
                const response = await apiClient.post("/api/migration/sign", {
                    migrationId,
                });
                setSessionId(response.data.sessionId);
                setQrData(response.data.qrData);
            } catch (error) {
                console.error("Error creating signing session:", error);
                setError("Failed to create signing session");
            }
        };

        createSigningSession();
    }, [migrationId]);

    useEffect(() => {
        if (!sessionId) return;

        const baseUrl = process.env.NEXT_PUBLIC_EMOVER_BASE_URL || "http://localhost:4000";
        const eventSource = new EventSource(
            `${baseUrl}/api/migration/sessions/${sessionId}`
        );

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.status) {
                    setStatus(data.status);
                }
                if (data.message) {
                    setLogs((prev) => [...prev, data.message]);
                }
            } catch (error) {
                console.error("Error parsing SSE data:", error);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => eventSource.close();
    }, [sessionId]);

    if (error) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    {error}
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-8">Migration in Progress</h1>

            {qrData && (
                <div className="bg-white p-6 rounded-lg shadow mb-6">
                    <h2 className="text-xl font-semibold mb-4">
                        Scan QR Code to Confirm Migration
                    </h2>
                    <div className="flex justify-center">
                        <QRCodeSVG value={qrData} size={256} />
                    </div>
                </div>
            )}

            {status && (
                <div className="bg-white p-6 rounded-lg shadow mb-6">
                    <h2 className="text-xl font-semibold mb-4">Status</h2>
                    <p className="text-lg">{status}</p>
                </div>
            )}

            {logs.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Logs</h2>
                    <div className="space-y-1 font-mono text-sm">
                        {logs.map((log, index) => (
                            <div key={index}>{log}</div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function MigratePage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <MigrateContent />
        </Suspense>
    );
}

