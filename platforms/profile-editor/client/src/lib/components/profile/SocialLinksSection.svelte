<script lang="ts">
    import { updateSocialLinks, type SocialLink } from "$lib/stores/profile";
    import { toast } from "svelte-sonner";
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
    } from "@metastate-foundation/ui/card";
    import { Button } from "@metastate-foundation/ui/button";
    import { Input } from "@metastate-foundation/ui/input";
    import { Label } from "@metastate-foundation/ui/label";
    import {
        Select,
        SelectTrigger,
        SelectContent,
        SelectItem,
    } from "@metastate-foundation/ui/select";
    import { Separator } from "@metastate-foundation/ui/separator";

    let {
        links = [],
        editable = false,
    }: { links?: SocialLink[]; editable?: boolean } = $props();

    let showForm = $state(false);
    let form = $state<SocialLink>({ platform: "linkedin", url: "", label: "" });

    const platforms = ["linkedin", "github", "twitter", "website", "other"];
    const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

    function normalizeAndValidateUrl(raw: string): string | null {
        let value = raw.trim();
        if (!value) return null;
        if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
            value = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
                ? `mailto:${value}`
                : `https://${value}`;
        }
        try {
            const parsed = new URL(value);
            if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
            return parsed.href;
        } catch {
            return null;
        }
    }

    async function addLink() {
        const normalized = normalizeAndValidateUrl(form.url);
        if (!normalized) {
            toast.error("Please enter a valid URL (http, https, or mailto)");
            return;
        }
        try {
            await updateSocialLinks([...links, { ...form, url: normalized }]);
            showForm = false;
            form = { platform: "linkedin", url: "", label: "" };
            toast.success("Social link added");
        } catch {
            toast.error("Failed to add social link");
        }
    }

    async function removeLink(index: number) {
        try {
            await updateSocialLinks(links.filter((_, i) => i !== index));
            toast.success("Social link removed");
        } catch {
            toast.error("Failed to remove social link");
        }
    }
</script>

<Card>
    <CardHeader>
        <div class="flex items-center justify-between">
            <CardTitle>Social Links</CardTitle>
            {#if editable}
                <Button
                    variant="ghost"
                    size="sm"
                    onclick={() => {
                        showForm = true;
                    }}>+ Add</Button
                >
            {/if}
        </div>
    </CardHeader>

    <CardContent>
        {#if showForm}
            <Card class="mb-4 bg-muted/30">
                <CardContent class="grid gap-3 pt-6">
                    <div class="space-y-1">
                        <Label>Platform</Label>
                        <select
                            bind:value={form.platform}
                            class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                            {#each platforms as p}
                                <option value={p}
                                    >{p.charAt(0).toUpperCase() +
                                        p.slice(1)}</option
                                >
                            {/each}
                        </select>
                    </div>
                    <div class="space-y-1">
                        <Label>URL</Label>
                        <Input
                            bind:value={form.url}
                            placeholder="https://..."
                        />
                    </div>
                    <div class="space-y-1">
                        <Label>Label (optional)</Label>
                        <Input
                            bind:value={form.label}
                            placeholder="Display label"
                        />
                    </div>
                    <div class="flex gap-2">
                        <Button size="sm" onclick={addLink}>Add</Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={() => {
                                showForm = false;
                            }}>Cancel</Button
                        >
                    </div>
                </CardContent>
            </Card>
        {/if}

        <div class="space-y-2">
            {#each links as link, i}
                {#if i > 0}
                    <Separator />
                {/if}
                {@const safeUrl = normalizeAndValidateUrl(link.url)}
                <div class="flex items-center justify-between py-1">
                    {#if safeUrl}
                        <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                        >
                            <span class="font-medium capitalize"
                                >{link.platform}</span
                            >
                            {#if link.label}
                                <span class="text-muted-foreground/60"
                                    >· {link.label}</span
                                >
                            {/if}
                        </a>
                    {:else}
                        <span
                            class="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                            <span class="font-medium capitalize"
                                >{link.platform}</span
                            >
                            {#if link.label}
                                <span class="text-muted-foreground/60"
                                    >· {link.label}</span
                                >
                            {/if}
                        </span>
                    {/if}
                    {#if editable}
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onclick={() => removeLink(i)}
                        >
                            <svg
                                class="h-4 w-4 text-destructive"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                ><path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M6 18L18 6M6 6l12 12"
                                /></svg
                            >
                        </Button>
                    {/if}
                </div>
            {:else}
                {#if !showForm}
                    <p class="text-sm italic text-muted-foreground/50">
                        {editable ? "Add your social links" : "No social links"}
                    </p>
                {/if}
            {/each}
        </div>
    </CardContent>
</Card>
