// Drop-in replacement for `$lib/paraglide/messages`, with the corrections
// fetched at runtime layered over the compiled strings.
import { m as compiled } from "$lib/paraglide/messages";
import { getLocale } from "$lib/paraglide/runtime";
import { lookup } from "./overrides.svelte";
import { createMessages } from "./wrap";

export { refreshOverrides } from "./overrides.svelte";

export const m = createMessages(compiled, getLocale, lookup);
