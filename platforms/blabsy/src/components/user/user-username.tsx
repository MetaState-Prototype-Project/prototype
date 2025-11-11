import Link from 'next/link';
import cn from 'clsx';

type UserUsernameProps = {
    username?: string | null;
    className?: string;
    disableLink?: boolean;
};

export function UserUsername({
    username,
    className,
    disableLink
}: UserUsernameProps): JSX.Element {
    if (!username) {
        return (
            <span
                className={cn(
                    'truncate text-light-secondary dark:text-dark-secondary max-w-[100px]',
                    className,
                    'pointer-events-none'
                )}
            >
                @user
            </span>
        );
    }

    return (
        <Link
            href={`/user/${username}`}
            className={cn(
                'truncate text-light-secondary dark:text-dark-secondary max-w-[100px]',
                className,
                disableLink && 'pointer-events-none'
            )}
            tabIndex={-1}
        >
            @{username}
        </Link>
    );
}
