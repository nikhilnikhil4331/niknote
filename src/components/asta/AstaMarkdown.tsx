import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Sparkles, Trophy } from 'lucide-react';

interface ParsedMCQ {
  number: string;
  question: string;
  options: { letter: string; text: string }[];
  answer: string;
  explanation: string;
}

function parseInteractiveQuiz(markdown: string): ParsedMCQ[] {
  const blocks = markdown.split(/(?=###\s*Q\d+[.:)\s])/i).filter((b) => /^###\s*Q\d+/i.test(b.trim()));
  if (blocks.length < 2) return [];

  const parsed: ParsedMCQ[] = [];
  for (const block of blocks) {
    const lines = block.trim().split('\n').map((l) => l.trim()).filter(Boolean);
    const header = lines[0]?.replace(/^###\s*/i, '') || '';
    const numMatch = header.match(/^Q(\d+)[.:)\s-]*(.*)$/i);
    if (!numMatch) continue;

    const options: { letter: string; text: string }[] = [];
    let answer = '';
    let explanation = '';

    for (const line of lines.slice(1)) {
      const opt = line.match(/^(?:[-*]\s*)?\*{0,2}([A-D])\*{0,2}[).:\s-]+\s*(.+)$/i);
      if (opt && !/^answer/i.test(line)) {
        options.push({ letter: opt[1].toUpperCase(), text: opt[2].trim() });
        continue;
      }
      const ans = line.match(/^\*{0,2}Answer\s*:?\*{0,2}\s*\(?([A-D])\)?/i);
      if (ans) {
        answer = ans[1].toUpperCase();
        continue;
      }
      const exp = line.match(/^\*{0,2}Explanation\s*:?\*{0,2}\s*(.+)$/i);
      if (exp) {
        explanation = exp[1].trim();
      }
    }

    if (options.length >= 2 && answer) {
      parsed.push({
        number: numMatch[1],
        question: numMatch[2].trim(),
        options,
        answer,
        explanation,
      });
    }
  }
  return parsed;
}

const CodeBlockView: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-3.5 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-800/90 bg-zinc-900/90 px-3.5 py-2 text-[11px] font-mono text-zinc-400">
        <span className="uppercase tracking-wider">{language || 'code / formula'}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-[28px] items-center gap-1.5 rounded-md px-2 py-1 text-zinc-300 transition-colors hover:bg-zinc-800 active:scale-95"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-[13px] leading-relaxed font-mono text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const InteractiveQuizDeck: React.FC<{ questions: ParsedMCQ[] }> = ({ questions }) => {
  const [selected, setSelected] = useState<Record<string, string>>({});

  const score = useMemo(
    () => questions.reduce((acc, q) => (selected[q.number] === q.answer ? acc + 1 : acc), 0),
    [questions, selected]
  );
  const answeredCount = Object.keys(selected).length;

  return (
    <div className="my-3 space-y-3.5">
      <div className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] px-3.5 py-2.5 text-xs font-medium text-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
          Interactive Practice Quiz ({questions.length} MCQs)
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 font-semibold shadow-2xs">
          <Trophy className="h-3.5 w-3.5 text-amber-500" />
          Score: {score} / {questions.length}
        </span>
      </div>

      {questions.map((q) => {
        const pick = selected[q.number];
        return (
          <div
            key={q.number}
            className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-2xs transition-colors"
          >
            <p className="mb-3 text-[14.5px] font-semibold leading-snug text-foreground">
              <span className="mr-1.5 text-indigo-500">Q{q.number}.</span>
              {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt) => {
                const isChosen = pick === opt.letter;
                const isRight = opt.letter === q.answer;
                let cls =
                  'border-border/70 bg-background hover:bg-muted/60 text-foreground';
                if (pick) {
                  if (isRight) {
                    cls = 'border-emerald-500/70 bg-emerald-500/10 text-foreground font-medium';
                  } else if (isChosen) {
                    cls = 'border-rose-500/70 bg-rose-500/10 text-foreground';
                  } else {
                    cls = 'border-border/40 bg-background/50 text-muted-foreground';
                  }
                }
                return (
                  <button
                    key={opt.letter}
                    type="button"
                    onClick={() => setSelected((prev) => ({ ...prev, [q.number]: opt.letter }))}
                    className={`flex w-full min-h-[44px] items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-[13.5px] transition-all active:scale-[0.99] ${cls}`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current/25 text-xs font-bold">
                      {opt.letter}
                    </span>
                    <span className="flex-1 leading-snug">{opt.text}</span>
                  </button>
                );
              })}
            </div>
            {pick && (
              <div className="mt-3 rounded-xl bg-muted/60 px-3.5 py-2.5 text-xs leading-relaxed text-foreground/90">
                <strong className={pick === q.answer ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {pick === q.answer ? '✓ Correct!' : `✗ Correct Answer: Option ${q.answer}`}
                </strong>
                {q.explanation ? ` — ${q.explanation}` : ''}
              </div>
            )}
          </div>
        );
      })}

      {answeredCount === questions.length && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-foreground">
          <span>Quiz completed! Final score: <strong>{score}/{questions.length}</strong></span>
          <button
            type="button"
            onClick={() => setSelected({})}
            className="rounded-lg bg-background px-3 py-1.5 font-semibold shadow-2xs hover:bg-muted"
          >
            Retry Quiz
          </button>
        </div>
      )}
    </div>
  );
};

export const AstaMarkdown: React.FC<{ content: string; isStreaming?: boolean }> = ({
  content,
  isStreaming = false,
}) => {
  const quizQuestions = useMemo(
    () => (isStreaming ? [] : parseInteractiveQuiz(content)),
    [content, isStreaming]
  );

  if (quizQuestions.length >= 2) {
    return <InteractiveQuizDeck questions={quizQuestions} />;
  }

  return (
    <div className="asta-prose text-[15px] leading-[1.7] text-foreground break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-4 mb-2.5 text-xl font-bold tracking-tight text-foreground first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 mb-2 text-[17px] font-bold tracking-tight text-foreground first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-1.5 text-[15.5px] font-semibold text-foreground first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3 last:mb-0 leading-[1.72]">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1.5 marker:text-indigo-500">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1.5 marker:font-semibold">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5 leading-[1.68]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 rounded-r-xl border-l-[3px] border-indigo-500 bg-indigo-500/[0.06] px-4 py-2.5 text-[14px] text-foreground/90">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-border/70" />,
          table: ({ children }) => (
            <div className="my-3.5 w-full overflow-x-auto rounded-xl border border-border/80">
              <table className="w-full min-w-[300px] border-collapse text-left text-[13.5px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/70 text-xs font-semibold uppercase tracking-wide">{children}</thead>,
          th: ({ children }) => <th className="border-b border-border px-3.5 py-2.5 font-semibold text-foreground">{children}</th>,
          td: ({ children }) => <td className="border-b border-border/50 px-3.5 py-2.5 align-top">{children}</td>,
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const text = String(children).replace(/\n$/, '');
            const isBlock = Boolean(match) || text.includes('\n');
            if (isBlock) {
              return <CodeBlockView language={match?.[1] || ''} code={text} />;
            }
            return (
              <code
                className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[13px] font-medium text-indigo-600 dark:text-indigo-300"
                {...props}
              >
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-indigo-600 underline underline-offset-2 dark:text-indigo-400"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-indigo-500 align-middle" />
      )}
    </div>
  );
};
