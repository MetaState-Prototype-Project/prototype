declare global {
    namespace App {
        interface Locals {
            /** The signed-in eVault owner, or null when unauthenticated. */
            user: { ename: string } | null;
        }
    }
}

export {};
