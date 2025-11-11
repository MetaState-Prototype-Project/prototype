import Link from 'next/link';
import type { ComponentProps } from 'react';

type MenuLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
    href: string;
};

export function MenuLink({ href, children, ...rest }: MenuLinkProps): JSX.Element {
    return (
        <Link href={href} {...rest}>
            {children}
        </Link>
    );
}
