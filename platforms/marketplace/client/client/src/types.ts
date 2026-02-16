// Type definitions for the marketplace
export type App = {
  id: string;
  name: string;
  description: string;
  fullDescription: string | null;
  category: string;
  link: string;
  logoUrl: string | null;
  screenshots: string[] | null;
  status: string;
  averageRating: string | null;
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
};

export type InsertApp = Omit<App, 'id' | 'averageRating' | 'totalReviews' | 'createdAt' | 'updatedAt'>;

export type Review = {
  id: string;
  appId: string;
  userName: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
};

export type InsertReview = Omit<Review, 'id' | 'createdAt'>;

export type User = {
  id: string;
  email: string;
  username: string;
  password: string;
  isAdmin: boolean;
  createdAt: Date;
};

export type InsertUser = Omit<User, 'id' | 'isAdmin' | 'createdAt'>;

