export const runtime = $state<{
    header: {
        title: string | undefined;
        backEnabled: boolean | undefined;
    }
}>({
    header: {
        title: undefined,
        backEnabled: undefined
    }
})