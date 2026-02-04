"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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

interface MigrationInfo {
    migrationId: string;
    ename: string;
    status: MigrationStatus | null;
    logs: string[];
}

function BulkMigrateContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const migrationIdsParam = searchParams?.get("migrations");
    const [migrations, setMigrations] = useState<MigrationInfo[]>([]);
    const [selectedMigrationId, setSelectedMigrationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!migrationIdsParam) {
            router.push("/admin");
            return;
        }

        try {
            // Parse migration data from query param: "id1:ename1,id2:ename2,..."
            const pairs = migrationIdsParam.split(",");
            const initialMigrations = pairs.map(pair => {
                const [migrationId, ename] = pair.split(":");
                return {
                    migrationId,
                    ename,
                    status: null,
                    logs: [],
                };
            });
            setMigrations(initialMigrations);
            if (initialMigrations.length > 0) {
                setSelectedMigrationId(initialMigrations[0].migrationId);
            }
            setIsLoading(false);
        } catch (error) {
            console.error("Error parsing migration IDs:", error);
            router.push("/admin");
        }
    }, [migrationIdsParam, router]);

    // Poll migration status for all migrations
    useEffect(() => {
        if (migrations.length === 0) return;

        const pollAllStatus = async () => {
            const updatedMigrations = await Promise.all(
                migrations.map(async (migration) => {
                    try {
                        const response = await apiClient.get(`/api/migration/status/${migration.migrationId}`);
                        const data = response.data;

                        const logLines = data.logs
                            ? data.logs.split("\n").filter((line: string) => line.trim().length > 0)
                            : [];

                        // Detect completion from logs if status is still marking_active
                        let finalStatus = data.status as MigrationStatus;
                        if (finalStatus === "marking_active" && 
                            logLines.some(log => log.includes("New evault marked as active and verified working"))) {
                            finalStatus = "completed";
                        }

                        return {
                            ...migration,
                            status: finalStatus,
                            logs: logLines,
                        };
                    } catch (error) {
                        console.error(`Error fetching status for ${migration.migrationId}:`, error);
                        return migration;
                    }
                }),
            );
            setMigrations(updatedMigrations);
        };

        pollAllStatus();
        const interval = setInterval(pollAllStatus, 2000);

        return () => clearInterval(interval);
    }, [migrations.length]);

    const selectedMigration = migrations.find(m => m.migrationId === selectedMigrationId);
    const allCompleted = migrations.length > 0 && migrations.every(m => m.status === "completed");
    const anyFailed = migrations.some(m => m.status === "failed");

    const getStatusColor = (status: MigrationStatus | null) => {
        if (!status) return "bg-gray-100 text-gray-800";
        if (status === "completed") return "bg-green-100 text-green-800";
        if (status === "failed") return "bg-red-100 text-red-800";
        return "bg-blue-100 text-blue-800";
    };

    const getStatusIcon = (status: MigrationStatus | null) => {
        if (!status) return "⏳";
        if (status === "completed") return "✓";
        if (status === "failed") return "✗";
        return "⏳";
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
                    <p className="text-gray-600">Loading migrations...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                    Bulk Migration Status
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                    Monitoring {migrations.length} migration{migrations.length > 1 ? "s" : ""}
                </p>
            </div>

            {allCompleted && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-medium">
                        All migrations completed successfully!
                    </p>
                    <button
                        type="button"
                        onClick={() => router.push("/admin")}
                        className="mt-2 text-sm text-green-700 hover:text-green-900 underline"
                    >
                        Return to Admin Dashboard
                    </button>
                </div>
            )}

            {anyFailed && !allCompleted && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 font-medium">
                        Some migrations have failed. Check the logs for details.
                    </p>
                </div>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Migration list */}
                <div className="lg:w-96 shrink-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Migrations
                    </h2>
                    <div className="space-y-2">
                        {migrations.map((migration) => (
                            <button
                                key={migration.migrationId}
                                type="button"
                                onClick={() => setSelectedMigrationId(migration.migrationId)}
                                className={`w-full text-left p-3 border rounded-lg transition-colors ${
                                    selectedMigrationId === migration.migrationId
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-200 hover:border-gray-300"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-gray-900 text-sm truncate">
                                        {migration.ename}
                                    </span>
                                    <span className="text-lg ml-2">
                                        {getStatusIcon(migration.status)}
                                    </span>
                                </div>
                                {migration.status && (
                                    <span
                                        className={`inline-block px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                                            migration.status,
                                        )}`}
                                    >
                                        {STATUS_LABELS[migration.status]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Logs display */}
                <div className="flex-1 min-w-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                    {selectedMigration ? (
                        <>
                            <div className="mb-4">
                                <h2 className="text-xl font-semibold text-gray-900">
                                    {selectedMigration.ename}
                                </h2>
                                {selectedMigration.status && (
                                    <span
                                        className={`inline-block mt-2 px-3 py-1 text-sm font-medium rounded ${getStatusColor(
                                            selectedMigration.status,
                                        )}`}
                                    >
                                        {STATUS_LABELS[selectedMigration.status]}
                                    </span>
                                )}
                            </div>

                            <div className="bg-gray-900 rounded-lg p-4 overflow-y-auto max-h-[600px]">
                                {selectedMigration.logs.length > 0 ? (
                                    <div className="font-mono text-xs text-gray-100 space-y-1">
                                        {selectedMigration.logs.map((log, index) => (
                                            <div key={`${log.slice(0, 50)}-${index}`}>
                                                {log}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 text-sm">
                                        Waiting for migration logs...
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-gray-500 py-12">
                            Select a migration to view logs
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 flex justify-between items-center">
                <button
                    type="button"
                    onClick={() => router.push("/admin")}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
                >
                    Back to Admin Dashboard
                </button>
            </div>
        </div>
    );
}

export default function BulkMigratePage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen bg-gray-50">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
                        <p className="text-gray-600">Loading...</p>
                    </div>
                </div>
            }
        >
            <BulkMigrateContent />
        </Suspense>
    );
}
