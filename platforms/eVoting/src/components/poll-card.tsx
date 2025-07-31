import { Link } from "wouter";
import { Eye, UserX, Users, Vote, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Poll } from "@shared/schema";

interface PollCardProps {
  poll: Poll;
}

export default function PollCard({ poll }: PollCardProps) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{poll.title}</h3>
        <Badge variant={poll.mode === "public" ? "default" : "secondary"}>
          {poll.mode === "public" ? (
            <><Eye className="w-3 h-3 mr-1" />Public</>
          ) : (
            <><UserX className="w-3 h-3 mr-1" />Private</>
          )}
        </Badge>
      </div>
      
      <div className="flex items-center justify-between text-sm text-gray-600">
        <div className="flex items-center space-x-4">
          <span className="flex items-center">
            <Users className="w-4 h-4 mr-1" />
            {poll.totalVotes} votes
          </span>
          <span>
            {poll.createdAt ? new Date(poll.createdAt).toLocaleDateString() : "N/A"}
          </span>
        </div>
        
        <div className="flex space-x-2">
          <Link href="/vote">
            <a className="text-(--crimson) hover:text-(--crimson-700) font-medium flex items-center">
              <Vote className="w-4 h-4 mr-1" />
              Vote
            </a>
          </Link>
          <Link href={`/results/${poll.id}`}>
            <a className="text-(--crimson) hover:text-(--crimson-700) font-medium flex items-center">
              <BarChart3 className="w-4 h-4 mr-1" />
              Results
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
