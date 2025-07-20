import Link from "next/link";
import { CheckCircle, Clock, Eye, Crown } from "lucide-react";
import { PlatformBadge } from "./platform-badge";
import { useAuth } from "@/hooks/useAuth";

interface CharterCardProps {
    charter: {
        id: string;
        name: string;
        isActive: boolean;
        ownerId: string;
        updatedAt: Date;
        createdAt: Date;
        group: {
            id: string;
            name: string;
            platform: string;
        };
        // TODO: Define the full structure of the charter object
    };
}

export default function CharterCard({ charter }: CharterCardProps) {
    const { user } = useAuth();
    const StatusIcon = charter.isActive ? CheckCircle : Clock;
    const statusColor = charter.isActive ? "text-green-600" : "text-yellow-600";
    const statusBg = charter.isActive ? "bg-green-100" : "bg-yellow-100";
    const isOwner = user?.id === charter.ownerId;

    return (
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl p-4 sm:p-6 soft-shadow hover-lift cursor-pointer fade-in">
            <div className="flex items-start justify-between mb-3 sm:mb-4">
                <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                    <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-gray-800 text-sm sm:text-base truncate">
                            {charter.name}
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-600 truncate mt-1">
                            {charter.group.name}
                        </p>
                        <div className="flex items-center mt-1">
                            <PlatformBadge
                                platform={charter.group.platform}
                                className="text-xs"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex items-center space-x-2 shrink-0 ml-2">
                    {isOwner && (
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                            <Crown
                                className="text-yellow-600 text-sm"
                                size={12}
                            />
                        </div>
                    )}
                    <div
                        className={`w-6 h-6 sm:w-8 sm:h-8 ${statusBg} rounded-full flex items-center justify-center`}
                    >
                        <StatusIcon
                            className={`${statusColor} text-sm`}
                            size={12}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                <span className="text-xs text-gray-500">
                    Updated{" "}
                    {charter.updatedAt
                        ? new Date(charter.updatedAt).toLocaleDateString()
                        : "recently"}
                </span>
                <Link href={`/charter/${charter.id}`}>
                    <button
                        type="button"
                        className="text-amber-600 hover:text-amber-700 font-medium text-sm flex items-center space-x-1 w-fit"
                    >
                        <Eye size={14} />
                        <span>View Charter</span>
                    </button>
                </Link>
            </div>
        </div>
    );
}
