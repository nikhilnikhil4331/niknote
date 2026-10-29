import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

function gscVerificationPlugin(verificationToken?: string): Plugin {
  const cleanToken = verificationToken?.trim();
  return {
    name: "niknote-gsc-verification",
    transformIndexHtml(html) {
      if (!cleanToken || cleanToken.includes("REPLACE_WITH")) {
        return html;
      }
      const safeToken = cleanToken.replace(/["<>]/g, "");
      return html.replace(
        "</head>",
        `  <meta name="google-site-verification" content="${safeToken}" />\n</head>`,
      );
    },
  };
}

function niknoteLocalAIPlugin(): Plugin {
  const attach = (middlewares: any) => {
    middlewares.use("/api/ai", async (req: any, res: any) => {
      try {
        const mod = await import("./api/ai");
        const handler = mod.default;
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const bodyBuf = Buffer.concat(chunks);
        // Keep the query string (?probe=1 etc.) — connect strips the mount path
        // from req.url, so prefer originalUrl when it exists.
        const pathWithQuery = req.originalUrl || `/api/ai${req.url || ""}`;
        const url = `http://${req.headers.host || "localhost"}${pathWithQuery}`;
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) {
          if (typeof v === "string") headers.set(k, v);
          else if (Array.isArray(v)) headers.set(k, v.join(", "));
        }
        const controller = new AbortController();
        res.on("close", () => controller.abort());

        const webReq = new Request(url, {
          method: req.method || "GET",
          headers,
          body: req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS" ? undefined : bodyBuf,
          signal: controller.signal,
        });

        const webRes = await handler(webReq);
        res.statusCode = webRes.status;
        webRes.headers.forEach((v, k) => res.setHeader(k, v));

        if (!webRes.body) {
          res.end();
          return;
        }
        const reader = webRes.body.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      } catch (err: any) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
        }
        res.end(JSON.stringify({ error: err?.message || "Internal AI error" }));
      }
    });
  };

  return {
    name: "niknote-local-ai-endpoint",
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}

// https://vitejs.org/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  // Only explicitly public settings are exposed by Vite. Provider secrets may
  // still have historical VITE_* names in the hosting environment; never
  // expose them, even if a client module accidentally reads import.meta.env.
  envPrefix: [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_GA_MEASUREMENT_ID',
    'VITE_META_PIXEL_ID',
    'VITE_GSC_VERIFICATION',
    'VITE_NIKAI_REMOTE_AI_URL',
  ],
  server: {
    host: "0.0.0.0",
    port: 8080,
    allowedHosts: true,
    cors: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: true as any,
  },
  plugins: [
    react(),
    niknoteLocalAIPlugin(),
    gscVerificationPlugin(env.VITE_GSC_VERIFICATION),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/lib/*.test.ts', 'node_modules/**'],
    css: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-popover', '@radix-ui/react-tabs'],
          'vendor-ui-extra': ['@radix-ui/react-tooltip', '@radix-ui/react-scroll-area', '@radix-ui/react-select', '@radix-ui/react-separator', '@radix-ui/react-switch'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-motion': ['framer-motion'],
          'vendor-pdf': ['jspdf', 'html2canvas'],
          'vendor-charts': ['recharts'],
          'vendor-markdown': ['react-markdown'],
          'vendor-form': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-date': ['date-fns', 'react-day-picker'],
          'vendor-canvas': ['fabric'],
          'vendor-cmdk': ['cmdk'],
        },
      },
    },
    target: 'es2020',
    minify: true,
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
  };
});
