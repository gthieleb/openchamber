import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import {
  createServerPluginLoader,
  validatePluginPath,
  validateCapabilities,
  isPathUnderAllowlist,
  ALLOWED_SERVER_CAPABILITIES,
  DANGEROUS_CAPABILITIES,
} from "./server-loader.js";

let tmpDir;
let otherDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "server-plugin-test-"));
  otherDir = fs.mkdtempSync(path.join(os.tmpdir(), "other-plugin-test-"));
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(otherDir, { recursive: true, force: true }); } catch {}
});

function createTempPlugin(content, filename = "plugin.js", dir = tmpDir) {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

function createValidPlugin(content, filename = "plugin.js", dir = tmpDir) {
  const pluginContent = `
export default function testPlugin(ctx) {
  ${content}
}
testPlugin.__definition = {
  id: "test-plugin",
  name: "Test Plugin",
  version: "1.0.0",
  description: "Test plugin",
  source: "user",
  targets: ["server"],
  capabilities: ["server.route"],
  optionalCapabilities: [],
  priority: 0,
  required: false,
  enabledByDefault: false,
};
`;
  return createTempPlugin(pluginContent, filename, dir);
}

describe("validatePluginPath", () => {
  it("validates existing file", () => {
    const filePath = createTempPlugin("export default {}");
    const result = validatePluginPath(filePath);
    expect(result.valid).toBe(true);
    expect(result.resolvedPath).toBe(path.resolve(filePath));
  });

  it("rejects non-existent file", () => {
    const result = validatePluginPath(path.join(tmpDir, "nonexistent.js"));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("does not exist");
  });

  it("rejects directory", () => {
    const result = validatePluginPath(tmpDir);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("must be a file");
  });
});

describe("validateCapabilities", () => {
  it("allows server capabilities", () => {
    const invalid = validateCapabilities(["server.route", "server.middleware", "server.lifecycle"]);
    expect(invalid).toEqual([]);
  });

  it("rejects UI capabilities", () => {
    const invalid = validateCapabilities(["ui.fill", "ui.surface"]);
    expect(invalid).toContain("ui.fill");
    expect(invalid).toContain("ui.surface");
  });

  it("rejects auth.provider capability", () => {
    const invalid = validateCapabilities(["auth.provider"]);
    expect(invalid).toContain("auth.provider");
  });

  it("allows storage and fs capabilities", () => {
    const invalid = validateCapabilities(["storage.global", "fs.read", "git.read"]);
    expect(invalid).toEqual([]);
  });
});

describe("isPathUnderAllowlist", () => {
  it("allows exact path match", () => {
    const allowlist = ["/plugins"];
    expect(isPathUnderAllowlist("/plugins", allowlist)).toBe(true);
  });

  it("allows subdirectory", () => {
    const allowlist = ["/plugins"];
    expect(isPathUnderAllowlist("/plugins/my-plugin/index.js", allowlist)).toBe(true);
  });

  it("rejects path outside allowlist", () => {
    const allowlist = ["/plugins"];
    expect(isPathUnderAllowlist("/other/plugin.js", allowlist)).toBe(false);
  });

  it("rejects path with similar prefix", () => {
    const allowlist = ["/plugins"];
    expect(isPathUnderAllowlist("/plugins-extra/plugin.js", allowlist)).toBe(false);
  });

  it("handles multiple allowlisted paths", () => {
    const allowlist = ["/plugins", "/extensions"];
    expect(isPathUnderAllowlist("/extensions/my-ext/index.js", allowlist)).toBe(true);
    expect(isPathUnderAllowlist("/plugins/my-plugin/index.js", allowlist)).toBe(true);
    expect(isPathUnderAllowlist("/other/plugin.js", allowlist)).toBe(false);
  });

  it("allows all when allowlist is empty", () => {
    expect(isPathUnderAllowlist("/any/path/plugin.js", [])).toBe(true);
  });
});

describe("createServerPluginLoader", () => {
  let loader;
  let mockRegistry;

  beforeEach(() => {
    mockRegistry = {
      registerRoutes: () => {},
      registerMiddleware: () => {},
      registerLifecycle: () => {},
    };
    loader = createServerPluginLoader({
      allowlist: [tmpDir],
      serverRegistry: mockRegistry,
    });
  });

  it("loads and registers a valid plugin", async () => {
    const pluginPath = createValidPlugin("");
    const result = await loader.loadAndRegister(pluginPath, "test-plugin");
    expect(result.pluginId).toBe("test-plugin");
    expect(result.status).toBe("ready");

    const loaded = loader.getPluginById("test-plugin");
    expect(loaded).not.toBeNull();
    expect(loaded.status).toBe("ready");
  });

  it("rejects plugin outside allowlist", async () => {
    const pluginPath = createValidPlugin("", "plugin.js", otherDir);

    await expect(loader.loadAndRegister(pluginPath, "bad-plugin")).rejects.toThrow(
      /not in the allowlist/,
    );

    const errors = loader.getSetupErrors();
    expect(errors.some((e) => e.pluginId === "bad-plugin" && e.phase === "allowlist")).toBe(true);
  });

  it("rejects plugin with denied capabilities", async () => {
    const pluginContent = `
export default function badPlugin(ctx) {}
badPlugin.__definition = {
  id: "bad-plugin",
  name: "Bad Plugin",
  version: "1.0.0",
  source: "user",
  targets: ["server"],
  capabilities: ["ui.fill", "server.route"],
  optionalCapabilities: [],
  priority: 0,
  required: false,
  enabledByDefault: false,
};
`;
    const pluginPath = createTempPlugin(pluginContent);

    await expect(loader.loadAndRegister(pluginPath, "bad-plugin")).rejects.toThrow(
      /cannot request these capabilities/,
    );

    const errors = loader.getSetupErrors();
    expect(errors.some((e) => e.pluginId === "bad-plugin" && e.phase === "capability")).toBe(true);
  });

  it("isolates setup errors", async () => {
    const pluginContent = `
export default function failingPlugin(ctx) {
  throw new Error("Setup failed intentionally");
}
failingPlugin.__definition = {
  id: "failing-plugin",
  name: "Failing Plugin",
  version: "1.0.0",
  source: "user",
  targets: ["server"],
  capabilities: ["server.route"],
  optionalCapabilities: [],
  priority: 0,
  required: false,
  enabledByDefault: false,
};
`;
    const pluginPath = createTempPlugin(pluginContent);

    await expect(loader.loadAndRegister(pluginPath, "failing-plugin")).rejects.toThrow(
      "Setup failed intentionally",
    );

    const errors = loader.getSetupErrors();
    const setupError = errors.find((e) => e.pluginId === "failing-plugin");
    expect(setupError).toBeDefined();
    expect(setupError.phase).toBe("setup");
    expect(setupError.error).toBe("Setup failed intentionally");
  });

  it("registers routes through server API", async () => {
    let registeredRoute = null;
    mockRegistry.registerRoutes = (routeId, register, pluginId, source, options) => {
      registeredRoute = { routeId, pluginId, source, phase: options.phase };
    };

    const pluginPath = createValidPlugin(`
      ctx.server.routes("test.route", () => {}, { phase: "postAuthFeatureRoutes" });
    `);

    await loader.loadAndRegister(pluginPath, "test-plugin");
    expect(registeredRoute).not.toBeNull();
    expect(registeredRoute.routeId).toBe("test.route");
    expect(registeredRoute.pluginId).toBe("test-plugin");
    expect(registeredRoute.source).toBe("user");
  });

  it("registers middleware through server API", async () => {
    let registeredMiddleware = null;
    mockRegistry.registerMiddleware = (middlewareId, middleware, pluginId, source, options) => {
      registeredMiddleware = { middlewareId, pluginId, source, phase: options.phase };
    };

    const pluginContent = `
export default function testPlugin(ctx) {
  ctx.server.middleware("test.middleware", () => {}, { phase: "earlyMiddleware" });
}
testPlugin.__definition = {
  id: "test-plugin",
  name: "Test Plugin",
  version: "1.0.0",
  source: "user",
  targets: ["server"],
  capabilities: ["server.middleware"],
  optionalCapabilities: [],
  priority: 0,
  required: false,
  enabledByDefault: false,
};
`;
    const pluginPath = createTempPlugin(pluginContent);

    await loader.loadAndRegister(pluginPath, "test-plugin");
    expect(registeredMiddleware).not.toBeNull();
    expect(registeredMiddleware.middlewareId).toBe("test.middleware");
  });

  it("registers lifecycle hooks through server API", async () => {
    let registeredHook = null;
    mockRegistry.registerLifecycle = (hook, fn, pluginId) => {
      registeredHook = { hook, pluginId };
    };

    const pluginPath = createValidPlugin(`
      ctx.server.lifecycle("afterListen", () => {});
    `);

    await loader.loadAndRegister(pluginPath, "test-plugin");
    expect(registeredHook).not.toBeNull();
    expect(registeredHook.hook).toBe("afterListen");
    expect(registeredHook.pluginId).toBe("test-plugin");
  });

  it("disposes all plugins on shutdown", async () => {
    const pluginPath = createValidPlugin(`
      ctx.server.lifecycle("beforeShutdown", () => {});
    `);

    await loader.loadAndRegister(pluginPath, "test-plugin");
    await loader.disposeAll();

    const loaded = loader.getLoadedPlugins();
    expect(loaded).toHaveLength(0);
  });

  it("returns loaded plugins with dangerous capability flag", async () => {
    const pluginContent = `
export default function dangerousPlugin(ctx) {}
dangerousPlugin.__definition = {
  id: "dangerous-plugin",
  name: "Dangerous Plugin",
  version: "1.0.0",
  source: "user",
  targets: ["server"],
  capabilities: ["server.route", "fs.write"],
  optionalCapabilities: [],
  priority: 0,
  required: false,
  enabledByDefault: false,
};
`;
    const pluginPath = createTempPlugin(pluginContent);

    await loader.loadAndRegister(pluginPath, "dangerous-plugin");

    const loaded = loader.getLoadedPlugins();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].hasDangerousCapabilities).toBe(true);
    expect(loaded[0].capabilities).toContain("fs.write");
  });

  it("rejects plugin without definePlugin definition", async () => {
    const pluginContent = `
export default function noDefPlugin(ctx) {}
`;
    const pluginPath = createTempPlugin(pluginContent);

    await expect(loader.loadAndRegister(pluginPath, "no-def-plugin")).rejects.toThrow(
      /definePlugin/,
    );

    const errors = loader.getSetupErrors();
    expect(errors.some((e) => e.pluginId === "no-def-plugin")).toBe(true);
  });

  it("works with empty allowlist (allows all)", async () => {
    const openLoader = createServerPluginLoader({
      allowlist: [],
      serverRegistry: mockRegistry,
    });

    const pluginPath = createValidPlugin("");
    const result = await openLoader.loadAndRegister(pluginPath, "test-plugin");
    expect(result.status).toBe("ready");

    await openLoader.disposeAll();
  });
});

describe("ALLOWED_SERVER_CAPABILITIES", () => {
  it("includes server.* capabilities", () => {
    expect(ALLOWED_SERVER_CAPABILITIES.has("server.route")).toBe(true);
    expect(ALLOWED_SERVER_CAPABILITIES.has("server.middleware")).toBe(true);
    expect(ALLOWED_SERVER_CAPABILITIES.has("server.lifecycle")).toBe(true);
    expect(ALLOWED_SERVER_CAPABILITIES.has("server.event")).toBe(true);
  });

  it("excludes UI capabilities", () => {
    expect(ALLOWED_SERVER_CAPABILITIES.has("ui.fill")).toBe(false);
    expect(ALLOWED_SERVER_CAPABILITIES.has("ui.surface")).toBe(false);
    expect(ALLOWED_SERVER_CAPABILITIES.has("ui.replace")).toBe(false);
  });

  it("excludes auth.provider", () => {
    expect(ALLOWED_SERVER_CAPABILITIES.has("auth.provider")).toBe(false);
  });
});

describe("DANGEROUS_CAPABILITIES", () => {
  it("marks write and exec as dangerous", () => {
    expect(DANGEROUS_CAPABILITIES.has("fs.write")).toBe(true);
    expect(DANGEROUS_CAPABILITIES.has("fs.exec")).toBe(true);
    expect(DANGEROUS_CAPABILITIES.has("git.write")).toBe(true);
  });

  it("does not mark read capabilities as dangerous", () => {
    expect(DANGEROUS_CAPABILITIES.has("fs.read")).toBe(false);
    expect(DANGEROUS_CAPABILITIES.has("git.read")).toBe(false);
    expect(DANGEROUS_CAPABILITIES.has("server.route")).toBe(false);
  });
});
