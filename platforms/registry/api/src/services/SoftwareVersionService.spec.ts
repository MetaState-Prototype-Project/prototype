import type { Repository } from "typeorm";
import type { SoftwareVersion } from "../entities/SoftwareVersion";
import {
    SoftwareVersionConflictError,
    SoftwareVersionService,
    normalizeSoftwareVersion,
    softwareVersionEName,
} from "./SoftwareVersionService";

const platformEname = "@0699e093-2dd9-59cc-a416-7dc69623ebfd";

function repository(existing: SoftwareVersion | null = null) {
    const save = jest.fn(async (record: SoftwareVersion) => record);
    return {
        findOneBy: jest.fn(async () => existing),
        create: jest.fn((record) => record as SoftwareVersion),
        save,
    } as unknown as Repository<SoftwareVersion>;
}

describe("SoftwareVersionService", () => {
    it("derives stable version eNames", () => {
        expect(softwareVersionEName(platformEname, "1.2.3")).toBe(
            softwareVersionEName(platformEname, "1.2.3"),
        );
        expect(softwareVersionEName(platformEname, "1.2.4")).not.toBe(
            softwareVersionEName(platformEname, "1.2.3"),
        );
    });

    it("normalizes v-prefixed semantic versions", () => {
        expect(normalizeSoftwareVersion("v1.2.3")).toBe("1.2.3");
        expect(() => normalizeSoftwareVersion("latest")).toThrow("semantic");
    });

    it("returns the existing immutable record idempotently", async () => {
        const existing = {
            id: 7,
            ename: softwareVersionEName(platformEname, "1.2.3"),
            platformEname,
            version: "1.2.3",
            releaseTag: "v1.2.3",
            commitSha: "a".repeat(40),
            createdAt: new Date(),
        };
        const repo = repository(existing);
        const service = new SoftwareVersionService(repo);

        await expect(service.create({
            platformEname,
            version: "v1.2.3",
            releaseTag: "v1.2.3",
            commitSha: "A".repeat(40),
        })).resolves.toBe(existing);
        expect(repo.save).not.toHaveBeenCalled();
    });

    it("rejects rebinding a platform version", async () => {
        const existing = {
            id: 7,
            ename: softwareVersionEName(platformEname, "1.2.3"),
            platformEname,
            version: "1.2.3",
            releaseTag: "v1.2.3",
            commitSha: "a".repeat(40),
            createdAt: new Date(),
        };
        const service = new SoftwareVersionService(repository(existing));

        await expect(service.create({
            platformEname,
            version: "1.2.3",
            releaseTag: "v1.2.3",
            commitSha: "b".repeat(40),
        })).rejects.toBeInstanceOf(SoftwareVersionConflictError);
    });
});
