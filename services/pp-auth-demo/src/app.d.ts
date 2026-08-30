declare global {
    namespace App {
        interface Locals {
            /** The signed-in PPA admin, or null when unauthenticated. */
            user: { ename: string } | null;
        }
    }
}

export {};
