import cn from 'clsx';
import React, { FC } from 'react';
import { CustomIcon } from './custom-icon';

type LoadingProps = {
    className?: string;
    iconClassName?: string;
};

export const Loading: FC<LoadingProps> = ({
    className,
    iconClassName
}) => {
    return (
        <i className={cn('flex justify-center', className ?? 'p-4')}>
            <CustomIcon
                className={cn('text-main-accent', iconClassName ?? 'h-7 w-7')}
                iconName='SpinnerIcon'
            />
        </i>
    );
};
