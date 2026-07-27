/// <reference types="next/navigation" />
/// <reference types="next/image" />
/// <reference types="next/headers" />

declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    JWT_SECRET: string;
    JWT_ACCESS_EXPIRY?: string;
    JWT_REFRESH_EXPIRY?: string;
    UPSTASH_REDIS_REST_URL?: string;
    UPSTASH_REDIS_REST_TOKEN?: string;
  }
}
