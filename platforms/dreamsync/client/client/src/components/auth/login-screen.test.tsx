// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAuthOfferRequest } = vi.hoisted(() => ({ getAuthOfferRequest: vi.fn() }));

vi.mock("@/lib/apiClient", () => ({
  apiClient: { defaults: { baseURL: "http://localhost:4001" }, get: getAuthOfferRequest },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ login: vi.fn() }) }));

import { LoginScreen } from "./login-screen";

const VALID_AUTH_OFFER_RESPONSE_BODY = {
  offer: "w3ds://auth?redirect=http://localhost:4001/api/auth&session=session-id&platform=dreamsync",
  sessionId: "session-id",
};

// What a single-page app server sends back when the API base URL points at the client instead of the API
const SINGLE_PAGE_APP_FALLBACK_HTML = "<!DOCTYPE html><html><body><div id=\"root\"></div></body></html>";

const AUTH_OFFER_UNAVAILABLE_MESSAGE = /could not load the login code/i;

class EventSourceStub {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close() {}
}

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", EventSourceStub);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    getAuthOfferRequest.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the QR code for a valid auth offer", async () => {
    getAuthOfferRequest.mockResolvedValue({ data: VALID_AUTH_OFFER_RESPONSE_BODY });

    const { container } = render(<LoginScreen />);

    await screen.findByText(/scan the qr code/i);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText(AUTH_OFFER_UNAVAILABLE_MESSAGE)).toBeNull();
  });

  it("tells the user the login code is unavailable when the offer response is not an auth offer", async () => {
    getAuthOfferRequest.mockResolvedValue({ data: SINGLE_PAGE_APP_FALLBACK_HTML });

    render(<LoginScreen />);

    expect(await screen.findByText(AUTH_OFFER_UNAVAILABLE_MESSAGE)).not.toBeNull();
  });

  it("tells the user the login code is unavailable when the offer request fails", async () => {
    getAuthOfferRequest.mockRejectedValue(new Error("Network Error"));

    render(<LoginScreen />);

    expect(await screen.findByText(AUTH_OFFER_UNAVAILABLE_MESSAGE)).not.toBeNull();
  });
});
