import { generateUuid } from "../../src/utils/uuid";
import falso from "@ngneat/falso";
import { describe, test } from "vitest";

describe("UUIDv5 Generation", () => {
  test("Create UUID", () => {
    const id = generateUuid(falso.randText());
  });
});
