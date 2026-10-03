/** Bindings and secrets available to every edge handler. */
export interface Env {
  DB: D1Database;
  /** 32+ random bytes, base64/hex — signs session and OAuth-state cookies. */
  SESSION_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  /** Set to "1" in `.dev.vars` to enable offline sign-in (honoured on localhost only). */
  DEV_AUTH?: string;
}
