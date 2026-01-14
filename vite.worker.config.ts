import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig(({ isSsrBuild }) => {
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
    },
    ssr: {
      target: "webworker",
      noExternal: true,
      resolve: {
        conditions: ["workerd", "worker", "browser"],
        externalConditions: ["workerd", "worker"],
      },
    },
  };
});
