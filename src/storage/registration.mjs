const DURABILITY = ["D0_VOLATILE","D1_PROCESS_CRASH","D2_HOST_CRASH","D3_FAILURE_DOMAIN","D4_INDEPENDENT_CUSTODY"];
const ADMISSION = ["DECLARED","IMPLEMENTED","STRUCTURALLY_VALIDATED","CONFORMANCE_TESTED","HOST_OBSERVED","INTEGRITY_VERIFIED","AUTHORITY_ADMITTED","RECONTACT_VERIFIED","WITNESSED","QUARANTINED","REVOKED"];
const RUNTIMES = ["MACOS","LINUX","WINDOWS","WINDOWS_ARM64_GUEST","ANDROID","IOS","BROWSER","WASM","DOCKER","CONTAINERD","PODMAN","LIMA","COLIMA","HYPERVISOR_GUEST","CLOUD_RUNTIME","IN_MEMORY","OTHER","BUBBLE","CLOUDFLARE_WORKER","EDGE_RUNTIME","SUPABASE","NODE","PYTHON","RUST","MACOS_APP"];
const BOOL_CAPS = ["immutable_publish","atomic_no_replace","exact_readback","digest_verify","file_flush","namespace_flush","snapshot","replication","retention_lock","encryption_at_rest","offline"];

export function validateStorageAdapterRegistration(registration) {
  const errors=[];
  const add=(code,path)=>errors.push({code,path});
  if(!registration||typeof registration!=="object"||Array.isArray(registration))return {valid:false,errors:[{code:"INVALID_REGISTRATION_OBJECT",path:"$"}]};
  if(registration.schema!=="ourdata.storage-adapter-registration.v1")add("UNSUPPORTED_SCHEMA","schema");
  if(typeof registration.adapter_id!=="string"||!/^[A-Z0-9][A-Z0-9._-]{2,127}$/.test(registration.adapter_id))add("INVALID_ADAPTER_ID","adapter_id");
  if(typeof registration.adapter_version!=="string"||!registration.adapter_version)add("INVALID_ADAPTER_VERSION","adapter_version");
  const runtime=registration.runtime;
  if(!runtime||typeof runtime!=="object")add("MISSING_RUNTIME_IDENTITY","runtime");
  else {
    if(typeof runtime.runtime_id!=="string"||!runtime.runtime_id)add("INVALID_RUNTIME_ID","runtime.runtime_id");
    if(!RUNTIMES.includes(runtime.runtime_kind))add("UNKNOWN_RUNTIME_KIND","runtime.runtime_kind");
    if(typeof runtime.runtime_instance_id!=="string"||!runtime.runtime_instance_id)add("INVALID_RUNTIME_INSTANCE","runtime.runtime_instance_id");
  }
  const host=registration.host;
  if(!host||typeof host.host_id!=="string"||!host.host_id)add("INVALID_HOST_ID","host.host_id");
  if(!host||typeof host.failure_domain_id!=="string"||!host.failure_domain_id)add("INVALID_FAILURE_DOMAIN","host.failure_domain_id");
  const scope=registration.scope;
  if(!scope||typeof scope.reality_id!=="string"||!scope.reality_id)add("INVALID_REALITY_SCOPE","scope.reality_id");
  if(!scope||typeof scope.instance_id!=="string"||!scope.instance_id)add("INVALID_INSTANCE_SCOPE","scope.instance_id");
  if(!scope||typeof scope.namespace!=="string"||!scope.namespace)add("INVALID_NAMESPACE","scope.namespace");
  const custody=registration.custody;
  if(!custody||typeof custody.independent_custody!=="boolean")add("INVALID_CUSTODY_DECLARATION","custody.independent_custody");
  if(!custody||typeof custody.control_domain_id!=="string"||!custody.control_domain_id)add("INVALID_CUSTODY_CONTROL_DOMAIN","custody.control_domain_id");
  if(!custody||!Array.isArray(custody.independence_evidence_refs))add("INVALID_CUSTODY_EVIDENCE_REFS","custody.independence_evidence_refs");
  if(!custody||!Array.isArray(custody.witness_evidence_refs))add("INVALID_WITNESS_EVIDENCE_REFS","custody.witness_evidence_refs");
  const caps=registration.capabilities;
  if(!caps||typeof caps!=="object")add("MISSING_CAPABILITY_PROFILE","capabilities");
  else for(const key of BOOL_CAPS)if(typeof caps[key]!=="boolean")add("INVALID_CAPABILITY_FLAG","capabilities."+key);
  const durability=registration.durability;
  if(!DURABILITY.includes(durability))add("UNKNOWN_DURABILITY_CLASS","durability");
  if(!ADMISSION.includes(registration.admission))add("UNKNOWN_ADMISSION_STATE","admission");
  if(!Array.isArray(registration.evidence_refs))add("INVALID_EVIDENCE_REFS","evidence_refs");

  if(caps&&DURABILITY.includes(durability)){
    if(durability!=="D0_VOLATILE"&&(!caps.exact_readback||!caps.digest_verify))add("DURABILITY_REQUIRES_VERIFIED_READBACK","capabilities");
    if(["D2_HOST_CRASH","D3_FAILURE_DOMAIN","D4_INDEPENDENT_CUSTODY"].includes(durability)&&(!caps.atomic_no_replace||!caps.file_flush||!caps.namespace_flush))add("HOST_CRASH_DURABILITY_REQUIREMENTS_MISSING","capabilities");
    if(["D3_FAILURE_DOMAIN","D4_INDEPENDENT_CUSTODY"].includes(durability)&&!caps.replication)add("FAILURE_DOMAIN_REQUIRES_REPLICATION","capabilities.replication");
    if(durability==="D4_INDEPENDENT_CUSTODY"){
      const custody=registration.custody;
      if(!custody||custody.independent_custody!==true)add("INDEPENDENT_CUSTODY_NOT_PROVEN","custody.independent_custody");
      if(!custody||!Array.isArray(custody.independence_evidence_refs)||custody.independence_evidence_refs.length===0)add("INDEPENDENCE_EVIDENCE_REQUIRED","custody.independence_evidence_refs");
      if(!custody||!Array.isArray(custody.witness_evidence_refs)||custody.witness_evidence_refs.length===0)add("INDEPENDENT_WITNESS_EVIDENCE_REQUIRED","custody.witness_evidence_refs");
      if(custody&&custody.control_domain_id&&custody.witness_control_domain_id&&custody.control_domain_id===custody.witness_control_domain_id)add("WITNESS_CONTROL_DOMAIN_NOT_INDEPENDENT","custody.witness_control_domain_id");
    }
  }
  if(registration.admission==="AUTHORITY_ADMITTED"&&!Array.isArray(registration.evidence_refs))add("ADMISSION_EVIDENCE_REQUIRED","evidence_refs");
  return {valid:errors.length===0,errors};
}

export function evaluateStorageCapabilityRequirement(registration, requiredDurability, requiredCapabilities=[]) {
  const validation=validateStorageAdapterRegistration(registration);
  const rank=Object.fromEntries(DURABILITY.map((value,index)=>[value,index]));
  const errors=[...validation.errors];
  if(!Object.hasOwn(rank,requiredDurability))errors.push({code:"UNKNOWN_REQUIRED_DURABILITY",path:"requiredDurability"});
  else if(Object.hasOwn(rank,registration?.durability)&&rank[registration.durability]<rank[requiredDurability])errors.push({code:"DURABILITY_BELOW_REQUIRED",path:"durability"});
  for(const capability of requiredCapabilities){
    if(registration?.capabilities?.[capability]!==true)errors.push({code:"REQUIRED_CAPABILITY_UNAVAILABLE",path:"capabilities."+capability});
  }
  if(registration?.admission!=="AUTHORITY_ADMITTED"&&registration?.admission!=="RECONTACT_VERIFIED"&&registration?.admission!=="WITNESSED")errors.push({code:"ADAPTER_NOT_AUTHORITY_ADMITTED",path:"admission"});
  return {authorized_for_requirement:errors.length===0,errors};
}
