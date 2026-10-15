import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agentRoles, agentRolePrompt } from '../server/ai/prompts/agent-roles';
import { prompts } from '../server/ai/prompts';
import type { AiTask } from '../server/ai/contracts';

test('every registered AI task receives its own role, obligations and execution limits', () => {
  const tasks = Object.keys(prompts) as AiTask[];
  assert.deepEqual(Object.keys(agentRoles).sort(), [...tasks].sort());
  assert.equal(new Set(tasks.map((task) => agentRoles[task].role)).size, tasks.length);
  for (const task of tasks) {
    assert.ok(prompts[task].startsWith(agentRolePrompt(task)));
    for (const section of [
      'ROLE:',
      'SKILL:',
      'RESPONSIBILITY:',
      'TOOLS AND INPUT:',
      'OUTPUT:',
      'COMPLETION:',
      'FAILURE:',
      'PROHIBITED:',
    ])
      assert.ok(agentRolePrompt(task).includes(section), `${task} misses ${section}`);
    assert.ok(
      prompts[task].includes(
        'You have no browser, email, registration, payment or filesystem tools',
      ),
    );
  }
});

test('reviewers and legal analyst have distinct obligations rather than author self-approval', () => {
  assert.match(agentRoles.verification.responsibility, /original evidence/);
  assert.match(agentRoles.verification.failure, /Agreement between agents cannot resolve it/);
  assert.match(agentRoles.pro_review.prohibited, /average specialist probabilities/);
  assert.match(agentRoles.legal.failure, /empty hypothesis list/);
  assert.match(agentRoles.context.failure, /collection failure to not_found/);
});
