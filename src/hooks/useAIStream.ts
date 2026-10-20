// ============================================================
// useAIStream — authenticated client for the Supabase editor-ai function.
// The function streams plain text and keeps provider secrets server-side.
// ============================================================
import { useCallback, useRef, useState } from "react";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
  supabase,
} from "@/integrations/supabase/client";

export type AIAction =
  | "improve" | "fix_grammar" | "shorten" | "lengthen"
  | "continue" | "translate" | "summarize" | "explain" | "custom";

export interface AIStreamRequest {
  action: AIAction;
  text: string;
  context?: string;
  targetLanguage?: string;
  instruction?: string;
}

export interface AIStreamState {
  output: string;
  status: "idle" | "streaming" | "done" | "error";
  error: string | null;
}

const initialState: AIStreamState = { output: "", status: "idle", error: null };

export function useAIStream() {
  const [state, setState] = useState<AIStreamState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState(initialState);
  }, [cancel]);

  const run = useCallback(async (request: AIStreamRequest) => {
    cancel();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ output: "", status: "streaming", error: null });

    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (sessionError || !accessToken) {
        setState({ output: "", status: "error", error: "Please sign in to use AI writing." });
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/editor-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        let message = `AI request failed (${response.status})`;
        try {
          const payload = await response.json();
          if (typeof payload?.error === "string") message = payload.error;
        } catch {
          // The gateway may return a non-JSON error body.
        }
        setState({ output: "", status: "error", error: message });
        return;
      }

      if (!response.body) {
        setState({ output: "", status: "error", error: "The AI service returned an empty response." });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let output = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        output += decoder.decode(value, { stream: true });
        setState({ output, status: "streaming", error: null });
      }
      output += decoder.decode();
      setState({ output, status: "done", error: null });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setState((current) => ({ ...current, status: "idle" }));
        return;
      }
      setState({
        output: "",
        status: "error",
        error: (error as Error).message || "Network error",
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [cancel]);

  return { ...state, run, cancel, reset };
}
