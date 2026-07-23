// ============================================================
// AIDiffView — word-level diff (no deps), inline preview
// Green = added, red strikethrough = removed, muted = unchanged
// ============================================================
import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

type DiffOp = { type: "eq" | "add" | "del"; value: string };

function tokenize(s: string): string[] {
  // Split on whitespace, keeping the whitespace as its own tokens so we can rebuild
  return s.match(/\s+|\S+/g) || [];
}

// Classic LCS-based word diff. Fine for typical block sizes.
function diffWords(a: string, b: string): DiffOp[] {
  const A = tokenize(a);
  const B = tokenize(b);
  const n = A.length, m = B.length;
  // Build LCS table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { ops.push({ type: "eq", value: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: "del", value: A[i] }); i++; }
    else { ops.push({ type: "add", value: B[j] }); j++; }
  }
  while (i < n) { ops.push({ type: "del", value: A[i++] }); }
  while (j < m) { ops.push({ type: "add", value: B[j++] }); }
  return ops;
}

interface Props {
  original: string;
  next: string;
  className?: string;
}

export const AIDiffView: React.FC<Props> = ({ original, next, className }) => {
  const ops = useMemo(() => diffWords(original || "", next || ""), [original, next]);

  return (
    <div className={cn("text-[14px] leading-relaxed whitespace-pre-wrap break-words", className)}>
      {ops.map((op, idx) => {
        if (op.type === "eq") {
          return <span key={idx} className="text-gray-600">{op.value}</span>;
        }
        if (op.type === "add") {
          return (
            <span key={idx} className="bg-emerald-100 text-emerald-900 rounded-sm px-0.5">
              {op.value}
            </span>
          );
        }
        return (
          <span key={idx} className="bg-red-100 text-red-800 line-through rounded-sm px-0.5">
            {op.value}
          </span>
        );
      })}
    </div>
  );
};

export default AIDiffView;
