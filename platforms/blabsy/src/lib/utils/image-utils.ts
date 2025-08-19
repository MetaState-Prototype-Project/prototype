/**
 * Combines accidentally separated base64 image URLs
 * This handles cases where base64 data URLs get split at the comma
 * and need to be recombined to form valid image sources
 */
export function combineBase64Images(images: Array<{ src: string; alt: string; type?: string; id: string }>): Array<{ src: string; alt: string; type?: string; id: string }> {
    if (!images || images.length === 0) {
        return images;
    }

    const result: Array<{ src: string; alt: string; type?: string; id: string }> = [];
    
    console.log('Processing images for base64 combining:', images.length);
    
    for (let i = 0; i < images.length; i += 2) {
        const dataPart = images[i];
        const chunkPart = images[i + 1];

        if (dataPart && chunkPart) {
            // Check if this looks like a base64 data URL that got split
            if (dataPart.src.startsWith('data:') && !chunkPart.src.startsWith('data:')) {
                // Combine the base64 parts
                const combinedSrc = `${dataPart.src},${chunkPart.src}`;
                console.log(`Combined base64 image at index ${i}:`, {
                    original: dataPart.src.substring(0, 50) + '...',
                    chunk: chunkPart.src.substring(0, 50) + '...',
                    combined: combinedSrc.substring(0, 50) + '...'
                });
                
                result.push({
                    ...dataPart,
                    src: combinedSrc
                });
            } else {
                // Not a base64 split, add both parts separately
                result.push(dataPart);
                result.push(chunkPart);
            }
        } else {
            // Handle odd number of images (last item)
            if (dataPart) {
                if (dataPart.src.startsWith('data:')) {
                    console.warn(`Incomplete base64 image at index ${i}, skipping`);
                } else {
                    result.push(dataPart);
                }
            }
        }
    }
    
    console.log(`Processed ${images.length} images into ${result.length} valid images`);
    return result;
}

/**
 * Alternative implementation that processes the entire array
 * and looks for patterns of split base64 URLs
 */
export function combineBase64ImagesAlternative(images: Array<{ src: string; alt: string; type?: string; id: string }>): Array<{ src: string; alt: string; type?: string; id: string }> {
    if (!images || images.length === 0) {
        return images;
    }

    const result: Array<{ src: string; alt: string; type?: string; id: string }> = [];
    let i = 0;
    
    while (i < images.length) {
        const current = images[i];
        
        // Check if current image starts with data: but doesn't contain a comma
        if (current.src.startsWith('data:') && !current.src.includes(',')) {
            // Look for the next image that might be the continuation
            if (i + 1 < images.length) {
                const next = images[i + 1];
                
                // If next doesn't start with data:, it's likely the continuation
                if (!next.src.startsWith('data:')) {
                    const combinedSrc = `${current.src},${next.src}`;
                    console.log(`Combined base64 image:`, {
                        index: i,
                        original: current.src.substring(0, 50) + '...',
                        chunk: next.src.substring(0, 50) + '...',
                        combined: combinedSrc.substring(0, 50) + '...'
                    });
                    
                    result.push({
                        ...current,
                        src: combinedSrc
                    });
                    
                    // Skip the next image since we combined it
                    i += 2;
                    continue;
                }
            }
        }
        
        // Add current image as-is
        result.push(current);
        i++;
    }
    
    return result;
} 