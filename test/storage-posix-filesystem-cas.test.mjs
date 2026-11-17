import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { createPosixFilesystemCas } from "../src/storage/posix-filesystem-cas.mjs";

const digest = (bytes) => "sha256:" + createHash("sha256").update(bytes).digest("hex");
async function fixture(t) {
  const parent = await mkdtemp(path.join(tmpdir(), "ourself-storage-test-"));
  const root = path.join(parent, "store");
  const adapter = await createPosixFilesystemCas({
    root, runtimeId: "OURSELFMAC.local", runtimeInstanceId: "TEST-INSTANCE",
    hostId: "TEST-HOST", failureDomainId: "TEST-DISK"
  });
  t.after(async () => { await adapter.close(); await rm(parent, { recursive: true, force: true }); });
  return { parent, root, adapter };
}

test("publishes exact bytes and verifies content address on read-back", async (t) => {
  const { adapter } = await fixture(t);
  const bytes = Buffer.from([0, 1, 2, 10, 13, 255]);
  const receipt = await adapter.putImmutable(bytes, digest(bytes));
  assert.equal(receipt.status, "PERSISTED");
  assert.equal(receipt.readback_verified, true);
  assert.deepEqual(await adapter.get(digest(bytes)), bytes);
  assert.deepEqual(await adapter.verify(digest(bytes)), {
    content_key: digest(bytes),
    sha256: digest(bytes).slice(7),
    byte_count: bytes.length,
    integrity: "MATCH"
  });
});

test("same content publication is idempotent", async (t) => {
  const { adapter } = await fixture(t);
  const bytes = Buffer.from("same bytes");
  assert.equal((await adapter.putImmutable(bytes, digest(bytes))).status, "PERSISTED");
  assert.equal((await adapter.putImmutable(bytes, digest(bytes))).status, "IDEMPOTENT_MATCH");
});

test("rejects a caller-supplied key that does not match exact bytes", async (t) => {
  const { adapter } = await fixture(t);
  await assert.rejects(adapter.putImmutable(Buffer.from("x"), "sha256:" + "0".repeat(64)), /CONTENT_KEY_PRECONDITION_FAILED/);
});

test("rejects malformed content keys", async (t) => {
  const { adapter } = await fixture(t);
  await assert.rejects(adapter.get("../outside"), /INVALID_CONTENT_KEY/);
});

test("detects on-disk byte tampering during get", async (t) => {
  const { root, adapter } = await fixture(t);
  const bytes = Buffer.from("immutable");
  const key = digest(bytes);
  await adapter.putImmutable(bytes, key);
  const hex = key.slice(7);
  const target = path.join(root, "objects", "sha256", hex.slice(0, 2), hex.slice(2, 4), hex);
  await writeFile(target, Buffer.from("tampered"));
  await assert.rejects(adapter.get(key), /STORAGE_INTEGRITY_MISMATCH/);
});

test("does not claim host-crash or independent-custody durability", async (t) => {
  const { adapter } = await fixture(t);
  assert.equal(adapter.describe().durability, "D1_PROCESS_CRASH");
  assert.equal(adapter.capabilities().replication, false);
  assert.equal(adapter.capabilities().retention_lock, false);
});

test("does not silently provide an unbounded listing operation", async (t) => {
  const { adapter } = await fixture(t);
  await assert.rejects(adapter.list(""), /CAPABILITY_UNAVAILABLE/);
});

test("descriptor binds host and failure domain identities", async (t) => {
  const { adapter } = await fixture(t);
  const descriptor = adapter.describe();
  assert.equal(descriptor.runtime_kind, process.platform === "darwin" ? "MACOS" : "LINUX");
  assert.equal(descriptor.host_id, "TEST-HOST");
  assert.equal(descriptor.failure_domain_id, "TEST-DISK");
});

test("rejects a symlink at a content-addressed object path",async(t)=>{
  const {root,adapter}=await fixture(t);
  const bytes=Buffer.from("linked object");
  const key=digest(bytes),hex=key.slice(7);
  const directory=path.join(root,"objects","sha256",hex.slice(0,2),hex.slice(2,4));
  await import("node:fs/promises").then(({mkdir})=>mkdir(directory,{recursive:true}));
  const target=path.join(root,"outside");
  await writeFile(target,bytes);
  await symlink(target,path.join(directory,hex));
  await assert.rejects(adapter.get(key));
});

test("rejects a group- or world-writable store root",async()=>{
  const parent=await mkdtemp(path.join(tmpdir(),"ourself-storage-permission-"));
  const root=path.join(parent,"store");
  await mkdir(root,{mode:0o700});
  const {chmod}=await import("node:fs/promises");
  await chmod(root,0o777);
  await assert.rejects(createPosixFilesystemCas({root,runtimeId:"R",runtimeInstanceId:"I",hostId:"H",failureDomainId:"F"}),/STORE_ROOT_GROUP_OR_WORLD_WRITABLE/);
  await rm(parent,{recursive:true,force:true});
});
