# CloudBoard

> **Minimalist, edge-native project & ticket tracking. "It just works."**

CloudBoard is both a free, public hosted service for developers and small teams, and a 100% open-source project. Engineered to run completely within Cloudflare's free tier limits (Cloudflare Pages Functions + Cloudflare D1) without external microservices or third-party databases.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
[![GitHub Repository](https://img.shields.io/badge/github-27bhd%2FCloudBoard-181717.svg?logo=github)](https://github.com/27bhd/CloudBoard)

---

## Vision & Highlights

- **Zero Bloat**: No heavy UI runtimes, no bulky client frameworks, no bulky ORMs. Built with native Web APIs (`crypto.subtle`, signed HTTP-only cookies, standard `fetch`, and lightweight hyperscript).
- **Fast at the Edge**: Instant loads and sub-second edge mutations powered by Cloudflare Pages and native SQLite on Cloudflare D1.
- **Crafted Minimalist UI**: High visual polish with custom typography (Gloock, Schibsted Grotesk, Martian Mono), dark mode, smooth drag-and-drop, and optimistic UI updates.
- **Mandatory Status Update Notes**: Whenever ticket status changes (via board drag-and-drop or details drawer), team members provide a context note displayed on cards and in the reverse-chronological activity timeline.
- **Bulk JSON Task Import**: Easily migrate tickets from other issue trackers or batch-import tasks using a clean JSON format or file upload with live validation.
- **Controlled Ticket Edits**: Explicit Save and Cancel controls with keyboard shortcuts (`Ctrl+Enter` / `Cmd+Enter`) to prevent database chatter.
- **Native GitHub Authentication**: Passwordless sign-in via direct OAuth token exchange (no third-party auth provider).
- **Time-Limited Expiring Invites**: Cryptographically secure invite tokens with 24h, 48h, or 7d expiration.
- **Audit History**: Transparent event tracking for all ticket updates and lifecycle states.
- **Zero-Config DX**: Instant local development with Bun and Cloudflare Wrangler (`bun run setup` -> `bun run dev`).

---

## Tech Stack

- **Runtime & Toolchain**: [Bun](https://bun.sh)
- **Edge Platform**: [Cloudflare Pages](https://pages.cloudflare.com) & [Pages Functions](https://developers.cloudflare.com/pages/functions/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (Serverless edge SQLite)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com) (zero runtime overhead)
- **Typography**: Gloock (editorial display serif), Schibsted Grotesk (functional UI sans), Martian Mono (clean ticket keys & codes)
- **Language**: TypeScript with strict type checking across client, server, and scripts

---

## Quick Start (Local Development)

### Prerequisites

- [Bun](https://bun.sh) (v1.2+)
- Node.js (v18+ for Wrangler CLI integration)

### One-Command Setup

```bash
git clone https://github.com/27bhd/CloudBoard.git
cd CloudBoard

# Installs dependencies, sets up local .dev.vars, and applies local D1 migrations
bun run setup

# Starts the local development environment
bun run dev
```

Visit [http://localhost:8788](http://localhost:8788) in your browser.

> [!TIP]
> In local development (`DEV_AUTH=1`), you can use the built-in offline developer login form without needing GitHub OAuth credentials.

---

## GitHub OAuth Configuration

To enable real GitHub sign-in locally or in production:

1. Go to [GitHub Developer Settings -> OAuth Apps -> New OAuth App](https://github.com/settings/applications/new).
2. Set:
   - **Application name**: `CloudBoard`
   - **Homepage URL**: `http://localhost:8788` (or your production Pages domain)
   - **Authorization callback URL**: `http://localhost:8788/api/auth/callback` (or `https://<your-project>.pages.dev/api/auth/callback`)
3. Add the credentials:
   - Locally: in `.dev.vars`
     ```ini
     GITHUB_CLIENT_ID=your_client_id
     GITHUB_CLIENT_SECRET=your_client_secret
     SESSION_SECRET=random_32_byte_secret
     ```
   - Production: via Cloudflare Dashboard or Wrangler secrets.

---

## Cloudflare Deployment

### 1. Create the D1 Database

```bash
npx wrangler d1 create cloudboard
```

Copy the returned `database_id` into [`wrangler.toml`](./wrangler.toml):

```toml
[[d1_databases]]
binding = "DB"
database_name = "cloudboard"
database_id = "<your-database-id>"
migrations_dir = "migrations"
```

### 2. Apply Migrations to Remote D1

```bash
bun run db:migrate:remote
```

### 3. Set Production Secrets

```bash
npx wrangler pages secret put SESSION_SECRET
npx wrangler pages secret put GITHUB_CLIENT_ID
npx wrangler pages secret put GITHUB_CLIENT_SECRET
```

### 4. Build and Deploy

```bash
bun run deploy
```

---

## Bulk Ticket Migration (JSON)

Developers migrating from existing issue trackers or batch-importing tasks can use the **Import** button in the project header or POST directly to the API:

```bash
POST /api/projects/:id/tickets/import
Content-Type: application/json
```

Payload schema (JSON array of up to 200 items):

```json
[
  {
    "title": "Configure staging deployment pipeline",
    "description": "Run automated smoke tests before promotion to production.",
    "status": "todo",
    "priority": "high"
  },
  {
    "title": "Document environment variables",
    "description": "List all required production secrets in developer guide.",
    "status": "backlog",
    "priority": "medium"
  }
]
```

---

## Contributing

We welcome community contributions! Please read [`CONTRIBUTING.md`](./CONTRIBUTING.md) for architectural guidelines, TypeScript standards, and pull request procedures.

---

## License

CloudBoard is open-source software licensed under the [MIT License](./LICENSE).
