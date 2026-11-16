import test from "node:test";
import assert from "node:assert/strict";
import { validateStorageAdapterRegistration, evaluateStorageCapabilityRequirement } from "../src/storage/registration.mjs";

function registration(overrides={}) {
  return {
    schema:"ourdata.storage-adapter-registration.v1",
    adapter_id:"NODE-POSIX-FILESYSTEM-CAS",
    adapter_version:"0.1.0",
    runtime:{runtime_id:"OURSELFMAC.local",runtime_kind:"MACOS",runtime_instance_id:"MAC-INSTANCE-001"},
    host:{host_id:"MAC-HOST-001",failure_domain_id:"INTERNAL-APFS-001",observed_at:"2026-11-16T23:00:00Z"},
    scope:{reality_id:"OURDATASELFBASE",instance_id:"OURSELF-INSTANCE-0001",namespace:"objects/sha256",allowed_object_classes:["EVIDENCE_ARTIFACT"],jurisdiction:"OURSELF"},
    capabilities:{immutable_publish:true,atomic_no_replace:true,exact_readback:true,digest_verify:true,file_flush:true,namespace_flush:true,snapshot:false,replication:false,retention_lock:false,encryption_at_rest:false,offline:true},
    custody:{independent_custody:false,control_domain_id:"FOUNDER-CONTROLLED",independence_evidence_refs:[],witness_id:null,witness_control_domain_id:null,witness_evidence_refs:[]},
    durability:"D1_PROCESS_CRASH",
    admission:"CONFORMANCE_TESTED",
    evidence_refs:["FLOW-STORAGE-TEST-001"],
    ...overrides
  };
}

test("accepts a structurally valid D1 runtime registration",()=>{
  assert.deepEqual(validateStorageAdapterRegistration(registration()),{valid:true,errors:[]});
});

test("rejects unknown runtime family and missing host identity",()=>{
  const result=validateStorageAdapterRegistration(registration({runtime:{runtime_id:"x",runtime_kind:"QUANTUM_VM",runtime_instance_id:"i"},host:{failure_domain_id:"fd"}}));
  assert.ok(result.errors.some(x=>x.code==="UNKNOWN_RUNTIME_KIND"));
  assert.ok(result.errors.some(x=>x.code==="INVALID_HOST_ID"));
});

test("D2 requires atomic no-replace and file plus namespace flush",()=>{
  const value=registration({durability:"D2_HOST_CRASH",capabilities:{...registration().capabilities,atomic_no_replace:false,namespace_flush:false}});
  const result=validateStorageAdapterRegistration(value);
  assert.ok(result.errors.some(x=>x.code==="HOST_CRASH_DURABILITY_REQUIREMENTS_MISSING"));
});

test("D3 requires replication",()=>{
  const result=validateStorageAdapterRegistration(registration({durability:"D3_FAILURE_DOMAIN"}));
  assert.ok(result.errors.some(x=>x.code==="FAILURE_DOMAIN_REQUIRES_REPLICATION"));
});

test("D4 requires independently evidenced custody and witness",()=>{
  const value=registration({durability:"D4_INDEPENDENT_CUSTODY",capabilities:{...registration().capabilities,replication:true},custody:{independent_custody:false,independence_evidence_refs:[],witness_evidence_refs:[],control_domain_id:"founder",witness_control_domain_id:"founder"}});
  const result=validateStorageAdapterRegistration(value);
  assert.ok(result.errors.some(x=>x.code==="INDEPENDENT_CUSTODY_NOT_PROVEN"));
  assert.ok(result.errors.some(x=>x.code==="INDEPENDENCE_EVIDENCE_REQUIRED"));
  assert.ok(result.errors.some(x=>x.code==="INDEPENDENT_WITNESS_EVIDENCE_REQUIRED"));
  assert.ok(result.errors.some(x=>x.code==="WITNESS_CONTROL_DOMAIN_NOT_INDEPENDENT"));
});

test("does not authorize a conformant but unadmitted adapter for canonical writes",()=>{
  const result=evaluateStorageCapabilityRequirement(registration(),"D1_PROCESS_CRASH",["immutable_publish","exact_readback"]);
  assert.equal(result.authorized_for_requirement,false);
  assert.ok(result.errors.some(x=>x.code==="ADAPTER_NOT_AUTHORITY_ADMITTED"));
});

test("does not downgrade D2 requirement to D1",()=>{
  const result=evaluateStorageCapabilityRequirement(registration(),"D2_HOST_CRASH",["atomic_no_replace","file_flush"]);
  assert.equal(result.authorized_for_requirement,false);
  assert.ok(result.errors.some(x=>x.code==="DURABILITY_BELOW_REQUIRED"));
});

test("recognizes Bubble, Cloudflare edge, Supabase projection and language runtimes",()=>{
  for(const runtime_kind of ["RASPBERRY_PI","BUBBLE","CLOUDFLARE_WORKER","EDGE_RUNTIME","SUPABASE","NODE","PYTHON","RUST","MACOS_APP"]){
    const value=registration({runtime:{runtime_id:"RUNTIME-"+runtime_kind,runtime_kind,runtime_instance_id:"INSTANCE-"+runtime_kind}});
    assert.equal(validateStorageAdapterRegistration(value).valid,true,runtime_kind);
  }
});
