type ExpressionValue = unknown;

type Token = {
  kind: 'number' | 'string' | 'identifier' | 'operator' | 'punctuation';
  value: string;
};

const FORBIDDEN_PATH_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const OPERATORS = ['===', '!==', '**', '>=', '<=', '==', '!=', '&&', '||', '??', '+', '-', '*', '/', '%', '>', '<', '!'];
const PRECEDENCE: Record<string, number> = {
  '||': 1,
  '??': 1,
  '&&': 2,
  '==': 3,
  '===': 3,
  '!=': 3,
  '!==': 3,
  '>': 4,
  '>=': 4,
  '<': 4,
  '<=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
  '**': 7,
};

function tokenize(source: string): Token[] {
  if (source.length > 512) throw new Error('Formula is too long');
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }

    const number = /^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(source.slice(index));
    if (number) {
      tokens.push({ kind: 'number', value: number[0] });
      index += number[0].length;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      index++;
      let value = '';
      let closed = false;
      while (index < source.length) {
        const current = source[index++];
        if (current === quote) {
          closed = true;
          break;
        }
        if (current === '\\') {
          if (index >= source.length) throw new Error('Invalid string escape');
          const escaped = source[index++];
          const escapes: Record<string, string> = {
            n: '\n',
            r: '\r',
            t: '\t',
            '\\': '\\',
            '"': '"',
            "'": "'",
          };
          value += escapes[escaped] ?? escaped;
        } else {
          value += current;
        }
      }
      if (!closed) throw new Error('Unclosed string');
      tokens.push({ kind: 'string', value });
      continue;
    }

    const identifier = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(index));
    if (identifier) {
      tokens.push({ kind: 'identifier', value: identifier[0] });
      index += identifier[0].length;
      continue;
    }

    const operator = OPERATORS.find((candidate) => source.startsWith(candidate, index));
    if (operator) {
      tokens.push({ kind: 'operator', value: operator });
      index += operator.length;
      continue;
    }

    if ('(),.'.includes(char)) {
      tokens.push({ kind: 'punctuation', value: char });
      index++;
      continue;
    }

    throw new Error('Unsupported formula syntax');
  }

  if (tokens.length > 256) throw new Error('Formula has too many parts');
  return tokens;
}

function toNumber(value: ExpressionValue): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  throw new Error('Expected a finite number');
}

function toDate(value: ExpressionValue): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value ?? ''));
  if (!Number.isFinite(date.getTime())) throw new Error('Expected a valid date');
  return date;
}

function ownPathValue(context: Record<string, unknown>, path: string[]): ExpressionValue {
  let value: unknown = context;
  for (const part of path) {
    if (FORBIDDEN_PATH_SEGMENTS.has(part) || value === null || typeof value !== 'object') {
      throw new Error('Unknown property');
    }
    if (!Object.prototype.hasOwnProperty.call(value, part)) throw new Error('Unknown property');
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function callSafeFunction(name: string, args: ExpressionValue[]): ExpressionValue {
  const lowerName = name.toLowerCase();
  const values = (value: ExpressionValue) => (Array.isArray(value) ? value : [value]);
  const numericValues = (value: ExpressionValue) => values(value).map(toNumber);

  switch (lowerName) {
    case 'abs':
      return Math.abs(toNumber(args[0]));
    case 'round': {
      const places = Math.max(0, Math.min(8, Math.trunc(args[1] === undefined ? 0 : toNumber(args[1]))));
      const factor = 10 ** places;
      return Math.round(toNumber(args[0]) * factor) / factor;
    }
    case 'ceil':
      return Math.ceil(toNumber(args[0]));
    case 'floor':
      return Math.floor(toNumber(args[0]));
    case 'sum':
      return numericValues(args[0]).reduce((total, value) => total + value, 0);
    case 'avg': {
      const numbers = numericValues(args[0]);
      return numbers.length ? numbers.reduce((total, value) => total + value, 0) / numbers.length : 0;
    }
    case 'min':
      return Math.min(...numericValues(args[0]));
    case 'max':
      return Math.max(...numericValues(args[0]));
    case 'count':
      return Array.isArray(args[0]) ? args[0].length : args[0] == null ? 0 : 1;
    case 'concat':
      return args.map((value) => (value == null ? '' : String(value))).join('');
    case 'upper':
      return String(args[0] ?? '').toUpperCase();
    case 'lower':
      return String(args[0] ?? '').toLowerCase();
    case 'length':
      return String(args[0] ?? '').length;
    case 'contains':
      return Array.isArray(args[0])
        ? args[0].includes(args[1])
        : String(args[0] ?? '').includes(String(args[1] ?? ''));
    case 'if':
      if (args.length !== 3) throw new Error('if expects three arguments');
      return args[0] ? args[1] : args[2];
    case 'and':
      return args.every(Boolean);
    case 'or':
      return args.some(Boolean);
    case 'not':
      return !args[0];
    case 'now':
      return new Date().toISOString();
    case 'dateadd': {
      const date = toDate(args[0]);
      date.setUTCDate(date.getUTCDate() + Math.trunc(toNumber(args[1])));
      return date.toISOString();
    }
    case 'datediff':
      return Math.trunc((toDate(args[1]).getTime() - toDate(args[0]).getTime()) / 86_400_000);
    case 'formatdate': {
      const date = toDate(args[0]);
      const pad = (part: number) => String(part).padStart(2, '0');
      return String(args[1] ?? 'YYYY-MM-DD')
        .replace(/YYYY/g, String(date.getUTCFullYear()))
        .replace(/MM/g, pad(date.getUTCMonth() + 1))
        .replace(/DD/g, pad(date.getUTCDate()));
    }
    default:
      throw new Error('Unsupported formula function');
  }
}

function applyOperator(operator: string, left: ExpressionValue, right: ExpressionValue): ExpressionValue {
  switch (operator) {
    case '||':
      return Boolean(left || right);
    case '??':
      return left ?? right;
    case '&&':
      return Boolean(left && right);
    case '==':
    case '===':
      return left === right;
    case '!=':
    case '!==':
      return left !== right;
    case '>':
      return typeof left === 'string' && typeof right === 'string' ? left > right : toNumber(left) > toNumber(right);
    case '>=':
      return typeof left === 'string' && typeof right === 'string' ? left >= right : toNumber(left) >= toNumber(right);
    case '<':
      return typeof left === 'string' && typeof right === 'string' ? left < right : toNumber(left) < toNumber(right);
    case '<=':
      return typeof left === 'string' && typeof right === 'string' ? left <= right : toNumber(left) <= toNumber(right);
    case '+':
      return typeof left === 'string' || typeof right === 'string'
        ? String(left ?? '') + String(right ?? '')
        : toNumber(left) + toNumber(right);
    case '-':
      return toNumber(left) - toNumber(right);
    case '*':
      return toNumber(left) * toNumber(right);
    case '**':
      return toNumber(left) ** toNumber(right);
    case '/': {
      const divisor = toNumber(right);
      if (divisor === 0) throw new Error('Division by zero');
      return toNumber(left) / divisor;
    }
    case '%': {
      const divisor = toNumber(right);
      if (divisor === 0) throw new Error('Division by zero');
      return toNumber(left) % divisor;
    }
    default:
      throw new Error('Unsupported operator');
  }
}

/** Evaluate a deliberately small, side-effect-free expression language. */
export function evaluateSafeExpression(
  source: string,
  context: Record<string, unknown> = {}
): ExpressionValue {
  const tokens = tokenize(source);
  if (!tokens.length) throw new Error('Formula is empty');
  let position = 0;

  const peek = () => tokens[position];
  const consume = () => tokens[position++];
  const expect = (value: string) => {
    const token = consume();
    if (!token || token.value !== value) throw new Error(`Expected ${value}`);
  };

  const parseExpression = (minimumPrecedence = 0): ExpressionValue => {
    let left = parseUnary();
    while (peek()?.kind === 'operator' && (PRECEDENCE[peek().value] ?? -1) >= minimumPrecedence) {
      const operator = consume().value;
      const precedence = PRECEDENCE[operator];
      const right = parseExpression(precedence + (operator === '**' ? 0 : 1));
      left = applyOperator(operator, left, right);
      if (typeof left === 'number' && !Number.isFinite(left)) throw new Error('Formula result is not finite');
    }
    return left;
  };

  const parseUnary = (): ExpressionValue => {
    if (peek()?.kind === 'operator' && ['!', '+', '-'].includes(peek().value)) {
      const operator = consume().value;
      const value = parseUnary();
      if (operator === '!') return !value;
      return operator === '+' ? toNumber(value) : -toNumber(value);
    }
    return parsePrimary();
  };

  const parsePrimary = (): ExpressionValue => {
    const token = consume();
    if (!token) throw new Error('Unexpected end of formula');
    if (token.kind === 'number') return Number(token.value);
    if (token.kind === 'string') return token.value;

    if (token.kind === 'punctuation' && token.value === '(') {
      const value = parseExpression();
      expect(')');
      return value;
    }

    if (token.kind !== 'identifier') throw new Error('Expected a value');
    const identifier = token.value;
    if (identifier === 'true') return true;
    if (identifier === 'false') return false;
    if (identifier === 'null') return null;

    if (peek()?.kind === 'punctuation' && peek().value === '(') {
      consume();
      const args: ExpressionValue[] = [];
      if (!(peek()?.kind === 'punctuation' && peek().value === ')')) {
        args.push(parseExpression());
        while (peek()?.kind === 'punctuation' && peek().value === ',') {
          consume();
          args.push(parseExpression());
        }
      }
      expect(')');
      return callSafeFunction(identifier, args);
    }

    const path = [identifier];
    while (peek()?.kind === 'punctuation' && peek().value === '.') {
      consume();
      const next = consume();
      if (!next || next.kind !== 'identifier') throw new Error('Invalid property path');
      path.push(next.value);
    }
    return ownPathValue(context, path);
  };

  const value = parseExpression();
  if (position !== tokens.length) throw new Error('Unexpected formula content');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Formula result is not finite');
  return value;
}
