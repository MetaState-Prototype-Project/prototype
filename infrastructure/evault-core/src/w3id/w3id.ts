import { W3ID as W3IDClass, W3IDBuilder } from "w3id";

export class W3ID {
    private static instance: W3IDClass;

    private constructor() {}

    static async get(options?: { id: string }) {
        if (W3ID.instance) return W3ID.instance;
        if (!options)
            throw new Error(
                "No instance of W3ID exists yet, please create it by passing options",
            );
        W3ID.instance = await new W3IDBuilder().build();
    }
}
