import type { Image } from "$lib/types";

export const revokeImageUrls = (imageArray: Image[]) => {
    imageArray?.forEach((img) => URL.revokeObjectURL(img.url));
};
