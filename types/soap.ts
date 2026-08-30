import { SoapMethod } from "@/generated/prisma/client";

export type SoapExecuteRequest = {
  dataserver: string;
  process: string;
  method: SoapMethod;
  xml: string;
  context?: SoapContext;
  timeout?: number;
};

export type SoapContext = {
  coligate?: number;
  branch?: number;
  levelEducation?: number;
  codSystem?: string;
  user?: string;
};

export type SoapExecuteResponse = {
  xmlResponse: string;
  jsonResponse: Record<string, unknown>;
  duration: number;
  status: number;
};

export type SoapLogEntry = {
  id: string;
  dataserver: string | null;
  process: string | null;
  method: SoapMethod | null;
  xmlRequest: string | null;
  xmlResponse: string | null;
  jsonResponse: Record<string, unknown> | null;
  status: number | null;
  duration: number | null;
  error: string | null;
  createdAt: Date;
};

export type SoapTemplate = {
  id: string;
  name: string;
  description: string | null;
  dataserver: string | null;
  process: string | null;
  method: SoapMethod | null;
  xmlTemplate: string | null;
};
