export function useAuth() {
    const {
        data: user,
        isLoading,
        error,
    } = {
        data: null,
        isLoading: false,
        error: null,
    }; // TODO: replace with actual data fetching logic

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        error,
    };
}
