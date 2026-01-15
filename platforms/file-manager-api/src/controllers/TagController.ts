import { Request, Response } from "express";
import { TagService } from "../services/TagService";

export class TagController {
    private tagService: TagService;

    constructor() {
        this.tagService = new TagService();
    }

    createTag = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { name, color } = req.body;

            if (!name) {
                return res.status(400).json({ error: "Tag name is required" });
            }

            const tag = await this.tagService.createTag(
                name,
                req.user.id,
                color || null
            );

            res.status(201).json({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                ownerId: tag.ownerId,
                createdAt: tag.createdAt,
            });
        } catch (error) {
            console.error("Error creating tag:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to create tag" });
        }
    };

    getTags = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const tags = await this.tagService.getUserTags(req.user.id);
            res.json(tags.map(tag => ({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                ownerId: tag.ownerId,
                createdAt: tag.createdAt,
            })));
        } catch (error) {
            console.error("Error getting tags:", error);
            res.status(500).json({ error: "Failed to get tags" });
        }
    };

    updateTag = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { name, color } = req.body;

            const tag = await this.tagService.updateTag(
                id,
                req.user.id,
                name,
                color !== undefined ? (color === 'null' || color === '' ? null : color) : undefined
            );

            if (!tag) {
                return res.status(404).json({ error: "Tag not found or not authorized" });
            }

            res.json({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                ownerId: tag.ownerId,
                createdAt: tag.createdAt,
            });
        } catch (error) {
            console.error("Error updating tag:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to update tag" });
        }
    };

    deleteTag = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const deleted = await this.tagService.deleteTag(id, req.user.id);

            if (!deleted) {
                return res.status(404).json({ error: "Tag not found or not authorized" });
            }

            res.json({ message: "Tag deleted successfully" });
        } catch (error) {
            console.error("Error deleting tag:", error);
            res.status(500).json({ error: "Failed to delete tag" });
        }
    };

    addTagToFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { tagId } = req.body;

            if (!tagId) {
                return res.status(400).json({ error: "tagId is required" });
            }

            const file = await this.tagService.addTagToFile(id, tagId, req.user.id);

            if (!file) {
                return res.status(404).json({ error: "File not found or access denied" });
            }

            res.json({
                id: file.id,
                name: file.name,
                tags: file.tags?.map(tag => ({
                    id: tag.id,
                    name: tag.name,
                    color: tag.color,
                })) || [],
            });
        } catch (error) {
            console.error("Error adding tag to file:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to add tag to file" });
        }
    };

    removeTagFromFile = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id, tagId } = req.params;

            const file = await this.tagService.removeTagFromFile(id, tagId, req.user.id);

            if (!file) {
                return res.status(404).json({ error: "File not found or access denied" });
            }

            res.json({
                id: file.id,
                name: file.name,
                tags: file.tags?.map(tag => ({
                    id: tag.id,
                    name: tag.name,
                    color: tag.color,
                })) || [],
            });
        } catch (error) {
            console.error("Error removing tag from file:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to remove tag from file" });
        }
    };

    addTagToFolder = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id } = req.params;
            const { tagId } = req.body;

            if (!tagId) {
                return res.status(400).json({ error: "tagId is required" });
            }

            const folder = await this.tagService.addTagToFolder(id, tagId, req.user.id);

            if (!folder) {
                return res.status(404).json({ error: "Folder not found or access denied" });
            }

            res.json({
                id: folder.id,
                name: folder.name,
                tags: folder.tags?.map(tag => ({
                    id: tag.id,
                    name: tag.name,
                    color: tag.color,
                })) || [],
            });
        } catch (error) {
            console.error("Error adding tag to folder:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to add tag to folder" });
        }
    };

    removeTagFromFolder = async (req: Request, res: Response) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: "Authentication required" });
            }

            const { id, tagId } = req.params;

            const folder = await this.tagService.removeTagFromFolder(id, tagId, req.user.id);

            if (!folder) {
                return res.status(404).json({ error: "Folder not found or access denied" });
            }

            res.json({
                id: folder.id,
                name: folder.name,
                tags: folder.tags?.map(tag => ({
                    id: tag.id,
                    name: tag.name,
                    color: tag.color,
                })) || [],
            });
        } catch (error) {
            console.error("Error removing tag from folder:", error);
            if (error instanceof Error) {
                return res.status(400).json({ error: error.message });
            }
            res.status(500).json({ error: "Failed to remove tag from folder" });
        }
    };
}

