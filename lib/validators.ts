import { z } from "zod"
import { isValidDocument, onlyDigits } from "@/lib/masks"

export function nameSchema(label = "Nome") {
  return z
    .string()
    .min(1, `${label} é obrigatório`)
    .min(3, `${label} deve ter no mínimo 3 caracteres`)
    .max(155, `${label} deve ter no máximo 155 caracteres`)
}

export function optionalNameSchema(label = "Nome") {
  return z
    .string()
    .max(155, `${label} deve ter no máximo 155 caracteres`)
    .optional()
    .or(z.literal(""))
}

function requiredEmail() {
  return z.email("Email inválido").max(60, "Email deve ter no máximo 60 caracteres").min(1, "Email é obrigatório")
}
function optionalEmail() {
  return z.email("Email inválido").max(60, "Email deve ter no máximo 60 caracteres").optional().or(z.literal(""))
}
export function emailSchema(required: true): ReturnType<typeof requiredEmail>
export function emailSchema(required: false): ReturnType<typeof optionalEmail>
export function emailSchema(required: boolean): ReturnType<typeof requiredEmail> | ReturnType<typeof optionalEmail>
export function emailSchema(required: boolean) {
  return required ? requiredEmail() : optionalEmail()
}

function phoneBase() {
  return z
    .string()
    .max(15, "Telefone deve ter no máximo 15 caracteres")
    .refine((value) => !value || onlyDigits(value).length >= 10, {
      message: "Telefone inválido",
    })
}
function requiredPhone() {
  return phoneBase().min(1, "Telefone é obrigatório")
}
function optionalPhone() {
  return phoneBase().optional().or(z.literal(""))
}
export function phoneSchema(required: true): ReturnType<typeof requiredPhone>
export function phoneSchema(required: false): ReturnType<typeof optionalPhone>
export function phoneSchema(required: boolean): ReturnType<typeof requiredPhone> | ReturnType<typeof optionalPhone>
export function phoneSchema(required: boolean) {
  return required ? requiredPhone() : optionalPhone()
}

function documentBase() {
  return z.string().refine((value) => !value || isValidDocument(value), {
    message: "CPF/CNPJ inválido",
  })
}
function requiredDocument() {
  return documentBase().min(1, "CPF/CNPJ é obrigatório")
}
function optionalDocument() {
  return documentBase().optional().or(z.literal(""))
}
export function documentSchema(required: true): ReturnType<typeof requiredDocument>
export function documentSchema(required: false): ReturnType<typeof optionalDocument>
export function documentSchema(required: boolean): ReturnType<typeof requiredDocument> | ReturnType<typeof optionalDocument>
export function documentSchema(required: boolean) {
  return required ? requiredDocument() : optionalDocument()
}

export function dateSchema() {
  return z.date({
    error: (issue) => (issue.input === undefined ? "Campo obrigatório" : "Data inválida"),
  })
}

export const passwordRequirements = {
  minLength: 8,
  maxLength: 32,
  hasUppercase: (value: string) => /[A-Z]/.test(value),
  hasLowercase: (value: string) => /[a-z]/.test(value),
  hasNumber: (value: string) => /\d/.test(value),
  hasSpecial: (value: string) => /[!@#$%^&*]/.test(value),
}

function passwordBase() {
  return z
    .string()
    .min(passwordRequirements.minLength, "Senha deve ter no mínimo 8 caracteres")
    .max(passwordRequirements.maxLength, "Senha deve ter no máximo 32 caracteres")
    .refine(passwordRequirements.hasUppercase, "Senha deve conter ao menos uma letra maiúscula")
    .refine(passwordRequirements.hasLowercase, "Senha deve conter ao menos uma letra minúscula")
    .refine(passwordRequirements.hasNumber, "Senha deve conter ao menos um número")
    .refine(passwordRequirements.hasSpecial, "Senha deve conter ao menos um caractere especial (!@#$%^&*)")
}
function requiredPassword() {
  return passwordBase()
}
function optionalPassword() {
  return passwordBase().optional().or(z.literal(""))
}
export function passwordSchema(required: true): ReturnType<typeof requiredPassword>
export function passwordSchema(required: false): ReturnType<typeof optionalPassword>
export function passwordSchema(required: boolean): ReturnType<typeof requiredPassword> | ReturnType<typeof optionalPassword>
export function passwordSchema(required: boolean) {
  return required ? requiredPassword() : optionalPassword()
}
