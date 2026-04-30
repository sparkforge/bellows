# Bellows 🔥

The bellows that feed the forge — a Pi-native agent orchestrator that turns Linear issues into isolated, autonomous implementation runs.

## What is Bellows?

Bellows is the Pi-native answer to [Symphony](https://github.com/openai/symphony). Instead of launching Codex as a subprocess and speaking a proprietary protocol, Bellows embeds [Pi](https://github.com/pi-coding-agent/pi) directly via its TypeScript SDK.

**Key difference:** Symphony spawns `codex app-server`. Bellows calls `createAgentSession()`.

## Features

- 🎯 **Linear Integration** — Polls your Linear workspace for active issues
- 🏝️ **Isolated Workspaces** — Each issue gets its own directory + git state
- 🔄 **Automatic Retries** — Exponential backoff on transient failures
- 🔥 **Concurrency Control** — Bounded concurrent agents with per-state limits
- 🎛️ **Workflow-Driven** — Configuration and prompts in `WORKFLOW.md`
- 📊 **Observable** — Structured logs for monitoring and debugging

## Installation

```bash
npm install -g @sparkforge/bellows
```

Or use locally:

```bash
npm install
npm run build
npm start -- start ./WORKFLOW.md
```

## Quick Start

Create a `WORKFLOW.md` in your repo:

```yaml
---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: my-team
  active_states: [Todo, "In Progress"]
  terminal_states: [Done, Closed, Cancelled]

polling:
  interval_ms: 30000

agent:
  max_concurrent_agents: 5
  max_turns: 20

workspace:
  root: ./workspaces
  hooks:
    after_create: |
      git clone git@github.com:myorg/myrepo.git .
    before_run: |
      npm install
---

You are an expert TypeScript developer. Your task is to implement the issue described below.

Issue: {{issue.title}}
Description: {{issue.description}}

When finished:
1. Create a PR with your changes
2. Update the Linear issue with the PR link
3. Move the issue to "In Review"
```

Run it:

```bash
export LINEAR_API_KEY="lin_api_..."
bellows start
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Linear    │────▶│ Orchestrator│────▶│   Pi Agent  │
│    API      │     │  (Daemon)   │     │  (Embedded) │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Workspace  │
                    │   (Git +    │
                    │   Files)    │
                    └─────────────┘
```

## Configuration

See [SPEC.md](./SPEC.md) for the complete configuration specification.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- start

# Build
npm run build

# Test
npm run test
```

## License

MIT

## Related

- [Symphony](https://github.com/openai/symphony) — OpenAI's Codex orchestrator (inspiration)
- [Pi](https://github.com/pi-coding-agent/pi) — The agent SDK that powers Bellows
- [OpenClaw](https://openclaw.ai) — The gateway where Bellows was born
