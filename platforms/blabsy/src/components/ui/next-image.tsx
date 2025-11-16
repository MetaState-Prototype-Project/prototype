import { useState } from 'react';
import Image from 'next/image';
import cn from 'clsx';
import type { ReactNode } from 'react';
import type { ImageProps } from 'next/image';

type NextImageProps = {
    alt: string;
    width?: string | number;
    children?: ReactNode;
    useSkeleton?: boolean;
    imgClassName?: string;
    previewCount?: number;
    blurClassName?: string;
} & ImageProps;

/**
 *
 * @description Must set width and height, if not add layout='fill'
 * @param useSkeleton add background with pulse animation, don't use it if image is transparent
 */
export function NextImage({
    src,
    alt,
    width,
    height,
    children,
    className,
    useSkeleton,
    imgClassName,
    previewCount,
    blurClassName,
    ...rest
}: NextImageProps): JSX.Element {
    const [loading, setLoading] = useState(!!useSkeleton);

    const handleLoad = (): void => setLoading(false);

    // Check if the image source is a base64 data URI
    const isBase64 = typeof src === 'string' && src.startsWith('data:');

    // For base64 images, use a regular img tag to avoid Next.js optimization issues
    if (isBase64) {
        return (
            <figure style={{ width }} className={className}>
                <img
                    className={cn(
                        imgClassName,
                        loading
                            ? blurClassName ??
                                  'animate-pulse bg-light-secondary dark:bg-dark-secondary'
                            : previewCount === 1
                            ? '!h-auto !min-h-0 !w-auto !min-w-0 rounded-lg object-contain'
                            : 'object-cover',
                        'w-full h-full'
                    )}
                    src={src}
                    alt={alt}
                    onLoad={handleLoad}
                />
                {children}
            </figure>
        );
    }

    return (
        <figure style={{ width }} className={className}>
            <Image
                className={cn(
                    imgClassName,
                    loading
                        ? blurClassName ??
                              'animate-pulse bg-light-secondary dark:bg-dark-secondary'
                        : previewCount === 1
                        ? '!h-auto !min-h-0 !w-auto !min-w-0 rounded-lg object-contain'
                        : 'object-cover'
                )}
                src={src}
                width={width}
                height={height}
                alt={alt}
                onLoadingComplete={handleLoad}
                layout='responsive'
                {...rest}
            />
            {children}
        </figure>
    );
}
