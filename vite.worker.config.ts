import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig(({ isSsrBuild, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [reactRouter(), tsconfigPaths()],
    resolve: {
      mainFields: ["browser", "module", "main"],
      alias: [
        // Use regex to catch any reference to entry.server.tsx and redirect to worker version
        {
          find: /.*\/app\/entry\.server\.tsx$/,
          replacement: path.resolve(__dirname, "./app/entry.server.worker.tsx"),
        },
        // Same for shopify.server.ts to avoid Node adapter
        {
          find: /.*\/app\/shopify\.server\.ts$/,
          replacement: path.resolve(
            __dirname,
            "./app/shopify.server.worker.ts",
          ),
        },
        // Force @prisma/client to use the main entry point to allow the adapter to take over
        // This prevents it from pulling in the node-specific binary loader that triggers the "edge runtime" error check
        {
          find: "@prisma/client",
          replacement: path.resolve(
            __dirname,
            "node_modules/@prisma/client/index.js",
          ),
        },
        // Standard aliases
        {
          find: "~/entry.server",
          replacement: path.resolve(__dirname, "./app/entry.server.worker.tsx"),
        },
        {
          find: "~/shopify.server",
          replacement: path.resolve(
            __dirname,
            "./app/shopify.server.worker.ts",
          ),
        },
      ],
    },
    build: {
      target: "es2022",
      rollupOptions: isSsrBuild
        ? {
            input: "./app/entry.worker.ts",
            output: {
              entryFileNames: "worker.js",
            },
          }
        : undefined,
    },
    define: {
      "process.env.TARGET": JSON.stringify("worker"),
      // Shopify env vars come from Cloudflare secrets at runtime, not build time
    },
    ssr: {
      target: "webworker",
      noExternal: true,
      resolve: {
        conditions: ["workerd", "worker", "browser"],
        externalConditions: ["workerd", "worker"],
      },
      external: ["node:async_hooks"], // Explicitly externalize node built-ins
    },
    // Explicitly optimize @prisma/client for the worker build to avoid Node.js fallbacks
    optimizeDeps: {
      include: ["@prisma/client", "@prisma/adapter-d1"],
    },
  };
});
