import { Request, Response } from "express";
import { UserSearchService } from "../services/UserSearchService";

export class DiscoveryController {
	private userSearchService: UserSearchService;

	constructor() {
		this.userSearchService = new UserSearchService();
	}

	discover = async (req: Request, res: Response) => {
		try {
			const { q, page, limit, sortBy } = req.query;

			const pageNum = Math.max(1, parseInt(page as string) || 1);
			const limitNum = Math.min(
				100,
				Math.max(1, parseInt(limit as string) || 12),
			);

			const query = ((q as string) ?? "").trim();

			const results = query
				? await this.userSearchService.searchUsers(
						query,
						pageNum,
						limitNum,
						(sortBy as string) || "relevance",
					)
				: await this.userSearchService.listPublicUsers(
						pageNum,
						limitNum,
					);

			res.setHeader(
				"Cache-Control",
				"no-store, no-cache, must-revalidate, proxy-revalidate",
			);
			res.setHeader("Pragma", "no-cache");
			res.setHeader("Expires", "0");
			res.json(results);
		} catch (error: any) {
			console.error("Discovery error:", error.message);
			res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
			res.setHeader("Pragma", "no-cache");
			res.status(500).json({ error: "Search service unavailable" });
		}
	};
}
