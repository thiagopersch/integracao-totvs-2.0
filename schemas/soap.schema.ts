import { z } from "zod";

export const soapExecuteSchema = z.object({
  dataserver: z.string().min(1, "Dataserver é obrigatório"),
  process: z.string().min(1, "Processo é obrigatório"),
  method: z.enum(["GETSCHEMA", "READRECORD", "READVIEW", "SAVERECORD"]),
  xml: z.string().min(1, "XML é obrigatório"),
  timeout: z.number().optional(),
  context: z.object({
    coligate: z.number().optional(),
    branch: z.number().optional(),
    levelEducation: z.number().optional(),
    codSystem: z.string().optional(),
    user: z.string().optional(),
  }).optional(),
});

export type SoapExecuteInput = z.output<typeof soapExecuteSchema>;
