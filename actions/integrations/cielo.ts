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
  await requirePermission("integrations", "execute");

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
