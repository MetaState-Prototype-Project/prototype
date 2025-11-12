import cn from 'clsx';
import Link from 'next/link';
import { HeroIcon } from '@components/ui/hero-icon';

type UserNameProps = {
    tag?: keyof JSX.IntrinsicElements;
    name: string;
    verified: boolean;
    username?: string;
    className?: string;
    iconClassName?: string;
};

export function UserName({
    tag,
    name,
    verified,
    username,
    className,
    iconClassName
}: UserNameProps): JSX.Element {
    const CustomTag = tag ? tag : 'p';

    const content = (
        <>
            <CustomTag className='truncate max-w-[120px]'>{name}</CustomTag>
            {verified && (
                <i>
                    <HeroIcon
                        className={cn(
                            'fill-accent-blue',
                            iconClassName ?? 'h-5 w-5'
                        )}
                        iconName='CheckBadgeIcon'
                        solid
                    />
                </i>
            )}
        </>
    );

    if (!username) {
        return (
            <div
                className={cn(
                    'flex items-center gap-1 truncate font-bold pointer-events-none',
                    className
                )}
            >
                {content}
            </div>
        );
    }

    return (
        <Link
            href={`/user/${username}`}
            className={cn(
                'flex items-center gap-1 truncate font-bold custom-underline',
                className
            )}
            tabIndex={0}
        >
            {content}
        </Link>
    );
}
