---
name: docs-writing
description: Use when writing, editing, or reviewing documentation in Docusaurus (cf-evo-docs). Enforces metadata structure, content rules, and preview workflow for docs pages.
license: MIT
compatibility: opencode
---

## Overview

Rules for writing documentation in the Docusaurus-based docs site (cf-evo-docs). Follow these guidelines before pushing any docs changes.

## Rules

### Metadata in index.md — no `_category_.json`

Use metadata inside each directory's `index.md` file. Do **not** use `_category_.json` files, with probably only one exception (undocumented).

### Categories collapsed by default

All categories/directories are collapsed by default. Do not add instructions to override this behavior — keep the default.

### No API details in docs

Do not duplicate content that is already present in:
- OpenAPI schema
- Configuration schema
- Any auto-generated schema

Avoid straightforward API details (route, controller, method, etc.). If it's in the schema, link to it — don't re-document it.

### Readable as raw markdown

Documentation files must be readable without a live-view editor. Write clean raw markdown:
- Format tables properly (IDE auto-format is available)
- No messy inline HTML or unreadable constructs
- A table should look like a table in the raw file

### Doc item metadata standardization

Metadata structure for doc items is not yet finalized. We are working on standardization. Follow existing patterns in the docs for now.

### Always preview locally

Before pushing docs changes to the repo:
1. Preview changes in Docusaurus locally (cf-evo-docs)
2. Verify rendering before committing
