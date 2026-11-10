import { describe, expect, it } from 'vitest';
import { evaluateFormula } from '@/components/database/FormulaEngine';
import { evaluateSafeExpression } from '@/lib/safeExpression';

describe('safe formula evaluation', () => {
  it('evaluates arithmetic, comparisons, and documented formula functions', () => {
    expect(evaluateFormula('Score * 2 + 3', { Score: 4 })).toBe(11);
    expect(evaluateFormula('if(Score >= 50, "Pass", "Retry")', { Score: 75 })).toBe('Pass');
    expect(evaluateFormula('concat(First, " ", Last)', { First: 'Nik', Last: 'Note' })).toBe('Nik Note');
    expect(evaluateFormula('round(3.14159, 2)', {})).toBe(3.14);
  });

  it('supports arithmetic exponentiation without dynamic code evaluation', () => {
    expect(evaluateSafeExpression('3 ** 2 ** 2')).toBe(81);
    expect(evaluateSafeExpression('(2 + 1) ** 3')).toBe(27);
    expect(() => evaluateSafeExpression('0 ** -1')).toThrow();
  });

  it('resolves only own, safe input properties for workflow conditions', () => {
    expect(evaluateSafeExpression('inputs.score >= 80 && inputs.passed', {
      inputs: { score: 85, passed: true },
    })).toBe(true);
    expect(() => evaluateSafeExpression('inputs.constructor.constructor', { inputs: {} })).toThrow();
    expect(() => evaluateSafeExpression('inputs.missing.value', { inputs: {} })).toThrow();
  });

  it('treats malicious property text as data and never evaluates JavaScript', () => {
    const payload = 'x"; globalThis.__niknoteFormulaPwned = true; //';
    expect(evaluateFormula('concat(Name, "!")', { Name: payload })).toBe(`${payload}!`);
    expect(evaluateFormula('globalThis.__niknoteFormulaPwned = true', { Name: payload })).toBe('Error');
    const globalWithFormulaProbe = globalThis as typeof globalThis & { __niknoteFormulaPwned?: boolean };
    expect(globalWithFormulaProbe.__niknoteFormulaPwned).toBeUndefined();
  });

  it('fails closed for unsupported syntax, unknown functions, and division by zero', () => {
    expect(evaluateFormula('rollup(Tasks, Status, "count")', {})).toBe('Error');
    expect(evaluateFormula('1 / 0', {})).toBe('Error');
    expect(evaluateFormula('1; alert(1)', {})).toBe('Error');
  });
});
