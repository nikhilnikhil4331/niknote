import { describe, expect, it } from 'vitest';
import { WorkflowEngine, type Workflow } from '@/services/workflow/WorkflowEngine';

describe('workflow JavaScript sandbox boundary', () => {
  it('fails the workflow explicitly without evaluating saved JavaScript code', async () => {
    const workflow: Workflow = {
      id: 'security-test',
      name: 'Unsafe code node',
      description: 'Regression test for custom JavaScript execution',
      nodes: [
        {
          id: 'start',
          type: 'start',
          position: { x: 0, y: 0 },
          data: { label: 'Start', config: {} },
          connections: { inputs: [], outputs: ['code'] },
        },
        {
          id: 'code',
          type: 'code',
          position: { x: 1, y: 0 },
          data: { label: 'Custom JavaScript', config: { code: 'globalThis.__niknoteWorkflowPwned = true;' } },
          connections: { inputs: ['start'], outputs: [] },
        },
      ],
      variables: [],
      createdAt: 0,
      updatedAt: 0,
      version: 1,
      status: 'draft',
      executionCount: 0,
    };

    const result = await new WorkflowEngine().execute(workflow);
    const globalWithProbe = globalThis as typeof globalThis & { __niknoteWorkflowPwned?: boolean };
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/disabled for security/i);
    expect(globalWithProbe.__niknoteWorkflowPwned).toBeUndefined();
  });
});
