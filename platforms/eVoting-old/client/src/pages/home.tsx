import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Vote, BarChart3, LogOut, Eye, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { CountdownTimer } from "@/components/CountdownTimer";
import type { Poll } from "@shared/schema";

export default function Home() {
  const { user } = useAuth();
  
  const { data: polls = [], isLoading } = useQuery<Poll[]>({
    queryKey: ["/api/polls"],
    retry: (failureCount, error) => {
      if (isUnauthorizedError(error)) return false;
      return failureCount < 3;
    },
  });

  // Helper function to check if a poll is actually active (not expired)
  const isPollActive = (poll: Poll) => {
    if (!poll.isActive) return false;
    if (!poll.deadline) return true;
    return new Date() < new Date(poll.deadline);
  };

  // Filter polls
  const activePolls = polls.filter(poll => poll.isActive);
  const userPolls = polls.filter(poll => poll.createdBy === user?.id);
  // Split active polls into truly active and expired
  const votablePolls = activePolls.filter(poll => isPollActive(poll));
  const expiredPolls = activePolls.filter(poll => !isPollActive(poll));

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to eVoting
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Create votes, gather responses, and view results in real-time
        </p>

      </div>

      {/* Create Vote Action - Desktop only 40% width */}
      <div className="flex justify-center">
        <Card className="w-full md:max-w-[40%]">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Plus className="mr-2 h-5 w-5" />
              Create New Vote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Create a new vote with custom options and voting modes
            </p>
            <Button asChild className="w-full bg-[--crimson] text-white hover:bg-[--crimson-50] hover:text-[--crimson] hover:border-[--crimson] border transition-colors">
              <Link href="/create">
                <Plus className="w-4 h-4 mr-2" />
                Create Vote
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Active Votes to Vote On */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Vote className="mr-2 h-5 w-5" />
            Active Votes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[--crimson]"></div>
            </div>
          ) : votablePolls.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No active votes available for voting.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {votablePolls.map((poll) => {
                const isActive = isPollActive(poll);
                return (
                  <Card key={poll.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <h3 className="font-semibold text-gray-900">{poll.title}</h3>
                        <div className="flex items-center space-x-2">
                          <Badge variant={poll.mode === "public" ? "default" : "secondary"}>
                            {poll.mode === "public" ? (
                              <><Eye className="w-3 h-3 mr-1" />Public</>
                            ) : (
                              <><UserX className="w-3 h-3 mr-1" />Private</>
                            )}
                          </Badge>
                          <Badge variant={isActive ? "success" : "warning"}>
                            {isActive ? "Active" : "Ended"}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">{poll.totalVotes} votes</div>
                        <Button asChild size="sm" className="w-full bg-[--crimson] hover:bg-[--crimson-50] hover:text-[--crimson] hover:border-[--crimson] border text-white">
                          <Link href={`/vote/${poll.id}`}>View Vote</Link>
                        </Button>
                        <CountdownTimer deadline={poll.deadline} className="mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Closed Votes */}
      {expiredPolls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Closed Votes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {expiredPolls.map((poll) => {
                const isActive = isPollActive(poll);
                return (
                  <Card key={poll.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <h3 className="font-semibold text-gray-900">{poll.title}</h3>
                        <div className="flex items-center space-x-2">
                          <Badge variant={poll.mode === "public" ? "default" : "secondary"}>
                            {poll.mode === "public" ? (
                              <><Eye className="w-3 h-3 mr-1" />Public</>
                            ) : (
                              <><UserX className="w-3 h-3 mr-1" />Private</>
                            )}
                          </Badge>
                          <Badge variant={isActive ? "success" : "warning"}>
                            {isActive ? "Active" : "Ended"}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">{poll.totalVotes} votes</div>
                        <Button asChild size="sm" className="w-full bg-[--crimson] hover:bg-[--crimson-50] hover:text-[--crimson] hover:border-[--crimson] border text-white">
                          <Link href={`/vote/${poll.id}`}>View Results</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User's Created Polls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="mr-2 h-5 w-5" />
            Your Votes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[--crimson]"></div>
            </div>
          ) : userPolls.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              You haven't created any votes yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {userPolls.map((poll) => {
                const isActive = isPollActive(poll);
                return (
                  <Card key={poll.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <h3 className="font-semibold text-gray-900">{poll.title}</h3>
                        <div className="flex items-center space-x-2">
                          <Badge variant={poll.mode === "public" ? "default" : "secondary"}>
                            {poll.mode === "public" ? (
                              <><Eye className="w-3 h-3 mr-1" />Public</>
                            ) : (
                              <><UserX className="w-3 h-3 mr-1" />Private</>
                            )}
                          </Badge>
                          <Badge variant={isActive ? "success" : "warning"}>
                            {isActive ? "Active" : "Ended"}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">{poll.totalVotes} votes</div>
                        <Button asChild size="sm" className="w-full bg-[--crimson] hover:bg-[--crimson-50] hover:text-[--crimson] hover:border-[--crimson] border text-white">
                          <Link href={`/vote/${poll.id}`}>View Vote</Link>
                        </Button>
                        <CountdownTimer deadline={poll.deadline} className="mt-2" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}