import {test} from "node:test";
import assert from "node:assert/strict";
import {bootProtocolSelfRegistry} from "../runtime/protocolself-registry.mjs";
test("OURPROCESSORSELF boot binds the pinned 18-protocol registry without network listeners",()=>{const r=bootProtocolSelfRegistry();assert.equal(r.protocol_count,18);assert.equal(r.status,"REGISTRY_BOOTED_LISTENERS_DISABLED");assert.equal(r.network_listeners_started,0);assert.equal(r.external_bindings_created,0);assert.equal(r.network_transport_authority,"NOT_GRANTED");});
