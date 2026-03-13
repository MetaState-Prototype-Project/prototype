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

			if (!q) {
				return res
					.status(400)
					.json({ error: 'Query parameter "q" is required' });
			}

			const pageNum = Math.max(1, parseInt(page as string) || 1);
			const limitNum = Math.min(
				100,
				Math.max(1, parseInt(limit as string) || 10),
			);

			const results = await this.userSearchService.searchUsers(
				q as string,
				pageNum,
				limitNum,
				(sortBy as string) || "relevance",
			);

			res.json(results);
		} catch (error: any) {
			console.error("Discovery error:", error.message);
			res.status(500).json({ error: "Search service unavailable" });
		}
	};
}
