/// <reference path="../.astro/types.d.ts" />

declare module "cloudflare:workers" {
  export const env: {
    AUTH_RATE_LIMIT?: import("./lib/rate-limit.ts").CloudflareKVLike;
    SESSION?: import("./lib/rate-limit.ts").CloudflareKVLike;
  };
}

declare namespace App {
  interface Locals {
    user: import("./lib/auth.ts").AuthUser | null;
    accessToken: string | null;
  }
}
