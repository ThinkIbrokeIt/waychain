// Unit tests for the shared Verify Ladder primitive (issue #111).
// Run: node dapps/_shared/verify-ladder.test.mjs
import { VerifyLadder, STEP_KIND } from './verify-ladder.js';

let pass = 0, failc = 0;
const ok = (m) => { console.log('  ✓ ' + m); pass++; };
const fail = (m) => { console.log('  ✗ ' + m); failc++; };

console.log('Verify Ladder primitive — shared verification/task state');

// 1. objective steps are auto-verifiable; subjective are not.
if (VerifyLadder.isAutoVerifiable(STEP_KIND.OBJECTIVE)) ok('objective step is auto-verifiable'); else fail('objective should be auto-verifiable');
if (!VerifyLadder.isAutoVerifiable(STEP_KIND.SIGNOFF)) ok('signoff (subjective) is NOT auto-verifiable'); else fail('signoff must not be auto-verifiable');
if (!VerifyLadder.isAutoVerifiable(STEP_KIND.ATTESTATION)) ok('attestation requires signed attestation, not autopilot'); else fail('attestation must not be autopilot');

// 2. createTask + verify objective step + complete detection.
const task = VerifyLadder.createTask('deploy-btc-observer', 'Deploy BTC observer oracle', [
  { id: 'hash-check', kind: STEP_KIND.OBJECTIVE, label: 'On-chain hash matches' },
  { id: 'oracle-sig', kind: STEP_KIND.ATTESTATION, label: 'Oracle attests funding' },
  { id: 'curator-sign', kind: STEP_KIND.SIGNOFF, label: 'L3 curator sign-off' },
]);
if (!VerifyLadder.isComplete(task)) ok('task starts incomplete'); else fail('new task should be incomplete');

// autopilot can verify the objective step
VerifyLadder.verifyStep(task, 'hash-check', 'autopilot');
if (task.steps[0].verified && task.steps[0].verifier === 'autopilot') ok('objective step auto-verified by autopilot'); else fail('objective step not auto-verified');

// subjective step CANNOT be auto-verified (enforces founder rule)
let threw = false;
try { VerifyLadder.verifyStep(task, 'curator-sign', 'autopilot'); } catch { threw = true; }
if (threw) ok('subjective step rejects autopilot verify (founder rule enforced)'); else fail('subjective step must reject autopilot');

// human/oracle can verify subjective steps
VerifyLadder.verifyStep(task, 'oracle-sig', '0x' + 'ab'.repeat(32));
VerifyLadder.verifyStep(task, 'curator-sign', '0x' + 'cd'.repeat(20));
if (VerifyLadder.isComplete(task)) ok('task complete after all steps verified'); else fail('task should be complete');

// 3. progress math
const t2 = VerifyLadder.createTask('x', 'x', [
  { id: 'a', kind: STEP_KIND.OBJECTIVE }, { id: 'b', kind: STEP_KIND.SIGNOFF },
]);
VerifyLadder.verifyStep(t2, 'a', 'autopilot');
if (Math.abs(VerifyLadder.progress(t2) - 0.5) < 1e-9) ok('progress = 0.5 after 1/2 steps'); else fail('progress wrong: ' + VerifyLadder.progress(t2));

// 4. ladder mapping
if (VerifyLadder.ladderFromTasks({ verifiedHuman: true }) === '1') ok('verified human -> L1'); else fail('L1 mapping wrong');
if (VerifyLadder.ladderFromTasks({ professional: true }) === '2') ok('professional -> L2'); else fail('L2 mapping wrong');
if (VerifyLadder.ladderFromTasks({ governed: true }) === '3t/3p') ok('governed -> 3p/3t'); else fail('L3 mapping wrong');

if (failc === 0) { console.log(`\nPASSED: Verify Ladder primitive holds`); process.exit(0); }
else { console.log(`\nFAILED: ${failc} check(s) failed`); process.exit(1); }
