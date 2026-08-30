"use server";

import axios from "axios";
import { requirePermission } from "@/lib/rbac";
import { notificationService } from "@/services/notification.service";
import { buildIntegrationTestFailedNotification } from "@/lib/notification-types";
import { classifyError } from "@/lib/error-kind";
import { prisma } from "@/lib/prisma";
import { redactObject } from "@/lib/redact";
import type { Prisma } from "@/generated/prisma/client";

const CIELO_URLS = {
  sandbox: "https://apisandbox.cieloecommerce.cielo.com.br/1/sales",
  production: "https://api.cieloecommerce.cielo.com.br/1/sales",
} as const;

export interface CieloPaymentInput {
  environment: "sandbox" | "production";
  merchantId: string;
  merchantKey: string;
  merchantOrderId: string;
  /** Reais, e.g. 100.00 — converted to centavos before the request, per Cielo's Amount field. */
  amount: number;
  currency: string;
  country: string;
  installments: number;
  interest: "ByMerchant" | "ByIssuer";
  softDescriptor: string;
  capture: boolean;
  authenticate: boolean;
  recurrent: boolean;
  cardNumber: string;
  holder: string;
  expirationDate: string;
  securityCode: string;
  brand: string;
  saveCard: boolean;
  customerName: string;
  customerIdentity: string;
  customerIdentityType: "CPF" | "CNPJ" | "";
  customerEmail: string;
  customerBirthdate: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressZipCode: string;
  addressCity: string;
  addressState: string;
  addressCountry: string;
}

export async function testCieloPayment(input: CieloPaymentInput) {
  const { organizationId, userId } = await requirePermission("integrations", "execute");

  const url = CIELO_URLS[input.environment];

  const address = input.addressStreet || input.addressZipCode || input.addressCity
    ? {
        Street: input.addressStreet,
        ...(input.addressNumber ? { Number: input.addressNumber } : {}),
        ...(input.addressComplement ? { Complement: input.addressComplement } : {}),
        ZipCode: input.addressZipCode,
        City: input.addressCity,
        State: input.addressState,
        Country: input.addressCountry || "BRA",
      }
    : undefined;

  const customer = input.customerName
    ? {
        Name: input.customerName,
        ...(input.customerIdentity ? { Identity: input.customerIdentity } : {}),
        ...(input.customerIdentityType ? { IdentityType: input.customerIdentityType } : {}),
        ...(input.customerEmail ? { Email: input.customerEmail } : {}),
        ...(input.customerBirthdate ? { Birthdate: input.customerBirthdate } : {}),
        ...(address ? { Address: address } : {}),
      }
    : undefined;

  const body = {
    MerchantOrderId: input.merchantOrderId,
    ...(customer ? { Customer: customer } : {}),
    Payment: {
      Type: "CreditCard",
      Amount: Math.round(input.amount * 100),
      Currency: input.currency || "BRL",
      Country: input.country || "BRA",
      Installments: input.installments,
      Interest: input.interest,
      Capture: input.capture,
      Authenticate: input.authenticate,
      Recurrent: input.recurrent,
      ...(input.softDescriptor ? { SoftDescriptor: input.softDescriptor } : {}),
      CreditCard: {
        CardNumber: input.cardNumber,
        Holder: input.holder,
        ExpirationDate: input.expirationDate,
        SecurityCode: input.securityCode,
        Brand: input.brand,
        SaveCard: input.saveCard,
      },
    },
  };

  // Never persist the full card body — only a safe summary (last 4 digits, no CVV/full PAN/merchant key).
  const requestSummary = {
    merchantOrderId: input.merchantOrderId,
    environment: input.environment,
    amount: input.amount,
    installments: input.installments,
    brand: input.brand,
    cardLast4: input.cardNumber.slice(-4),
  };
  const startTime = Date.now();

  try {
    const res = await axios.post(url, body, {
      headers: {
        MerchantId: input.merchantId,
        MerchantKey: input.merchantKey,
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
      timeout: 30_000,
    });
    const duration = Date.now() - startTime;
    const failed = res.status >= 400;

    await prisma.apiLog.create({
      data: {
        organizationId,
        userId,
        integration: "CIELO",
        url,
        httpMethod: "POST",
        httpStatus: res.status,
        duration,
        error: failed ? `HTTP ${res.status}` : undefined,
        requestSummary: requestSummary as Prisma.InputJsonValue,
        responseSummary: (typeof res.data === "object" && res.data !== null ? redactObject(res.data as Record<string, unknown>) : { raw: String(res.data).slice(0, 500) }) as Prisma.InputJsonValue,
      },
    });

    if (failed) {
      const notification = buildIntegrationTestFailedNotification({
        integration: "Cielo",
        errorMessage: `HTTP ${res.status}`,
        errorKind: res.status === 401 ? "auth" : "http",
        url,
      });
      await notificationService.create({ organizationId, userId, ...notification });
    }

    return { success: true, url, httpStatus: res.status, data: res.data };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = (error as Error).message;

    await prisma.apiLog.create({
      data: { organizationId, userId, integration: "CIELO", url, httpMethod: "POST", duration, error: errorMessage, requestSummary },
    });

    const notification = buildIntegrationTestFailedNotification({ integration: "Cielo", errorMessage, errorKind: classifyError(error), url });
    await notificationService.create({ organizationId, userId, ...notification });

    return { success: false, url, error: errorMessage };
  }
}
