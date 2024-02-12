import { PluginOption, defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { nodeExternals } from "rollup-plugin-node-externals";

// vite.config.js
import { resolve } from "path";

function externals(): PluginOption {
  return {
    ...nodeExternals(),
    name: "node-externals",
    enforce: "pre",
    apply: "build",
  };
}

export default defineConfig({
  plugins: [
    externals(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "HTTPResponseHelpers",
      formats: ["es", "umd"],
      fileName: "index",
    },
  },
});
