import { z } from "zod";

export const SQL_DOC_MAX_SQL_CHARS = 200_000;

export const analyzeSqlQuerySchema = z.object({
  id: z.string().trim().min(1).max(100),
  code: z.string().trim().max(200).default(""),
  title: z.string().trim().max(300).default(""),
  sql: z.string().trim().min(1, "Informe o SQL da consulta").max(SQL_DOC_MAX_SQL_CHARS, "Consulta muito grande (máx. 200 mil caracteres)"),
});

export type AnalyzeSqlQueryInput = z.infer<typeof analyzeSqlQuerySchema>;
