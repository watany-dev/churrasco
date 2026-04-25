# Packaging

This document captures the v0.1 `package.json` blueprint. It is the concrete contribution surface — commands, configuration, and views — that the spec maps to. Cross-references: [State & Commands](spec/state-and-commands.md), [Architecture](spec/architecture.md).

```json
{
  "name": "churrasco-break",
  "displayName": "Churrasco Break",
  "description": "A VS Code extension that delivers a different cut of churrasco to your editor every 10 minutes.",
  "version": "0.1.0",
  "publisher": "your-publisher-name",
  "engines": {
    "vscode": "^1.90.0"
  },
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
    "compile": "npm run check-types && node esbuild.js",
    "check-types": "tsc --noEmit",
    "watch": "npm-run-all -p watch:*",
    "watch:esbuild": "node esbuild.js --watch",
    "watch:tsc": "tsc --noEmit --watch --project tsconfig.json",
    "lint": "eslint src --ext ts",
    "test": "vscode-test",
    "package": "npm run check-types && node esbuild.js --production",
    "vscode:prepublish": "npm run package"
  }
}
```
