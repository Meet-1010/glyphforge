import { defineConfig } from "tsup"

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      forge: "src/forge/index.ts",
      catalog: "src/catalog/index.ts",
      presets: "src/presets.ts",
      codegen: "src/codegen/index.ts",
    },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    treeshake: true,
    sourcemap: true,
    target: "es2020",
    external: [
      "react",
      "react-dom",
      "three",
      "@react-three/fiber",
      "@react-three/drei",
      "@react-three/postprocessing",
      "postprocessing",
    ],
  },
  {
    entry: { cli: "src/cli/index.ts" },
    format: ["cjs"],
    dts: false,
    clean: false,
    sourcemap: false,
    target: "node18",
    banner: { js: "#!/usr/bin/env node" },
  },
])
