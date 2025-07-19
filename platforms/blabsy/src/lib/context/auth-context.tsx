import { useState, useEffect, useContext, createContext, useMemo } from 'react';
import {
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut as signOutFirebase,
    signInWithCustomToken as signInWithCustomTokenFirebase
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth } from '@lib/firebase/app';
import {
    usersCollection,
    userBookmarksCollection
} from '@lib/firebase/collections';
import { getRandomId } from '@lib/random';
import type { ReactNode } from 'react';
import type { User as AuthUser } from 'firebase/auth';
import type { User } from '@lib/types/user';
import type { Bookmark } from '@lib/types/bookmark';

type AuthContext = {
    user: User | null;
    error: Error | null;
    loading: boolean;
    isAdmin: boolean;
    randomSeed: string;
    userBookmarks: Bookmark[] | null;
    signOut: () => Promise<void>;
    signInWithGoogle: () => Promise<void>;
    signInWithCustomToken: (token: string) => Promise<void>;
};

export const AuthContext = createContext<AuthContext | null>(null);

type AuthContextProviderProps = {
    children: ReactNode;
};

export function AuthContextProvider({
    children
}: AuthContextProviderProps): JSX.Element {
    const [user, setUser] = useState<User | null>(null);
    const [userBookmarks, setUserBookmarks] = useState<Bookmark[] | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const manageUser = async (authUser: AuthUser): Promise<void> => {
            const { uid, displayName, photoURL } = authUser;
            console.log(uid);

            const userSnapshot = await getDoc(doc(usersCollection, uid));

            if (!userSnapshot.exists()) {
                // User doesn't exist in database - don't create automatically
                console.error(
                    `User ${uid} not found in database. User must be pre-registered.`
                );
                setError(
                    new Error(
                        'User not found in database. Please contact support to register your account.'
                    )
                );
                setLoading(false);
                // Sign out the user since they shouldn't be authenticated
                await signOutFirebase(auth);
                return;
            } else {
                const userData = userSnapshot.data();
                setUser(userData);
            }

            setLoading(false);
        };

        const handleUserAuth = (authUser: AuthUser | null): void => {
            setLoading(true);

            if (authUser) void manageUser(authUser);
            else {
                setUser(null);
                setLoading(false);
            }
        };

        onAuthStateChanged(auth, handleUserAuth);
    }, []);

    useEffect(() => {
        if (!user) return;

        const { id } = user;

        const unsubscribeUser = onSnapshot(doc(usersCollection, id), (doc) => {
            setUser(doc.data() as User);
        });

        const unsubscribeBookmarks = onSnapshot(
            userBookmarksCollection(id),
            (snapshot) => {
                const bookmarks = snapshot.docs.map((doc) => doc.data());
                setUserBookmarks(bookmarks);
            }
        );

        return () => {
            unsubscribeUser();
            unsubscribeBookmarks();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const signInWithGoogle = async (): Promise<void> => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            setError(error as Error);
        }
    };

    const signInWithCustomToken = async (token: string): Promise<void> => {
        try {
            await signInWithCustomTokenFirebase(auth, token);
        } catch (error) {
            setError(error as Error);
        }
    };

    const signOut = async (): Promise<void> => {
        try {
            await signOutFirebase(auth);
        } catch (error) {
            setError(error as Error);
        }
    };

    const isAdmin = user ? user.username === 'ccrsxx' : false;
    const randomSeed = useMemo(getRandomId, [user?.id]);

    const value: AuthContext = {
        user,
        error,
        loading,
        isAdmin,
        randomSeed,
        userBookmarks,
        signOut,
        signInWithGoogle,
        signInWithCustomToken
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth(): AuthContext {
    const context = useContext(AuthContext);

    if (!context)
        throw new Error('useAuth must be used within an AuthContextProvider');

    return context;
}
