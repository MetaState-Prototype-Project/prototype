import ipaddr from "ipaddr.js";

type Address = ipaddr.IPv4 | ipaddr.IPv6;

// Block and exempt rules broader than this are refused: one typo should not
// cut off, or wave through, a large share of the internet.
const MIN_PREFIX = { ipv4: 8, ipv6: 32 } as const;

function parseAddress(raw: string): Address | null {
    try {
        // process() unwraps IPv4-mapped IPv6 (::ffff:1.2.3.4), which is how a
        // dual-stack socket reports an IPv4 client.
        return ipaddr.process(raw.trim());
    } catch {
        return null;
    }
}

/**
 * The form of a client address used as its counter key and matched against
 * rules. An address that cannot be parsed is returned unchanged.
 */
export function normalizeIp(raw: string): string {
    return parseAddress(raw)?.toString() ?? raw;
}

/**
 * The canonical CIDR for an admin-entered IP or range: a bare address becomes
 * a single-address range and host bits are zeroed. Throws on invalid input.
 */
export function canonicalizeSubject(input: string): string {
    const value = input.trim();
    // The parser also takes shorthand such as "10" (0.0.0.10) or "1.2.3";
    // an admin typing that almost certainly meant something else.
    const host = value.split("/")[0];
    if (!host.includes(":") && !ipaddr.IPv4.isValidFourPartDecimal(host)) {
        throw new Error("Not a valid IP address or CIDR range");
    }
    let address: Address;
    let prefix: number;
    if (value.includes("/")) {
        try {
            [address, prefix] = ipaddr.parseCIDR(value);
        } catch {
            throw new Error("Not a valid IP address or CIDR range");
        }
        if (
            address.kind() === "ipv6" &&
            (address as ipaddr.IPv6).isIPv4MappedAddress() &&
            prefix >= 96
        ) {
            address = (address as ipaddr.IPv6).toIPv4Address();
            prefix -= 96;
        }
    } else {
        const parsed = parseAddress(value);
        if (!parsed) throw new Error("Not a valid IP address or CIDR range");
        address = parsed;
        prefix = parsed.kind() === "ipv4" ? 32 : 128;
    }

    const cidr = `${address.toString()}/${prefix}`;
    const network =
        address.kind() === "ipv4"
            ? ipaddr.IPv4.networkAddressFromCIDR(cidr)
            : ipaddr.IPv6.networkAddressFromCIDR(cidr);
    return `${network.toString()}/${prefix}`;
}

/** Whether a canonical CIDR covers more than a block or exempt rule may. */
export function isTooBroad(subject: string): boolean {
    const [address, prefix] = ipaddr.parseCIDR(subject);
    return prefix < MIN_PREFIX[address.kind() as "ipv4" | "ipv6"];
}

/** How many addresses a canonical CIDR covers, as a power of two exponent. */
export function hostBits(subject: string): number {
    const [address, prefix] = ipaddr.parseCIDR(subject);
    return (address.kind() === "ipv4" ? 32 : 128) - prefix;
}

export type IpRuleMatcher<T> = (ip: string) => T | null;

/**
 * Builds a matcher returning the most specific rule covering an address.
 * Rules whose subject is not a valid CIDR are skipped.
 */
export function compileIpRules<T extends { subject: string }>(
    rules: T[],
): IpRuleMatcher<T> {
    const compiled: { range: [Address, number]; rule: T }[] = [];
    for (const rule of rules) {
        try {
            compiled.push({ range: ipaddr.parseCIDR(rule.subject), rule });
        } catch {
            console.warn(
                `[rate-limit] ignoring rule with invalid range "${rule.subject}"`,
            );
        }
    }
    compiled.sort((a, b) => b.range[1] - a.range[1]);

    return (ip) => {
        const address = parseAddress(ip);
        if (!address) return null;
        for (const { range, rule } of compiled) {
            if (address.kind() !== range[0].kind()) continue;
            if (address.match(range)) return rule;
        }
        return null;
    };
}
