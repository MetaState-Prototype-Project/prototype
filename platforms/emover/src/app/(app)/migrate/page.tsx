"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { apiClient } from "@/lib/apiClient";

type MigrationStatus =
    | "initiated"
    | "provisioning"
    | "copying"
    | "verifying"
    | "updating_registry"
    | "marking_active"
    | "completed"
    | "failed";

const STATUS_LABELS: Record<MigrationStatus, string> = {
    initiated: "Migration Initiated",
    provisioning: "Provisioning New eVault",
    copying: "Copying Data",
    verifying: "Verifying Copy",
    updating_registry: "Updating Registry",
    marking_active: "Activating New eVault",
    completed: "Migration Completed",
    failed: "Migration Failed",
};

function MigrateContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const provisionerUrl = searchParams?.get("provisioner");
    const migrationIdParam = searchParams?.get("migrationId"); // Admin provides this
    const [migrationId, setMigrationId] = useState<string | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [qrData, setQrData] = useState<string | null>(null);
    const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isSigned, setIsSigned] = useState(false);
    const [isActivated, setIsActivated] = useState(false);

    // If migrationId is provided (admin flow), skip initiation and signing
    const isAdminMigration = !!migrationIdParam;

    useEffect(() => {
        if (isAdminMigration) {
            // Admin flow: migration already started, just set ID and poll
            setMigrationId(migrationIdParam);
            return;
        }

        // User flow: initiate migration (existing code)
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
    }, [provisionerUrl, isAdminMigration, migrationIdParam]);

    useEffect(() => {
        if (!migrationId || isAdminMigration) return; // Skip signing for admin

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
    }, [migrationId, isAdminMigration]);

    // Poll migration status
    useEffect(() => {
        if (!migrationId) return;

        const pollStatus = async () => {
            try {
                const response = await apiClient.get(`/api/migration/status/${migrationId}`);
                const data = response.data;

                if (data.status) {
                    setMigrationStatus(data.status as MigrationStatus);

                    // Parse logs from the logs string
                    if (data.logs) {
                        const logLines = data.logs
                            .split("\n")
                            .filter((line: string) => line.trim().length > 0);
                        setLogs(logLines);

                        // Check if activation is complete
                        const activated = logLines.some(
                            (log: string) =>
                                log.includes("marked as active") ||
                                log.includes("New evault marked as active"),
                        );
                        if (activated) {
                            setIsActivated(true);
                            setQrData(null); // Hide QR code when activated
                        }
                    }

                    // Check if migration is complete or failed
                    if (data.status === "completed") {
                        setIsActivated(true);
                        setQrData(null);
                    } else if (data.status === "failed") {
                        setError(data.error || "Migration failed");
                    }
                }
            } catch (error) {
                console.error("Error polling migration status:", error);
            }
        };

        // Poll immediately, then every 2 seconds
        pollStatus();
        const interval = setInterval(pollStatus, 2000);

        return () => clearInterval(interval);
    }, [migrationId]);

    // Listen for signing confirmation via SSE
    useEffect(() => {
        if (!sessionId || isSigned || isAdminMigration) return; // Skip for admin

        const baseUrl =
            process.env.NEXT_PUBLIC_EMOVER_BASE_URL || "http://localhost:4003";
        const eventSource = new EventSource(
            `${baseUrl}/api/migration/sessions/${sessionId}`,
        );

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.status === "signed") {
                    setIsSigned(true);
                    setQrData(null); // Hide QR code after signing
                }
            } catch (error) {
                console.error("Error parsing SSE data:", error);
            }
        };

        eventSource.onerror = () => {
            eventSource.close();
        };

        return () => eventSource.close();
    }, [sessionId, isSigned]);

    if (error && migrationStatus !== "failed") {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="rounded-lg border border-red-400 bg-red-100 p-4 text-red-700">
                    {error}
                </div>
            </div>
        );
    }

    const getStatusColor = (status: MigrationStatus | null) => {
        if (!status) return "bg-gray-100 text-gray-800";
        if (status === "completed") return "bg-green-100 text-green-800";
        if (status === "failed") return "bg-red-100 text-red-800";
        return "bg-blue-100 text-blue-800";
    };

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8">
                Migration in Progress
            </h1>

            {qrData && !isSigned && !isAdminMigration && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Scan QR Code to Confirm Migration
                    </h2>
                    <p className="text-sm text-gray-600 mb-4">
                        Please scan this QR code with your eID Wallet app to
                        confirm the migration.
                    </p>
                    <div className="flex justify-center">
                        <QRCodeSVG value={qrData} size={256} />
                    </div>
                </div>
            )}

            {(migrationStatus || isActivated) && (
                <div
                    className={`p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 mb-6 ${getStatusColor(
                        isActivated ? "completed" : migrationStatus,
                    )}`}
                >
                    <h2 className="text-xl font-semibold mb-2">Status</h2>
                    <p className="text-lg font-medium">
                        {isActivated
                            ? "eVault Activated"
                            : STATUS_LABELS[migrationStatus || "initiated"]}
                    </p>
                    {isActivated && (
                        <div className="mt-4">
                            <p className="mb-4 text-sm">
                                Your eVault has been successfully migrated and
                                activated!
                            </p>
                            <button
                                type="button"
                                onClick={() => router.push("/")}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
                            >
                                Go Back to Main Page
                            </button>
                        </div>
                    )}
                    {migrationStatus === "completed" && !isActivated && (
                        <p className="mt-2 text-sm">
                            Migration completed successfully! Redirecting to main
                            page...
                        </p>
                    )}
                    {migrationStatus === "failed" && error && (
                        <p className="mt-2 text-sm">{error}</p>
                    )}
                </div>
            )}

            {logs.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Migration Logs
                    </h2>
                    <div className="space-y-1 font-mono text-sm max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg">
                        {logs.map((log, index) => (
                            <div
                                key={`${log.slice(0, 50)}-${index}`}
                                className="text-gray-700"
                            >
                                {log}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function MigratePage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-[50vh] bg-gray-50">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
                        <p className="text-gray-600">Loading...</p>
                    </div>
                </div>
            }
        >
            <MigrateContent />
        </Suspense>
    );
}

