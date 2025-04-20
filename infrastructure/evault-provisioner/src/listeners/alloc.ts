import EventEmitter from "events";
import axios from "axios";

export function subscribeToAlloc(evalId: string): EventEmitter {
    const emitter = new EventEmitter();

    const poll = async () => {
        try {
            // Step 1: Wait for alloc to be running
            let allocId: string | null = null;
            for (let i = 0; i < 30; i++) {
                const allocsRes = await axios.get(
                    `http://localhost:4646/v1/evaluation/${evalId}/allocations`,
                );
                const running = allocsRes.data.find(
                    (a: any) => a.ClientStatus === "running",
                );
                if (running) {
                    allocId = running.ID;
                    break;
                }
                await new Promise((r) => setTimeout(r, 1000));
            }

            if (!allocId) {
                emitter.emit(
                    "error",
                    new Error("Timeout: no running allocation"),
                );
                return;
            }

            // Step 2: Get alloc info → port + node
            const allocInfo = await axios.get(
                `http://localhost:4646/v1/allocation/${allocId}`,
            );
            const netInfo = allocInfo.data.Resources.Networks[0];
            const port = netInfo.DynamicPorts.find(
                (p: any) => p.Label === "http",
            )?.Value;
            const nodeId = allocInfo.data.NodeID;

            if (!port || !nodeId) {
                emitter.emit("error", new Error("Missing port or node info"));
                return;
            }

            // Step 3: Get node (host) IP
            const nodeInfo = await axios.get(
                `http://localhost:4646/v1/node/${nodeId}`,
            );
            const host =
                nodeInfo.data.Attributes["unique.network.ip-address"] ||
                nodeInfo.data.HTTPAddr;

            if (!host) {
                emitter.emit("error", new Error("No host found for node"));
                return;
            }

            const url = `http://${host}:${port}`;

            emitter.emit("ready", url);
        } catch (err) {
            emitter.emit("error", err);
        }
    };

    poll();
    return emitter;
}
