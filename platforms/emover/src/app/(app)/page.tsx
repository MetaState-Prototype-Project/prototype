"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";

interface EvaultInfo {
    eName: string;
    uri: string;
    evault: string;
    provider: string;
}

interface Provisioner {
    url: string;
    name: string;
    description: string;
}

export default function DashboardPage() {
    const { user, isAuthenticated, isLoading, logout } = useAuth();
    const router = useRouter();
    const [evaultInfo, setEvaultInfo] = useState<EvaultInfo | null>(null);
    const [provisioners, setProvisioners] = useState<Provisioner[]>([]);
    const [selectedProvisioner, setSelectedProvisioner] = useState<string>("");
    const [isLoadingInfo, setIsLoadingInfo] = useState(true);

    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            router.push("/login");
        }
    }, [isLoading, isAuthenticated, router]);

    useEffect(() => {
        if (!isAuthenticated) return;

        const fetchData = async () => {
            try {
                const [evaultResponse, provisionersResponse] = await Promise.all([
                    apiClient.get("/api/evault/current"),
                    apiClient.get("/api/provisioners"),
                ]);

                setEvaultInfo(evaultResponse.data);
                setProvisioners(provisionersResponse.data);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setIsLoadingInfo(false);
            }
        };

        fetchData();
    }, [isAuthenticated]);

    const handleStartMigration = () => {
        if (!selectedProvisioner) {
            alert("Please select a provisioner");
            return;
        }
        router.push(`/migrate?provisioner=${encodeURIComponent(selectedProvisioner)}`);
    };

    if (isLoading || isLoadingInfo) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div>Loading...</div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Evault Migration</h1>
                <button
                    onClick={logout}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                    Logout
                </button>
            </div>

            <div className="space-y-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Current Evault</h2>
                    {evaultInfo ? (
                        <div className="space-y-2">
                            <p>
                                <span className="font-medium">eName:</span> {evaultInfo.eName}
                            </p>
                            <p>
                                <span className="font-medium">Provider:</span>{" "}
                                {evaultInfo.provider}
                            </p>
                            <p>
                                <span className="font-medium">URI:</span> {evaultInfo.uri}
                            </p>
                            <p>
                                <span className="font-medium">Evault ID:</span>{" "}
                                {evaultInfo.evault}
                            </p>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">No evault information available</p>
                    )}
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Select New Provider</h2>
                    {provisioners.length > 0 ? (
                        <div className="space-y-4">
                            {provisioners.map((provisioner) => (
                                <div
                                    key={provisioner.url}
                                    className={`p-4 border rounded cursor-pointer ${
                                        selectedProvisioner === provisioner.url
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-gray-200 hover:border-gray-300"
                                    }`}
                                    onClick={() => setSelectedProvisioner(provisioner.url)}
                                >
                                    <h3 className="font-medium">{provisioner.name}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {provisioner.description}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {provisioner.url}
                                    </p>
                                </div>
                            ))}
                            <button
                                onClick={handleStartMigration}
                                disabled={!selectedProvisioner}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                                Start Migration
                            </button>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">
                            No provisioners available. Check environment variables.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

