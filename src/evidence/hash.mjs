import { createHash } from "node:crypto";

export const HASH_ALGORITHM = "sha256";

function canonical(value) {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
}

export function sha256(value) {
  return createHash(HASH_ALGORITHM).update(canonical(value), "utf8").digest("hex");
}

export function hashBytes(bytes) {
  return createHash(HASH_ALGORITHM).update(bytes).digest("hex");
}
