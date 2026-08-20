"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { EditorView, basicSetup } from "codemirror"
import { EditorState } from "@codemirror/state"
import { xml } from "@codemirror/lang-xml"
import { json } from "@codemirror/lang-json"
import { oneDark } from "@codemirror/theme-one-dark"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Play, Save, Star, Copy, Download, Loader2, Code2, FileJson, Table2, Radio, Globe, Braces, Database, Workflow, Search } from "lucide-react"
import { toast } from "sonner"
import axios from "axios"
import { formatXml, xmlToJson, jsonToXml } from "@/utils/xml"
import { formatDuration } from "@/utils/format"
import { cn } from "@/utils/cn"

type EndpointType = {
  id: string
  type: string
  label: string
  suffix: string
  active: boolean
}

type EndpointMethod = {
  id: string
  method: string
  label: string
  active: boolean
}

type TbcOption = {
  id: string
  name: string
  link: string
  client: { id: string; name: string } | null
}

export default function SoapBuilderPage() {
  const { theme } = useTheme()
  const xmlEditorRef = useRef<HTMLDivElement>(null)
  const jsonEditorRef = useRef<HTMLDivElement>(null)
  const xmlViewRef = useRef<EditorView | null>(null)
  const jsonViewRef = useRef<EditorView | null>(null)

  const [endpointTypes, setEndpointTypes] = useState<EndpointType[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState("")
  const [methods, setMethods] = useState<EndpointMethod[]>([])
  const [selectedMethodId, setSelectedMethodId] = useState("")
  const [tbcs, setTbcs] = useState<TbcOption[]>([])
  const [selectedTbcId, setSelectedTbcId] = useState("")
  const [tbcSearch, setTbcSearch] = useState("")
  const [xmlContent, setXmlContent] = useState("<GetSchema />")
  const [jsonContent, setJsonContent] = useState("{}")
  const [activeTab, setActiveTab] = useState("xml")
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<{
    xmlResponse: string
    jsonResponse: Record<string, unknown>
    duration: number
    status: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [context, setContext] = useState({
    coligate: 1,
    branch: 1,
    levelEducation: 1,
    codSystem: "",
    user: "",
  })
  const [timeout, setTimeout_] = useState(30000)

  const selectedType = endpointTypes.find((t) => t.id === selectedTypeId)
  const selectedTbc = tbcs.find((t) => t.id === selectedTbcId)
  const selectedMethodObj = methods.find((m) => m.id === selectedMethodId)
  const fullUrl = selectedTbc ? `${selectedTbc.link}${selectedType?.suffix || ""}` : ""

  const filteredTbcs = tbcs.filter(
    (t) =>
      t.name.toLowerCase().includes(tbcSearch.toLowerCase()) ||
      t.link.toLowerCase().includes(tbcSearch.toLowerCase()) ||
      (t.client?.name || "").toLowerCase().includes(tbcSearch.toLowerCase())
  )

  useEffect(() => {
    Promise.all([
      axios.get("/api/soap/endpoint-types"),
      axios.get("/api/soap/tbcs"),
    ]).then(([typesRes, tbcsRes]) => {
      setEndpointTypes(typesRes.data)
      setTbcs(tbcsRes.data)
    }).catch(() => {
      toast.error("Erro ao carregar dados")
    })
  }, [])

  useEffect(() => {
    if (!selectedTypeId) {
      setMethods([])
      setSelectedMethodId("")
      return
    }
    axios.get(`/api/soap/methods?endpointTypeId=${selectedTypeId}`)
      .then((res) => {
        setMethods(res.data)
        if (res.data.length > 0) {
          setSelectedMethodId(res.data[0].id)
          const initialXml = `<${res.data[0].method} />`
          setXmlContent(initialXml)
          try {
            const json = xmlToJson(initialXml)
            setJsonContent(JSON.stringify(json, null, 2))
          } catch { /* empty */ }
        }
      })
      .catch(() => toast.error("Erro ao carregar métodos"))
  }, [selectedTypeId])

  useEffect(() => {
    if (!xmlEditorRef.current) return
    const isDark = theme === "dark"
    const extensions: any[] = [basicSetup, xml(), isDark ? oneDark : []]

    const state = EditorState.create({
      doc: xmlContent,
      extensions: [
        ...extensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newXml = update.state.doc.toString()
            setXmlContent(newXml)
            try {
              const parsed = xmlToJson(newXml)
              setJsonContent(JSON.stringify(parsed, null, 2))
            } catch { /* empty */ }
          }
        }),
      ],
    })

    if (xmlViewRef.current) xmlViewRef.current.destroy()
    xmlViewRef.current = new EditorView({ state, parent: xmlEditorRef.current })

    return () => { xmlViewRef.current?.destroy() }
  }, [theme])

  useEffect(() => {
    if (!jsonEditorRef.current || activeTab !== "json") return
    const isDark = theme === "dark"
    const extensions: any[] = [basicSetup, json(), isDark ? oneDark : []]

    const state = EditorState.create({
      doc: jsonContent,
      extensions: [
        ...extensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newJson = update.state.doc.toString()
            setJsonContent(newJson)
            try {
              const parsed = JSON.parse(newJson)
              setXmlContent(jsonToXml(parsed))
            } catch { /* empty */ }
          }
        }),
      ],
    })

    if (jsonViewRef.current) jsonViewRef.current.destroy()
    jsonViewRef.current = new EditorView({ state, parent: jsonEditorRef.current })

    return () => { jsonViewRef.current?.destroy() }
  }, [theme, activeTab])

  async function handleExecute() {
    if (!selectedTypeId) { toast.error("Selecione o tipo de endpoint"); return }
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
        method: selectedMethodObj?.method || "GETSCHEMA",
        endpointType: selectedType?.type || "dataserver",
        suffix: selectedType?.suffix || "",
        xml,
        context,
        timeout,
      })

      setResponse(res.data)
      toast.success(`Executado em ${formatDuration(res.data.duration)}`)
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleGetSchema() {
    if (!selectedTypeId || !selectedMethodId || !selectedTbcId) {
      toast.error("Preencha todos os campos obrigatórios")
      return
    }

    setLoading(true)
    try {
      const res = await axios.post("/api/soap/execute", {
        endpointTypeId: selectedTypeId,
        methodId: selectedMethodId,
        tbcId: selectedTbcId,
        method: "GETSCHEMA",
        endpointType: selectedType?.type || "dataserver",
        suffix: selectedType?.suffix || "",
        xml: "<GetSchema />",
        context,
        timeout,
      })
      const formatted = formatXml(res.data.xmlResponse)
      setXmlContent(formatted)
      try {
        const parsed = xmlToJson(formatted)
        setJsonContent(JSON.stringify(parsed, null, 2))
      } catch { /* empty */ }
      toast.success("Schema gerado")
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message)
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

  const renderTable = useCallback((jsonData: Record<string, unknown> | null) => {
    if (!jsonData || typeof jsonData !== "object") return <p className="text-muted-foreground text-sm p-4">Sem dados tabulares</p>
    const entries = Object.entries(jsonData)
    if (entries.length === 0) return <p className="text-muted-foreground text-sm p-4">Sem dados tabulares</p>

    const firstValue = entries[0][1]
    if (Array.isArray(firstValue)) {
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
            {firstValue.map((row: any, i: number) => (
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
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2 mb-4">
            {endpointTypes.map((type) => (
              <Button
                key={type.id}
                variant={selectedTypeId === type.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTypeId(type.id)}
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Método</Label>
              <Select
                items={methods.map((m) => ({ value: m.id, label: m.label }))}
                value={selectedMethodId || null}
                onValueChange={(v) => setSelectedMethodId(v || "")}
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
            <div className="space-y-2">
              <Label>TBC</Label>
              <Select
                items={tbcs.map((t) => ({ value: t.id, label: `${t.name}${t.client ? ` (${t.client.name})` : ""}` }))}
                value={selectedTbcId || null}
                onValueChange={(v) => setSelectedTbcId(v || "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecionar TBC..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Buscar TBC..."
                      value={tbcSearch}
                      onChange={(e) => setTbcSearch(e.target.value)}
                      className="h-8 w-full"
                    />
                  </div>
                  {filteredTbcs.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.client ? ` (${t.client.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Timeout (ms)</Label>
              <Input type="number" value={timeout} onChange={(e) => setTimeout_(Number(e.target.value))} className="w-full" />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={fullUrl} readOnly className="w-full font-mono text-xs" placeholder="Selecione tipo e TBC..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Coligate</Label>
              <Input type="number" value={context.coligate} onChange={(e) => setContext({ ...context, coligate: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <Input type="number" value={context.branch} onChange={(e) => setContext({ ...context, branch: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="space-y-2">
              <Label>Level Education</Label>
              <Input type="number" value={context.levelEducation} onChange={(e) => setContext({ ...context, levelEducation: Number(e.target.value) })} className="w-full" />
            </div>
            <div className="space-y-2">
              <Label>Cod System</Label>
              <Input value={context.codSystem} onChange={(e) => setContext({ ...context, codSystem: e.target.value })} className="w-full" />
            </div>
            <div className="space-y-2">
              <Label>User</Label>
              <Input value={context.user} onChange={(e) => setContext({ ...context, user: e.target.value })} className="w-full" />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
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
          <CardContent className="p-0">
            {activeTab === "xml" ? (
              <div ref={xmlEditorRef} className="min-h-[400px]" />
            ) : (
              <div ref={jsonEditorRef} className="min-h-[400px]" />
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
          <CardContent className="p-0">
            <Tabs defaultValue="xml">
              <div className="px-4">
                <TabsList>
                  <TabsTrigger value="xml">XML</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                  <TabsTrigger value="raw">Raw</TabsTrigger>
                  <TabsTrigger value="table">
                    <Table2 className="h-3 w-3 mr-1" /> Tabela
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="xml" className="m-0">
                <ScrollArea className="h-[400px] p-4">
                  {response ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap">{formatXml(response.xmlResponse)}</pre>
                  ) : error ? (
                    <pre className="text-xs font-mono text-destructive whitespace-pre-wrap">{error}</pre>
                  ) : (
                    <p className="text-muted-foreground text-sm p-4">Execute uma chamada para ver a resposta</p>
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="json" className="m-0">
                <ScrollArea className="h-[400px] p-4">
                  {response ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap">{JSON.stringify(response.jsonResponse, null, 2)}</pre>
                  ) : (
                    <p className="text-muted-foreground text-sm p-4">Execute uma chamada para ver a resposta</p>
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="raw" className="m-0">
                <ScrollArea className="h-[400px] p-4">
                  {response ? (
                    <pre className="text-xs font-mono whitespace-pre-wrap">{response.xmlResponse}</pre>
                  ) : (
                    <p className="text-muted-foreground text-sm p-4">Execute uma chamada para ver a resposta raw</p>
                  )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="table" className="m-0">
                <ScrollArea className="h-[400px]">
                  {response ? (
                    <div className="p-4">{renderTable(response.jsonResponse)}</div>
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
