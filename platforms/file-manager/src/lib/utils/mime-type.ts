/**
 * Returns a short, user-friendly label for a MIME type (e.g. DOCX, XLSX, PDF)
 * instead of long strings like application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 */
export function getMimeTypeDisplayLabel(mimeType: string): string {
    if (!mimeType || typeof mimeType !== "string") return mimeType ?? "";
    const m = mimeType.toLowerCase();
    // Office / common document types
    if (m.includes("spreadsheetml.sheet") || m.includes("ms-excel"))
        return "XLSX";
    if (m.includes("wordprocessingml.document") || m.includes("msword"))
        return "DOCX";
    if (m.includes("presentationml") || m.includes("ms-powerpoint"))
        return "PPTX";
    if (m === "application/pdf") return "PDF";
    // Generic fallback: last meaningful part (e.g. "sheet", "pdf")
    const parts = m.split(/[/+]/);
    const last = parts[parts.length - 1];
    if (last && last !== "application" && last.length <= 20)
        return last.toUpperCase();
    return mimeType;
}
