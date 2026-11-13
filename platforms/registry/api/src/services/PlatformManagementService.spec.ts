import type { Repository } from "typeorm";
import type { PlatformManagement } from "../entities/PlatformManagement";
import { generateManagedPlatformToken, verifyPlatformTokenClaims } from "../jwt";
import { PlatformManagementConflictError, PlatformManagementService, tokenFingerprint } from "./PlatformManagementService";

jest.mock("../jwt", () => ({
    generateManagedPlatformToken: jest.fn(async () => "manager-token"),
    verifyPlatformTokenClaims: jest.fn(),
}));

describe("PlatformManagementService", () => {
    const records = new Map<string, PlatformManagement>();
    const repository = {
        findOneBy: jest.fn(async ({ ename }: { ename: string }) => records.get(ename) ?? null),
        create: jest.fn((input: PlatformManagement) => input),
        save: jest.fn(async (input: PlatformManagement) => {
            records.set(input.ename, input);
            return input;
        }),
    } as unknown as Repository<PlatformManagement>;
    const service = new PlatformManagementService(repository);

    beforeEach(() => {
        records.clear();
        jest.clearAllMocks();
        jest.mocked(verifyPlatformTokenClaims).mockResolvedValue({ platform: "legacy-publisher" });
    });

    it("activates one idempotent management transfer and revokes the supplied token", async () => {
        const input = { ename: "@platform", manager: "https://gitw3.example", profileEnvelopeId: "profile-1", legacyToken: "old-secret" };
        const first = await service.transfer(input);
        const repeated = await service.transfer(input);

        expect(first.management.revokedTokenFingerprint).toBe(tokenFingerprint("old-secret"));
        expect(repeated.management).toEqual(first.management);
        expect(generateManagedPlatformToken).toHaveBeenCalledTimes(2);
    });

    it("rejects a competing transfer", async () => {
        await service.transfer({ ename: "@platform", manager: "manager-a", profileEnvelopeId: "profile-1", legacyToken: "old-secret" });
        await expect(service.transfer({ ename: "@platform", manager: "manager-b", profileEnvelopeId: "profile-1", legacyToken: "old-secret" }))
            .rejects.toBeInstanceOf(PlatformManagementConflictError);
    });

    it("allows only the active manager to write the managed profile envelope", async () => {
        await service.transfer({ ename: "@platform", manager: "manager-a", profileEnvelopeId: "profile-1", legacyToken: "old-secret" });

        expect(await service.authorizeProfileWrite({ ename: "@platform", ontology: "other" })).toEqual({ managed: false, allowed: true });
        expect((await service.authorizeProfileWrite({ ename: "@platform", ontology: "550e8400-e29b-41d4-a716-446655440000", envelopeId: "profile-1", token: "old-secret" })).allowed).toBe(false);
        jest.mocked(verifyPlatformTokenClaims).mockResolvedValue({ platform: "manager-a", kind: "platform-manager", managedEname: "@platform", manager: "manager-a" });
        expect(await service.authorizeProfileWrite({ ename: "@platform", ontology: "550e8400-e29b-41d4-a716-446655440000", envelopeId: "profile-1", token: "new-secret" })).toEqual({ managed: true, allowed: true });
    });
});
