import { GraphQLClient } from "graphql-request";
import { CALENDAR_EVENT_ONTOLOGY_ID } from "../constants";

const META_ENVELOPES_QUERY = `
  query MetaEnvelopes($filter: MetaEnvelopeFilterInput, $first: Int, $after: String) {
    metaEnvelopes(filter: $filter, first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          ontology
          parsed
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

const CREATE_MUTATION = `
  mutation CreateMetaEnvelope($input: MetaEnvelopeInput!) {
    createMetaEnvelope(input: $input) {
      metaEnvelope {
        id
        ontology
        parsed
      }
      errors { field message code }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdateMetaEnvelope($id: ID!, $input: MetaEnvelopeInput!) {
    updateMetaEnvelope(id: $id, input: $input) {
      metaEnvelope {
        id
        ontology
        parsed
      }
      errors { message code }
    }
  }
`;

const META_ENVELOPE_QUERY = `
  query MetaEnvelope($id: ID!) {
    metaEnvelope(id: $id) {
      id
      parsed
    }
  }
`;

const REMOVE_MUTATION = `
  mutation RemoveMetaEnvelope($id: ID!) {
    removeMetaEnvelope(id: $id) {
      deletedId
      success
      errors { message code }
    }
  }
`;

export interface CalendarEventPayload {
  title: string;
  color?: string;
  start: string;
  end: string;
}

export interface CalendarEventResponse {
  id: string;
  title: string;
  color: string;
  start: string;
  end: string;
}

function getEvaultGraphqlUrl(): string {
  const base = process.env.PUBLIC_EVAULT_SERVER_URI || "http://localhost:4000";
  const normalized = base.replace(/\/$/, "");
  return `${normalized}/graphql`;
}

interface PlatformTokenResponse {
  token: string;
  expiresAt?: number;
}

export class EVaultService {
  private platformToken: string | null = null;
  private tokenExpiresAt: number = 0;

  private async ensurePlatformToken(): Promise<string> {
    const now = Date.now();
    if (this.platformToken && this.tokenExpiresAt > now + 5 * 60 * 1000) {
      return this.platformToken;
    }

    const registryUrl = process.env.PUBLIC_REGISTRY_URL;
    if (!registryUrl) {
      throw new Error("PUBLIC_REGISTRY_URL not configured");
    }

    const baseUrl = process.env.NEXT_PUBLIC_CALENDAR_APP_URL;
    if (!baseUrl) {
      throw new Error("NEXT_PUBLIC_CALENDAR_APP_URL not configured");
    }

    const response = await fetch(
      new URL("/platforms/certification", registryUrl).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: baseUrl }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get platform token: HTTP ${response.status}`);
    }

    const data = (await response.json()) as PlatformTokenResponse;
    this.platformToken = data.token;
    this.tokenExpiresAt = data.expiresAt || now + 3600000;
    console.log("[EVaultService] Platform token obtained for", baseUrl, "expires at", new Date(this.tokenExpiresAt).toISOString());
    return this.platformToken;
  }

  private async getClient(eName: string): Promise<GraphQLClient> {
    const endpoint = getEvaultGraphqlUrl();
    const token = await this.ensurePlatformToken();
    console.log("[EVaultService] Creating client for endpoint:", endpoint, "eName:", eName);
    return new GraphQLClient(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-ENAME": eName,
      },
    });
  }

  async listEvents(
    eName: string,
    first = 100,
    after?: string
  ): Promise<CalendarEventResponse[]> {
    console.log("[EVaultService.listEvents] eName:", eName, "first:", first, "after:", after);
    const client = await this.getClient(eName);
    const variables: {
      filter: { ontologyId: string };
      first: number;
      after?: string;
    } = {
      filter: { ontologyId: CALENDAR_EVENT_ONTOLOGY_ID },
      first,
    };
    if (after != null && after !== "") {
      variables.after = after;
    }
    console.log("[EVaultService.listEvents] variables:", JSON.stringify(variables));
    type MetaEnvelopesResult = {
      metaEnvelopes: {
        edges: Array<{
          node: { id: string; parsed: Record<string, unknown> };
        }>;
      };
    };
    let result: MetaEnvelopesResult;
    try {
      result = await client.request<MetaEnvelopesResult>(META_ENVELOPES_QUERY, variables);
    } catch (err: unknown) {
      const msg =
        err &&
        typeof err === "object" &&
        "response" in err
          ? JSON.stringify((err as { response?: unknown }).response)
          : String(err);
      console.error("[EVaultService] metaEnvelopes request failed:", msg);
      throw new Error(`eVault query failed: ${msg}`);
    }

    return result.metaEnvelopes.edges.map((edge) => {
      const p = edge.node.parsed as Record<string, unknown>;
      return {
        id: edge.node.id,
        title: (p.title as string) ?? "",
        color: (p.color as string) ?? "",
        start: (p.start as string) ?? "",
        end: (p.end as string) ?? "",
      };
    });
  }

  async createEvent(
    eName: string,
    payload: CalendarEventPayload
  ): Promise<CalendarEventResponse> {
    const client = await this.getClient(eName);
    const result = await client.request<{
      createMetaEnvelope: {
        metaEnvelope: { id: string; parsed: Record<string, unknown> } | null;
        errors: Array<{ message: string }>;
      };
    }>(CREATE_MUTATION, {
      input: {
        ontology: CALENDAR_EVENT_ONTOLOGY_ID,
        payload: {
          title: payload.title,
          color: payload.color ?? "",
          start: payload.start,
          end: payload.end,
        },
        acl: ["*"],
      },
    });

    const { metaEnvelope, errors } = result.createMetaEnvelope;
    if (errors?.length) {
      throw new Error(errors.map((e) => e.message).join("; "));
    }
    if (!metaEnvelope) {
      throw new Error("Create failed: no metaEnvelope returned");
    }

    const p = metaEnvelope.parsed as Record<string, unknown>;
    return {
      id: metaEnvelope.id,
      title: (p.title as string) ?? "",
      color: (p.color as string) ?? "",
      start: (p.start as string) ?? "",
      end: (p.end as string) ?? "",
    };
  }

  async updateEvent(
    eName: string,
    id: string,
    partial: Partial<CalendarEventPayload>
  ): Promise<CalendarEventResponse> {
    const client = await this.getClient(eName);
    const existing = await client.request<{
      metaEnvelope: { id: string; parsed: Record<string, unknown> } | null;
    }>(META_ENVELOPE_QUERY, { id });
    if (!existing.metaEnvelope?.parsed) {
      throw new Error("Event not found");
    }
    const current = existing.metaEnvelope.parsed as Record<string, unknown>;
    const payload: CalendarEventPayload = {
      title: (partial.title as string) ?? (current.title as string),
      color: (partial.color as string) ?? (current.color as string) ?? "",
      start: (partial.start as string) ?? (current.start as string),
      end: (partial.end as string) ?? (current.end as string),
    };

    const result = await client.request<{
      updateMetaEnvelope: {
        metaEnvelope: { id: string; parsed: Record<string, unknown> } | null;
        errors: Array<{ message: string }>;
      };
    }>(UPDATE_MUTATION, {
      id,
      input: {
        ontology: CALENDAR_EVENT_ONTOLOGY_ID,
        payload,
        acl: ["*"],
      },
    });

    const { metaEnvelope, errors } = result.updateMetaEnvelope;
    if (errors?.length) {
      throw new Error(errors.map((e) => e.message).join("; "));
    }
    if (!metaEnvelope) {
      throw new Error("Update failed: no metaEnvelope returned");
    }

    const p = metaEnvelope.parsed as Record<string, unknown>;
    return {
      id: metaEnvelope.id,
      title: (p.title as string) ?? "",
      color: (p.color as string) ?? "",
      start: (p.start as string) ?? "",
      end: (p.end as string) ?? "",
    };
  }

  async removeEvent(eName: string, id: string): Promise<boolean> {
    const client = await this.getClient(eName);
    const result = await client.request<{
      removeMetaEnvelope: { success: boolean; errors: Array<{ message: string }> };
    }>(REMOVE_MUTATION, { id });

    if (result.removeMetaEnvelope.errors?.length) {
      throw new Error(
        result.removeMetaEnvelope.errors.map((e) => e.message).join("; ")
      );
    }
    return result.removeMetaEnvelope.success;
  }
}
