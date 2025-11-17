/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect, createContext, useContext } from 'react';
import { updateUserTheme } from '@lib/firebase/utils';
import { useAuth } from './auth-context';
import type { ReactNode, ChangeEvent } from 'react';
import type { Theme, Accent } from '@lib/types/theme';

type ThemeContext = {
    theme: Theme;
    accent: Accent;
    changeTheme: ({ target: { value } }: ChangeEvent<HTMLInputElement>) => void;
    changeAccent: ({
        target: { value }
    }: ChangeEvent<HTMLInputElement>) => void;
};

export const ThemeContext = createContext<ThemeContext | null>(null);

type ThemeContextProviderProps = {
    children: ReactNode;
};

function setInitialTheme(): Theme {
    // Always return dark theme - no light mode option
    return 'dark';
}

function setInitialAccent(): Accent {
    if (typeof window === 'undefined') return 'blue';

    const savedAccent = localStorage.getItem('accent') as Accent | null;

    return savedAccent ?? 'blue';
}

export function ThemeContextProvider({
    children
}: ThemeContextProviderProps): JSX.Element {
    const [theme, setTheme] = useState<Theme>(setInitialTheme);
    const [accent, setAccent] = useState<Accent>(setInitialAccent);

    const { user } = useAuth();
    const { id: userId, theme: userTheme, accent: userAccent } = user ?? {};

    useEffect(() => {
        // Always force dark theme, ignore user theme preference
        setTheme('dark');
    }, [userId, userTheme]);

    useEffect(() => {
        if (user && userAccent) setAccent(userAccent);
    }, [userId, userAccent]);

    useEffect(() => {
        const flipTheme = (): NodeJS.Timeout | undefined => {
            const root = document.documentElement;
            // Always use dark theme
            const forcedTheme: Theme = 'dark';
            
            // Always ensure dark class is present and never remove it
            root.classList.add('dark');
            // Prevent any accidental removal
            if (!root.classList.contains('dark')) {
                root.classList.add('dark');
            }

            root.style.setProperty(
                '--main-background',
                `var(--${forcedTheme}-background)`
            );

            root.style.setProperty(
                '--main-search-background',
                `var(--${forcedTheme}-search-background)`
            );

            root.style.setProperty(
                '--main-sidebar-background',
                `var(--${forcedTheme}-sidebar-background)`
            );

            if (user) {
                localStorage.setItem('theme', forcedTheme);
                return setTimeout(
                    () => void updateUserTheme(user.id, { theme: forcedTheme }),
                    500
                );
            }

            return undefined;
        };

        const timeoutId = flipTheme();
        // Ensure dark class is always applied on mount and updates
        const root = document.documentElement;
        root.classList.add('dark');
        
        return () => clearTimeout(timeoutId);
    }, [userId]);

    useEffect(() => {
        const flipAccent = (accent: Accent): NodeJS.Timeout | undefined => {
            const root = document.documentElement;

            root.style.setProperty('--main-accent', `var(--accent-${accent})`);

            if (user) {
                localStorage.setItem('accent', accent);
                return setTimeout(
                    () => void updateUserTheme(user.id, { accent }),
                    500
                );
            }

            return undefined;
        };

        const timeoutId = flipAccent(accent);
        return () => clearTimeout(timeoutId);
    }, [userId, accent]);

    const changeTheme = ({
        target: { value }
    }: ChangeEvent<HTMLInputElement>): void => {
        // Ignore theme changes - always keep dark mode
        setTheme('dark');
    };

    const changeAccent = ({
        target: { value }
    }: ChangeEvent<HTMLInputElement>): void => setAccent(value as Accent);

    const value: ThemeContext = {
        theme,
        accent,
        changeTheme,
        changeAccent
    };

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContext {
    const context = useContext(ThemeContext);

    if (!context)
        throw new Error('useTheme must be used within an ThemeContextProvider');

    return context;
}
