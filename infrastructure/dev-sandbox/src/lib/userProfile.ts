/**
 * UserProfile shape matching eID wallet evault controller.
 * Username is derived from ename exactly as eID: ename.replace("@", "").
 */
export interface UserProfile {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  ename: string;
  isVerified: boolean;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

const USER_PROFILE_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";

/**
 * Create a random UserProfile for the given ename.
 * username = ename.replace("@", "") exactly as eID wallet does.
 */
export async function createRandomUserProfile(ename: string): Promise<UserProfile> {
  const { randFullName, randParagraph, randAvatar } = await import("@ngneat/falso");

  const now = new Date().toISOString();
  const username = ename.replace("@", "");

  return {
    username,
    displayName: randFullName(),
    bio: randParagraph(),
    avatarUrl: randAvatar(),
    bannerUrl: randAvatar(),
    ename,
    isVerified: false,
    isPrivate: false,
    createdAt: now,
    updatedAt: now,
    isArchived: false,
  };
}

/**
 * Store UserProfile in eVault via storeMetaEnvelope (X-ENAME only, no Bearer).
 */
export async function storeUserProfileInEvault(
  evaultUri: string,
  eName: string,
  profile: UserProfile,
): Promise<void> {
  const url = new URL("/graphql", evaultUri).toString();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-ENAME": eName,
    },
    body: JSON.stringify({
      query: `
        mutation StoreMetaEnvelope($input: MetaEnvelopeInput!) {
          storeMetaEnvelope(input: $input) {
            metaEnvelope { id }
          }
        }
      `,
      variables: {
        input: {
          ontology: USER_PROFILE_ONTOLOGY,
          payload: profile,
          acl: ["*"],
        },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`UserProfile store failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as { errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
}
