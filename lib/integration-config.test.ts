import { describe, expect, it } from "vitest";


import { clampTimeout, defaultIntegrationConfig, mergeIntegrationConfig } from "./integration-config";

describe("integration config", () => {
  it("uses env defaults for SOAP", () => {
    expect(defaultIntegrationConfig("SOAP")).toEqual({ timeoutMs: 30000, maxRetries: 3, retryDelayMs: 1000 });
  });

  it("merges an override and clamps it", () => {
    expect(mergeIntegrationConfig("SOAP", { timeoutMs: 999_999, maxRetries: 0, retryDelayMs: 500 })).toEqual({
      timeoutMs: 300_000,
      maxRetries: 1,
      retryDelayMs: 500,
    });
    expect(mergeIntegrationConfig("CIELO", { timeoutMs: 10_000, maxRetries: 3, retryDelayMs: 500 })).toEqual({
      timeoutMs: 10_000,
      maxRetries: 0,
      retryDelayMs: 500,
    });
  });

  it("clamps caller-supplied timeouts", () => {
    expect(clampTimeout(undefined, 5000)).toBe(5000);
    expect(clampTimeout(10, 5000)).toBe(1000);
    expect(clampTimeout(10_000_000, 5000)).toBe(300_000);
  });
});
