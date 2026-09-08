/**
 * @jest-environment jsdom
 */

import {
    getParticipant,
    getParticipants,
    invalidateParticipant
} from './participants';

const ALICE = '@48468c9a-dc1b-5663-92fb-5e46e3d2a7f0';
const BOB = '@7f3d2e1a-9b8c-4d5e-8f0a-1b2c3d4e5f60';
const STRANGER = '@0c0ffee0-dead-4bee-8fee-000000000000';

/** Profiles this fake Firestore knows about, keyed by document id. */
const profiles: Record<string, { id: string; name: string }> = {
    [ALICE]: { id: ALICE, name: 'Alice' },
    [BOB]: { id: BOB, name: 'Bob' }
};

const getDoc = jest.fn(async (ref: { id: string }) => ({
    exists: () => ref.id in profiles,
    data: () => profiles[ref.id]
}));

jest.mock('firebase/firestore', () => ({
    doc: (_collection: unknown, id: string) => ({ id }),
    getDoc: (ref: { id: string }) => getDoc(ref)
}));

jest.mock('./collections', () => ({ usersCollection: {} }));

describe('participant profile cache', () => {
    beforeEach(() => {
        getDoc.mockClear();
        for (const ename of [ALICE, BOB, STRANGER]) invalidateParticipant(ename);
    });

    it('resolves a display name for an eName-only participant', async () => {
        // The cost of dropping the envelope dereference: the profile is a
        // separate read, and it still has to work.
        await expect(getParticipant(ALICE)).resolves.toEqual({
            id: ALICE,
            name: 'Alice'
        });
    });

    it('reads a given participant once, then serves from cache', async () => {
        await getParticipant(ALICE);
        await getParticipant(ALICE);
        await getParticipant(ALICE);

        expect(getDoc).toHaveBeenCalledTimes(1);
    });

    it('collapses a concurrent burst into one read', async () => {
        // Every participant tile on a room render asks at the same moment.
        await Promise.all([
            getParticipant(ALICE),
            getParticipant(ALICE),
            getParticipant(ALICE)
        ]);

        expect(getDoc).toHaveBeenCalledTimes(1);
    });

    it('caches a miss so unknown participants are not re-read', async () => {
        await expect(getParticipant(STRANGER)).resolves.toBeNull();
        await getParticipant(STRANGER);

        expect(getDoc).toHaveBeenCalledTimes(1);
    });

    it('resolves a whole participant list and omits the unknown', async () => {
        const found = await getParticipants([ALICE, STRANGER, BOB]);

        expect(found[ALICE]).toEqual({ id: ALICE, name: 'Alice' });
        expect(found[BOB]).toEqual({ id: BOB, name: 'Bob' });
        expect(found[STRANGER]).toBeUndefined();
    });

    it('does not read the current user, who is already in hand', async () => {
        const self = { id: ALICE, name: 'Alice' } as never;
        const found = await getParticipants([ALICE, BOB], self);

        expect(found[ALICE]).toBe(self);
        expect(getDoc).toHaveBeenCalledTimes(1);
    });

    it('reads each distinct participant once for a list with duplicates', async () => {
        await getParticipants([ALICE, BOB, ALICE, BOB]);
        expect(getDoc).toHaveBeenCalledTimes(2);
    });

    it('does not cache a failed read', async () => {
        getDoc.mockRejectedValueOnce(new Error('offline'));

        await expect(getParticipant(ALICE)).resolves.toBeNull();
        await expect(getParticipant(ALICE)).resolves.toEqual({
            id: ALICE,
            name: 'Alice'
        });
    });
});
