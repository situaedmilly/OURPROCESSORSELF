import {createMachineState, createSurfaceState, SURFACE} from "../../contracts/repository-machine.mjs";

export {SURFACE};

export function bootstrapMachineState(commit) {
  if (!commit) throw new TypeError("canonical commit is required");
  const surfaces = Object.values(SURFACE).map((surface) =>
    createSurfaceState({
      surface,
      ref: `refs/heads/${surface}`,
      commit,
    })
  );
  return createMachineState({surfaces});
}
