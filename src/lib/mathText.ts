// ============================================================
// mathText — turn the LaTeX that models emit into readable maths.
//
// The notes renderer has no TeX engine (and we are not adding a
// heavy dependency for a handful of school formulas), so equations
// are normalised into real Unicode maths: fractions, roots,
// exponents, subscripts, Greek letters and operators. Unsupported
// commands are degraded to readable text instead of leaking raw
// backslashes into the page.
// ============================================================

const GREEK: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ',
  mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ',
  upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ',
  Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
};

const SYMBOLS: Record<string, string> = {
  times: '×', div: '÷', cdot: '·', pm: '±', mp: '∓', ast: '∗', star: '⋆',
  le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', equiv: '≡',
  sim: '∼', simeq: '≃', propto: '∝', lt: '<', gt: '>', ll: '≪', gg: '≫',
  infty: '∞', partial: '∂', nabla: '∇', forall: '∀', exists: '∃', nexists: '∄',
  in: '∈', notin: '∉', ni: '∋', subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇',
  cup: '∪', cap: '∩', emptyset: '∅', varnothing: '∅',
  therefore: '∴', because: '∵', angle: '∠', perp: '⊥', parallel: '∥', circ: '∘',
  degree: '°', prime: '′', ldots: '…', dots: '…', cdots: '⋯', vdots: '⋮',
  to: '→', rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', Rightarrow: '⇒',
  Leftarrow: '⇐', Leftrightarrow: '⇔', mapsto: '↦', implies: '⇒', iff: '⇔',
  int: '∫', iint: '∬', iiint: '∭', oint: '∮', sum: '∑', prod: '∏', coprod: '∐',
  sqrt: '√', quad: ' ', qquad: '  ', ',' : ' ', ';': ' ', ':': ' ', '!': '',
  left: '', right: '', displaystyle: '', limits: '', mathrm: '', mathbf: '', text: '',
  ln: 'ln', log: 'log', sin: 'sin', cos: 'cos', tan: 'tan', sec: 'sec', csc: 'csc',
  cot: 'cot', arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan', sinh: 'sinh',
  cosh: 'cosh', tanh: 'tanh', lim: 'lim', max: 'max', min: 'min', exp: 'exp', det: 'det',
};

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷',
  '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  n: 'ⁿ', i: 'ⁱ', x: 'ˣ', y: 'ʸ', a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', k: 'ᵏ',
  m: 'ᵐ', p: 'ᵖ', t: 'ᵗ', '°': '°', '′': '′',
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇',
  '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ',
  p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
};

function mapChars(value: string, table: Record<string, string>): string | null {
  let out = '';
  for (const ch of value) {
    const mapped = table[ch];
    if (!mapped) return null;
    out += mapped;
  }
  return out;
}

/** Read a balanced `{...}` group starting at `start` (index of '{'). */
function readGroup(src: string, start: number): { body: string; end: number } | null {
  if (src[start] !== '{') return null;
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return { body: src.slice(start + 1, i), end: i + 1 };
    }
  }
  return null;
}

function readArgument(src: string, start: number): { body: string; end: number } {
  if (src[start] === '{') return readGroup(src, start) ?? { body: '', end: start };
  if (src[start] === '\\') {
    const m = /^\\[a-zA-Z]+/.exec(src.slice(start));
    if (m) return { body: m[0], end: start + m[0].length };
  }
  return { body: src.slice(start, start + 1), end: start + 1 };
}

/** Recursively resolve \frac, \sqrt, exponents and symbol commands. */
function normalise(src: string, depth = 0): string {
  if (depth > 8) return src;
  let out = '';
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    if (ch === '\\') {
      const cmdMatch = /^\\([a-zA-Z]+|.)/.exec(src.slice(i));
      if (!cmdMatch) { i++; continue; }
      const name = cmdMatch[1];
      let consumed = i + cmdMatch[0].length;

      if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
        const a = readArgument(src, consumed);
        const b = readArgument(src, a.end);
        const num = normalise(a.body, depth + 1).trim();
        const den = normalise(b.body, depth + 1).trim();
        const simple = /^[\w.]+$/.test(num) && /^[\w.]+$/.test(den);
        out += simple ? `${num}/${den}` : `(${num}) / (${den})`;
        i = b.end;
        continue;
      }

      if (name === 'sqrt') {
        let index = '';
        if (src[consumed] === '[') {
          const close = src.indexOf(']', consumed);
          if (close !== -1) {
            index = normalise(src.slice(consumed + 1, close), depth + 1).trim();
            consumed = close + 1;
          }
        }
        const arg = readArgument(src, consumed);
        const body = normalise(arg.body, depth + 1).trim();
        const prefix = index ? (mapChars(index, SUPERSCRIPTS) ?? `${index}`) : '';
        out += `${prefix}√(${body})`;
        i = arg.end;
        continue;
      }

      if (name === 'vec' || name === 'bar' || name === 'hat') {
        const arg = readArgument(src, consumed);
        const body = normalise(arg.body, depth + 1).trim();
        const mark = name === 'vec' ? '\u20D7' : name === 'bar' ? '\u0304' : '\u0302';
        out += name === 'vec' ? `${body}${mark}` : `${body}${mark}`;
        i = arg.end;
        continue;
      }

      if (GREEK[name]) { out += GREEK[name]; i = consumed; continue; }
      if (SYMBOLS[name] !== undefined) { out += SYMBOLS[name]; i = consumed; continue; }

      // Unknown command: keep a readable word instead of a backslash.
      if (name.length > 1) { out += ''; i = consumed; continue; }
      out += name;
      i = consumed;
      continue;
    }

    if (ch === '^' || ch === '_') {
      const arg = readArgument(src, i + 1);
      const raw = normalise(arg.body, depth + 1).trim();
      if (ch === '^') out += mapChars(raw, SUPERSCRIPTS) ?? `^(${raw})`;
      else out += mapChars(raw, SUBSCRIPTS) ?? `_(${raw})`;
      i = arg.end;
      continue;
    }

    if (ch === '{') {
      const group = readGroup(src, i);
      if (group) {
        out += normalise(group.body, depth + 1);
        i = group.end;
        continue;
      }
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Convert a LaTeX-ish string into readable Unicode maths.
 * Returns plain text when the input has no TeX at all.
 */
export function latexToText(input: string): string {
  if (!input) return '';
  let src = String(input)
    .replace(/^\\[[]/, '')
    .replace(/\\]$/, '')
    .replace(/\$\$/g, '')
    .replace(/(?<!\\)\$/g, '')
    .replace(/\\\(|\\\)/g, '')
    .replace(/\\\[|\\\]/g, '')
    .replace(/\\\\/g, ' ');

  src = normalise(src);
  return src
    .replace(/\s*([+\-=<>±×÷≤≥≠≈])\s*/g, ' $1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/** True when a line is entirely mathematics. */
export function looksLikeMath(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^\$\$?.*\$\$?$/.test(t)) return true;
  if (/^\\\[.*\\\]$/.test(t) || /^\\\(.*\\\)$/.test(t)) return true;
  // A line that is mostly symbols/commands with no prose words.
  const words = t.replace(/\\[a-zA-Z]+/g, '').match(/[A-Za-z]{3,}/g) ?? [];
  const hasMath = /[=+\-^_\\∫∑√]/.test(t);
  return hasMath && words.length <= 2;
}
