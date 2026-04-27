# Packaging

This document captures the **v0.1 final-form** `package.json` blueprint — the concrete contribution surface (commands, configuration, views) that the spec maps to once every milestone has shipped. Cross-references: [State & Commands](spec/state-and-commands.md), [Architecture](spec/architecture.md).

The toolchain is pinned via `packageManager: "pnpm@<version>"` (activated by Corepack), `engines.node: ">=24"`, and `engines.vscode: "^1.90.0"`. All scripts assume `pnpm`. Quality and tests are run via Biome / Vitest / `@vscode/test-cli` rather than ESLint / Prettier / Mocha-as-unit-runner.

> **Note:** the live `package.json` now declares every command listed below (M0–M5: `startSession`, `stopSession`, `pauseSession`, `openMenu`, `eatCurrentMeat`, `passCurrentMeat`, `showTodayLog`, `resetToday`) plus the `viewsContainers` / `views` contributions for the M6 sidebar.

```json
{
  "name": "churrasco-break",
  "displayName": "Churrasco Break",
  "description": "A VS Code extension that delivers a different cut of churrasco to your editor every 10 minutes.",
  "version": "0.1.0",
  "publisher": "your-publisher-name",
  "bugs": { "url": "https://github.com/<owner>/<repo>/issues" },
  "homepage": "https://github.com/<owner>/<repo>#readme",
  "keywords": ["pomodoro", "timer", "break", "churrasco", "rhythm"],
  "engines": {
    "vscode": "^1.90.0",
    "node": ">=24"
  },
  "packageManager": "pnpm@<version>",
  "categories": ["Other"],
  "activationEvents": [],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      { "command": "churrasco.startSession",   "title": "Churrasco: Start Service" },
      { "command": "churrasco.stopSession",    "title": "Churrasco: End Service" },
      { "command": "churrasco.pauseSession",   "title": "Churrasco: Pause" },
      { "command": "churrasco.eatCurrentMeat", "title": "Churrasco: Eat Current Meat" },
      { "command": "churrasco.passCurrentMeat","title": "Churrasco: Pass Current Meat" },
      { "command": "churrasco.showTodayLog",   "title": "Churrasco: Show Today's Log" },
      { "command": "churrasco.openMenu",       "title": "Churrasco: Open Menu" },
      { "command": "churrasco.resetToday",     "title": "Churrasco: Reset Today's Log" }
    ],
    "configuration": {
      "title": "Churrasco Break",
      "properties": {
        "churrasco.intervalMinutes": {
          "type": "number",
          "default": 10,
          "minimum": 0.1,
          "description": "Interval between meat arrivals, in minutes."
        },
        "churrasco.enableNotifications": {
          "type": "boolean",
          "default": true,
          "description": "Show a notification on meat arrival."
        },
        "churrasco.showStatusBar": {
          "type": "boolean",
          "default": true,
          "description": "Show the Churrasco Break status bar item."
        },
        "churrasco.pauseWhenInactive": {
          "type": "boolean",
          "default": false,
          "description": "Pause the timer while VS Code is inactive. May be unimplemented in v0.1."
        },
        "churrasco.maxSatiety": {
          "type": "number",
          "default": 100,
          "minimum": 10,
          "description": "Maximum satiety value."
        },
        "churrasco.autoStopWhenFull": {
          "type": "boolean",
          "default": true,
          "description": "Automatically end the session when satiety reaches the maximum."
        },
        "churrasco.locale": {
          "type": "string",
          "default": "ja",
          "enum": ["ja"],
          "description": "Display language. v0.1 only supports `ja`."
        }
      }
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "churrasco-break",
          "title": "Churrasco",
          "icon": "resources/churrasco.svg"
        }
      ]
    },
    "views": {
      "churrasco-break": [
        {
          "id": "churrasco.statusView",
          "name": "Churrasco Break"
        }
      ]
    }
  },
  "scripts": {
    "compile":      "pnpm check-types && node esbuild.js",
    "check-types":  "tsc --noEmit",
    "watch":        "pnpm /^watch:/",
    "watch:esbuild":"node esbuild.js --watch",
    "watch:tsc":    "tsc --noEmit --watch --project tsconfig.json",
    "lint":         "biome check .",
    "lint:fix":     "biome check --write .",
    "format":       "biome format --write .",
    "knip":         "knip",
    "test:unit":    "vitest run",
    "test:vscode":  "vscode-test",
    "test":         "pnpm test:unit && pnpm test:vscode",
    "package":      "vsce package --no-dependencies",
    "vscode:prepublish": "pnpm check-types && node esbuild.js --production"
  }
}
```

## .vscodeignore

`vsce package` honors a top-level `.vscodeignore`. The v0.1 policy is to ship only the production runtime — `dist/extension.js`, `package.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, and `resources/`. Everything else (TypeScript sources, tests, configs, CI workflows, lockfiles, ADRs) is excluded so the VSIX stays small and free of repo metadata.

```text
.vscode/**
.vscode-test/**
.vscode-test.mjs
.github/**
.husky/**
src/**
out/**
coverage/**
docs/**

**/*.test.ts
**/*.map
**/*.tsbuildinfo
**/tsconfig*.json
vitest.config.ts
vitest.workspace.ts
esbuild.js
knip.config.ts
biome.json
lefthook.yml
commitlint.config.*

pnpm-lock.yaml
pnpm-workspace.yaml
.npmrc
.nvmrc
.gitignore
.gitattributes
.editorconfig
```

## Marketplace icon

A top-level `"icon"` is intentionally omitted in v0.1: the VS Code Marketplace requires a PNG of at least 128×128, and `resources/churrasco.svg` is currently used only for the activity bar container (`viewsContainers.activitybar[].icon`, which does accept SVG). Adding a Marketplace-grade PNG icon is tracked alongside Marketplace publication in v0.2+.
