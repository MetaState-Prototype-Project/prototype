import { DataSource } from "typeorm";
import { betterAuth } from "better-auth";

export const typeormAdapter = (dataSource: DataSource) => {
    return betterAuth.adapters.typeorm(dataSource);
};
