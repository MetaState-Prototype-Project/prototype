/**
 * Drop-in replacement for `$lib/paraglide/messages`. Components import `m`
 * from here and call it exactly as before; corrections fetched at runtime are
 * layered over the compiled strings.
 */

import { m as compiled } from "$lib/paraglide/messages";
import { getLocale } from "$lib/paraglide/runtime";
import { lookup } from "./overrides.svelte";
import { createMessages } from "./wrap";

export { refreshOverrides } from "./overrides.svelte";

export const m = createMessages(compiled, getLocale, lookup);
