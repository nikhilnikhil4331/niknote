// ============================================================
// useAIStream — client hook that streams text from the editor-ai edge function
// Mobile-friendly: plain text stream, incremental updates, cancellable.
// ============================================================
import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY) as string;

export function useAIStream() {
  const [state, setState] = useState<AIStreamState>({
    output: "",
    status: "idle",
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState({ output: "", status: "idle", error: null });
  }, [cancel]);

  const run = useCallback(async (req: AIStreamRequest) => {
    cancel();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ output: "", status: "streaming", error: null });

    try {
      // Attach the user's JWT if signed in; edge function will still work if unauthenticated.
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token || PUBLISHABLE_KEY;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/editor-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: PUBLISHABLE_KEY,
        },
        body: JSON.stringify(req),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        let msg = `AI request failed (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        setState({ output: "", status: "error", error: msg });
        return;
      }

      if (!res.body) {
        setState({ output: "", status: "error", error: "No response body" });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setState({ output: acc, status: "streaming", error: null });
      }
      setState({ output: acc, status: "done", error: null });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setState((s) => ({ ...s, status: "idle" }));
        return;
      }
      setState({
        output: "",
        status: "error",
        error: (err as Error).message || "Network error",
      });
    } finally {
      abortRef.current = null;
    }
  }, [cancel]);

  return { ...state, run, cancel, reset };
}
