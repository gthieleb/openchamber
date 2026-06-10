# Reproduction: Issue #1605 - Skill slash command inserts plain text

## Summary

Selecting a user-installed skill from the slash command menu (`/` at start of chat input) inserts the skill name as plain text instead of invoking the skill. The UI shows all installed skills in the menu, but the routing logic that dispatches the command on submit does not recognize skills that lack a `trigger`/`slash` frontmatter field.

## Only `graphify` works

`graphify` has `trigger: /graphify` in its SKILL.md frontmatter. This causes OpenCode's server to register it as a command (with `source: "skill"`) in its `command.list` API response. Skills without `trigger`/`slash` in frontmatter (like `grill-with-docs` by default) are NOT registered as commands by OpenCode.

Even adding `trigger: /grill-with-docs` to `grill-with-docs`'s frontmatter may not work immediately because OpenCode's server needs to re-read the SKILL.md file. A config reload or server restart may be needed.

## Root Cause — Code Path Gap

There is a mismatch between what the **CommandAutocomplete** menu shows and what the **routeMessage** dispatch function can handle.

### A. What the menu shows (`CommandAutocomplete.tsx`)

File: `packages/ui/src/components/chat/CommandAutocomplete.tsx`

The component fetches skills from **two separate sources** and merges them:

1. **`useCommandsStore`** (lines 75-76): calls `opencodeClient.listCommandsWithDetails()` — only returns commands registered with OpenCode (including skills with `trigger`/`slash`)
2. **`useSkillsStore`** (lines 77-78): calls `GET /api/config/skills` — returns ALL discovered skills regardless of `trigger`/`slash`

The merge code (lines 116-135):
```typescript
const customCommands: CommandInfo[] = commandsWithMetadata.map((cmd, index) => ({
  id: `opencode:${cmd.scope ?? 'global'}:${cmd.name}:${cmd.agent ?? ''}:${cmd.model ?? ''}:${index}`,
  // ...
  isSkill: cmd.source === 'skill' || skillNames.has(cmd.name),
  // ...
}));
const skillCommands: CommandInfo[] = skills.map((skill, index) => ({
  id: `skill:${skill.scope}:${skill.source ?? 'opencode'}:${skill.name}:${index}`,
  name: skill.name,
  source: 'skill',
  // ...
}));
const allCommands = [...builtInCommands, ...customCommands, ...skillCommands];
```

**Result:** ALL skills from `useSkillsStore` (including those without `trigger`) appear in the menu.

### B. How skills are stored in useCommandsStore

File: `packages/ui/src/stores/useCommandsStore.ts`

Line 177 explicitly **filters OUT** skills:
```typescript
const configurableCommands = commands.filter((cmd) => cmd.source !== 'skill');
```

So `useCommandsStore.getState().commands` never contains skills.

### C. What happens on submit (`session-ui-store.ts`, `routeMessage`)

File: `packages/ui/src/sync/session-ui-store.ts`

Lines 94-129:
```typescript
if (params.content.startsWith("/")) {
    const [head, ...tail] = params.content.split(" ")
    const cmdName = head.slice(1)

    const dirState = getDirectoryState(requestDirectory)
    const syncCommands = dirState?.command ?? []
    const storeCommands = useCommandsStore.getState().commands

    const isCommand = syncCommands.find((c) => c.name === cmdName)
      || storeCommands.find((c) => c.name === cmdName)

    if (isCommand) {
      // → opencodeClient.sendCommand() — CORRECT skill invocation
    }
  }

  // → opencodeClient.sendMessage() — PLAIN TEXT fallthrough
```

The check for `isCommand` looks at:
- `syncCommands`: `dirState?.command` from OpenCode SDK sync state (populated by OpenCode server's `command.list` API)
- `storeCommands`: `useCommandsStore.getState().commands` (filtered to exclude `source: 'skill'` at load time)

**Skills without `trigger`/`slash` are in NEITHER list**, so the code falls through to `opencodeClient.sendMessage()` — the skill name is sent as plain text.

### D. The `SkillAutocomplete` (inline `/` mentions) has a different path

The `SkillAutocomplete` menu (shown when `/` is mid-text, after a word boundary) only inserts `/{skillname}` into the text. On submit, `collectInlineSkillMentions` detects these and adds a synthetic instruction for the AI (line 1822-1828 of ChatInput.tsx):

```typescript
const skillMentionInstruction = buildSkillMentionInstruction(mentionedSkillNames);
if (skillMentionInstruction) {
    additionalParts.push({
        text: skillMentionInstruction,
        synthetic: true,
    });
}
```

This instruction tells the AI to use the skill tool. This is a DIFFERENT flow from the slash-at-start command path and is not relevant to this bug.

## Reproduction Steps

1. Install any user skill WITHOUT a `trigger` frontmatter (e.g., `grill-with-docs`)
2. Open chat input
3. Type `/` at the start of input → the skill appears in the CommandAutocomplete menu
4. Select the skill from the menu → `/{skillname}` is inserted as text
5. Press Enter → the message is sent as a normal user message
6. The AI sees `/{skillname}` as regular text, not as a skill invocation

## Discussion for fix

The mismatch can be resolved in the UI layer by either:

**Option A (no server change):** In `CommandAutocomplete.tsx`, filter out skills that are NOT already registered as commands (i.e., skills from `useSkillsStore` that don't have a matching entry in `commandsWithMetadata`). Only show skills that can actually be invoked via `/`.

**Option B (UI-side skill fallback):** In `routeMessage` (or `handleSubmit`), when a `/command` is not found in `syncCommands` or `storeCommands`, check `useSkillsStore` for a matching skill name. If found, invoke the skill content directly (e.g., inject the skill instructions as a synthetic system message).

**Option C (server-side):** Have OpenChamber's skill routes register skills as commands with OpenCode even without `trigger`/`slash` frontmatter.

Note: The AGENTS.md says "Do not fix the bug. Only reproduce it." This document is analysis-only to guide discussion.

## Key Files

| File | Role |
|---|---|
| `packages/ui/src/components/chat/CommandAutocomplete.tsx` | Slash command menu — shows skills from both stores |
| `packages/ui/src/components/chat/ChatInput.tsx` | `handleCommandSelect` (line 3117) and submit flow |
| `packages/ui/src/sync/session-ui-store.ts` | `routeMessage` (line 70) — final dispatch gate |
| `packages/ui/src/stores/useCommandsStore.ts` | Filters out `source: 'skill'` (line 177) |
| `packages/ui/src/stores/useSkillsStore.ts` | Loads all skills from `/api/config/skills` |
