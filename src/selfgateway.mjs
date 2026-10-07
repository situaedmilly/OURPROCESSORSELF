import { createHash } from "node:crypto";
const sha256 = value => createHash("sha256").update(value, "utf8").digest("hex");

export function validateSelfGatewayManifest(manifest) {
  if (manifest?.schema !== "SELFgateway/v0.1") throw new Error("SELFgateway schema mismatch");
  for (const field of ["model_name","model_number","firmware_version"]) {
    if (typeof manifest.gateway?.[field] !== "string" || !manifest.gateway[field]) throw new Error("missing gateway." + field);
  }
  if (manifest.network?.inbound_reachability === "PROVEN" && !manifest.network?.wan_address) throw new Error("PROVEN reachability requires wan_address");
  return true;
}

export function executeSelfGatewayAlchemy(manifest, { probe = null } = {}) {
  validateSelfGatewayManifest(manifest);
  const observed = probe ? probe(manifest) : {
    wan_address: manifest.network.wan_address,
    address_family: manifest.network.address_family,
    nat_state: manifest.network.nat_state,
    inbound_reachability: manifest.network.inbound_reachability
  };
  const result = {
    schema: "SELFgateway/v0.1",
    gateway: manifest.gateway,
    network: observed,
    authority: manifest.authority,
    execution: { mode: "LOCAL_ALCHEMY", external_effect: false },
    identity_secrets_persisted: false
  };
  return Object.freeze({status:"RECORDED", effect_hash:"sha256:"+sha256(JSON.stringify(result)), result});
}
