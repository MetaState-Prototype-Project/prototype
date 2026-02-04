"use client";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/apiClient";
import { useRouter } from "next/navigation";

const PER_PAGE = 20;

interface EnameInfo {
    ename: string;
    evault: string;
    uri: string;
    provider: string;
}

interface Provisioner {
    url: string;
    name: string;
    description: string;
}

export default function AdminDashboard() {
    const { isAdmin, isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const [enames, setEnames] = useState<EnameInfo[]>([]);
    const [provisioners, setProvisioners] = useState<Provisioner[]>([]);
    const [selectedEname, setSelectedEname] = useState<string>("");
    const [selectedProvisioner, setSelectedProvisioner] = useState<string>("");
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [selectedEnames, setSelectedEnames] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!isLoading && (!isAuthenticated || !isAdmin)) {
            router.push("/");
            return;
        }
    }, [isLoading, isAuthenticated, isAdmin, router]);

    useEffect(() => {
        if (!isAdmin) return;

        const fetchData = async () => {
            try {
                const [enamesRes, provisionersRes] = await Promise.all([
                    apiClient.get("/api/admin/enames"),
                    apiClient.get("/api/provisioners"),
                ]);
                setEnames(enamesRes.data);
                setProvisioners(provisionersRes.data);
            } catch (error) {
                console.error("Error fetching admin data:", error);
            } finally {
                setIsLoadingData(false);
            }
        };

        fetchData();
    }, [isAdmin]);

    const toggleSelectEname = (ename: string) => {
        setSelectedEnames(prev => {
            const next = new Set(prev);
            if (next.has(ename)) {
                next.delete(ename);
            } else {
                next.add(ename);
            }
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedEnames.size === paginatedEnames.length && paginatedEnames.length > 0) {
            // Deselect all on current page
            setSelectedEnames(prev => {
                const next = new Set(prev);
                for (const e of paginatedEnames) {
                    next.delete(e.ename);
                }
                return next;
            });
        } else {
            // Select all on current page
            setSelectedEnames(prev => {
                const next = new Set(prev);
                for (const e of paginatedEnames) {
                    next.add(e.ename);
                }
                return next;
            });
        }
    };

    const handleStartMigration = async () => {
        if (!selectedProvisioner) {
            return;
        }

        // Use bulk endpoint if multiple selected, otherwise single
        const enameList = Array.from(selectedEnames);

        if (enameList.length === 0 && !selectedEname) {
            return;
        }

        try {
            if (enameList.length > 0) {
                // Bulk migration
                const response = await apiClient.post("/api/admin/migrate/bulk", {
                    enames: enameList,
                    provisionerUrl: selectedProvisioner,
                });

                const started = response.data.results.filter((r: { status: string; migrationId?: string; ename?: string }) => r.status === 'started');

                if (started.length > 0) {
                    // Build query param: "id1:ename1,id2:ename2,..."
                    const migrationsParam = started
                        .map((r: { migrationId?: string; ename?: string }) => `${r.migrationId}:${r.ename}`)
                        .join(",");
                    
                    // Redirect to bulk migration status page
                    router.push(`/admin/bulk-migrate?migrations=${encodeURIComponent(migrationsParam)}`);
                }

                // Clear selections
                setSelectedEnames(new Set());
            } else {
                // Single migration (backward compatibility)
                const response = await apiClient.post("/api/admin/migrate", {
                    ename: selectedEname,
                    provisionerUrl: selectedProvisioner,
                });

                router.push(`/migrate?migrationId=${response.data.migrationId}`);
            }
        } catch (error) {
            console.error("Error starting migration:", error);
        }
    };

    const filteredEnames = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return enames;
        return enames.filter(
            (e) =>
                e.ename.toLowerCase().includes(q) ||
                e.evault.toLowerCase().includes(q) ||
                e.provider.toLowerCase().includes(q),
        );
    }, [enames, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredEnames.length / PER_PAGE));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const paginatedEnames = useMemo(() => {
        const start = (currentPage - 1) * PER_PAGE;
        return filteredEnames.slice(start, start + PER_PAGE);
    }, [filteredEnames, currentPage]);

    const allOnPageSelected = paginatedEnames.length > 0 &&
        paginatedEnames.every(e => selectedEnames.has(e.ename));

    useEffect(() => {
        if (page > totalPages && totalPages >= 1) setPage(totalPages);
    }, [totalPages, page]);

    if (isLoading || isLoadingData) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4" />
                    <p className="text-gray-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                    Admin Dashboard
                </h1>
                <p className="text-sm sm:text-base text-gray-600">
                    Migrate eVaults for any user
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left: Ename table with search and pagination */}
                <div className="flex-1 min-w-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Select User (eName)
                    </h2>
                    <div className="mb-4">
                        <input
                            type="search"
                            placeholder="Search by eName, eVault ID, or provider..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            aria-label="Search enames"
                        />
                    </div>
                    {enames.length > 0 ? (
                        <>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 w-12"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={allOnPageSelected}
                                                    onChange={toggleSelectAll}
                                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                    aria-label="Select all on page"
                                                />
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                            >
                                                eName
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                            >
                                                eVault ID
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                            >
                                                Provider
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {paginatedEnames.map((row) => (
                                            <tr
                                                key={row.ename}
                                                className={`transition-colors ${
                                                    selectedEname === row.ename
                                                        ? "bg-blue-50"
                                                        : "hover:bg-gray-50"
                                                }`}
                                            >
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEnames.has(row.ename)}
                                                        onChange={() => toggleSelectEname(row.ename)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                        aria-label={`Select ${row.ename}`}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                                                    {row.ename}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap truncate max-w-40">
                                                    {row.evault}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                                    {row.provider}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4 flex items-center justify-between">
                                <p className="text-sm text-gray-600">
                                    Showing{" "}
                                    {(currentPage - 1) * PER_PAGE + 1}–
                                    {Math.min(
                                        currentPage * PER_PAGE,
                                        filteredEnames.length,
                                    )}{" "}
                                    of {filteredEnames.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPage((p) => Math.max(1, p - 1))
                                        }
                                        disabled={currentPage <= 1}
                                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-sm text-gray-600">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setPage((p) =>
                                                Math.min(totalPages, p + 1),
                                            )
                                        }
                                        disabled={currentPage >= totalPages}
                                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-500">No enames found</p>
                    )}
                </div>

                {/* Right: Provisioner selection */}
                <div className="lg:w-96 shrink-0 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
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
                                    <p className="text-xs text-gray-500 mt-1 truncate">
                                        {provisioner.url}
                                    </p>
                                </button>
                            ))}
                            {selectedEnames.size > 0 && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                                    <p className="font-medium text-blue-900">
                                        {selectedEnames.size} ename{selectedEnames.size > 1 ? 's' : ''} selected
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedEnames(new Set())}
                                        className="text-blue-600 hover:text-blue-800 text-xs mt-1"
                                    >
                                        Clear selection
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={handleStartMigration}
                                disabled={!selectedProvisioner || (selectedEnames.size === 0 && !selectedEname)}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                                {selectedEnames.size > 0
                                    ? `Start ${selectedEnames.size} Migration${selectedEnames.size > 1 ? "s" : ""}`
                                    : "Start Migration"
                                }
                            </button>
                        </div>
                    ) : (
                        <p className="text-gray-500">
                            No provisioners available
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
