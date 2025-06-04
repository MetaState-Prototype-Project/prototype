import { Request, Response } from "express";
import { PostService } from "../services/PostService";
import axios from "axios";
import { Post } from "database/entities/Post";

async function evault(post: Post, ename: string | undefined) {
    if (!ename) return;
    const { author, likedBy, id, comments, ...rest } = post;
    const {
        data: { uri },
    } = await axios.get(
        new URL(
            `/resolve?w3id=${ename}`,
            process.env.PUBLIC_REGISTRY_URL,
        ).toString(),
    );
    const query = `
mutation {
  storeMetaEnvelope(input: {
    ontology: "SocialMediaPost",
    payload: {
        internalId: "${id}",
        createdAt: "${rest.createdAt}",
        updatedAt: "${rest.updatedAt}",
        text: "${rest.text}",
        images: [${rest.images.map((e) => `"${e}"`)}],
        isArchived: ${rest.isArchived}
    },
    acl: ["*"]
  }) {
    metaEnvelope {
      id
      ontology
      parsed
    }
    envelopes {
      id
      ontology
      value
      valueType
    }
  }
}
`;
    const graphqlEndpoint = new URL(
        "/graphql",
        "http://192.168.0.226:31919",
    ).toString();
    const response = await axios.post(
        graphqlEndpoint,
        {
            query,
        },
        {
            headers: {
                "Content-Type": "application/json",
            },
        },
    );

    console.log(JSON.stringify(response.data));
}

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
                limit,
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

            evault(post, req.user?.ename);

            res.status(201).json(post);
        } catch (error) {
            console.error("Error creating post:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };

    toggleLike = async (req: Request, res: Response) => {
        try {
            const { postId } = req.params;
            const userId = req.user?.id;

            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const post = await this.postService.toggleLike(postId, userId);
            console.log(post);
            res.json(post);
        } catch (error) {
            console.error("Error toggling like:", error);
            res.status(500).json({ error: "Internal server error" });
        }
    };
}
