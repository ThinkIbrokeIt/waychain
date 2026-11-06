// WayChain Verify Ladder — shared verification / task-tracking primitive (issue #111).
//
// Cross-cutting primitive consumed (NOT owned) by the DoxDev dApp (#106),
// Oracle dApp (#107), and the BIJO-approved dev-task flow (#110). It tracks
// objective verification steps, attestations, and sign-offs in a single place
// so each dApp references it instead of re-implementing ladder logic.
//
// Model (matches the live Dox_Dev ladder + TaskRegistry autopilot):
//   - A "task" has verification steps. Each step has a kind:
//       'objective'  — machine-verifiable (hash match, on-chain state). Auto-verifiable.
//       'attestation'— requires an oracle/Dox_Dev signed attestation (ed25519).
//       'signoff'    — requires a human L2+ sign-off (subjective).
//   - A task is COMPLETE when all steps are verified.
//   - Objective steps can be auto-verified (autopilot taskAutoVerify); subjective
//     steps stay human (founder 2026-07-17 directive: subjective -> human L2+).
//
// This module is pure logic (no DOM, no network) so it is unit-testable and
// importable by any dApp. It does NOT call the chain — callers wire the actual
// on-chain verify (TaskRegistry 0x23 taskVerify / OracleVerifier 0x0E).

export const STEP_KIND = { OBJECTIVE: 'objective', ATTESTATION: 'attestation', SIGNOFF: 'signoff' };

// Pure: does this step kind support autopilot auto-verify?
export function isAutoVerifiable(kind) {
  return kind === STEP_KIND.OBJECTIVE;
}

// Build a task descriptor from a list of step specs.
//   steps: [{ id, kind, label }]
export function createTask(id, title, steps) {
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('task needs >=1 step');
  return {
    id,
    title,
    steps: steps.map((s) => ({
      id: s.id,
      kind: s.kind,
      label: s.label || s.id,
      verified: false,
      verifier: null, // 'autopilot' | human address | oracle pubkey
    })),
  };
}

// Mark a step verified. `by` records who/what verified it.
// Throws if a subjective step is marked auto-verified (enforces founder rule).
export function verifyStep(task, stepId, by = 'autopilot') {
  const step = task.steps.find((s) => s.id === stepId);
  if (!step) throw new Error('unknown step ' + stepId);
  if (step.kind !== STEP_KIND.OBJECTIVE && by === 'autopilot') {
    throw new Error(`subjective step "${stepId}" (${step.kind}) cannot be auto-verified; requires human/oracle`);
  }
  step.verified = true;
  step.verifier = by;
  return task;
}

// Pure: is the whole task complete?
export function isComplete(task) {
  return task.steps.length > 0 && task.steps.every((s) => s.verified);
}

// Progress 0..1 across steps.
export function progress(task) {
  if (!task.steps.length) return 0;
  const done = task.steps.filter((s) => s.verified).length;
  return done / task.steps.length;
}

// Ladder level implied by a completed task set (mirrors Dox_Dev 0->1->2->3p/3t).
// Returns the highest reachable ladder tier given which task categories finished.
export function ladderFromTasks({ verifiedHuman = false, professional = false, governed = false, autopilot = false }) {
  if (autopilot || governed) return '3t/3p';
  if (professional) return '2';
  if (verifiedHuman) return '1';
  return '0';
}

export const VerifyLadder = {
  STEP_KIND, isAutoVerifiable, createTask, verifyStep, isComplete, progress, ladderFromTasks,
};
