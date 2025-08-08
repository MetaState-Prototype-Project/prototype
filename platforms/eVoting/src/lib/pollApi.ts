import { apiClient } from "./apiClient";

export interface Poll {
  id: string;
  title: string;
  mode: "normal" | "point" | "rank";
  visibility: "public" | "private";
  options: string[];
  deadline?: string | null;
  creatorId: string;
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
}

export interface PollResults {
  poll: Poll;
  totalVotes: number;
  results: {
    option: string;
    votes: number;
    percentage: number;
  }[];
}

export const pollApi = {
  // Get all polls
  getAllPolls: async (): Promise<Poll[]> => {
    const response = await apiClient.get("/api/polls");
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
  submitVote: async (pollId: string, optionId: number): Promise<Vote> => {
    const response = await apiClient.post("/api/votes", {
      pollId,
      optionId
    });
    return response.data;
  },

  // Get votes for a poll
  getPollVotes: async (pollId: string): Promise<Vote[]> => {
    const response = await apiClient.get(`/api/polls/${pollId}/votes`);
    return response.data;
  },

  // Get user's vote for a poll
  getUserVote: async (pollId: string): Promise<{ hasVoted: boolean; vote: Vote | null }> => {
    const response = await apiClient.get(`/api/polls/${pollId}/vote`);
    return response.data;
  },

  // Get poll results
  getPollResults: async (pollId: string): Promise<PollResults> => {
    const response = await apiClient.get(`/api/polls/${pollId}/results`);
    return response.data;
  }
}; 