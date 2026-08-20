export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "")
}

export function formatPhone(value: string | null | undefined): string {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length === 0) return ""
  if (digits.length <= 2) return digits.replace(/^(\d*)/, "($1")
  if (digits.length <= 6) return digits.replace(/^(\d{2})(\d*)/, "($1) $2")
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d*)/, "($1) $2-$3")
  }
  return digits.replace(/^(\d{2})(\d{5})(\d*)/, "($1) $2-$3")
}

export function formatDocument(value: string | null | undefined): string {
  const digits = onlyDigits(value).slice(0, 14)

  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4")
  }
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5")
}

export function isValidCPF(value: string | null | undefined): boolean {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  const digits = cpf.split("").map(Number)
  const calcCheckDigit = (length: number) => {
    let sum = 0
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i)
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return calcCheckDigit(9) === digits[9] && calcCheckDigit(10) === digits[10]
}

export function isValidCNPJ(value: string | null | undefined): boolean {
  const cnpj = onlyDigits(value)
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false

  const digits = cnpj.split("").map(Number)
  const calcCheckDigit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    let sum = 0
    for (let i = 0; i < length; i++) sum += digits[i] * weights[i]
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  return calcCheckDigit(12) === digits[12] && calcCheckDigit(13) === digits[13]
}

export function isValidDocument(value: string | null | undefined): boolean {
  const digits = onlyDigits(value)
  if (!digits) return false
  return digits.length === 11 ? isValidCPF(digits) : isValidCNPJ(digits)
}
