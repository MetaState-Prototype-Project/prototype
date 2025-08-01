"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getValueByPath = getValueByPath;
exports.fromGlobal = fromGlobal;
exports.toGlobal = toGlobal;
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
function getValueByPath(obj, path) {
    // Handle array mapping case (e.g., "images[].src")
    if (path.includes("[]")) {
        const [arrayPath, fieldPath] = path.split("[]");
        const array = getValueByPath(obj, arrayPath);
        if (!Array.isArray(array)) {
            return [];
        }
        // If there's a field path after [], map through the array
        if (fieldPath) {
            return array.map((item) => getValueByPath(item, fieldPath.slice(1))); // Remove the leading dot
        }
        return array;
    }
    // Handle regular path case
    const parts = path.split(".");
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    return parts.reduce((acc, part) => {
        if (acc === null || acc === undefined)
            return undefined;
        return acc[part];
    }, obj);
}
async function extractOwnerEvault(data, ownerEnamePath) {
    if (!ownerEnamePath || ownerEnamePath === "null") {
        return null;
    }
    if (!ownerEnamePath.includes("(")) {
        return data[ownerEnamePath] || null;
    }
    const [_, fieldPathRaw] = ownerEnamePath.split("(");
    const fieldPath = fieldPathRaw.replace(")", "");
    let value = getValueByPath(data, fieldPath);
    if (Array.isArray(value))
        return value[0];
    console.log("OWNER PATH", value);
    if (value.includes("(") && value.includes(")")) {
        value = value.split("(")[1].split(")")[0];
    }
    return value || null;
}
async function fromGlobal({ data, mapping, mappingStore, }) {
    const result = {};
    for (const [localKey, globalPathRaw] of Object.entries(mapping.localToUniversalMap)) {
        let value;
        const targetKey = localKey;
        let tableRef = null;
        const internalFnMatch = globalPathRaw.match(/^__(\w+)\((.+)\)$/);
        if (internalFnMatch) {
            const [, outerFn, innerExpr] = internalFnMatch;
            if (outerFn === "date") {
                const calcMatch = innerExpr.match(/^calc\((.+)\)$/);
                if (calcMatch) {
                    const calcResult = evaluateCalcExpression(calcMatch[1], data);
                    value =
                        calcResult !== undefined
                            ? new Date(calcResult).toISOString()
                            : undefined;
                }
                else {
                    const rawVal = getValueByPath(data, innerExpr);
                    if (typeof rawVal === "number") {
                        value = new Date(rawVal).toISOString();
                    }
                    else if (rawVal?._seconds) {
                        value = new Date(rawVal._seconds * 1000).toISOString();
                    }
                    else if (rawVal instanceof Date) {
                        value = rawVal.toISOString();
                    }
                    else {
                        value = undefined;
                    }
                }
            }
            else if (outerFn === "calc") {
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
                value = await Promise.all(value.map(async (v) => {
                    const localId = await mappingStore.getLocalId(v);
                    return localId ? `${tableRef}(${localId})` : null;
                }));
            }
            else {
                value = await mappingStore.getLocalId(value);
                value = value ? `${tableRef}(${value})` : null;
            }
        }
        result[localKey] = value;
    }
    return {
        data: result,
    };
}
function evaluateCalcExpression(expr, 
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
context) {
    const tokens = expr
        .split(/[^\w.]+/)
        .map((t) => t.trim())
        .filter(Boolean);
    let resolvedExpr = expr;
    for (const token of tokens) {
        const value = getValueByPath(context, token);
        if (typeof value !== "undefined") {
            resolvedExpr = resolvedExpr.replace(new RegExp(`\\b${token.replace(".", "\\.")}\\b`, "g"), value);
        }
    }
    try {
        return Function(`use strict"; return (${resolvedExpr})`)();
    }
    catch {
        return undefined;
    }
}
async function toGlobal({ data, mapping, mappingStore, }) {
    const result = {};
    for (const [localKey, globalPathRaw] of Object.entries(mapping.localToUniversalMap)) {
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        let value;
        let targetKey = globalPathRaw;
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
                    const calcResult = evaluateCalcExpression(calcMatch[1], data);
                    value =
                        calcResult !== undefined
                            ? new Date(calcResult).toISOString()
                            : undefined;
                }
                else {
                    const rawVal = getValueByPath(data, innerExpr);
                    if (typeof rawVal === "number") {
                        value = new Date(rawVal).toISOString();
                    }
                    else if (rawVal?._seconds) {
                        value = new Date(rawVal._seconds * 1000).toISOString();
                    }
                    else if (rawVal instanceof Date) {
                        value = rawVal.toISOString();
                    }
                    else {
                        value = undefined;
                    }
                }
            }
            else if (outerFn === "calc") {
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
            }
            else {
                value = refValue ? `@${refValue}` : undefined;
            }
            result[targetKey] = value;
            continue;
        }
        let pathRef = globalPathRaw.includes(",")
            ? globalPathRaw
            : localKey;
        let tableRef = null;
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
                value = await Promise.all(value.map(async (v) => (await mappingStore.getGlobalId(v)) ?? undefined));
            }
            else {
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
//# sourceMappingURL=mapper.js.map