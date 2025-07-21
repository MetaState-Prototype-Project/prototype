export function useAuth() {
    const { data: user, isLoading } = { data: null, isLoading: false }; // TODO: Replace with api call to get the currently authenticated user

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
    };
}
