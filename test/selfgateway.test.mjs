import test from "node:test";
import assert from "node:assert/strict";
import { executeSelfGatewayAlchemy } from "../src/selfgateway.mjs";

test("SELFgateway defaults to non-authoritative local alchemy", () => {
  const receipt = executeSelfGatewayAlchemy({
    schema:"SELFgateway/v0.1",
    gateway:{model_name:"HB5GGW_TMO-G4AR",model_number:"JT737656C",firmware_version:"1.00.18"},
    network:{wan_address:null,address_family:null,nat_state:"UNKNOWN",inbound_reachability:"UNPROVEN"},
    authority:{status:"NONE"}
  });
  assert.equal(receipt.status,"RECORDED");
  assert.equal(receipt.result.execution.external_effect,false);
  assert.equal(receipt.result.identity_secrets_persisted,false);
});
