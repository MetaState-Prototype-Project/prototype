import type { Driver } from "neo4j-driver";
import { W3IDBuilder, type W3ID as W3IDClass } from "w3id";
import { LogService } from "./log-service";

export class W3ID {
    private static instance: W3IDClass;

    private constructor() {}

    static async get(options?: {
        id: string;
        driver: Driver;
        password?: string;
    }) {
        if (W3ID.instance) return W3ID.instance;
        if (!options)
            throw new Error(
                "No instance of W3ID exists yet, please create it by passing options",
            );

        const repository = new LogService(options.driver);

        W3ID.instance = await new W3IDBuilder()
            .withId(options.id)
            .withRepository(repository)
            .withGlobal(true)
            .build();

        return W3ID.instance;
    }
}
