import { describe, expect, it } from "vitest";
import { classifyError, isPermissionDeniedMessage } from "./error-kind";

describe("isPermissionDeniedMessage", () => {
  it("recognizes TOTVS RM permission-denied wording", () => {
    expect(isPermissionDeniedMessage("Usuário sem permissão para acessar o DataServer EduPSAreaOfertadaData")).toBe(true);
    expect(isPermissionDeniedMessage("O usuário mestre não possui permissão de acesso ao sistema")).toBe(true);
    expect(isPermissionDeniedMessage("Acesso negado")).toBe(true);
    expect(isPermissionDeniedMessage("Permissão negada para executar a operação")).toBe(true);
    expect(isPermissionDeniedMessage("Access is denied.")).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isPermissionDeniedMessage("Object reference not set to an instance of an object.")).toBe(false);
    expect(isPermissionDeniedMessage("Timeout of 30000ms exceeded")).toBe(false);
    expect(isPermissionDeniedMessage(null)).toBe(false);
  });
});

describe("classifyError", () => {
  it("maps HTTP 403 to permission and 401 to auth", () => {
    expect(classifyError({ response: { status: 403 } })).toBe("permission");
    expect(classifyError({ response: { status: 401 } })).toBe("auth");
  });
});
