"use server";

import axios from "axios";
import { requirePermission } from "@/lib/rbac";

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
  installments: number;
  softDescriptor: string;
  capture: boolean;
  cardNumber: string;
  holder: string;
  expirationDate: string;
  securityCode: string;
  brand: string;
}

export async function testCieloPayment(input: CieloPaymentInput) {
  await requirePermission("integrations", "execute");

  const url = CIELO_URLS[input.environment];
  const body = {
    MerchantOrderId: input.merchantOrderId,
    Payment: {
      Type: "CreditCard",
      Amount: Math.round(input.amount * 100),
      Installments: input.installments,
      Capture: input.capture,
      ...(input.softDescriptor ? { SoftDescriptor: input.softDescriptor } : {}),
      CreditCard: {
        CardNumber: input.cardNumber,
        Holder: input.holder,
        ExpirationDate: input.expirationDate,
        SecurityCode: input.securityCode,
        Brand: input.brand,
      },
    },
  };

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

    return { success: true, url, httpStatus: res.status, data: res.data };
  } catch (error) {
    return { success: false, url, error: (error as Error).message };
  }
}
