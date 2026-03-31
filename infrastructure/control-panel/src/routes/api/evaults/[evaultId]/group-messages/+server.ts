import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { PUBLIC_CONTROL_PANEL_URL } from '$env/static/public';
import { registryService } from '$lib/services/registry';
import {
	evaultGraphqlPost,
	fetchGroupManifestOrFallbackParsed,
	fetchRegistryEvaultRows,
	MESSAGE_ONTOLOGY_ID,
	requestPlatformToken,
	type RegistryEvaultRow
} from '$lib/server/evault-graphql';
import {
	buildDashboardNameByKey,
	resolveSenderRowFields,
	userRegistryRowsForProbe
} from '$lib/server/group-sender-resolve.server';
import {
	buildRegistryEnameLookup,
	previewMessageBody,
	senderBucketKey
} from '$lib/server/group-message-buckets';

const MESSAGES_PAGE_QUERY = `
	query GroupMessagesList($filter: MetaEnvelopeFilterInput, $first: Int, $after: String) {
		metaEnvelopes(filter: $filter, first: $first, after: $after) {
			totalCount
			pageInfo {
				hasNextPage
				endCursor
			}
			edges {
				node {
					id
					parsed
				}
			}
		}
	}
`;

const PAGE_SIZE = 100;
const MAX_PAGES = 50;
const MAX_BUCKET_PARAM_LEN = 512;

type MessageListConnection = {
	totalCount?: number;
	pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
	edges?: Array<{ node?: { id?: string; parsed?: Record<string, unknown> } }>;
};

function readConnection(payload: Record<string, unknown> | null): MessageListConnection | null {
	if (!payload) {
		return null;
	}
	const data = payload.data as Record<string, unknown> | undefined;
	const conn = data?.metaEnvelopes as MessageListConnection | undefined;
	return conn ?? null;
}

export const GET: RequestHandler = async ({ params, url }) => {
	const evaultId = params.evaultId;
	const bucketParam = url.searchParams.get('bucket');

	if (bucketParam == null || bucketParam === '') {
		return json({ error: 'Missing required query parameter: bucket' }, { status: 400 });
	}
	if (bucketParam.length > MAX_BUCKET_PARAM_LEN) {
		return json({ error: 'Invalid bucket parameter' }, { status: 400 });
	}

	const filterBucket = bucketParam;

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
			console.warn('Group messages: no platform token:', tokenError);
		}

		let registryRows: RegistryEvaultRow[] = [];
		try {
			registryRows = await fetchRegistryEvaultRows(token);
		} catch (rowsErr) {
			console.warn('Group messages: fetchRegistryEvaultRows failed:', rowsErr);
		}
		const dashboardNameByKey = buildDashboardNameByKey(registryRows);
		const hintByBucket = new Map<string, Map<string, number>>();
		const userRowsForProbe = userRegistryRowsForProbe(registryRows);
		const probeRequestCache = new Map<string, string | null>();
		const { displayName: senderDisplayName, ename: senderEname } = await resolveSenderRowFields({
			bucketKey: filterBucket,
			allVaults,
			registryEnameLookup,
			token,
			dashboardNameByKey,
			hintByBucket,
			userRowsForProbe,
			probeRequestCache
		});

		const manifest = await fetchGroupManifestOrFallbackParsed(vault, token);
		const manifestRec = manifest && typeof manifest === 'object' && !Array.isArray(manifest)
			? (manifest as Record<string, unknown>)
			: null;
		const groupDisplayNameRaw = manifestRec?.name;
		const groupDisplayName =
			typeof groupDisplayNameRaw === 'string' && groupDisplayNameRaw.trim()
				? groupDisplayNameRaw.trim()
				: vault.ename || evaultId || 'Group';

		const messages: Array<{
			id: string | null;
			preview: string | undefined;
			senderBucket: string;
		}> = [];

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

			const conn = readConnection(payload);
			if (!conn) {
				break;
			}

			if (pageIndex === 0 && typeof conn.totalCount === 'number') {
				totalCount = conn.totalCount;
			}

			const edges = conn.edges ?? [];
			for (const edge of edges) {
				const node = edge.node;
				const parsed = node?.parsed;
				const p =
					parsed && typeof parsed === 'object' && !Array.isArray(parsed)
						? (parsed as Record<string, unknown>)
						: undefined;
				const bucket = senderBucketKey(p, registryEnameLookup);
				messagesScanned += 1;
				if (bucket === filterBucket) {
					const graphqlId = typeof node?.id === 'string' ? node.id : null;
					const parsedId = p && typeof p.id === 'string' ? p.id : null;
					messages.push({
						id: graphqlId ?? parsedId,
						preview: previewMessageBody(p),
						senderBucket: bucket
					});
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

		return json({
			evault: {
				ename: vault.ename,
				uri: vault.uri,
				evault: vault.evault
			},
			groupDisplayName,
			senderDisplayName,
			senderEname,
			bucket: filterBucket,
			messages,
			matchedCount: messages.length,
			messagesScanned,
			totalCount,
			capped
		});
	} catch (error) {
		console.error('Error fetching group messages:', error);
		return json({ error: 'Failed to fetch group messages' }, { status: 500 });
	}
};
