import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: [
    // Design-system docs first, so they head the sidebar.
    "../stories/**/*.mdx",
    "../stories/**/*.stories.@(ts|tsx)",
    "../components/**/*.stories.@(ts|tsx)",
    "../app/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-vitest"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  staticDirs: ["../public"],
  core: {
    disableTelemetry: true,
  },
};

export default config;
