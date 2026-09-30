import type { Express } from "express";
import { createServer, type Server } from "http";
import { listPlatforms } from "./aaas";
import { listCatalogApps } from "./catalog";

const EREPUTATION_API_URL = process.env.EREPUTATION_API_URL || "http://localhost:8765";

export async function registerRoutes(app: Express): Promise<Server> {
  // Simple health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Marketplace server is running" });
  });

  // Live platform listings pulled from Awareness-as-a-Service. Degrades to an
  // empty list if AaaS is unavailable or unconfigured, so the static catalog
  // still renders.
  app.get("/api/platforms", async (_req, res) => {
    try {
      const platforms = await listPlatforms();
      res.json({ platforms, count: platforms.length });
    } catch (error: any) {
      console.error("Error fetching platforms from awareness:", error);
      res.json({ platforms: [], count: 0, error: error.message });
    }
  });

  // Full catalogue (curated + live) for other clients, e.g. the eID wallet's
  // apps ribbon. Public, read-only data, so any origin may read it.
  app.get("/api/apps", async (_req, res) => {
    const apps = await listCatalogApps();
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Cache-Control", "public, max-age=300");
    res.json({ apps, count: apps.length });
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
