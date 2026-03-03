/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll, beforeEach } from "vitest";

// Import the modal (side-effect: registers the custom element)
import "../modal.js";
import { W3dsGatewayChooser } from "../modal.js";
import { configurePlatformUrls } from "../capabilities.js";

// Configure test platform URLs
beforeAll(() => {
    configurePlatformUrls({
        pictique: "http://localhost:5173",
        blabsy: "http://localhost:8080",
        "file-manager": "http://localhost:3005",
        esigner: "http://localhost:3006",
        evoting: "http://localhost:3000",
    });
});

describe("W3dsGatewayChooser web component", () => {
    beforeEach(() => {
        // Clean up any existing instances
        document.body.innerHTML = "";
    });

    it("registers the custom element", () => {
        const ctor = customElements.get("w3ds-gateway-chooser");
        expect(ctor).toBeDefined();
        expect(ctor).toBe(W3dsGatewayChooser);
    });

    it("creates an element with shadow DOM", () => {
        const el = document.createElement("w3ds-gateway-chooser");
        document.body.appendChild(el);

        expect(el.shadowRoot).toBeDefined();
        expect(el.shadowRoot).not.toBeNull();
    });

    it("starts closed by default", () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        document.body.appendChild(el);

        expect(el.isOpen).toBe(false);
        const backdrop = el.shadowRoot!.querySelector(".gateway-backdrop");
        expect(backdrop).not.toBeNull();
        expect(backdrop!.classList.contains("open")).toBe(false);
    });

    it("opens via the open() method", () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        el.setAttribute("ename", "@test-user");
        el.setAttribute("schema-id", "550e8400-e29b-41d4-a716-446655440001");
        document.body.appendChild(el);

        el.open();

        expect(el.isOpen).toBe(true);
        const backdrop = el.shadowRoot!.querySelector(".gateway-backdrop");
        expect(backdrop!.classList.contains("open")).toBe(true);
    });

    it("closes via the close() method", () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        el.setAttribute("ename", "@test-user");
        el.setAttribute("schema-id", "550e8400-e29b-41d4-a716-446655440001");
        document.body.appendChild(el);

        el.open();
        el.close();

        expect(el.isOpen).toBe(false);
        const backdrop = el.shadowRoot!.querySelector(".gateway-backdrop");
        expect(backdrop!.classList.contains("open")).toBe(false);
    });

    it("dispatches gateway-open event on open()", () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        el.setAttribute("ename", "@test-user");
        el.setAttribute("schema-id", "550e8400-e29b-41d4-a716-446655440001");
        document.body.appendChild(el);

        let opened = false;
        el.addEventListener("gateway-open", () => { opened = true; });
        el.open();

        expect(opened).toBe(true);
    });

    it("dispatches gateway-close event on close()", () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        el.setAttribute("ename", "@test-user");
        el.setAttribute("schema-id", "550e8400-e29b-41d4-a716-446655440001");
        document.body.appendChild(el);

        let closed = false;
        el.addEventListener("gateway-close", () => { closed = true; });
        el.open();
        el.close();

        expect(closed).toBe(true);
    });

    it("shows error when ename is missing on open", async () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        el.setAttribute("schema-id", "some-schema");
        document.body.appendChild(el);

        el.open();
        // Wait for async resolve
        await new Promise((r) => setTimeout(r, 50));

        const error = el.shadowRoot!.querySelector(".gateway-error");
        expect(error).not.toBeNull();
        expect(error!.textContent).toContain("Missing data");
    });

    it("shows error when schema-id is missing on open", async () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        el.setAttribute("ename", "@test-user");
        document.body.appendChild(el);

        el.open();
        await new Promise((r) => setTimeout(r, 50));

        const error = el.shadowRoot!.querySelector(".gateway-error");
        expect(error).not.toBeNull();
        expect(error!.textContent).toContain("Missing data");
    });

    it("renders app links for known schema", async () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        el.setAttribute("ename", "@test-user");
        el.setAttribute("schema-id", "550e8400-e29b-41d4-a716-446655440001"); // SocialMediaPost
        el.setAttribute("entity-id", "post-123");
        document.body.appendChild(el);

        el.open();
        // Wait for async resolve (no registry, uses defaults)
        await new Promise((r) => setTimeout(r, 100));

        const links = el.shadowRoot!.querySelectorAll(".gateway-app-link");
        expect(links.length).toBeGreaterThan(0);

        // SocialMediaPost should have Pictique and Blabsy
        const hrefs = Array.from(links).map((l) => (l as HTMLAnchorElement).href);
        const pictique = hrefs.find((h) => h.includes("localhost:5173"));
        const blabsy = hrefs.find((h) => h.includes("localhost:8080"));
        expect(pictique).toBeDefined();
        expect(blabsy).toBeDefined();
    });

    it("renders empty state for unknown schema", async () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        el.setAttribute("ename", "@test-user");
        el.setAttribute("schema-id", "nonexistent-schema-id");
        document.body.appendChild(el);

        el.open();
        await new Promise((r) => setTimeout(r, 100));

        const empty = el.shadowRoot!.querySelector(".gateway-empty");
        expect(empty).not.toBeNull();
    });

    it("opens automatically when 'open' attribute is present", async () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        el.setAttribute("ename", "@test-user");
        el.setAttribute("schema-id", "550e8400-e29b-41d4-a716-446655440001");
        el.setAttribute("open", "");
        document.body.appendChild(el);

        // Should auto-open on connect
        expect(el.isOpen).toBe(true);
    });

    it("shows eName in the footer", async () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        el.setAttribute("ename", "@alice-test");
        el.setAttribute("schema-id", "550e8400-e29b-41d4-a716-446655440001");
        el.setAttribute("entity-id", "post-1");
        document.body.appendChild(el);

        el.open();
        await new Promise((r) => setTimeout(r, 100));

        const footer = el.shadowRoot!.querySelector(".gateway-footer");
        expect(footer).not.toBeNull();
        expect(footer!.textContent).toContain("@alice-test");
    });

    it("has proper ARIA attributes", () => {
        const el = document.createElement("w3ds-gateway-chooser") as W3dsGatewayChooser;
        document.body.appendChild(el);

        const modal = el.shadowRoot!.querySelector(".gateway-modal");
        expect(modal!.getAttribute("role")).toBe("dialog");
        expect(modal!.getAttribute("aria-modal")).toBe("true");
    });
});
