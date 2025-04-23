import { JSONSchema7 } from "json-schema";

export type SchemaType = {
    schema: JSONSchema7;
    deserialize: (value: any) => any;
};

export const SchemaTypes: Record<string, SchemaType> = {
    date: {
        schema: {
            type: "string",
            format: "date-time",
        },
        deserialize: (value: string) => new Date(value),
    },
    number: {
        schema: {
            type: "number",
        },

        deserialize: (value: number) => value,
    },
    string: {
        schema: {
            type: "string",
        },
        deserialize: (value: string) => value,
    },
    boolean: {
        schema: {
            type: "boolean",
        },
        deserialize: (value: boolean) => value,
    },
    array: {
        schema: {
            type: "array",
        },
        deserialize: (value: any[]) => value,
    },
    object: {
        schema: {
            type: "object",
        },
        deserialize: (value: Record<string, any>) => value,
    },
};

export function getSchemaType(value: any): SchemaType {
    if (value instanceof Date) return SchemaTypes.date;
    if (Array.isArray(value)) return SchemaTypes.array;
    if (typeof value === "object" && value !== null) return SchemaTypes.object;
    if (typeof value === "number") return SchemaTypes.number;
    if (typeof value === "boolean") return SchemaTypes.boolean;
    return SchemaTypes.string;
}

export function serializeValue(value: any): { value: any; type: string } {
    const type = getSchemaType(value);
    let serializedValue = value;

    if (type === SchemaTypes.date) {
        serializedValue = value.toISOString();
    } else if (type === SchemaTypes.object) {
        serializedValue = JSON.stringify(value);
    }

    return {
        value: serializedValue,
        type:
            Object.keys(SchemaTypes).find((key) => SchemaTypes[key] === type) ||
            "string",
    };
}

export function deserializeValue(value: any, type: string): any {
    const schemaType = SchemaTypes[type];
    if (!schemaType) return value;

    if (type === "object") {
        return JSON.parse(value);
    }

    return schemaType.deserialize(value);
}
