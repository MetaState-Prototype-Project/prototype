import { AppDataSource } from "../database/data-source";
import { Tag } from "../database/entities/Tag";
import { File } from "../database/entities/File";
import { Folder } from "../database/entities/Folder";

export class TagService {
    private tagRepository = AppDataSource.getRepository(Tag);
    private fileRepository = AppDataSource.getRepository(File);
    private folderRepository = AppDataSource.getRepository(Folder);

    async createTag(
        name: string,
        ownerId: string,
        color?: string | null
    ): Promise<Tag> {
        // Check if tag with same name already exists for this user
        const existingTag = await this.tagRepository.findOne({
            where: { name, ownerId },
        });

        if (existingTag) {
            throw new Error("Tag with this name already exists");
        }

        const tag = this.tagRepository.create({
            name,
            ownerId,
            color: color || null,
        });

        return await this.tagRepository.save(tag);
    }

    async getUserTags(userId: string): Promise<Tag[]> {
        return await this.tagRepository.find({
            where: { ownerId: userId },
            relations: ["files", "folders"],
            order: { createdAt: "DESC" },
        });
    }

    async getTagById(id: string, userId: string): Promise<Tag | null> {
        const tag = await this.tagRepository.findOne({
            where: { id, ownerId: userId },
            relations: ["files", "folders"],
        });

        return tag;
    }

    async updateTag(
        id: string,
        userId: string,
        name?: string,
        color?: string | null
    ): Promise<Tag | null> {
        const tag = await this.tagRepository.findOne({
            where: { id, ownerId: userId },
        });

        if (!tag) {
            return null;
        }

        if (name !== undefined) {
            // Check if another tag with this name exists
            const existingTag = await this.tagRepository.findOne({
                where: { name, ownerId: userId },
            });
            if (existingTag && existingTag.id !== id) {
                throw new Error("Tag with this name already exists");
            }
            tag.name = name;
        }

        if (color !== undefined) {
            tag.color = color;
        }

        return await this.tagRepository.save(tag);
    }

    async deleteTag(id: string, userId: string): Promise<boolean> {
        const tag = await this.tagRepository.findOne({
            where: { id, ownerId: userId },
        });

        if (!tag) {
            return false;
        }

        await this.tagRepository.remove(tag);
        return true;
    }

    async addTagToFile(fileId: string, tagId: string, userId: string): Promise<File | null> {
        const file = await this.fileRepository.findOne({
            where: { id: fileId },
            relations: ["tags", "owner"],
        });

        if (!file) {
            throw new Error("File not found");
        }

        // Verify user has access to the file
        if (file.ownerId !== userId) {
            throw new Error("Access denied");
        }

        const tag = await this.tagRepository.findOne({
            where: { id: tagId, ownerId: userId },
        });

        if (!tag) {
            throw new Error("Tag not found");
        }

        // Check if tag is already attached
        if (file.tags && file.tags.some(t => t.id === tagId)) {
            return file;
        }

        if (!file.tags) {
            file.tags = [];
        }

        file.tags.push(tag);
        return await this.fileRepository.save(file);
    }

    async removeTagFromFile(fileId: string, tagId: string, userId: string): Promise<File | null> {
        const file = await this.fileRepository.findOne({
            where: { id: fileId },
            relations: ["tags", "owner"],
        });

        if (!file) {
            throw new Error("File not found");
        }

        // Verify user has access to the file
        if (file.ownerId !== userId) {
            throw new Error("Access denied");
        }

        if (!file.tags || !file.tags.some(t => t.id === tagId)) {
            return file;
        }

        file.tags = file.tags.filter(t => t.id !== tagId);
        return await this.fileRepository.save(file);
    }

    async addTagToFolder(folderId: string, tagId: string, userId: string): Promise<Folder | null> {
        const folder = await this.folderRepository.findOne({
            where: { id: folderId },
            relations: ["tags", "owner"],
        });

        if (!folder) {
            throw new Error("Folder not found");
        }

        // Verify user has access to the folder
        if (folder.ownerId !== userId) {
            throw new Error("Access denied");
        }

        const tag = await this.tagRepository.findOne({
            where: { id: tagId, ownerId: userId },
        });

        if (!tag) {
            throw new Error("Tag not found");
        }

        // Check if tag is already attached
        if (folder.tags && folder.tags.some(t => t.id === tagId)) {
            return folder;
        }

        if (!folder.tags) {
            folder.tags = [];
        }

        folder.tags.push(tag);
        return await this.folderRepository.save(folder);
    }

    async removeTagFromFolder(folderId: string, tagId: string, userId: string): Promise<Folder | null> {
        const folder = await this.folderRepository.findOne({
            where: { id: folderId },
            relations: ["tags", "owner"],
        });

        if (!folder) {
            throw new Error("Folder not found");
        }

        // Verify user has access to the folder
        if (folder.ownerId !== userId) {
            throw new Error("Access denied");
        }

        if (!folder.tags || !folder.tags.some(t => t.id === tagId)) {
            return folder;
        }

        folder.tags = folder.tags.filter(t => t.id !== tagId);
        return await this.folderRepository.save(folder);
    }

    async getFilesByTag(tagId: string, userId: string): Promise<File[]> {
        const tag = await this.tagRepository.findOne({
            where: { id: tagId, ownerId: userId },
            relations: ["files"],
        });

        if (!tag) {
            return [];
        }

        return tag.files || [];
    }

    async getFoldersByTag(tagId: string, userId: string): Promise<Folder[]> {
        const tag = await this.tagRepository.findOne({
            where: { id: tagId, ownerId: userId },
            relations: ["folders"],
        });

        if (!tag) {
            return [];
        }

        return tag.folders || [];
    }
}

