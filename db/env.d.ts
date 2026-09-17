declare namespace Cloudflare {
  interface Env {
    AUTH_MODE?: string;
    CF_ACCESS_AUD?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    DB: D1Database;
  }
}
