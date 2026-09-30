import {execFile} from "node:child_process";
import {promisify} from "node:util";
const execFileAsync = promisify(execFile);

export function createGitCliAdapter({cwd}={}) {
  if (!cwd) throw new TypeError("cwd is required");
  return Object.freeze({
    async readRef(ref) {
      const {stdout} = await execFileAsync("git", ["rev-parse", ref], {cwd});
      return {ref, commit: stdout.trim()};
    },
    async updateRef(ref, expectedCommit, newCommit) {
      const args = ["update-ref", ref, newCommit, expectedCommit];
      const {stdout, stderr} = await execFileAsync("git", args, {cwd});
      return {ref, expectedCommit, newCommit, stdout: stdout.trim(), stderr: stderr.trim()};
    },
  });
}
