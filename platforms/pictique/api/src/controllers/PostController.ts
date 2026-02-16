import { Request, Response } from "express";
import { PostService } from "../services/PostService";

export class PostController {
    private postService: PostService;

    constructor() {
        this.postService = new PostService();
    }

    getFeed = async (req: Request, res: Response) => {
        try {
            // @ts-ignore
            const userId = req.user?.id; // Assuming you have authentication middleware
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const feed = await this.postService.getFollowingFeed(
                userId,
                page,
                limit
            );
            res.json(feed);
        } catch (error) {
            console.error("Error fetching feed:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    createPost = async (req: Request, res: Response) => {
        try {
            // @ts-ignore
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const { text, images, hashtags } = req.body;
            const post = await this.postService.createPost(userId, {
                text,
                images,
                hashtags,
            });

            res.status(201).json(post);
        } catch (error) {
            console.error("Error creating post:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    toggleLike = async (req: Request, res: Response) => {
        try {
            const { id: postId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const post = await this.postService.toggleLike(postId, userId);
            res.json(post);
        } catch (error) {
            console.error("Error toggling like:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
