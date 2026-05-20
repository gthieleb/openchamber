export default function setupDemoPluginServer(ctx) {
  console.log("[DemoPlugin] Server plugin loaded");

  // Example: register a server route
  // In a real plugin, this would use ctx.server.routes() to add protected routes

  return {
    dispose: () => {
      console.log("[DemoPlugin] Server plugin disposed");
    },
  };
}
