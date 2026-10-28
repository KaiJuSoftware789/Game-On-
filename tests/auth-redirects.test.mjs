import test from "node:test";
import assert from "node:assert/strict";
import { safeNextPath } from "../lib/auth-config.ts";

test("sign-in destinations support both local and connected flows", () => {
  for (const path of [
    "/events",
    "/messages",
    "/players",
    "/profile",
    "/profile#game-accounts",
    "/tickets",
    "/tickets/new",
    "/games",
    "/account",
    "/",
  ]) {
    assert.equal(safeNextPath(path), path);
  }
});
test("sign-in destinations reject external and unsupported redirects", () => {
  for (const path of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/events?next=https://example.com",
    null,
  ]) {
    assert.equal(safeNextPath(path), "/games");
  }
});
