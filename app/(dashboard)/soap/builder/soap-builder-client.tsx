"use client"

import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CodeEditor } from "@/components/shared/code-editor"
import { Play, Copy, Download, Loader2, Code2, FileJson, Table2, Globe, Braces, Database, Workflow, Search } from "lucide-react"
import { toast } from "sonner"
import axios from "axios"
import { xmlToJson, jsonToXml, safeFormatXmlDeep } from "@/utils/xml"
import { formatDuration } from "@/utils/format"
import { useSoapStore } from "@/store/soap.store"

type EndpointMethod = {
  id: string
  method: string
  label: string
  active: boolean
}

type EndpointType = {
  id: string
  type: string
  label: string
  suffix: string
  active: boolean
  methods: EndpointMethod[]
}

type TbcOption = {
  id: string
  name: string
  link: string
  notRequiredLicense: boolean
  client: { id: string; name: string } | null
}

type ClientOption = { id: string; name: string }
type SistemaOption = { id: string; code: string; internalName: string; externalName: string }

interface SoapBuilderClientProps {
  initialEndpointTypes: EndpointType[]
  initialTbcs: TbcOption[]
  initialClients: ClientOption[]
  initialSistemas: SistemaOption[]
}

export function SoapBuilderClient({ initialEndpointTypes, initialTbcs, initialClients, initialSistemas }: SoapBuilderClientProps) {
  const endpointTypes = initialEndpointTypes
  const tbcs = initialTbcs
  const clients = initialClients
  const sistemas = initialSistemas

  const selectedTypeId = useSoapStore((state) => state.selectedTypeId)
  const setSelectedTypeId = useSoapStore((state) => state.setSelectedTypeId)
  const selectedMethodId = useSoapStore((state) => state.selectedMethodId)
  const setSelectedMethodId = useSoapStore((state) => state.setSelectedMethodId)
  const selectedSistemaId = useSoapStore((state) => state.selectedSistemaId)
  const setSelectedSistemaId = useSoapStore((state) => state.setSelectedSistemaId)
  const selectedClientId = useSoapStore((state) => state.selectedClientId)
  const setSelectedClientId = useSoapStore((state) => state.setSelectedClientId)
  const selectedTbcId = useSoapStore((state) => state.selectedTbcId)
  const setSelectedTbcId = useSoapStore((state) => state.setSelectedTbcId)
  const xmlContent = useSoapStore((state) => state.xmlContent)
  const setXmlContent = useSoapStore((state) => state.setXmlContent)
  const jsonContent = useSoapStore((state) => state.jsonContent)
  const setJsonContent = useSoapStore((state) => state.setJsonContent)
  const activeTab = useSoapStore((state) => state.activeTab)
  const setActiveTab = useSoapStore((state) => state.setActiveTab)
  const response = useSoapStore((state) => state.response)
  const setResponse = useSoapStore((state) => state.setResponse)
  const error = useSoapStore((state) => state.error)
  const setError = useSoapStore((state) => state.setError)
  const context = useSoapStore((state) => state.context)
  const setContext = useSoapStore((state) => state.setContext)
  const timeout = useSoapStore((state) => state.timeout)
  const setTimeout_ = useSoapStore((state) => state.setTimeout)

  const [loading, setLoading] = useState(false)
  // Bumped whenever the request XML/JSON is set programmatically (type/method change, schema
  // fetch) — used as CodeEditor's resetKey so the box actually refreshes to show it; left alone
  // while the user types, so their own edits never get stomped by a remount.
  const [requestVersion, setRequestVersion] = useState(0)
  const [responseVersion, setResponseVersion] = useState(0)

  const selectedType = endpointTypes.find((t) => t.id === selectedTypeId)
  const methods = selectedType?.methods ?? []
  const tbcsForClient = selectedClientId ? tbcs.filter((t) => t.client?.id === selectedClientId) : tbcs
  const selectedTbc = tbcs.find((t) => t.id === selectedTbcId)
  const selectedMethodObj = methods.find((m) => m.id === selectedMethodId)
  const selectedMethod = selectedMethodObj?.method
  const fullUrl = (() => {
    if (!selectedTbc || !selectedType) return ""
    const base = selectedTbc.link.replace(/\/+$/, "")
    const prefix = selectedTbc.notRequiredLicense ? "EduLicense" : ""
    const wsFolder = selectedType.suffix
    const isSharedAuthMethod = selectedMethod === "AUTENTICAACESSO"
    const port = isSharedAuthMethod ? "IwsBase" : `Iws${wsFolder.slice(2)}`
    return `${base}/${prefix}${wsFolder}/${port}`
  })()

  /** Programmatic updates (type/method switch, schema fetch) — bumps requestVersion so the
   *  still-mounted CodeEditor actually remounts and shows the new content. */
  function setRequestXml(newXml: string) {
    setXmlContent(newXml)
    try {
      setJsonContent(JSON.stringify(xmlToJson(newXml), null, 2))
    } catch { /* empty */ }
    setRequestVersion((v) => v + 1)
  }

  /** User typing in the XML editor — must NOT bump requestVersion, or every keystroke remounts
   *  the editor and resets the cursor. */
  function handleXmlChange(newXml: string) {
    setXmlContent(newXml)
    try {
      setJsonContent(JSON.stringify(xmlToJson(newXml), null, 2))
    } catch { /* empty */ }
  }

  function handleSelectType(type: EndpointType) {
    setSelectedTypeId(type.id)
    const firstMethod = type.methods[0]
    if (!firstMethod) {
      setSelectedMethodId("")
      return
    }
    setSelectedMethodId(firstMethod.id)
    setRequestXml(`<${firstMethod.method} />`)
  }

  function handleSelectMethod(methodId: string) {
    setSelectedMethodId(methodId)
    const method = methods.find((m) => m.id === methodId)
    if (method) setRequestXml(`<${method.method} />`)
  }

  function handleSelectSistema(sistemaId: string) {
    setSelectedSistemaId(sistemaId)
    const sistema = sistemas.find((s) => s.id === sistemaId)
    if (sistema) setContext({ codSystem: sistema.code })
  }

  function handleSelectClient(clientId: string) {
    setSelectedClientId(clientId)
    const stillValid = tbcs.find((t) => t.id === selectedTbcId && t.client?.id === clientId)
    if (!stillValid) setSelectedTbcId("")
  }

  function handleJsonChange(newJson: string) {
    setJsonContent(newJson)
    try {
      setXmlContent(jsonToXml(JSON.parse(newJson)))
    } catch { /* empty */ }
  }

  async function handleExecute() {
    if (!selectedTypeId) { toast.error("Selecione o sistema/endpoint"); return }
    if (!selectedMethodId) { toast.error("Selecione o método"); return }
    if (!selectedTbcId) { toast.error("Selecione o TBC"); return }

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      let xml = xmlContent
      if (selectedMethodObj?.method === "GETSCHEMA" || selectedMethodObj?.method === "GETSCHEMA2") {
        xml = "<GetSchema />"
      }

      const res = await axios.post("/api/soap/execute", {
        endpointTypeId: selectedTypeId,
        methodId: selectedMethodId,
        tbcId: selectedTbcId,
        xml,
        context,
        timeout,
      })

      setResponse(res.data)
      setResponseVersion((v) => v + 1)
      toast.success(`Executado em ${formatDuration(res.data.duration)}`)
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || err.message : (err as Error).message
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleGetSchema() {
    if (!selectedTypeId || !selectedTbcId) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }
    const schemaMethod = methods.find((m) => m.method === "GETSCHEMA" || m.method === "GETSCHEMA2")
    if (!schemaMethod) {
      toast.error("Este tipo de endpoint não tem um método Get Schema cadastrado em /admin/soap-endpoints")
      return
    }

    setLoading(true)
    try {
      const res = await axios.post("/api/soap/execute", {
        endpointTypeId: selectedTypeId,
        methodId: schemaMethod.id,
        tbcId: selectedTbcId,
        xml: "<GetSchema />",
        context,
        timeout,
      })
      setRequestXml(safeFormatXmlDeep(res.data.xmlResponse))
      toast.success("Schema gerado")
    } catch (err) {
      toast.error(axios.isAxiosError(err) ? err.response?.data?.error || err.message : (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleCopyXml() {
    navigator.clipboard.writeText(xmlContent)
    toast.success("XML copiado")
  }

  function handleDownloadXml() {
    const blob = new Blob([xmlContent], { type: "text/xml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `soap-request-${Date.now()}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderTable = useCallback((jsonData: Record<string, unknown> | null, emptyMessage: string) => {
    if (!jsonData || typeof jsonData !== "object") return <p className="text-muted-foreground text-sm p-4">{emptyMessage}</p>
    const entries = Object.entries(jsonData)
    if (entries.length === 0) return <p className="text-muted-foreground text-sm p-4">{emptyMessage}</p>

    const firstValue = entries[0][1]
    if (Array.isArray(firstValue)) {
      if (firstValue.length === 0) return <p className="text-muted-foreground text-sm p-4">{emptyMessage}</p>
      const columns = Object.keys(firstValue[0] || {})
      return (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {(firstValue as Record<string, unknown>[]).map((row, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col}>{String(row[col] ?? "")}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )
    }

    return (
      <Table>
        <TableBody>
          {entries.map(([key, value]) => (
            <TableRow key={key}>
              <TableHead className="w-1/3">{key}</TableHead>
              <TableCell>{String(value ?? "")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }, [])

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Integração SOAP</h1>
          <p className="text-sm text-muted-foreground">Builder de chamadas SOAP para TOTVS RM</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyXml}>
            <Copy className="h-4 w-4 mr-2" /> Copiar XML
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadXml}>
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            {endpointTypes.map((type) => (
              <Button
                key={type.id}
                variant={selectedTypeId === type.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleSelectType(type)}
                className="flex items-center gap-1"
              >
                {type.type === "dataserver" ? <Database className="h-4 w-4" /> :
                 type.type === "process" ? <Workflow className="h-4 w-4" /> :
                 type.type === "consulta" ? <Search className="h-4 w-4" /> :
                 type.type === "formula" ? <Braces className="h-4 w-4" /> :
                 <Globe className="h-4 w-4" />}
                {type.label}
              </Button>
            ))}
          </div>

          <fieldset className="space-y-3 rounded-lg border border-input p-3">
            <legend className="px-1 text-sm font-medium text-muted-foreground">Destino da chamada</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Sistema TOTVS</Label>
                <Select
                  items={sistemas.map((s) => ({ value: s.id, label: `${s.code} - ${s.internalName}` }))}
                  value={selectedSistemaId || null}
                  onValueChange={(v) => handleSelectSistema(v || "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar sistema..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sistemas.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.code} - {s.internalName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Combobox
                  items={clients.map((c) => ({ value: c.id, label: c.name }))}
                  value={selectedClientId}
                  onValueChange={handleSelectClient}
                  placeholder="Selecionar cliente..."
                  searchPlaceholder="Buscar cliente..."
                  emptyText="Nenhum cliente encontrado."
                />
              </div>
              <div className="space-y-2">
                <Label>TBC</Label>
                <Combobox
                  items={tbcsForClient.map((t) => ({ value: t.id, label: `${t.name}${t.client ? ` (${t.client.name})` : ""}` }))}
                  value={selectedTbcId}
                  onValueChange={setSelectedTbcId}
                  placeholder="Selecionar TBC..."
                  searchPlaceholder="Buscar TBC..."
                  emptyText="Nenhum TBC encontrado."
                />
              </div>
              <div className="space-y-2">
                <Label>Método</Label>
                <Select
                  items={methods.map((m) => ({ value: m.id, label: m.label }))}
                  value={selectedMethodId || null}
                  onValueChange={(v) => handleSelectMethod(v || "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar método..." />
                  </SelectTrigger>
                  <SelectContent>
                    {methods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>URL da requisição</Label>
                <Input value={fullUrl} readOnly className="w-full font-mono text-xs" placeholder="Selecione o sistema e o TBC..." />
              </div>
              <div className="space-y-2">
                <Label>Tempo limite (ms)</Label>
                <Input type="number" value={timeout} onChange={(e) => setTimeout_(Number(e.target.value))} className="w-full" />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-input p-3">
            <legend className="px-1 text-sm font-medium text-muted-foreground">Contexto de execução</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <div className="space-y-2">
                <Label>Coligada</Label>
                <Input type="number" value={context.coligate} onChange={(e) => setContext({ coligate: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Filial</Label>
                <Input type="number" value={context.branch} onChange={(e) => setContext({ branch: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Nível de Ensino</Label>
                <Input type="number" value={context.levelEducation} onChange={(e) => setContext({ levelEducation: Number(e.target.value) })} className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Código do Sistema</Label>
                <Input value={context.codSystem} onChange={(e) => setContext({ codSystem: e.target.value })} className="w-full" />
              </div>
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input value={context.user} onChange={(e) => setContext({ user: e.target.value })} className="w-full" />
              </div>
            </div>
          </fieldset>

          <div className="flex items-center gap-2">
            <Button onClick={handleExecute} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Executar
            </Button>
            <Button variant="secondary" onClick={handleGetSchema} disabled={loading}>
              <Code2 className="h-4 w-4 mr-2" /> GETSCHEMA
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="xml"><Code2 className="h-3 w-3 mr-1" /> XML</TabsTrigger>
                  <TabsTrigger value="json"><FileJson className="h-3 w-3 mr-1" /> JSON</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTab === "xml" ? (
              <CodeEditor value={xmlContent} onChange={handleXmlChange} language="xml" resetKey={requestVersion} minHeight="400px" />
            ) : (
              <CodeEditor value={jsonContent} onChange={handleJsonChange} language="json" resetKey={requestVersion} minHeight="400px" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Resposta</span>
              {response && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{formatDuration(response.duration)}</Badge>
                  <Badge variant={response.status < 400 ? "default" : "destructive"}>
                    {response.status}
                  </Badge>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="xml">
              <TabsList className="mb-2">
                <TabsTrigger value="xml">XML</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
                <TabsTrigger value="table">
                  <Table2 className="h-3 w-3 mr-1" /> Tabela
                </TabsTrigger>
              </TabsList>
              <TabsContent value="xml" className="m-0">
                {response ? (
                  <CodeEditor value={safeFormatXmlDeep(response.xmlResponse)} language="xml" readOnly theme="dark" resetKey={responseVersion} minHeight="400px" />
                ) : error ? (
                  <pre className="text-xs font-mono text-destructive whitespace-pre-wrap p-3">{error}</pre>
                ) : (
                  <p className="text-muted-foreground text-sm p-4">Execute uma chamada para ver a resposta</p>
                )}
              </TabsContent>
              <TabsContent value="json" className="m-0">
                {response ? (
                  <CodeEditor value={JSON.stringify(response.jsonResponse, null, 2)} language="json" readOnly theme="dark" resetKey={responseVersion} minHeight="400px" />
                ) : (
                  <p className="text-muted-foreground text-sm p-4">Execute uma chamada para ver a resposta</p>
                )}
              </TabsContent>
              <TabsContent value="raw" className="m-0">
                <ScrollArea className="h-[400px] rounded-lg border border-input p-4">
                  {response ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap">{response.xmlResponse}</pre>
                  ) : (
                    <p className="text-muted-foreground text-sm">Execute uma chamada para ver a resposta raw</p>
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="table" className="m-0">
                <ScrollArea className="h-[400px] rounded-lg border border-input">
                  {response ? (
                    <div>
                      {renderTable(
                        response.jsonResponse,
                        selectedMethod === "REALIZARCONSULTASQL" || selectedMethod === "REALIZARCONSULTASQLCONTEXTO"
                          ? "Nenhuma informação retornada da consulta"
                          : "Sem dados tabulares"
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm p-4">Execute uma chamada para ver os dados em tabela</p>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
