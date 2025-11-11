import Link from 'next/link';
import cn from 'clsx';
import { NextImage } from '@components/ui/next-image';

type UserAvatarProps = {
    src: string;
    alt: string;
    size?: number;
    username?: string;
    className?: string;
};

export function UserAvatar({
    src,
    alt,
    size,
    username,
    className
}: UserAvatarProps): JSX.Element {
    const pictureSize = size ?? 48;

    const image = (
        <NextImage
            useSkeleton
            imgClassName='rounded-full'
            width={pictureSize}
            height={pictureSize}
            src={src}
            alt={alt}
            key={src}
        />
    );

    if (!username) {
        return (
            <div
                className={cn(
                    'blur-picture flex self-start pointer-events-none',
                    className
                )}
            >
                {image}
            </div>
        );
    }

    return (
        <Link
            href={`/user/${username}`}
            className={cn(
                'blur-picture flex self-start',
                className
            )}
            tabIndex={0}
        >
            {image}
        </Link>
    );
}
