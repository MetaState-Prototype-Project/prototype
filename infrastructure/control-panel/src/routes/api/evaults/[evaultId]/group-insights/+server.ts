import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_CONTROL_PANEL_URL } from '$env/static/public';
import { registryService, type RegistryVault } from '$lib/services/registry';
import {
	evaultGraphqlPost,
	fetchGroupManifestOrFallbackParsed,
	fetchRegistryEvaultRows,
	MESSAGE_ONTOLOGY_ID,
	requestPlatformToken,
	type RegistryEvaultRow
} from '$lib/server/evault-graphql';
import {
	buildRegistryEnameLookup,
	NO_SENDER_BUCKET,
	previewMessageBody,
	rawMessageSenderId,
	resolveMessageSenderEname,
	senderBucketKey
} from '$lib/server/group-message-buckets';
import {
	buildDashboardNameByKey,
	displayHintFromMessage,
	recordDisplayHint,
	resolveSenderRowFields,
	userRegistryRowsForProbe
} from '$lib/server/group-sender-resolve.server';

/**
 * Sender display resolution lives in `$lib/server/group-sender-resolve.server.ts` (probe user vaults, dashboard names).
 */

const MESSAGES_PAGE_QUERY = `
	query GroupMessages($filter: MetaEnvelopeFilterInput, $first: Int, $after: String) {
		metaEnvelopes(filter: $filter, first: $first, after: $after) {
			totalCount
			pageInfo {
				hasNextPage
				endCursor
			}
			edges {
				node {
					parsed
				}
			}
		}
	}
`;

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

type MessageConnection = {
	totalCount?: number;
	pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
	edges?: Array<{ node?: { parsed?: Record<string, unknown> } }>;
};

function readMessageConnection(payload: Record<string, unknown> | null): MessageConnection | null {
	if (!payload) {
		return null;
	}
	const data = payload.data as Record<string, unknown> | undefined;
	const conn = data?.metaEnvelopes as MessageConnection | undefined;
	return conn ?? null;
}

type SenderRow = {
	displayName: string;
	ename: string;
	messageCount: number;
	bucketKey: string;
	evaultPageId: string | null;
};

async function mapInChunks<T, R>(items: T[], chunkSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = [];
	for (let i = 0; i < items.length; i += chunkSize) {
		const chunk = items.slice(i, i + chunkSize);
		out.push(...(await Promise.all(chunk.map(fn))));
	}
	return out;
}

async function buildSenderRows(
	byBucket: Record<string, number>,
	registryEnameLookup: Map<string, string>,
	allVaults: RegistryVault[],
	token: string | undefined,
	dashboardNameByKey: Map<string, string>,
	hintByBucket: Map<string, Map<string, number>>,
	userRowsForProbe: RegistryEvaultRow[],
	probeRequestCache: Map<string, string | null>
): Promise<SenderRow[]> {
	const entries = Object.entries(byBucket).filter(([k]) => k !== NO_SENDER_BUCKET);
	const rows = await mapInChunks(entries, 8, async ([bucketKey, messageCount]) => {
		const { displayName, ename, evaultPageId } = await resolveSenderRowFields({
			bucketKey,
			allVaults,
			registryEnameLookup,
			token,
			dashboardNameByKey,
			hintByBucket,
			userRowsForProbe,
			probeRequestCache
		});
		return {
			displayName,
			ename,
			messageCount,
			bucketKey,
			evaultPageId
		};
	});

	rows.sort((a, b) => b.messageCount - a.messageCount);

	const noSenderCount = byBucket[NO_SENDER_BUCKET] ?? 0;
	if (noSenderCount > 0) {
		rows.push({
			displayName: 'System / no sender',
			ename: '—',
			messageCount: noSenderCount,
			bucketKey: NO_SENDER_BUCKET,
			evaultPageId: null
		});
	}

	return rows;
}

/** Log one JSON line per scanned message. Set `CONTROL_PANEL_LOG_GROUP_MESSAGES=0` to disable. */
const LOG_EACH_MESSAGE = process.env.CONTROL_PANEL_LOG_GROUP_MESSAGES !== '0';

export const GET: RequestHandler = async ({ params, url }) => {
	const evaultId = params.evaultId;

	try {
		const allVaults = await registryService.getEVaults();
		const registryEnameLookup = buildRegistryEnameLookup(allVaults);

		const vault = allVaults.find((v) => v.evault === evaultId || v.ename === evaultId);

		if (!vault) {
			return json({ error: `eVault '${evaultId}' not found in registry.` }, { status: 404 });
		}

		const platform = PUBLIC_CONTROL_PANEL_URL || url.origin;
		let token: string | undefined;
		try {
			token = await requestPlatformToken(platform);
		} catch (tokenError) {
			console.warn('Group insights: no platform token:', tokenError);
		}

		let registryRows: RegistryEvaultRow[] = [];
		try {
			registryRows = await fetchRegistryEvaultRows(token);
		} catch (rowsErr) {
			console.warn('Group insights: fetchRegistryEvaultRows failed:', rowsErr);
		}
		const dashboardNameByKey = buildDashboardNameByKey(registryRows);
		const hintByBucket = new Map<string, Map<string, number>>();

		const manifest = await fetchGroupManifestOrFallbackParsed(vault, token);
		if (!manifest) {
			return json(
				{
					error:
						'Could not load group manifest from this vault (not a group eVault, unreachable, or auth failed).'
				},
				{ status: 400 }
			);
		}

		const byBucket: Record<string, number> = {};
		let messagesScanned = 0;
		let totalCount = 0;
		let after: string | undefined;
		let capped = false;

		for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
			const variables: Record<string, unknown> = {
				filter: { ontologyId: MESSAGE_ONTOLOGY_ID },
				first: PAGE_SIZE
			};
			if (after) {
				variables.after = after;
			}

			const payload = await evaultGraphqlPost({
				uri: vault.uri,
				ename: vault.ename,
				query: MESSAGES_PAGE_QUERY,
				variables,
				token,
				timeoutMs: 15000
			});

			const conn = readMessageConnection(payload);
			if (!conn) {
				break;
			}

			if (pageIndex === 0 && typeof conn.totalCount === 'number') {
				totalCount = conn.totalCount;
			}

			const edges = conn.edges ?? [];
			for (const edge of edges) {
				const parsed = edge.node?.parsed as Record<string, unknown> | undefined;
				const senderEname = resolveMessageSenderEname(parsed, registryEnameLookup);
				const rawSenderId = rawMessageSenderId(parsed);
				const bucket = senderBucketKey(parsed, registryEnameLookup);
				byBucket[bucket] = (byBucket[bucket] ?? 0) + 1;
				messagesScanned += 1;
				recordDisplayHint(hintByBucket, bucket, displayHintFromMessage(parsed));

				if (LOG_EACH_MESSAGE) {
					console.log(
						'[group-insights:message]',
						JSON.stringify({
							evaultId,
							vaultEname: vault.ename,
							index: messagesScanned,
							senderBucket: bucket,
							senderEname: senderEname ?? null,
							senderId: rawSenderId ?? null,
							id: parsed?.id ?? null,
							chatId: parsed?.chatId ?? null,
							isSystemMessage: parsed?.isSystemMessage ?? null,
							preview: previewMessageBody(parsed),
							parsedKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed).sort() : []
						})
					);
				}
			}

			const hasNext = conn.pageInfo?.hasNextPage === true;
			const endCursor = conn.pageInfo?.endCursor;
			if (!hasNext || edges.length === 0) {
				break;
			}
			if (pageIndex === MAX_PAGES - 1) {
				capped = true;
				break;
			}
			after = endCursor ?? undefined;
		}

		const messagesWithoutSender = byBucket[NO_SENDER_BUCKET] ?? 0;
		const messagesWithSenderBucket = Math.max(0, messagesScanned - messagesWithoutSender);
		const userRowsForProbe = userRegistryRowsForProbe(registryRows);
		const probeRequestCache = new Map<string, string | null>();
		const senderRows = await buildSenderRows(
			byBucket,
			registryEnameLookup,
			allVaults,
			token,
			dashboardNameByKey,
			hintByBucket,
			userRowsForProbe,
			probeRequestCache
		);

		console.log('[group-insights:summary]', {
			evaultId,
			vaultEname: vault.ename,
			totalCount,
			messagesScanned,
			messagesWithSenderBucket,
			messagesWithoutSender,
			senderRowCount: senderRows.length,
			capped,
			byBucket,
			perMessageLinesLogged: LOG_EACH_MESSAGE
		});

		return json({
			evault: {
				ename: vault.ename,
				uri: vault.uri,
				evault: vault.evault
			},
			manifest,
			messageStats: {
				totalCount,
				messagesScanned,
				messagesWithSenderBucket,
				messagesWithoutSender,
				capped,
				senderRows
			}
		});
	} catch (error) {
		console.error('Error fetching group insights:', error);
		return json({ error: 'Failed to fetch group insights' }, { status: 500 });
	}
};
