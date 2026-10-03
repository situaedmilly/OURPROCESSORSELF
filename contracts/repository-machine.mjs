export const REPOSITORY_MACHINE_SCHEMA = "OURSELF.GITHUBCOMPUTERMORPH.REPOSITORY_MACHINE.v0.1";

export const SURFACE = Object.freeze({
  MAIN: "main",
  INPUT: "input",
  CACHE: "cache",
  CPU: "cpu",
  RAM: "ram",
  STORAGE: "storage",
  OUTPUT: "output",
});

export const SURFACE_ROLE = Object.freeze({
  main: "CANONICAL_LINEAGE",
  input: "INCOMING_MATTER",
  cache: "HOT_CANDIDATE",
  cpu: "CURRENT_COMPUTATIONAL_STATE",
  ram: "SPECULATIVE_STATE",
  storage: "DURABLE_STATE",
  output: "PROJECTED_STATE",
});

export const TRANSITION = Object.freeze({
  ALLOCATE: "ALLOCATE",
  SELECT: "SELECT",
  COMPUTE: "COMPUTE",
  SIMULATE: "SIMULATE",
  ANCHOR: "ANCHOR",
  PROJECT: "PROJECT",
  PURGE: "PURGE",
  UPDATE_REF: "UPDATE_REF",
});

export function createSurfaceState({surface, ref, commit, status="READY"}={}) {
  if (!Object.hasOwn(SURFACE_ROLE, surface)) throw new TypeError(`unknown machine surface: ${surface}`);
  if (!ref || !commit) throw new TypeError("surface ref and commit are required");
  return Object.freeze({surface, ref, commit, status});
}

export function createMachineState({surfaces}={}) {
  const map = Object.create(null);
  for (const surface of surfaces ?? []) {
    if (map[surface.surface]) throw new TypeError(`duplicate surface: ${surface.surface}`);
    map[surface.surface] = surface;
  }
  for (const required of Object.values(SURFACE)) {
    if (!map[required]) throw new TypeError(`missing machine surface: ${required}`);
  }
  return Object.freeze({schema: REPOSITORY_MACHINE_SCHEMA, surfaces: Object.freeze(map)});
}
