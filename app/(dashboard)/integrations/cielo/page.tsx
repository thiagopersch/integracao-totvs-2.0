"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CodeEditor } from "@/components/shared/code-editor"
import { Loader2, CreditCard } from "lucide-react"
import { toast } from "sonner"
import { testCieloPayment } from "@/actions/integrations/cielo"

const BRANDS = ["Visa", "Master", "Amex", "Elo", "Aura", "JCB", "Diners", "Discover"]
const IDENTITY_TYPES = ["CPF", "CNPJ"]
const INTEREST_TYPES = ["ByMerchant", "ByIssuer"]

interface CieloFormState {
  environment: "sandbox" | "production"
  merchantId: string
  merchantKey: string
  merchantOrderId: string
  amount: string
  currency: string
  country: string
  installments: string
  interest: "ByMerchant" | "ByIssuer"
  softDescriptor: string
  capture: boolean
  authenticate: boolean
  recurrent: boolean
  cardNumber: string
  holder: string
  expirationDate: string
  securityCode: string
  brand: string
  saveCard: boolean
  customerName: string
  customerIdentity: string
  customerIdentityType: "CPF" | "CNPJ" | ""
  customerEmail: string
  customerBirthdate: string
  addressStreet: string
  addressNumber: string
  addressComplement: string
  addressZipCode: string
  addressCity: string
  addressState: string
  addressCountry: string
}

const initialForm: CieloFormState = {
  environment: "sandbox",
  merchantId: "",
  merchantKey: "",
  merchantOrderId: "",
  amount: "",
  currency: "BRL",
  country: "BRA",
  installments: "1",
  interest: "ByMerchant",
  softDescriptor: "",
  capture: true,
  authenticate: false,
  recurrent: false,
  cardNumber: "",
  holder: "",
  expirationDate: "",
  securityCode: "",
  brand: "Visa",
  saveCard: false,
  customerName: "",
  customerIdentity: "",
  customerIdentityType: "",
  customerEmail: "",
  customerBirthdate: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressZipCode: "",
  addressCity: "",
  addressState: "",
  addressCountry: "BRA",
}

export default function CieloIntegrationPage() {
  const [form, setForm] = useState<CieloFormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Awaited<ReturnType<typeof testCieloPayment>> | null>(null)

  function update<K extends keyof CieloFormState>(key: K, value: CieloFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (
      !form.merchantId || !form.merchantKey || !form.merchantOrderId || !form.amount ||
      !form.cardNumber || !form.holder || !form.expirationDate || !form.brand
    ) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await testCieloPayment({
        ...form,
        amount: Number(form.amount),
        installments: Number(form.installments) || 1,
      })
      setResult(res)
      if (!res.success) {
        toast.error(res.error || "Erro ao testar pagamento")
      } else if (res.data?.Payment?.ReturnMessage) {
        const ok = res.data.Payment.Status === 1 || res.data.Payment.Status === 2
        if (ok) toast.success(`Pagamento processado: ${res.data.Payment.ReturnMessage}`)
        else toast.error(`Pagamento não aprovado: ${res.data.Payment.ReturnMessage}`)
      } else {
        toast.success("Requisição enviada — veja a resposta abaixo")
      }
    } finally {
      setLoading(false)
    }
  }

  const paymentStatus: number | undefined = result?.success ? result.data?.Payment?.Status : undefined
  const approved = paymentStatus === 1 || paymentStatus === 2

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-5 w-5" /> Cielo — Pagamento com Cartão de Crédito
        </h1>
        <p className="text-sm text-muted-foreground">
          Testa a criação de um pagamento de crédito na API e-commerce da Cielo antes de configurar a integração.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset className="space-y-3 rounded-lg border border-input p-3">
              <legend className="px-1 text-sm font-medium text-muted-foreground">Credenciais</legend>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="environment">Ambiente</FieldLabel>
                  <Select
                    items={[{ value: "sandbox", label: "Sandbox" }, { value: "production", label: "Produção" }]}
                    value={form.environment}
                    onValueChange={(v) => update("environment", (v || "sandbox") as CieloFormState["environment"])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="production">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="merchantId">Merchant Id</FieldLabel>
                  <Input id="merchantId" value={form.merchantId} onChange={(e) => update("merchantId", e.target.value)} placeholder="GUID" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="merchantKey">Merchant Key</FieldLabel>
                  <Input id="merchantKey" value={form.merchantKey} onChange={(e) => update("merchantKey", e.target.value)} />
                </Field>
              </div>
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-input p-3">
              <legend className="px-1 text-sm font-medium text-muted-foreground">Pedido</legend>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Field>
                  <FieldLabel htmlFor="merchantOrderId">Número do Pedido</FieldLabel>
                  <Input id="merchantOrderId" value={form.merchantOrderId} onChange={(e) => update("merchantOrderId", e.target.value)} placeholder="Ex: PEDIDO123" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="amount">Valor (R$)</FieldLabel>
                  <Input id="amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="100.00" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="installments">Parcelas</FieldLabel>
                  <Input id="installments" type="number" min="1" max="24" value={form.installments} onChange={(e) => update("installments", e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="interest">Juros</FieldLabel>
                  <Select
                    items={INTEREST_TYPES.map((i) => ({ value: i, label: i }))}
                    value={form.interest}
                    onValueChange={(v) => update("interest", (v || "ByMerchant") as CieloFormState["interest"])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTEREST_TYPES.map((i) => (
                        <SelectItem key={i} value={i}>{i}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="currency">Moeda</FieldLabel>
                  <Input id="currency" maxLength={3} value={form.currency} onChange={(e) => update("currency", e.target.value)} placeholder="BRL" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="country">País</FieldLabel>
                  <Input id="country" maxLength={3} value={form.country} onChange={(e) => update("country", e.target.value)} placeholder="BRA" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="softDescriptor">Soft Descriptor</FieldLabel>
                  <Input id="softDescriptor" maxLength={13} value={form.softDescriptor} onChange={(e) => update("softDescriptor", e.target.value)} placeholder="Opcional" />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox id="capture" checked={form.capture} onCheckedChange={(v) => update("capture", v === true)} />
                  <Label htmlFor="capture">Capturar automaticamente</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="authenticate" checked={form.authenticate} onCheckedChange={(v) => update("authenticate", v === true)} />
                  <Label htmlFor="authenticate">Autenticar (3DS)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="recurrent" checked={form.recurrent} onCheckedChange={(v) => update("recurrent", v === true)} />
                  <Label htmlFor="recurrent">Recorrente</Label>
                </div>
              </div>
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-input p-3">
              <legend className="px-1 text-sm font-medium text-muted-foreground">Cliente (opcional)</legend>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="customerName">Nome</FieldLabel>
                  <Input id="customerName" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} placeholder="Nome do comprador" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="customerIdentity">CPF/CNPJ</FieldLabel>
                  <Input id="customerIdentity" maxLength={14} value={form.customerIdentity} onChange={(e) => update("customerIdentity", e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="customerIdentityType">Tipo do documento</FieldLabel>
                  <Select
                    items={IDENTITY_TYPES.map((t) => ({ value: t, label: t }))}
                    value={form.customerIdentityType || null}
                    onValueChange={(v) => update("customerIdentityType", (v || "") as CieloFormState["customerIdentityType"])}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {IDENTITY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="customerEmail">E-mail</FieldLabel>
                  <Input id="customerEmail" type="email" value={form.customerEmail} onChange={(e) => update("customerEmail", e.target.value)} placeholder="email@exemplo.com" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="customerBirthdate">Data de nascimento</FieldLabel>
                  <Input id="customerBirthdate" type="date" value={form.customerBirthdate} onChange={(e) => update("customerBirthdate", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="addressStreet">Endereço</FieldLabel>
                  <Input id="addressStreet" value={form.addressStreet} onChange={(e) => update("addressStreet", e.target.value)} placeholder="Rua, avenida..." />
                </Field>
                <Field>
                  <FieldLabel htmlFor="addressNumber">Número</FieldLabel>
                  <Input id="addressNumber" value={form.addressNumber} onChange={(e) => update("addressNumber", e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="addressComplement">Complemento</FieldLabel>
                  <Input id="addressComplement" value={form.addressComplement} onChange={(e) => update("addressComplement", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <Field>
                  <FieldLabel htmlFor="addressZipCode">CEP</FieldLabel>
                  <Input id="addressZipCode" maxLength={9} value={form.addressZipCode} onChange={(e) => update("addressZipCode", e.target.value)} placeholder="00000000" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="addressCity">Cidade</FieldLabel>
                  <Input id="addressCity" value={form.addressCity} onChange={(e) => update("addressCity", e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="addressState">UF</FieldLabel>
                  <Input id="addressState" maxLength={2} value={form.addressState} onChange={(e) => update("addressState", e.target.value)} placeholder="SP" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="addressCountry">País</FieldLabel>
                  <Input id="addressCountry" maxLength={3} value={form.addressCountry} onChange={(e) => update("addressCountry", e.target.value)} placeholder="BRA" />
                </Field>
              </div>
            </fieldset>

            <fieldset className="space-y-3 rounded-lg border border-input p-3">
              <legend className="px-1 text-sm font-medium text-muted-foreground">Cartão de crédito</legend>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="cardNumber">Número do Cartão</FieldLabel>
                  <Input id="cardNumber" value={form.cardNumber} onChange={(e) => update("cardNumber", e.target.value)} placeholder="0000000000000000" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="holder">Nome do Titular</FieldLabel>
                  <Input id="holder" maxLength={25} value={form.holder} onChange={(e) => update("holder", e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field>
                  <FieldLabel htmlFor="expirationDate">Validade</FieldLabel>
                  <Input id="expirationDate" value={form.expirationDate} onChange={(e) => update("expirationDate", e.target.value)} placeholder="MM/AAAA" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="securityCode">Código de Segurança</FieldLabel>
                  <Input id="securityCode" maxLength={4} value={form.securityCode} onChange={(e) => update("securityCode", e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="brand">Bandeira</FieldLabel>
                  <Select items={BRANDS.map((b) => ({ value: b, label: b }))} value={form.brand} onValueChange={(v) => update("brand", v || "Visa")}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANDS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="saveCard" checked={form.saveCard} onCheckedChange={(v) => update("saveCard", v === true)} />
                <Label htmlFor="saveCard">Salvar cartão (tokenização)</Label>
              </div>
            </fieldset>

            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Testar Pagamento
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Resposta</span>
            {result?.success && (
              <div className="flex items-center gap-2">
                {result.httpStatus !== undefined && <Badge variant="outline">HTTP {result.httpStatus}</Badge>}
                {paymentStatus !== undefined && (
                  <Badge variant={approved ? "default" : "destructive"}>
                    {approved ? "Aprovado" : "Não aprovado"}
                  </Badge>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-muted-foreground text-sm">Teste o pagamento para ver a resposta da API.</p>
          ) : result.success ? (
            <CodeEditor value={JSON.stringify(result.data, null, 2)} language="json" readOnly minHeight="240px" />
          ) : (
            <CodeEditor value={result.error ?? ""} language="json" readOnly minHeight="120px" />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
