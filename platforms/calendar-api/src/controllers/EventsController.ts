import { Response } from "express";
import { EVaultService } from "../services/EVaultService";
import { AuthenticatedRequest } from "../middleware/auth";

const evaultService = new EVaultService();

export class EventsController {
  list = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ename = req.user?.ename;
      if (!ename) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const first = Math.min(
        parseInt(String(req.query.first), 10) || 100,
        500
      );
      const after = (req.query.after as string) || undefined;
      const events = await evaultService.listEvents(ename, first, after);
      res.json(events);
    } catch (error) {
      console.error("List events error:", error);
      res.status(500).json({
        error: "Failed to list events",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  create = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ename = req.user?.ename;
      if (!ename) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const { title, color, start, end } = req.body;
      if (!title || !start || !end) {
        res.status(400).json({
          error: "Missing required fields",
          message: "title, start, and end are required",
        });
        return;
      }
      const event = await evaultService.createEvent(ename, {
        title,
        color: color ?? "",
        start,
        end,
      });
      res.status(201).json(event);
    } catch (error) {
      console.error("Create event error:", error);
      res.status(500).json({
        error: "Failed to create event",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  update = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ename = req.user?.ename;
      if (!ename) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const id = req.params.id;
      const { title, color, start, end } = req.body;
      const payload: Record<string, string> = {};
      if (title !== undefined) payload.title = title;
      if (color !== undefined) payload.color = color;
      if (start !== undefined) payload.start = start;
      if (end !== undefined) payload.end = end;
      if (Object.keys(payload).length === 0) {
        res.status(400).json({ error: "No fields to update" });
        return;
      }
      const event = await evaultService.updateEvent(ename, id, payload);
      res.json(event);
    } catch (error) {
      console.error("Update event error:", error);
      res.status(500).json({
        error: "Failed to update event",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  remove = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const ename = req.user?.ename;
      if (!ename) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const id = req.params.id;
      await evaultService.removeEvent(ename, id);
      res.status(204).send();
    } catch (error) {
      console.error("Remove event error:", error);
      res.status(500).json({
        error: "Failed to delete event",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
