import { createContext, useContext, useEffect, useState } from 'react';

type WindowSize = {
    width: number;
    height: number;
};

type WindowContext = {
    windowSize: WindowSize;
    isMobile: boolean;
};

const WindowContext = createContext<WindowContext | null>(null);

type WindowContextProviderProps = {
    children: React.ReactNode;
};

export function WindowContextProvider({
    children
}: WindowContextProviderProps): JSX.Element {
    const [windowSize, setWindowSize] = useState<WindowSize>({
        width: 0,
        height: 0
    });

    useEffect(() => {
        const handleResize = (): void => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };

        // Set initial size
        handleResize();

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowSize.width < 768;

    return (
        <WindowContext.Provider value={{ windowSize, isMobile }}>
            {children}
        </WindowContext.Provider>
    );
}

export function useWindow(): WindowContext {
    const context = useContext(WindowContext);

    if (!context)
        throw new Error(
            'useWindow must be used within a WindowContextProvider'
        );

    return context;
}
