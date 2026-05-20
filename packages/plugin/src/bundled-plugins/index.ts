import type { BundledPluginPackage } from "../bundled-plugin-types";
import { createBundledPluginManifest } from "../bundled-plugin-types";

const demoManifest = createBundledPluginManifest({
  id: "openchamber.demo-plugin",
  name: "Demo Plugin",
  version: "0.1.0",
  description: "Example bundled plugin demonstrating UI slot and command registration",
  targets: ["ui", "server"],
  capabilities: ["ui.fill", "ui.command", "server.route"],
  optionalCapabilities: [],
  priority: 100,
  required: false,
  enabledByDefault: true,
  entry: "./demo-plugin-ui.ts",
});

export const demoPluginPackage: BundledPluginPackage = {
  manifest: demoManifest,
  uiEntry: async () => import("./demo-plugin-ui"),
};

export const bundledPluginPackages: BundledPluginPackage[] = [demoPluginPackage];
