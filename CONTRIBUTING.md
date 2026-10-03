# Contributing to CloudBoard

Thank you for your interest in contributing to **CloudBoard**! We take pride in building a fast, edge-native, zero-bloat product and maintaining a gold-standard open-source codebase.

---

## Guiding Principles

1. **"It just works."**: Every feature, script, and component must work seamlessly without fragile workarounds.
2. **Zero Bloat**: No heavy external dependencies. We lean into Web standards (Web Crypto, native `fetch`, signed HTTP-only cookies, standard URL APIs).
3. **TypeScript Strictness**: 100% type coverage across edge handlers, client code, and utility scripts. Zero `any` types allowed.
4. **Design Excellence**: Every UI component must respect our design tokens, font hierarchy, and interaction standards.

---

## Local Development Setup

We use **Bun** for fast package management, builds, and scripting:

```bash
# 1. Clone your fork
git clone https://github.com/<your-username>/CloudBoard.git
cd CloudBoard

# 2. Automated one-command setup
bun run setup

# 3. Start local development
bun run dev
```

The app will be available at `http://localhost:8788`.

### Available Scripts

- `bun run setup` - Initializes dependencies, generates `.dev.vars`, and applies local D1 migrations.
- `bun run dev` - Starts watchers for Tailwind, client bundle, and Cloudflare Wrangler Pages emulator.
- `bun run build` - Compiles CSS, bundles the client, and prepares static assets in `dist/`.
- `bun run typecheck` - Validates TypeScript across all workspaces (`server`, `client`, `scripts`).
- `bun run db:reset` - Resets local SQLite database state and re-applies migrations cleanly.

---

## Repository Structure

```
CloudBoard/
├── functions/             # Cloudflare Pages Functions edge routing
│   └── api/               # Maps HTTP endpoints to src/server
├── migrations/            # D1 SQLite migrations (numbered sequentially)
├── scripts/               # Developer tooling (setup, dev, build, db reset)
├── src/
│   ├── client/            # Browser UI (hyperscript, Tailwind v4, zero-runtime)
│   │   ├── lib/           # DOM helpers, typed API client, client router
│   │   ├── pages/         # Page controllers (login, projects, board, join)
│   │   └── ui/            # Reusable UI components (icons, avatar, drawer, etc.)
│   ├── server/            # Edge backend logic
│   │   ├── db/            # Typed D1 SQL queries and row mappers
│   │   ├── handlers/      # Endpoint handlers (auth, projects, tickets, invites)
│   │   ├── lib/           # Web Crypto, signed cookies, HTTP utilities
│   │   └── services/      # Business logic and access control
│   └── shared/            # Shared API contracts & TypeScript interfaces
├── static/                # Public assets, self-hosted fonts, and _headers
├── package.json
├── tsconfig.*.json        # Strict isolated TypeScript configs
└── wrangler.toml          # Cloudflare Pages & D1 binding configuration
```

---

## Pull Request Guidelines

1. **Run Typecheck**: Ensure `bun run typecheck` passes with zero errors before submitting.
2. **Verify Build**: Ensure `bun run build` executes successfully.
3. **Follow Commit Conventions**: Write clear, descriptive commit messages (e.g., `feat: ...`, `fix: ...`, `docs: ...`, `refactor: ...`).
4. **Maintain Aesthetics**: Follow the design system tokens in `src/client/styles.css`. Do not add custom ad-hoc styling that breaks visual cohesion.
5. **No Unjustified Dependencies**: If you propose adding an npm dependency, document why native browser or Web platform APIs cannot achieve the same result.

---

## Security & Vulnerability Reporting

If you discover a security vulnerability, please do not open a public issue. Contact the repository maintainers directly or use GitHub Security Advisories.
