import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, lstat, realpath, open, link, unlink, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const KEY = /^sha256:([a-f0-9]{64})$/;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function parseKey(key) {
  const match = KEY.exec(key ?? "");
  if (!match) throw new TypeError("INVALID_CONTENT_KEY");
  return match[1];
}

async function syncDirectory(directory) {
  const handle = await open(directory, constants.O_RDONLY);
  try { await handle.sync(); } finally { await handle.close(); }
}

async function ensureDirectoryNoSymlink(root, target) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("PATH_ESCAPES_STORE_ROOT");
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try { await mkdir(current, { mode: 0o700 }); } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("STORE_PATH_COMPONENT_NOT_REAL_DIRECTORY");
  }
}

export async function createPosixFilesystemCas({ root, runtimeId, runtimeInstanceId, hostId, failureDomainId }) {
  if (!["darwin", "linux"].includes(process.platform)) throw new Error("POSIX_FILESYSTEM_ADAPTER_UNSUPPORTED_PLATFORM");
  for (const [key, value] of Object.entries({ root, runtimeId, runtimeInstanceId, hostId, failureDomainId })) {
    if (typeof value !== "string" || !value.trim()) throw new TypeError("MISSING_ADAPTER_IDENTITY:" + key);
  }

  const absoluteRoot = path.resolve(root);
  await mkdir(absoluteRoot, { recursive: true, mode: 0o700 });
  const rootStat = await lstat(absoluteRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("STORE_ROOT_NOT_REAL_DIRECTORY");
  const canonicalRoot = await realpath(absoluteRoot);
  const objectsRoot = path.join(canonicalRoot, "objects", "sha256");
  const stagingRoot = path.join(canonicalRoot, "staging");
  await ensureDirectoryNoSymlink(canonicalRoot, objectsRoot);
  await ensureDirectoryNoSymlink(canonicalRoot, stagingRoot);

  const objectPath = (digest) => path.join(objectsRoot, digest.slice(0, 2), digest.slice(2, 4), digest);
  const describe = () => ({
    adapter_id: "NODE-POSIX-FILESYSTEM-CAS",
    adapter_version: "0.1.0",
    runtime_id: runtimeId,
    runtime_kind: process.platform === "darwin" ? "MACOS" : "LINUX",
    runtime_instance_id: runtimeInstanceId,
    host_id: hostId,
    failure_domain_id: failureDomainId,
    durability: "D1_PROCESS_CRASH",
    protocol_version: "ourdata.storage-adapter.v1",
    implementation: "OURPROCESSORSELF/src/storage/posix-filesystem-cas.mjs"
  });

  async function get(contentKey) {
    const digest = parseKey(contentKey);
    const bytes = await readFile(objectPath(digest));
    const actual = sha256(bytes);
    if (actual !== digest) throw new Error("STORAGE_INTEGRITY_MISMATCH");
    return bytes;
  }

  return Object.freeze({
    describe,
    capabilities: () => ({
      immutable_publish: true,
      atomic_no_replace: true,
      exact_readback: true,
      digest_verify: true,
      file_flush: true,
      namespace_flush: true,
      snapshot: false,
      replication: false,
      retention_lock: false,
      encryption_at_rest: false,
      offline: true,
      streaming: false,
      range_read: false,
      max_object_bytes: null
    }),
    health: async () => ({ reachable: true, root: canonicalRoot }),
    head: async (contentKey) => {
      const bytes = await get(contentKey);
      return { exists: true, byte_count: bytes.byteLength, verified: true, content_key: contentKey, durability: "D1_PROCESS_CRASH" };
    },
    verify: async (contentKey) => {
      const bytes = await get(contentKey);
      return { content_key: contentKey, sha256: sha256(bytes), byte_count: bytes.byteLength, integrity: "MATCH" };
    },
    get,
    putImmutable: async (input, expectedContentKey) => {
      const bytes = Buffer.from(input);
      const digest = sha256(bytes);
      const contentKey = "sha256:" + digest;
      if (expectedContentKey !== contentKey) throw new Error("CONTENT_KEY_PRECONDITION_FAILED");
      const destination = objectPath(digest);
      const parent = path.dirname(destination);
      await ensureDirectoryNoSymlink(canonicalRoot, parent);
      const stagingPath = path.join(stagingRoot, randomUUID() + ".stage");
      const stage = await open(stagingPath, "wx", 0o600);
      try {
        await stage.writeFile(bytes);
        await stage.sync();
      } finally {
        await stage.close();
      }
      let created = false;
      try {
        await link(stagingPath, destination);
        created = true;
      } catch (error) {
        if (error.code !== "EEXIST") {
          await unlink(stagingPath).catch(() => {});
          throw error;
        }
      }
      await unlink(stagingPath);
      if (created) await syncDirectory(parent);
      const readback = await get(contentKey);
      if (readback.byteLength !== bytes.byteLength || sha256(readback) !== digest) throw new Error("STORAGE_READBACK_MISMATCH");
      return {
        status: created ? "PERSISTED" : "IDEMPOTENT_MATCH",
        adapter: describe(),
        content_key: contentKey,
        byte_count: readback.byteLength,
        durability: "D1_PROCESS_CRASH",
        observed_at: new Date().toISOString(),
        readback_verified: true
      };
    },
    list: async () => { throw new Error("CAPABILITY_UNAVAILABLE:LIST_REQUIRES_AUTHORIZED_SNAPSHOT_CONTRACT"); },
    close: async () => ({ closed: true })
  });
}
