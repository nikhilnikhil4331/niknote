import { useCallback, useEffect, useRef, useState } from "react";
import { streamAstaAI } from "@/lib/aiEngine";

export type AIAction =
  | "improve"
  | "fix_grammar"
  | "shorten"
  | "lengthen"
  | "continue"
  | "translate"
  | "summarize"
  | "explain"
  | "custom";

export interface AIStreamRequest {
  action: AIAction;
  text: string;
  context?: string;
  targetLanguage?: string;
  instruction?: string;
}

export type AIStreamStatus = "idle" | "streaming" | "done" | "error";

export function useAIStream() {
  const [status, setStatus] = useState<AIStreamStatus>("idle");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const frameRef = useRef<number | null>(null);
  const latestRef = useRef("");

  const flush = useCallback(() => {
    frameRef.current = null;
    setOutput(latestRef.current);
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    setStatus((current) => (current === "streaming" ? "idle" : current));
  }, []);

  const reset = useCallback(() => {
    cancel();
    latestRef.current = "";
    setOutput("");
    setError(null);
    setStatus("idle");
  }, [cancel]);

  useEffect(() => cancel, [cancel]);

  const run = useCallback(async (request: AIStreamRequest) => {
    cancel();
    latestRef.current = "";
    setOutput("");
    setError(null);
    setStatus("streaming");

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const mode = request.action === "explain" ? "teacher" : request.action === "custom" ? "auto" : "write";
      const result = await streamAstaAI({
        messages: [{ role: "user", content: request.text }],
        mode,
        noteContext: request.context,
        action: request.action,
        targetLanguage: request.targetLanguage,
        instruction: request.instruction,
        signal: controller.signal,
        onToken: (_delta, fullText) => {
          latestRef.current = fullText;
          if (frameRef.current === null) {
            frameRef.current = requestAnimationFrame(flush);
          }
        },
      });

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      latestRef.current = result.content;
      setOutput(result.content);
      setStatus("done");
    } catch (caught: any) {
      if (controller.signal.aborted || caught?.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Could not reach AI. Please try again.");
      setStatus("error");
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, [cancel, flush]);

  return { status, output, error, run, cancel, reset };
}
