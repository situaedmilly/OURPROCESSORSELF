import {createHash} from "node:crypto";

export function canonicalJson(value) {
  return JSON.stringify(value, (_, v) => {
    if (v instanceof Uint8Array) return Array.from(v);
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      return Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]]));
    }
    return v;
  });
}

export function sha256(value) {
  const input = typeof value === "string" ? value : canonicalJson(value);
  return createHash("sha256").update(input).digest("hex");
}
