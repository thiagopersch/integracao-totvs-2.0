import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", () => ({ redis: null }));

import { forgetSoapAuth, isSoapAuthCached, rememberSoapAuth, soapAuthCacheKey } from "./soap-auth-cache";

describe("soap auth cache (memory fallback)", () => {
  const tbc = { link: "https://rm.example/", user: "u", password: "enc:abc" };

  it("keys change with the password or the ws", () => {
    expect(soapAuthCacheKey(tbc, "wsDataServer")).not.toBe(soapAuthCacheKey({ ...tbc, password: "enc:new" }, "wsDataServer"));
    expect(soapAuthCacheKey(tbc, "wsDataServer")).not.toBe(soapAuthCacheKey(tbc, "wsProcess"));
  });

  it("remembers and forgets a handshake", async () => {
    const key = soapAuthCacheKey(tbc, "wsDataServer");
    expect(await isSoapAuthCached(key)).toBe(false);
    await rememberSoapAuth(key);
    expect(await isSoapAuthCached(key)).toBe(true);
    await forgetSoapAuth(key);
    expect(await isSoapAuthCached(key)).toBe(false);
  });
});
