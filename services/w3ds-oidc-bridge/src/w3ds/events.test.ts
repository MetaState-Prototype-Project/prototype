import { describe, expect, it, vi } from "vitest";
import { recordingSink } from "../harness.test-utils.js";
import { createSessionStreams } from "./events.js";

const streams = () => createSessionStreams({ heartbeatMs: 0 });

describe("createSessionStreams", () => {
    it("delivers an event to a waiting subscriber and closes the stream", () => {
        const s = streams();
        const sink = recordingSink();
        s.subscribe("session-1", sink);

        s.publish("session-1", {
            type: "redirect",
            url: "https://git.example.org/cb?code=x",
        });

        expect(sink.events).toEqual([
            { type: "redirect", url: "https://git.example.org/cb?code=x" },
        ]);
        expect(sink.ended).toBe(true);
    });

    it("holds an event for a subscriber that has not arrived yet", () => {
        // A fast scan can beat the browser's EventSource. Without this the login
        // would hang despite having succeeded.
        const s = streams();
        s.publish("session-1", { type: "error", message: "too old" });

        const sink = recordingSink();
        s.subscribe("session-1", sink);

        expect(sink.events).toEqual([{ type: "error", message: "too old" }]);
        expect(sink.ended).toBe(true);
    });

    it("delivers a held event only once", () => {
        const s = streams();
        s.publish("session-1", { type: "error", message: "too old" });

        s.subscribe("session-1", recordingSink());
        const second = recordingSink();
        s.subscribe("session-1", second);

        expect(second.events).toEqual([]);
    });

    it("keeps sessions apart", () => {
        const s = streams();
        const one = recordingSink();
        const two = recordingSink();
        s.subscribe("session-1", one);
        s.subscribe("session-2", two);

        s.publish("session-1", {
            type: "redirect",
            url: "https://example.org/",
        });

        expect(one.events).toHaveLength(1);
        expect(two.events).toHaveLength(0);
    });

    it("reaches every subscriber on the same session", () => {
        const s = streams();
        const first = recordingSink();
        const second = recordingSink();
        s.subscribe("session-1", first);
        s.subscribe("session-1", second);

        s.publish("session-1", {
            type: "redirect",
            url: "https://example.org/",
        });

        expect(first.events).toHaveLength(1);
        expect(second.events).toHaveLength(1);
        expect(s.subscriberCount("session-1")).toBe(0);
    });

    it("counts what is attached", () => {
        const s = streams();
        expect(s.subscriberCount("session-1")).toBe(0);
        s.subscribe("session-1", recordingSink());
        expect(s.subscriberCount("session-1")).toBe(1);
    });

    it("greets a new subscriber so the connection is established immediately", () => {
        const s = streams();
        const written: string[] = [];
        s.subscribe("session-1", {
            write: (chunk) => written.push(chunk),
            end: () => {},
            on: () => {},
        });
        expect(written[0]).toBe(": connected\n\n");
    });

    it("writes a well-formed SSE frame", () => {
        const s = streams();
        const written: string[] = [];
        s.subscribe("session-1", {
            write: (chunk) => written.push(chunk),
            end: () => {},
            on: () => {},
        });

        s.publish("session-1", {
            type: "redirect",
            url: "https://example.org/",
        });

        expect(written[1]).toBe(
            'event: redirect\ndata: {"type":"redirect","url":"https://example.org/"}\n\n',
        );
    });

    it("drops a subscriber whose connection closed", () => {
        const s = streams();
        let onClose = () => {};
        s.subscribe("session-1", {
            write: () => {},
            end: () => {},
            on: (_event, listener) => {
                onClose = listener;
            },
        });

        expect(s.subscriberCount("session-1")).toBe(1);
        onClose();
        expect(s.subscriberCount("session-1")).toBe(0);
    });

    describe("the heartbeat", () => {
        it("pings an idle connection so a proxy does not drop it", () => {
            vi.useFakeTimers();
            try {
                const s = createSessionStreams({ heartbeatMs: 1000 });
                const written: string[] = [];
                s.subscribe("session-1", {
                    write: (chunk) => written.push(chunk),
                    end: () => {},
                    on: () => {},
                });

                vi.advanceTimersByTime(2500);
                expect(
                    written.filter((chunk) => chunk === ": ping\n\n"),
                ).toHaveLength(2);

                s.closeAll();
            } finally {
                vi.useRealTimers();
            }
        });

        it("stops once the stream has served its event", () => {
            vi.useFakeTimers();
            try {
                const s = createSessionStreams({ heartbeatMs: 1000 });
                const written: string[] = [];
                s.subscribe("session-1", {
                    write: (chunk) => written.push(chunk),
                    end: () => {},
                    on: () => {},
                });

                s.publish("session-1", {
                    type: "redirect",
                    url: "https://example.org/",
                });
                const after = written.length;
                vi.advanceTimersByTime(5000);

                expect(written).toHaveLength(after);
            } finally {
                vi.useRealTimers();
            }
        });
    });

    it("closes everything on shutdown", () => {
        const s = streams();
        const sink = recordingSink();
        s.subscribe("session-1", sink);

        s.closeAll();

        expect(sink.ended).toBe(true);
        expect(s.subscriberCount("session-1")).toBe(0);
    });
});
