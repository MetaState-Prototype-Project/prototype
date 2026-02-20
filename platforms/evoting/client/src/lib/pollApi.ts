import { apiClient } from "./apiClient";

export interface Poll {
  id: string;
  title: string;
  mode: "normal" | "point" | "rank";
  visibility: "public" | "private";
  votingWeight: "1p1v" | "ereputation";
  options: string[];
  deadline?: string | null;
  creatorId: string;
  groupId?: string;
  group?: {
    id: string;
    name: string;
    description?: string;
  };
  creator?: {
    id: string;
    ename: string;
    name?: string;
  };
  votes?: Vote[];
  createdAt: string;
  updatedAt: string;
}

export interface PointVoteData {
  option: string;
  points: number;
}

export interface RankVoteData {
  option: string;
  points: number;
}

export interface VoteData {
  mode: "normal" | "point" | "rank";
  data: string[] | PointVoteData[] | RankVoteData[] | Record<string, number>;
}

export interface Vote {
  id: string;
  pollId: string;
  userId: string;
  voterId: string;
  data: VoteData;
  points?: Record<string, number>;
  ranks?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePollData {
  title: string;
  mode: "normal" | "point" | "rank";
  visibility: "public" | "private";
  votingWeight: "1p1v" | "ereputation";
  options: string[];
  deadline?: string;
  groupId: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  owner: string;
  isPrivate: boolean;
  visibility: "public" | "private" | "restricted";
  charter?: string; // Markdown content for the group charter
  createdAt: string;
  updatedAt: string;
}

export interface PollResultOption {
  option: string;
  votes: number;
  percentage?: number;
  // Additional fields for different voting modes
  totalPoints?: number;
  averagePoints?: number;
  isWinner?: boolean;
  isTied?: boolean;
  finalRound?: number;
  voteCount?: number;
}

export interface IRVRound {
  round: number;
  eliminated?: string;
  remainingCandidates: string[];
  voteCounts: Record<string, number>;
}

export interface IRVDetails {
  winnerIndex: number | null;
  winnerOption?: string;
  rounds: IRVRound[];
  rejectedBallots: number;
  rejectedReasons: string[];
}

export interface VoterDetail {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  optionId: string;
  profileImageUrl?: string;
  createdAt?: string;
  mode?: "normal" | "point" | "rank" | string;
  pointData?: Record<string, number>;
  rankData?: Record<string, number>;
  castById?: string | null;
  castByName?: string | null;
}

export interface PollResults {
  poll: Poll;
  totalVotes: number;
  totalWeightedVotes?: number;
  totalEligibleVoters?: number;
  turnout?: number;
  mode?: "normal" | "point" | "rank" | "ereputation";
  results: PollResultOption[];
  irvDetails?: IRVDetails;
  voterDetails?: VoterDetail[];
  pointsVoted?: number;
  totalEligiblePoints?: number;
}

export interface BlindVoteOptionResult {
  option: string;
  optionText?: string;
  voteCount: number;
  isTied?: boolean;
  isWinner?: boolean;
}

export interface BlindVoteResults {
  optionResults: BlindVoteOptionResult[];
  totalVotes: number;
  totalEligibleVoters?: number;
  turnout?: number;
}

export interface SigningSession {
  sessionId: string;
  qrData: string;
  expiresAt: string;
}

export interface SigningDelegationContext {
  delegatorId: string;
  delegatorName?: string;
}

export interface PollsResponse {
  polls: Poll[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type DelegationStatus = "pending" | "active" | "rejected" | "revoked" | "used";

export interface Delegation {
  id: string;
  pollId: string;
  delegatorId: string;
  delegateId: string;
  status: DelegationStatus;
  poll?: Poll;
  delegator?: {
    id: string;
    ename: string;
    name?: string;
    avatarUrl?: string;
  };
  delegate?: {
    id: string;
    ename: string;
    name?: string;
    avatarUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DelegationEligibility {
  canDelegate: boolean;
  reason?: string;
}

export const pollApi = {
  // Get all polls with pagination
  getAllPolls: async (page: number = 1, limit: number = 15, search?: string, sortField?: string, sortDirection?: "asc" | "desc"): Promise<PollsResponse> => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) {
      params.append('search', search);
    }
    if (sortField) {
      params.append('sortField', sortField);
    }
    if (sortDirection) {
      params.append('sortDirection', sortDirection);
    }
    
    const response = await apiClient.get(`/api/polls?${params.toString()}`);
    return response.data;
  },

  // Get poll by ID
  getPollById: async (id: string): Promise<Poll> => {
    const response = await apiClient.get(`/api/polls/${id}`);
    return response.data;
  },

  // Get user's polls
  getMyPolls: async (): Promise<Poll[]> => {
    const response = await apiClient.get("/api/polls/my");
    return response.data;
  },

  // Get user's groups
  getUserGroups: async (): Promise<Group[]> => {
    const response = await apiClient.get("/api/groups/my");
    return response.data;
  },

  // Create a new poll
  createPoll: async (pollData: CreatePollData): Promise<Poll> => {
    const response = await apiClient.post("/api/polls", pollData);
    return response.data;
  },

  // Update a poll
  updatePoll: async (id: string, pollData: Partial<CreatePollData>): Promise<Poll> => {
    const response = await apiClient.put(`/api/polls/${id}`, pollData);
    return response.data;
  },

  // Delete a poll
  deletePoll: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/polls/${id}`);
  },

  // Submit a vote
  submitVote: async (pollId: string, voteData: any): Promise<Vote> => {
    const response = await apiClient.post("/api/votes", {
      pollId,
      ...voteData
    });
    return response.data;
  },

  // Get votes for a poll
  getPollVotes: async (pollId: string): Promise<Vote[]> => {
    const response = await apiClient.get(`/api/polls/${pollId}/votes`);
    return response.data;
  },

  // Get user's vote for a poll
  getUserVote: async (pollId: string, userId: string): Promise<{ hasVoted: boolean; vote: Vote | null }> => {
    const response = await apiClient.get(`/api/polls/${pollId}/vote?userId=${userId}`);
    const vote = response.data;
    
    // Transform backend response (Vote | null) to frontend expected format
    return {
      hasVoted: !!vote,  // true if vote exists, false if null
      vote: vote         // the actual vote object or null
    };
  },

  // Get poll results
  getPollResults: async (pollId: string): Promise<PollResults> => {
    const response = await apiClient.get(`/api/polls/${pollId}/results`);
    return response.data;
  },

  // Create signing session
  createSigningSession: async (
    pollId: string,
    voteData: any,
    userId: string,
    delegationContext?: SigningDelegationContext
  ): Promise<SigningSession> => {
    const response = await apiClient.post("/api/signing/sessions", {
      pollId,
      voteData,
      userId,
      delegationContext,
    });
    return response.data;
  },

  // Delegation methods

  // Check if a poll can have delegation
  canPollHaveDelegation: async (pollId: string): Promise<DelegationEligibility> => {
    const response = await apiClient.get(`/api/polls/${pollId}/can-delegate`);
    return response.data;
  },

  // Request delegation (as delegator)
  requestDelegation: async (pollId: string, delegateId: string): Promise<Delegation> => {
    const response = await apiClient.post(`/api/polls/${pollId}/delegate`, { delegateId });
    return response.data;
  },

  // Revoke delegation (as delegator)
  revokeDelegation: async (pollId: string): Promise<Delegation> => {
    const response = await apiClient.delete(`/api/polls/${pollId}/delegate`);
    return response.data;
  },

  // Get my delegation status for a poll (as delegator)
  getMyDelegation: async (pollId: string): Promise<Delegation | null> => {
    const response = await apiClient.get(`/api/polls/${pollId}/my-delegation`);
    return response.data;
  },

  // Accept delegation (as delegate)
  acceptDelegation: async (delegationId: string): Promise<Delegation> => {
    const response = await apiClient.post(`/api/delegations/${delegationId}/accept`);
    return response.data;
  },

  // Reject delegation (as delegate)
  rejectDelegation: async (delegationId: string): Promise<Delegation> => {
    const response = await apiClient.post(`/api/delegations/${delegationId}/reject`);
    return response.data;
  },

  // Get active delegations received for a poll (as delegate)
  // includeUsed=true keeps already-cast delegations visible for history/context switching.
  getReceivedDelegations: async (pollId: string, includeUsed: boolean = false): Promise<Delegation[]> => {
    const response = await apiClient.get(`/api/polls/${pollId}/delegations${includeUsed ? "?includeUsed=true" : ""}`);
    return response.data;
  },

  // Get pending delegation requests for a poll (as delegate)
  getPendingDelegationsForPoll: async (pollId: string): Promise<Delegation[]> => {
    const response = await apiClient.get(`/api/polls/${pollId}/delegations/pending`);
    return response.data;
  },

  // Get all pending delegation requests across all polls (as delegate)
  getAllPendingDelegations: async (): Promise<Delegation[]> => {
    const response = await apiClient.get("/api/delegations/pending");
    return response.data;
  },

  // Cast delegated vote (as delegate)
  castDelegatedVote: async (pollId: string, delegatorId: string, voteData: any, mode?: "normal" | "point" | "rank"): Promise<Vote> => {
    const response = await apiClient.post(`/api/polls/${pollId}/delegated-vote`, {
      delegatorId,
      voteData,
      mode,
    });
    return response.data;
  },
}; 