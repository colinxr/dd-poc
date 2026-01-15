import { reactRouter } from "@react-router/dev/vite";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [reactRouter(), tsconfigPaths()],
  server: {
    allowedHosts: true,
    port: Number(process.env.PORT || 3000),
    hmr: {
      port: 1025,
    },
  },
}) satisfies UserConfig;
