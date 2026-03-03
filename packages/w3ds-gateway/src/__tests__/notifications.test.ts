import { describe, it, expect } from "vitest";
import {
    buildGatewayUri,
    buildGatewayData,
    buildGatewayLink,
    SchemaIds,
} from "../index.js";

describe("buildGatewayUri", () => {
    it("builds a w3ds-gateway:// URI with ename and schemaId", () => {
        const uri = buildGatewayUri({
            ename: "@user-uuid",
            schemaId: SchemaIds.File,
        });

        expect(uri).toMatch(/^w3ds-gateway:\/\/resolve\?/);
        expect(uri).toContain("ename=%40user-uuid");
        expect(uri).toContain(`schemaId=${SchemaIds.File}`);
        expect(uri).not.toContain("entityId");
    });

    it("includes entityId when provided", () => {
        const uri = buildGatewayUri({
            ename: "@user-uuid",
            schemaId: SchemaIds.File,
            entityId: "file-123",
        });

        expect(uri).toContain("entityId=file-123");
    });
});

describe("buildGatewayData", () => {
    it("returns structured data with auto-generated label", () => {
        const data = buildGatewayData({
            ename: "@user-uuid",
            schemaId: SchemaIds.File,
            entityId: "file-123",
        });

        expect(data.ename).toBe("@user-uuid");
        expect(data.schemaId).toBe(SchemaIds.File);
        expect(data.entityId).toBe("file-123");
        expect(data.label).toBe("Open File");
        expect(data.gatewayUri).toMatch(/^w3ds-gateway:\/\/resolve\?/);
    });

    it("uses custom linkText as label", () => {
        const data = buildGatewayData({
            ename: "@user-uuid",
            schemaId: SchemaIds.File,
            linkText: "View the file",
        });

        expect(data.label).toBe("View the file");
    });

    it("falls back to 'Open content' for unknown schemas", () => {
        const data = buildGatewayData({
            ename: "@user-uuid",
            schemaId: "unknown-schema",
        });

        expect(data.label).toBe("Open content");
    });
});

describe("buildGatewayLink", () => {
    it("builds an <a> tag with w3ds-gateway: protocol", () => {
        const html = buildGatewayLink({
            ename: "@user-uuid",
            schemaId: SchemaIds.SignatureContainer,
            entityId: "container-123",
        });

        expect(html).toContain('href="w3ds-gateway://resolve?');
        expect(html).toContain('class="w3ds-gateway-link"');
        expect(html).toContain('data-ename="@user-uuid"');
        expect(html).toContain(`data-schema-id="${SchemaIds.SignatureContainer}"`);
        expect(html).toContain('data-entity-id="container-123"');
        expect(html).toContain("Open Signature Container");
    });

    it("uses custom link text", () => {
        const html = buildGatewayLink({
            ename: "@user-uuid",
            schemaId: SchemaIds.File,
            linkText: "Click to open",
        });

        expect(html).toContain(">Click to open</a>");
    });

    it("includes data-fallback-href when fallbackUrl is provided", () => {
        const html = buildGatewayLink({
            ename: "@user-uuid",
            schemaId: SchemaIds.File,
            fallbackUrl: "https://control-panel.example.com/gateway",
        });

        expect(html).toContain('data-fallback-href="https://control-panel.example.com/gateway"');
    });

    it("does not include data-entity-id when entityId is missing", () => {
        const html = buildGatewayLink({
            ename: "@user-uuid",
            schemaId: SchemaIds.User,
        });

        expect(html).not.toContain("data-entity-id");
    });

    it("escapes HTML entities in link text", () => {
        const html = buildGatewayLink({
            ename: "@user-uuid",
            schemaId: SchemaIds.File,
            linkText: '<script>alert("xss")</script>',
        });

        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("escapes special characters in ename attribute", () => {
        const html = buildGatewayLink({
            ename: '@user"test',
            schemaId: SchemaIds.File,
        });

        expect(html).toContain('data-ename="@user&quot;test"');
    });
});


