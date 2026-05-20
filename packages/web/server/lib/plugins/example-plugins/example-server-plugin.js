export default function exampleServerPlugin(ctx) {
  const { server, manifest } = ctx;

  server.routes("example.health", (router) => {
    router.get("/api/plugins/example/health", (_req, res) => {
      res.json({
        status: "ok",
        plugin: manifest.id,
        version: manifest.version,
        timestamp: new Date().toISOString(),
      });
    });
  }, { phase: "postAuthFeatureRoutes" });

  server.lifecycle("afterListen", () => {
    console.log(`[Example Server Plugin] Plugin "${manifest.id}" is ready`);
  });
}

exampleServerPlugin.__definition = {
  id: "example-server-plugin",
  name: "Example Server Plugin",
  version: "0.1.0",
  description: "Example local server plugin for testing PLUG-IMPL-017",
  source: "user",
  targets: ["server"],
  capabilities: ["server.route", "server.lifecycle"],
  optionalCapabilities: [],
  priority: 0,
  required: false,
  enabledByDefault: false,
};
