import type { Express } from "express";
import { createServer, type Server } from "http";

const EREPUTATION_API_URL = process.env.EREPUTATION_API_URL || "http://localhost:8765";

export async function registerRoutes(app: Express): Promise<Server> {
  // Simple health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Marketplace server is running" });
  });

  // Get platform references from eReputation API
  app.get("/api/platforms/:platformId/references", async (req, res) => {
    try {
      const { platformId } = req.params;
      
      // Fetch references from eReputation API
      const response = await fetch(
        `${EREPUTATION_API_URL}/api/references/target/platform/${platformId}`
      );
      
      if (!response.ok) {
        throw new Error(`eReputation API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      // Filter only signed references
      const signedReferences = (data.references || []).filter(
        (ref: any) => ref.status === "signed"
      );
      
      res.json({
        references: signedReferences,
        count: signedReferences.length
      });
    } catch (error: any) {
      console.error("Error fetching platform references:", error);
      // Return empty array if eReputation API is unavailable
      res.json({
        references: [],
        count: 0,
        error: error.message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
