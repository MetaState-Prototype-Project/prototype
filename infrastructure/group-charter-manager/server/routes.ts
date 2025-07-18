import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertCharterSchema, insertSocialGroupSchema } from "@shared/schema";
import { seedSampleData } from "./seed-data";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Seed sample data for new users
      if (user) {
        await seedSampleData(userId);
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Manual seed endpoint for testing
  app.post('/api/seed-data', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await seedSampleData(userId);
      res.json({ message: "Sample data seeded successfully" });
    } catch (error) {
      console.error("Error seeding data:", error);
      res.status(500).json({ message: "Failed to seed data" });
    }
  });

  // Get user's social groups
  app.get("/api/groups", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groups = await storage.getSocialGroupsByUserId(userId);
      res.json(groups);
    } catch (error) {
      console.error("Error fetching groups:", error);
      res.status(500).json({ error: "Failed to fetch groups" });
    }
  });

  // Get user's charters
  app.get("/api/charters", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const charters = await storage.getChartersByUserId(userId);
      res.json(charters);
    } catch (error) {
      console.error("Error fetching charters:", error);
      res.status(500).json({ error: "Failed to fetch charters" });
    }
  });

  // Get charter detail
  app.get("/api/charters/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const charter = await storage.getCharterDetail(id);
      if (!charter) {
        return res.status(404).json({ error: "Charter not found" });
      }
      res.json(charter);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch charter" });
    }
  });

  // Create new charter
  app.post("/api/charters", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertCharterSchema.parse({
        ...req.body,
        ownerId: userId,
      });
      const charter = await storage.createCharter(validatedData);
      res.status(201).json(charter);
    } catch (error) {
      console.error("Error creating charter:", error);
      res.status(400).json({ error: "Invalid charter data", details: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Update charter
  app.patch("/api/charters/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const charter = await storage.updateCharter(id, updates);
      res.json(charter);
    } catch (error) {
      res.status(400).json({ error: "Failed to update charter" });
    }
  });

  // Delete charter
  app.delete("/api/charters/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteCharter(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete charter" });
    }
  });

  // Get dashboard stats
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const charters = await storage.getChartersByUserId(userId);
      const groups = await storage.getSocialGroupsByUserId(userId);
      
      const stats = {
        totalCharters: charters.length,
        activeGroups: groups.filter(g => g.charter?.isActive).length,
        totalMembers: groups.reduce((sum, g) => sum + g.memberCount, 0),
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
