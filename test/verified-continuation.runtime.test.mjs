import assert from "node:assert/strict";
import test from "node:test";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {bootstrapMachineState} from "../src/repository-machine/surfaces.mjs";
import {proposeTransition,executeTransition} from "../src/repository-machine/transition.mjs";
import {createActuationRequest} from "../contracts/actuation.mjs";
import {evaluateActuatorAdmission,executeActuation} from "../src/causal/actuation.mjs";
import {createGitCliAdapter} from "../src/repository-actuator/git-cli.mjs";
import {runVerifiedContinuation} from "../src/continuation/verified-continuation.mjs";

const exec=promisify(execFile);
async function git(cwd,...args){return exec("git",args,{cwd});}

async function fixture(){
  const cwd=await mkdtemp(tmpdir()+"/ourself-v07-runtime-");
  await git(cwd,"init","-q");
  await git(cwd,"config","user.email","ourself@example.invalid");
  await git(cwd,"config","user.name","OURSELF v0.7 runtime witness");
  await writeFile(cwd+"/state.txt","C1\n");
  await git(cwd,"add","state.txt");
  await git(cwd,"commit","-q","-m","C1");
  const c1=(await git(cwd,"rev-parse","HEAD")).stdout.trim();
  await writeFile(cwd+"/state.txt","C2\n");
  await git(cwd,"add","state.txt");
  await git(cwd,"commit","-q","-m","C2");
  const c2=(await git(cwd,"rev-parse","HEAD")).stdout.trim();
  await git(cwd,"branch","cpu",c1);
  return {cwd,c1,c2,ref:"refs/heads/cpu"};
}

test("v0.7 closes the real UPDATE_REF loop with verified Git read-back",async()=>{
  const f=await fixture();
  try{
    const machine=bootstrapMachineState(f.c1);
    const result=await runVerifiedContinuation({
      observedState:{surface:"cpu",ref:f.ref,commit:f.c1},
      desiredState:{surface:"cpu",ref:f.ref,commit:f.c2},
      authorityContext:{jurisdiction:"repository",capabilities:["UPDATE_REF"],constraints:["bounded"],termination:["realized","failure","authority"]},
      capabilityContext:{capabilities:["UPDATE_REF"]},
      mutation:{operation:"UPDATE_REF",authority:"repository",capability:"UPDATE_REF",target:"cpu",requestedPostCommit:f.c2},
      admitProposal:async({proposal})=>{
        const transitionProposal=proposeTransition({
          machine,from:"input",to:"cpu",operation:"UPDATE_REF",
          authorized:true,bounded:true,
          metadata:{continuationProposalId:proposal.proposalId}
        });
        if(transitionProposal.admission!=="ADMITTED") return {status:"REJECTED",reason:"TRANSITION_REJECTED"};
        const transition=executeTransition({
          machine,proposal:transitionProposal,targetCommit:f.c2,
          causalBinding:{proposalId:proposal.proposalId}
        });
        const request=createActuationRequest({
          transitionReceipt:transition.receipt,
          targetSurface:"cpu",
          expectedPreRef:f.ref,
          expectedPreCommit:f.c1,
          requestedPostCommit:f.c2
        });
        const admission=evaluateActuatorAdmission({
          request,machine,transition,authorized:true,bounded:true
        });
        return Object.freeze({...admission,request});
      },
      executeProposal:async({admission})=>{
        return executeActuation({
          actuatorAdmission:admission,
          adapter:createGitCliAdapter({cwd:f.cwd})
        });
      }
    });

    assert.equal(result.status,"DESIRED_STATE_REALIZED");
    assert.equal(result.cycles.length,1);
    const cycle=result.cycles[0];
    assert.equal(cycle.admission.status,"ACTUATOR_ADMITTED");
    assert.equal(cycle.execution.status,"ACTUATOR_EXECUTED");
    assert.equal(cycle.execution.actualState.ref,f.ref);
    assert.equal(cycle.execution.actualState.commit,f.c2);
    assert.equal(cycle.execution.receipt.readback.verified,true);
    assert.match(cycle.execution.receipt.receiptHash,/^[0-9a-f]{64}$/);
    assert.equal((await git(f.cwd,"rev-parse",f.ref)).stdout.trim(),f.c2);
  }finally{
    await rm(f.cwd,{recursive:true,force:true});
  }
});
