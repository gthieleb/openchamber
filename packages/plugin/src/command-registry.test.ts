import { describe, it, expect } from "vitest";
import { CommandRegistry } from "./command-registry";

describe("CommandRegistry", () => {
  it("registers and retrieves a command", () => {
    const reg = new CommandRegistry();
    let executed = false;
    reg.registerCommand("test.cmd", {
      title: "Test Command",
      group: "general",
      run: () => { executed = true; },
    }, "test-plugin", "builtin");

    const cmd = reg.getCommand("test.cmd");
    expect(cmd).toBeDefined();
    expect(cmd?.id).toBe("test.cmd");
    expect(cmd?.title).toBe("Test Command");
    expect(cmd?.group).toBe("general");
    expect(cmd?.isCore).toBe(false);

    cmd?.run();
    expect(executed).toBe(true);
  });

  it("throws on duplicate ID", () => {
    const reg = new CommandRegistry();
    reg.registerCommand("test.cmd", {
      title: "Test Command",
      group: "general",
      run: () => {},
    }, "test-plugin", "builtin");

    expect(() => {
      reg.registerCommand("test.cmd", {
        title: "Duplicate",
        group: "general",
        run: () => {},
      }, "other-plugin", "builtin");
    }).toThrow(/Duplicate command ID/);
  });

  it("returns all commands sorted by source then priority", () => {
    const reg = new CommandRegistry();
    reg.registerCommand("user.cmd", {
      title: "User Command",
      group: "general",
      priority: 0,
      run: () => {},
    }, "user-plugin", "user");
    reg.registerCommand("builtin.cmd", {
      title: "Builtin Command",
      group: "general",
      priority: 10,
      run: () => {},
    }, "builtin-plugin", "builtin");
    reg.registerCommand("builtin-low", {
      title: "Builtin Low",
      group: "general",
      priority: 0,
      run: () => {},
    }, "builtin-plugin", "builtin");

    const commands = reg.getAllCommands();
    expect(commands).toHaveLength(3);
    expect(commands[0].id).toBe("builtin-low");
    expect(commands[1].id).toBe("builtin.cmd");
    expect(commands[2].id).toBe("user.cmd");
  });

  it("filters by availability", () => {
    const reg = new CommandRegistry();
    reg.registerCommand("hidden", {
      title: "Hidden",
      group: "general",
      isAvailable: () => false,
      run: () => {},
    }, "test-plugin", "builtin");
    reg.registerCommand("visible", {
      title: "Visible",
      group: "general",
      run: () => {},
    }, "test-plugin", "builtin");

    const commands = reg.getAllCommands();
    expect(commands).toHaveLength(1);
    expect(commands[0].id).toBe("visible");
  });

  it("filters by enabled features", () => {
    const reg = new CommandRegistry();
    reg.registerCommand("feature.cmd", {
      title: "Feature Command",
      group: "general",
      featureId: "test.feature",
      run: () => {},
    }, "test-plugin", "builtin");
    reg.registerCommand("no-feature", {
      title: "No Feature",
      group: "general",
      run: () => {},
    }, "test-plugin", "builtin");

    const commands = reg.getAllCommands({ enabledFeatures: new Set(["other.feature"]) });
    expect(commands).toHaveLength(1);
    expect(commands[0].id).toBe("no-feature");
  });

  it("groups commands by group", () => {
    const reg = new CommandRegistry();
    reg.registerCommand("general.cmd", {
      title: "General Command",
      group: "general",
      run: () => {},
    }, "test-plugin", "builtin");
    reg.registerCommand("view.cmd", {
      title: "View Command",
      group: "view",
      run: () => {},
    }, "test-plugin", "builtin");

    const generalCommands = reg.getCommandsByGroup("general");
    expect(generalCommands).toHaveLength(1);
    expect(generalCommands[0].id).toBe("general.cmd");

    const viewCommands = reg.getCommandsByGroup("view");
    expect(viewCommands).toHaveLength(1);
    expect(viewCommands[0].id).toBe("view.cmd");
  });

  it("executes commands by ID", () => {
    const reg = new CommandRegistry();
    let value = 0;
    reg.registerCommand("test.cmd", {
      title: "Test Command",
      group: "general",
      run: () => { value = 42; },
    }, "test-plugin", "builtin");

    reg.executeCommand("test.cmd");
    expect(value).toBe(42);
  });

  it("throws when executing unknown command", () => {
    const reg = new CommandRegistry();
    expect(() => reg.executeCommand("nonexistent")).toThrow(/Command not found/);
  });

  it("tracks contribution records", () => {
    const reg = new CommandRegistry();
    reg.registerCommand("test.cmd", {
      title: "Test",
      group: "general",
      run: () => {},
    }, "test-plugin", "builtin");

    const records = reg.getAllRecords();
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("test.cmd");
    expect(records[0].pluginId).toBe("test-plugin");
    expect(reg.getContributionCount()).toBe(1);
  });

  it("supports async commands", async () => {
    const reg = new CommandRegistry();
    let resolved = false;
    reg.registerCommand("async.cmd", {
      title: "Async Command",
      group: "general",
      run: async () => {
        await Promise.resolve();
        resolved = true;
      },
    }, "test-plugin", "builtin");

    await reg.executeCommand("async.cmd");
    expect(resolved).toBe(true);
  });
});
