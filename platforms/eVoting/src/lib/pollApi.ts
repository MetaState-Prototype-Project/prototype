import { apiClient } from "./apiClient";

export interface Poll {
  id: string;
  title: string;
  mode: "normal" | "point" | "rank";
  visibility: "public" | "private";
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

export interface Vote {
  id: string;
  pollId: string;
  userId: string;
  voterId: string;
  data: {
    mode: "normal" | "point" | "rank";
    data: string[] | any[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreatePollData {
  title: string;
  mode: "normal" | "point" | "rank";
  visibility: "public" | "private";
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

export interface PollResults {
  poll: Poll;
  totalVotes: number;
  totalEligibleVoters?: number;
  turnout?: number;
  mode?: "normal" | "point" | "rank";
  results: {
    option: string;
    votes: number;
    percentage: number;
    // Additional fields for different voting modes
    totalPoints?: number;
    averagePoints?: number;
    isWinner?: boolean;
    isTied?: boolean;
    finalRound?: number;
  }[];
  // Detailed IRV info for rank mode
  irvDetails?: {
    winnerIndex: number | null;
    winnerOption?: string;
    rounds: any[];
    rejectedBallots: number;
    rejectedReasons: any[];
  };
}

export interface SigningSession {
  sessionId: string;
  qrData: string;
  expiresAt: string;
}

export interface PollsResponse {
  polls: Poll[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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
  createSigningSession: async (pollId: string, voteData: any, userId: string): Promise<SigningSession> => {
    const response = await apiClient.post("/api/signing/sessions", {
      pollId,
      voteData,
      userId,
    });
    return response.data;
  }
}; 