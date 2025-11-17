import { UriResolutionService } from "./UriResolutionService";

describe("UriResolutionService", () => {
    let service: UriResolutionService;

    beforeAll(() => {
        service = new UriResolutionService();
    });

    describe("resolveUri", () => {
        it("should return original URI unchanged (simplified multi-tenant)", async () => {
            const originalUri = "http://localhost:4000";
            const resolved = await service.resolveUri(originalUri);

            expect(resolved).toBe(originalUri);
        });

        it("should handle empty string", async () => {
            const resolved = await service.resolveUri("");
            expect(resolved).toBe("");
        });

        it("should handle IP address with port", async () => {
            const originalUri = "http://192.168.1.1:4000";
            const resolved = await service.resolveUri(originalUri);
            expect(resolved).toBe(originalUri);
        });

        it("should handle HTTPS URIs", async () => {
            const originalUri = "https://example.com:443";
            const resolved = await service.resolveUri(originalUri);
            expect(resolved).toBe(originalUri);
        });
    });
});

