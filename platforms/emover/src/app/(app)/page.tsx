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
    const { isAuthenticated, isLoading } = useAuth();
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
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                    Evault Migration
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                    Migrate your evault to a new provider
                </p>
            </div>

            <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Current Evault
                    </h2>
                    {evaultInfo ? (
                        <div className="space-y-2">
                            <p>
                                <span className="font-medium">eName:</span>{" "}
                                {evaultInfo.eName}
                            </p>
                            <p>
                                <span className="font-medium">Provider:</span>{" "}
                                {evaultInfo.provider}
                            </p>
                            <p>
                                <span className="font-medium">URI:</span>{" "}
                                {evaultInfo.uri}
                            </p>
                            <p>
                                <span className="font-medium">Evault ID:</span>{" "}
                                {evaultInfo.evault}
                            </p>
                        </div>
                    ) : (
                        <p className="text-gray-500">
                            No evault information available
                        </p>
                    )}
                </div>

                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Select New Provider
                    </h2>
                    {provisioners.length > 0 ? (
                        <div className="space-y-4">
                            {provisioners.map((provisioner) => (
                                <button
                                    key={provisioner.url}
                                    type="button"
                                    className={`w-full text-left p-4 border rounded-lg cursor-pointer ${
                                        selectedProvisioner === provisioner.url
                                            ? "border-blue-500 bg-blue-50"
                                            : "border-gray-200 hover:border-gray-300"
                                    }`}
                                    onClick={() =>
                                        setSelectedProvisioner(provisioner.url)
                                    }
                                >
                                    <h3 className="font-medium text-gray-900">
                                        {provisioner.name}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        {provisioner.description}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {provisioner.url}
                                    </p>
                                </button>
                            ))}
                            <button
                                type="button"
                                onClick={handleStartMigration}
                                disabled={!selectedProvisioner}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                                Start Migration
                            </button>
                        </div>
                    ) : (
                        <p className="text-gray-500">
                            No provisioners available. Check environment
                            variables.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

