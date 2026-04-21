import { beforeEach } from "vitest";
import { resetEnvCacheForTests } from "../env";

beforeEach(() => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET =
    process.env.JWT_SECRET ?? "test-jwt-secret-please-do-not-use-in-prod-32+";
  process.env.ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ?? "*";
  resetEnvCacheForTests();
});
