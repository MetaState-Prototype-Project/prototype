import type {
    IMapperResponse,
    IMappingConversionOptions,
} from "./mapper.types";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function getValueByPath(obj: Record<string, any>, path: string): any {
    // Handle array mapping case (e.g., "images[].src")
    if (path.includes("[]")) {
        const [arrayPath, fieldPath] = path.split("[]");
        const array = getValueByPath(obj, arrayPath);

        if (!Array.isArray(array)) {
            return [];
        }

        // If there's a field path after [], map through the array
        if (fieldPath) {
            return array.map((item) =>
                getValueByPath(item, fieldPath.slice(1)),
            ); // Remove the leading dot
        }

        return array;
    }

    // Handle regular path case
    const parts = path.split(".");
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    return parts.reduce((acc: any, part: string) => {
        if (acc === null || acc === undefined) return undefined;
        return acc[part];
    }, obj);
}

/**
 * Extracts the owner eVault from data using the specified path(s).
 * Supports fallback paths using the || operator.
 * 
 * @param data - The data object to extract from
 * @param ownerEnamePath - The path(s) to extract from. Can be:
 *   - Single path: "owner.ename"
 *   - Fallback paths: "path1||path2" (tries path1 first, then path2)
 *   - Table references: "users(owner.ename)"
 *   - Fallback with table refs: "users(owner.ename)||users(creator.ename)"
 * @returns The owner eVault identifier or null if not found
 */
async function extractOwnerEvault(
    data: Record<string, unknown>,
    ownerEnamePath: string,
): Promise<string | null> {
    if (!ownerEnamePath || ownerEnamePath === "null") {
        return null;
    }

    // Check if the path contains fallback operator (||)
    if (ownerEnamePath.includes("||")) {
        const paths = ownerEnamePath.split("||").map(path => path.trim()).filter(path => path.length > 0);
        
        if (paths.length < 2) {
            console.warn("Invalid fallback path format. Expected 'path1||path2' but got:", ownerEnamePath);
            return null;
        }
        
        console.log(`Processing fallback paths for owner eVault: [${paths.join(", ")}]`);
        
        // Try each path in order until one succeeds
        for (let i = 0; i < paths.length; i++) {
            const path = paths[i];
            console.log(`Trying fallback path ${i + 1}/${paths.length}: ${path}`);
            
            const result = await extractOwnerEvaultSinglePath(data, path);
            if (result !== null) {
                console.log(`✅ Owner eVault found using fallback path ${i + 1}: ${path}`);
                return result;
            } else {
                console.log(`❌ Fallback path ${i + 1} failed: ${path}`);
            }
        }
        
        // If all paths fail, return null
        console.log("❌ All fallback paths failed for owner eVault");
        return null;
    }

    // Single path - use existing logic
    return await extractOwnerEvaultSinglePath(data, ownerEnamePath);
}

/**
 * Helper function to extract owner eVault from a single path.
 * This is the original implementation logic for single paths.
 */
async function extractOwnerEvaultSinglePath(
    data: Record<string, unknown>,
    ownerEnamePath: string,
): Promise<string | null> {
    if (!ownerEnamePath.includes("(")) {
        return (data[ownerEnamePath] as string) || null;
    }

    const [_, fieldPathRaw] = ownerEnamePath.split("(");
    const fieldPath = fieldPathRaw.replace(")", "");
    let value = getValueByPath(data, fieldPath);
    if (Array.isArray(value)) return value[0];
    console.log("OWNER PATH", value);
    
    // Check if value is a string before calling .includes()
    if (typeof value === "string" && value.includes("(") && value.includes(")")) {
        value = value.split("(")[1].split(")")[0];
    }
    
    return (value as string) || null;
}

export async function fromGlobal({
    data,
    mapping,
    mappingStore,
}: IMappingConversionOptions): Promise<Omit<IMapperResponse, "ownerEvault">> {
    const result: Record<string, unknown> = {};

    for (const [localKey, globalPathRaw] of Object.entries(
        mapping.localToUniversalMap,
    )) {
        let value: string | number | undefined | (string | null)[] | null;
        const targetKey: string = localKey;
        let tableRef: string | null = null;

        const internalFnMatch = globalPathRaw.match(/^__(\w+)\((.+)\)$/);
        if (internalFnMatch) {
            const [, outerFn, innerExpr] = internalFnMatch;

            if (outerFn === "date") {
                const calcMatch = innerExpr.match(/^calc\((.+)\)$/);
                if (calcMatch) {
                    const calcResult = evaluateCalcExpression(
                        calcMatch[1],
                        data,
                    );
                    value =
                        calcResult !== undefined
                            ? new Date(calcResult).toISOString()
                            : undefined;
                } else {
                    const rawVal = getValueByPath(data, innerExpr);
                    if (typeof rawVal === "number") {
                        value = new Date(rawVal).toISOString();
                    } else if (rawVal?._seconds) {
                        // Handle Firebase v8 timestamp format
                        value = new Date(rawVal._seconds * 1000).toISOString();
                    } else if (rawVal?.seconds) {
                        // Handle Firebase v9+ timestamp format
                        value = new Date(rawVal.seconds * 1000).toISOString();
                    } else if (rawVal?.toDate && typeof rawVal.toDate === 'function') {
                        // Handle Firebase Timestamp objects
                        value = rawVal.toDate().toISOString();
                    } else if (rawVal instanceof Date) {
                        value = rawVal.toISOString();
                    } else if (typeof rawVal === 'string' && rawVal.includes('UTC')) {
                        // Handle Firebase timestamp strings like "August 18, 2025 at 10:03:19 AM UTC+5:30"
                        value = new Date(rawVal).toISOString();
                    } else {
                        value = undefined;
                    }
                }
            } else if (outerFn === "calc") {
                value = evaluateCalcExpression(innerExpr, data);
            }

            result[targetKey] = value;
            continue;
        }
        let pathRef = globalPathRaw;
        if (globalPathRaw.includes("(") && globalPathRaw.includes(")")) {
            tableRef = globalPathRaw.split("(")[0];
        }
        if (pathRef.includes(",")) {
            pathRef = pathRef.split(",")[1];
        }
        value = getValueByPath(data, pathRef);

        if (tableRef) {
            if (Array.isArray(value)) {
                value = await Promise.all(
                    value.map(async (v) => {
                        const localId = await mappingStore.getLocalId(
                            v as string,
                        );

                        return localId ? `${tableRef}(${localId})` : null;
                    }),
                );
            } else {
                value = await mappingStore.getLocalId(value as string);
                value = value ? `${tableRef}(${value})` : null;
            }
        }

        result[localKey] = value;
    }

    return {
        data: result,
    };
}

function evaluateCalcExpression(
    expr: string,
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    context: Record<string, any>,
): number | undefined {
    const tokens = expr
        .split(/[^\w.]+/)
        .map((t) => t.trim())
        .filter(Boolean);

    let resolvedExpr = expr;
    for (const token of tokens) {
        const value = getValueByPath(context, token);
        if (typeof value !== "undefined") {
            resolvedExpr = resolvedExpr.replace(
                new RegExp(`\\b${token.replace(".", "\\.")}\\b`, "g"),
                value,
            );
        }
    }

    try {
        return Function(`use strict"; return (${resolvedExpr})`)();
    } catch {
        return undefined;
    }
}

export async function toGlobal({
    data,
    mapping,
    mappingStore,
}: IMappingConversionOptions): Promise<IMapperResponse> {
    const result: Record<string, unknown> = {};

    for (const [localKey, globalPathRaw] of Object.entries(
        mapping.localToUniversalMap,
    )) {
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        let value: any;
        let targetKey: string = globalPathRaw;

        if (globalPathRaw.includes(",")) {
            const [_, alias] = globalPathRaw.split(",");
            targetKey = alias;
        }

        if (localKey.includes("[]")) {
            const [arrayPath, innerPathRaw] = localKey.split("[]");
            const cleanInnerPath = innerPathRaw.startsWith(".")
                ? innerPathRaw.slice(1)
                : innerPathRaw;
            const array = getValueByPath(data, arrayPath);
            value = Array.isArray(array)
                ? array.map((item) => getValueByPath(item, cleanInnerPath))
                : undefined;
            result[targetKey] = value;
            continue;
        }

        const internalFnMatch = globalPathRaw.match(/^__(\w+)\((.+)\)$/);
        if (internalFnMatch) {
            const [, outerFn, innerExpr] = internalFnMatch;

            if (outerFn === "date") {
                const calcMatch = innerExpr.match(/^calc\((.+)\)$/);
                if (calcMatch) {
                    const calcResult = evaluateCalcExpression(
                        calcMatch[1],
                        data,
                    );
                    value =
                        calcResult !== undefined
                            ? new Date(calcResult).toISOString()
                            : undefined;
                } else {
                    const rawVal = getValueByPath(data, innerExpr);
                    if (typeof rawVal === "number") {
                        value = new Date(rawVal).toISOString();
                    } else if (rawVal?._seconds) {
                        // Handle Firebase v8 timestamp format
                        value = new Date(rawVal._seconds * 1000).toISOString();
                    } else if (rawVal?.seconds) {
                        // Handle Firebase v9+ timestamp format
                        value = new Date(rawVal.seconds * 1000).toISOString();
                    } else if (rawVal?.toDate && typeof rawVal.toDate === 'function') {
                        // Handle Firebase Timestamp objects
                        value = rawVal.toDate().toISOString();
                    } else if (rawVal instanceof Date) {
                        value = rawVal.toISOString();
                    } else if (typeof rawVal === 'string' && rawVal.includes('UTC')) {
                        // Handle Firebase timestamp strings like "August 18, 2025 at 10:03:19 AM UTC+5:30"
                        value = new Date(rawVal).toISOString();
                    } else {
                        value = undefined;
                    }
                }
            } else if (outerFn === "calc") {
                value = evaluateCalcExpression(innerExpr, data);
            }

            result[targetKey] = value;
            continue;
        }

        const relationMatch = globalPathRaw.match(/^(\w+)\((.+?)\)(\[\])?$/);
        if (relationMatch) {
            const [, tableRef, pathInData, isArray] = relationMatch;
            const refValue = getValueByPath(data, pathInData);
            if (isArray) {
                value = Array.isArray(refValue)
                    ? refValue.map((v) => `@${v}`)
                    : [];
            } else {
                value = refValue ? `@${refValue}` : undefined;
            }
            result[targetKey] = value;
            continue;
        }

        let pathRef: string = globalPathRaw.includes(",")
            ? globalPathRaw
            : localKey;
        let tableRef: string | null = null;
        if (globalPathRaw.includes("(") && globalPathRaw.includes(")")) {
            pathRef = globalPathRaw.split("(")[1].split(")")[0];
            tableRef = globalPathRaw.split("(")[0];
        }
        if (globalPathRaw.includes(",")) {
            pathRef = pathRef.split(",")[0];
        }
        value = getValueByPath(data, pathRef);
        if (tableRef) {
            if (Array.isArray(value)) {
                value = await Promise.all(
                    value.map(
                        async (v) =>
                            (await mappingStore.getGlobalId(v)) ?? undefined,
                    ),
                );
            } else {
                value = (await mappingStore.getGlobalId(value)) ?? undefined;
            }
        }
        result[targetKey] = value;
    }
    const ownerEvault = await extractOwnerEvault(data, mapping.ownerEnamePath);

    return {
        ownerEvault,
        data: result,
    };
}
