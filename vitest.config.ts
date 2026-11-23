import { defineConfig, defineProject } from "vitest/config";

const sharedExclude = ["**/node_modules/**", "**/dist/**", "e2e/**"];

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "small",
          include: ["**/*.small.test.ts"],
          environment: "node",
          exclude: sharedExclude,
        },
      }),
      defineProject({
        test: {
          name: "medium",
          include: ["**/*.medium.test.ts"],
          environment: "node",
          exclude: sharedExclude,
        },
      }),
      defineProject({
        test: {
          name: "large",
          include: ["src/**/*.large.test.ts"],
          environment: "node",
          exclude: sharedExclude,
          testTimeout: 120_000,
        },
      }),
    ],
  },
});
