export const formatSize = (bytes: number): string => {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

export interface FileValidationResult {
	valid: boolean;
	error?: string;
}

export const validateFileSize = (
	file: File,
	maxFileSize: number,
	currentTotal?: number,
	maxTotalSize?: number
): FileValidationResult => {
	// Validate individual file size
	if (file.size > maxFileSize) {
		return {
			valid: false,
			error: `Image must be smaller than ${formatSize(maxFileSize)}`
		};
	}

	// Validate total size if applicable
	if (currentTotal !== undefined && maxTotalSize !== undefined) {
		if (currentTotal + file.size > maxTotalSize) {
			return {
				valid: false,
				error: `Adding this image would exceed the total limit of ${formatSize(maxTotalSize)}`
			};
		}
	}

	return { valid: true };
};
