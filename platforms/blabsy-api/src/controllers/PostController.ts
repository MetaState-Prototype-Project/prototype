import { Request, Response } from "express";
import { PostService } from "../services/PostService";

export class PostController {
    private postService: PostService;

    constructor() {
        this.postService = new PostService();
    }

    getFeed = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const feed = await this.postService.getFollowingFeed(userId, page, limit);
            res.json(feed);
        } catch (error) {
            console.error("Error fetching feed:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    createPost = async (req: Request, res: Response) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { content, images, hashtags } = req.body;
            const blab = await this.postService.createPost(userId, {
                content,
                images,
                hashtags,
            });

            res.status(201).json(blab);
        } catch (error) {
            console.error("Error creating blab:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    toggleLike = async (req: Request, res: Response) => {
        try {
            const { id: blabId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const blab = await this.postService.toggleLike(blabId, userId);
            res.json(blab);
        } catch (error) {
            console.error("Error toggling like:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
