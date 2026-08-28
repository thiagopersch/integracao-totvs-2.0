"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Combobox } from "@/components/ui/combobox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { CodeEditor } from "@/components/shared/code-editor"
import { SoapSchemaView } from "@/components/shared/soap-schema-view"
import { SoapDataTableView } from "@/components/shared/soap-data-table-view"
import { Play, Copy, Download, Loader2, Code2, FileJson, Table2, Globe, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import axios from "axios"
import { xmlToJson, jsonToXml, safeFormatXmlDeep } from "@/utils/xml"
import { buildSoapEnvelope, escapeXml, METHOD_OPERATION } from "@/utils/soap-envelope"
import {
  parseDataServerSchema,
  parseProcessSchema,
  parseReadViewResult,
  type DataTable,
  type SchemaTable,
} from "@/utils/soap-schema"
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
  user: string
  notRequiredLicense: boolean
  client: { id: string; name: string } | null
}

type ClientOption = { id: string; name: string }
type SistemaOption = { id: string; code: string; internalName: string; externalName: string }
type DataserverOption = { id: string; code: string; name: string }
type ProcessOption = { id: string; code: string; name: string }

interface SoapBuilderClientProps {
  initialEndpointTypes: EndpointType[]
  initialTbcs: TbcOption[]
  initialClients: ClientOption[]
  initialSistemas: SistemaOption[]
  initialDataservers: DataserverOption[]
  initialProcesses: ProcessOption[]
}

/** The 2 endpoint types whose methods operate on one specific catalog entry — TOTVS's generic
 *  wsDataServer/wsProcess folders take the entry name as the method's first parameter
 *  (`DataServerName` confirmed live against wsDataServer.ReadView/SaveRecord, see
 *  services/rm-sentence.service.ts; `ProcessServerName` confirmed live against
 *  wsProcess.GetSchema — NOT `ProcessName`, which TOTVS rejects with "Código do objeto não foi
 *  informado."). */
const ENTITY_NAME_TAG: Record<string, "DataServerName" | "ProcessServerName"> = {
  dataserver: "DataServerName",
  process: "ProcessServerName",
}

/** These are the ws-wide auth handshake (AUTENTICAACESSO/CHECKSERVICEACTIVITY) plus
 *  GETPROCESSSTATUS — the latter takes a job/exec id, not a process name, so `ProcessServerName`
 *  must never be injected into it. Its real param tag casing isn't confirmed live (unlike every
 *  other tag in this file), so the template just leaves a comment rather than guessing wrong —
 *  the `ProcessName` guess for a *different* method already cost a real bug once. */
const ENTITY_EXEMPT_METHODS = new Set(["AUTENTICAACESSO", "CHECKSERVICEACTIVITY", "GETPROCESSSTATUS"])

/** ExecuteWithXmlParams(Async) and SaveRecord/DeleteRecord don't take their XML payload as plain
 *  child elements — TOTVS wants it CDATA-wrapped inside `strXmlParams`/`XML` (confirmed against
 *  TOTVS's own docs). The request box only ever holds that inner payload for these 4 methods —
 *  never the `<ProcessServerName>`/`<DataServerName>` wrapper — because `buildFinalRequestXml`
 *  below applies that wrapper (with the CDATA) at execute/preview time. */
const XML_PARAM_WRAP_METHODS = new Set([
  "EXECUTEWITHXMLPARAMS",
  "EXECUTEWITHXMLPARAMSASYNC",
  "SAVERECORD",
  "DELETERECORD",
])
const XML_PARAM_TAG: Record<string, "strXmlParams" | "XML"> = {
  EXECUTEWITHXMLPARAMS: "strXmlParams",
  EXECUTEWITHXMLPARAMSASYNC: "strXmlParams",
  SAVERECORD: "XML",
  DELETERECORD: "XML",
}

/** `methodName` is the raw `SoapMethod` enum value (e.g. "READRECORD") as stored in the DB —
 *  translated here to the real PascalCase TOTVS operation name (e.g. "ReadRecord") via
 *  `METHOD_OPERATION`, since the root element sent on the wire must match that exact casing. */
function buildMethodTemplateXml(methodName: string, typeKey: string, entityCode: string): string {
  const operation = METHOD_OPERATION[methodName as keyof typeof METHOD_OPERATION] ?? methodName
  if (XML_PARAM_WRAP_METHODS.has(methodName)) {
    return "<!-- Selecione a entidade e o TBC para carregar a estrutura automaticamente -->"
  }
  if (methodName === "GETPROCESSSTATUS") {
    return `<${operation}>\n  <!-- Preencha o JobID/ExecID retornados por ExecuteWithXmlParamsAsync -->\n</${operation}>`
  }
  const tag = ENTITY_NAME_TAG[typeKey]
  if (!tag || !entityCode || ENTITY_EXEMPT_METHODS.has(methodName)) return `<${operation} />`
  return `<${operation}>\n  <${tag}>${entityCode}</${tag}>\n</${operation}>`
}

export function SoapBuilderClient({
  initialEndpointTypes,
  initialTbcs,
  initialClients,
  initialSistemas,
  initialDataservers,
  initialProcesses,
}: SoapBuilderClientProps) {
  const endpointTypes = initialEndpointTypes
  const tbcs = initialTbcs
  const clients = initialClients
  const sistemas = initialSistemas
  const dataservers = initialDataservers
  const processes = initialProcesses

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
  const selectedDataserverId = useSoapStore((state) => state.selectedDataserverId)
  const setSelectedDataserverId = useSoapStore((state) => state.setSelectedDataserverId)
  const selectedProcessId = useSoapStore((state) => state.selectedProcessId)
  const setSelectedProcessId = useSoapStore((state) => state.setSelectedProcessId)
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
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [responseTab, setResponseTab] = useState("xml")
  const [schemaTables, setSchemaTables] = useState<SchemaTable[] | null>(null)
  const [schemaSourceType, setSchemaSourceType] = useState<"dataserver" | "process" | null>(null)
  const [dataTables, setDataTables] = useState<DataTable[] | null>(null)
  // Set when a ReadRecord/ReadView call succeeds (200, no SOAP fault) but comes back with no data
  // at all — TOTVS's own documented behavior for a denied/nonexistent read, distinct from a real
  // fault (which already surfaces via `error`/toast in the catch block below).
  const [noDataWarning, setNoDataWarning] = useState<string | null>(null)
  // Bumped whenever the request XML/JSON is set programmatically (type/method change, schema
  // fetch) — used as CodeEditor's resetKey so the box actually refreshes to show it; left alone
  // while the user types, so their own edits never get stomped by a remount.
  const [requestVersion, setRequestVersion] = useState(0)
  const [responseVersion, setResponseVersion] = useState(0)

  // Guided-parameter state — an automatic GetSchema call feeds the ones below whenever the
  // selected method can't be filled in from just the entity code: ExecuteWithXmlParams(Async)
  // and SaveRecord/DeleteRecord need the entity's own field values (loaded straight into the
  // request box), ReadRecord/DeleteRecordByKey need its primary-key column names.
  const [guidedParamsLoading, setGuidedParamsLoading] = useState(false)
  const [guidedParamsLoadedFor, setGuidedParamsLoadedFor] = useState<string | null>(null)
  const [readViewFiltro, setReadViewFiltro] = useState("")
  const [primaryKeyFields, setPrimaryKeyFields] = useState<{ name: string; caption: string }[]>([])
  const [primaryKeyValues, setPrimaryKeyValues] = useState<Record<string, string>>({})
  // Every table the dataserver's own schema declares (not just the main one) — cached from the
  // same GetSchema call ReadRecord/DeleteRecordByKey already run for the primary key, and reused
  // to flag a ReadRecord result table that came back with no rows at all (see handleExecute).
  const [dataserverSchemaTables, setDataserverSchemaTables] = useState<SchemaTable[] | null>(null)

  const selectedType = endpointTypes.find((t) => t.id === selectedTypeId)
  const methods = selectedType?.methods ?? []
  const tbcsForClient = selectedClientId ? tbcs.filter((t) => t.client?.id === selectedClientId) : tbcs
  const selectedTbc = tbcs.find((t) => t.id === selectedTbcId)
  const selectedMethodObj = methods.find((m) => m.id === selectedMethodId)
  const selectedMethod = selectedMethodObj?.method
  const selectedDataserverCode = dataservers.find((d) => d.id === selectedDataserverId)?.code ?? ""
  const selectedProcessCode = processes.find((p) => p.id === selectedProcessId)?.code ?? ""
  const fullUrl = (() => {
    if (!selectedTbc || !selectedType) return ""
    const base = selectedTbc.link.replace(/\/+$/, "")
    const prefix = selectedTbc.notRequiredLicense ? "EduLicense" : ""
    const wsFolder = selectedType.suffix
    const isSharedAuthMethod = selectedMethod === "AUTENTICAACESSO"
    const port = isSharedAuthMethod ? "IwsBase" : `Iws${wsFolder.slice(2)}`
    return `${base}/${prefix}${wsFolder}/${port}`
  })()

  const isReadViewMethod = selectedType?.type === "dataserver" && selectedMethod === "READVIEW"
  const isDataserverPkMethod =
    selectedType?.type === "dataserver" && (selectedMethod === "READRECORD" || selectedMethod === "DELETERECORDBYKEY")
  const isXmlParamMethod = XML_PARAM_WRAP_METHODS.has(selectedMethod ?? "")
  // Both the process ExecuteWithXmlParams(Async) flow and the dataserver SaveRecord/DeleteRecord
  // flow need one automatic GetSchema round-trip before the request can be filled in or sent.
  const needsGuidedSchema = isXmlParamMethod || isDataserverPkMethod
  const guidedEntityId = selectedType?.type === "process" ? selectedProcessId : selectedDataserverId
  const guidedParamsKey = needsGuidedSchema
    ? `${selectedType?.type}:${selectedMethod}:${guidedEntityId}:${selectedTbcId}`
    : null
  const guidedParamsPending = needsGuidedSchema && (guidedParamsLoading || guidedParamsLoadedFor !== guidedParamsKey)

  /** ExecuteWithXmlParams(Async)/SaveRecord/DeleteRecord hold only their inner payload XML in the
   *  request box (see `XML_PARAM_WRAP_METHODS` above) — this applies the real
   *  `<ProcessServerName>`/`<DataServerName>` + CDATA wrapper TOTVS actually expects, both for the
   *  "XML Completo" preview and for what `handleExecute` sends on the wire, so the two never
   *  diverge. */
  const buildFinalRequestXml = useCallback((): string => {
    if (!isXmlParamMethod || !selectedMethod) return xmlContent
    const operation = METHOD_OPERATION[selectedMethod as keyof typeof METHOD_OPERATION] ?? selectedMethod
    const paramTag = XML_PARAM_TAG[selectedMethod]
    const nameTag = ENTITY_NAME_TAG[selectedType?.type ?? ""]
    const entityCode = selectedType?.type === "process" ? selectedProcessCode : selectedDataserverCode
    if (!nameTag || !paramTag) return xmlContent
    return `<${operation}>\n  <${nameTag}>${escapeXml(entityCode)}</${nameTag}>\n  <${paramTag}><![CDATA[${xmlContent}]]></${paramTag}>\n</${operation}>`
  }, [isXmlParamMethod, selectedMethod, selectedType?.type, selectedProcessCode, selectedDataserverCode, xmlContent])

  /** Live preview of the exact envelope that will be sent — same shape `soapService.dispatch` builds and logs to history, kept in sync as the method, TBC, XML body or context fields change. */
  const fullEnvelope = useMemo(
    () => safeFormatXmlDeep(buildSoapEnvelope(buildFinalRequestXml(), context)),
    [buildFinalRequestXml, context]
  )

  /** Programmatic updates (type/method switch, schema fetch) — bumps requestVersion so the
   *  still-mounted CodeEditor actually remounts and shows the new content. */
  function setRequestXml(newXml: string) {
    setXmlContent(newXml)
    try {
      setJsonContent(JSON.stringify(xmlToJson(newXml), null, 2))
    } catch {
      /* empty */
    }
    setRequestVersion((v) => v + 1)
  }

  /** User typing in the XML editor — must NOT bump requestVersion, or every keystroke remounts
   *  the editor and resets the cursor. */
  function handleXmlChange(newXml: string) {
    setXmlContent(newXml)
    try {
      setJsonContent(JSON.stringify(xmlToJson(newXml), null, 2))
    } catch {
      /* empty */
    }
  }

  /** Every guided-params handler below fully rebuilds its slice of state on selection change,
   *  same convention as the request XML itself — so a stale Filtro/primary-key value from a
   *  previous dataserver/method never leaks into the next one. */
  function resetGuidedParams() {
    setGuidedParamsLoadedFor(null)
    setReadViewFiltro("")
    setPrimaryKeyFields([])
    setPrimaryKeyValues({})
    setDataserverSchemaTables(null)
  }

  function handleSelectType(type: EndpointType) {
    setSelectedTypeId(type.id)
    // Entity selection (Dataserver/Processo) is scoped to the previous type — reset both so a
    // stale code from "dataserver" never gets injected into a "process" (or other) template.
    setSelectedDataserverId("")
    setSelectedProcessId("")
    resetGuidedParams()
    const firstMethod = type.methods[0]
    if (!firstMethod) {
      setSelectedMethodId("")
      return
    }
    setSelectedMethodId(firstMethod.id)
    setRequestXml(buildMethodTemplateXml(firstMethod.method, type.type, ""))
  }

  function handleSelectMethod(methodId: string) {
    setSelectedMethodId(methodId)
    resetGuidedParams()
    const method = methods.find((m) => m.id === methodId)
    if (!method) return
    const entityCode =
      selectedType?.type === "dataserver"
        ? (dataservers.find((d) => d.id === selectedDataserverId)?.code ?? "")
        : selectedType?.type === "process"
          ? (processes.find((p) => p.id === selectedProcessId)?.code ?? "")
          : ""
    setRequestXml(buildMethodTemplateXml(method.method, selectedType?.type ?? "", entityCode))
  }

  function handleSelectDataserver(id: string) {
    setSelectedDataserverId(id)
    resetGuidedParams()
    const dataserver = dataservers.find((d) => d.id === id)
    if (dataserver && selectedMethodObj) {
      setRequestXml(buildMethodTemplateXml(selectedMethodObj.method, "dataserver", dataserver.code))
    }
  }

  function handleSelectProcess(id: string) {
    setSelectedProcessId(id)
    resetGuidedParams()
    const process = processes.find((p) => p.id === id)
    if (process && selectedMethodObj) {
      setRequestXml(buildMethodTemplateXml(selectedMethodObj.method, "process", process.code))
    }
  }

  function handleFiltroChange(value: string) {
    setReadViewFiltro(value)
    setRequestXml(
      `<ReadView>\n  <DataServerName>${escapeXml(selectedDataserverCode)}</DataServerName>\n  <Filtro>${escapeXml(value)}</Filtro>\n</ReadView>`
    )
  }

  function handlePrimaryKeyValueChange(field: string, value: string) {
    const nextValues = { ...primaryKeyValues, [field]: value }
    setPrimaryKeyValues(nextValues)
    const operation = METHOD_OPERATION[(selectedMethod ?? "") as keyof typeof METHOD_OPERATION] ?? selectedMethod
    const joined = primaryKeyFields.map((f) => nextValues[f.name] ?? "").join(";")
    setRequestXml(
      `<${operation}>\n  <DataServerName>${escapeXml(selectedDataserverCode)}</DataServerName>\n  <PrimaryKey>${escapeXml(joined)}</PrimaryKey>\n</${operation}>`
    )
  }

  /** Runs the one automatic GetSchema round-trip these guided methods need before they're usable:
   *  ExecuteWithXmlParams(Async) loads the process's own sample XML straight into the request box
   *  for the user to fill in; ReadRecord/DeleteRecordByKey load just the dataserver's primary-key
   *  column names, so the user fills in values rather than guessing the key format by hand. */
  useEffect(() => {
    if (!needsGuidedSchema || !guidedParamsKey || guidedParamsKey === guidedParamsLoadedFor) return
    if (!selectedType || !selectedTbcId) return
    const schemaMethod = methods.find((m) => m.method === "GETSCHEMA" || m.method === "GETSCHEMA2")
    if (!schemaMethod) {
      toast.error("Este tipo de endpoint não tem um método GetSchema cadastrado em /admin/soap-endpoints")
      return
    }
    const typeKey = selectedType.type
    const entityCode = typeKey === "process" ? selectedProcessCode : selectedDataserverCode
    if (!entityCode) return
    // Re-bound to plain (non-optional) consts here, in the scope where narrowing still applies —
    // `schemaMethod`/`selectedType` themselves don't narrow across the `load` closure below.
    const schemaMethodId = schemaMethod.id
    const schemaMethodKey = schemaMethod.method

    async function load() {
      setGuidedParamsLoading(true)
      try {
        const schemaXml = buildMethodTemplateXml(schemaMethodKey, typeKey, entityCode)
        const res = await axios.post("/api/soap/execute", {
          endpointTypeId: selectedTypeId,
          methodId: schemaMethodId,
          tbcId: selectedTbcId,
          xml: schemaXml,
          context,
          timeout,
        })

        if (typeKey === "process") {
          setRequestXml(safeFormatXmlDeep(res.data.xmlResponse))
          toast.success("Estrutura de parâmetros do processo carregada — preencha os valores antes de executar")
        } else {
          const allTables = parseDataServerSchema(res.data.xmlResponse)
          const mainTable = allTables[0]
          if (!mainTable) {
            toast.error("Não foi possível interpretar o schema do dataserver")
            return
          }
          if (isDataserverPkMethod) {
            setDataserverSchemaTables(allTables)
            const pkFields = mainTable.fields
              .filter((f) => f.isPrimaryKey)
              .map((f) => ({ name: f.name, caption: f.caption }))
            setPrimaryKeyFields(pkFields)
            setPrimaryKeyValues(Object.fromEntries(pkFields.map((f) => [f.name, ""])))
            const operation =
              METHOD_OPERATION[(selectedMethod ?? "") as keyof typeof METHOD_OPERATION] ?? selectedMethod
            setRequestXml(
              `<${operation}>\n  <DataServerName>${escapeXml(entityCode)}</DataServerName>\n  <PrimaryKey>${pkFields.map((f) => f.name).join(";")}</PrimaryKey>\n</${operation}>`
            )
            toast.success("Chave primária carregada — preencha os valores antes de executar")
          } else {
            const skeleton = `<${mainTable.name}>\n${mainTable.fields.map((f) => `  <${f.name}></${f.name}>`).join("\n")}\n</${mainTable.name}>`
            setRequestXml(skeleton)
            toast.success("Estrutura de campos carregada — preencha os valores antes de executar")
          }
        }
        setGuidedParamsLoadedFor(guidedParamsKey)
      } catch (err) {
        toast.error(axios.isAxiosError(err) ? err.response?.data?.error || err.message : (err as Error).message)
      } finally {
        setGuidedParamsLoading(false)
      }
    }

    load()
    // Re-runs only when the guided-params identity itself changes — `load` closes over plenty of
    // other state (context, timeout, methods…) that shouldn't each retrigger a fresh GetSchema
    // call on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsGuidedSchema, guidedParamsKey, guidedParamsLoadedFor])

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

  function handleSelectTbc(tbcId: string) {
    setSelectedTbcId(tbcId)
    const tbc = tbcs.find((t) => t.id === tbcId)
    if (tbc) setContext({ user: tbc.user })
  }

  function handleJsonChange(newJson: string) {
    setJsonContent(newJson)
    try {
      setXmlContent(jsonToXml(JSON.parse(newJson)))
    } catch {
      /* empty */
    }
  }

  async function handleExecute() {
    if (!selectedTypeId) {
      toast.error("Selecione o sistema/endpoint")
      return
    }
    if (!selectedMethodId) {
      toast.error("Selecione o método")
      return
    }
    if (!selectedTbcId) {
      toast.error("Selecione o TBC")
      return
    }
    if (guidedParamsPending) {
      toast.error("Aguarde a estrutura de parâmetros ser carregada antes de executar")
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)
    setSchemaTables(null)
    setSchemaSourceType(null)
    setDataTables(null)
    setNoDataWarning(null)

    try {
      const res = await axios.post("/api/soap/execute", {
        endpointTypeId: selectedTypeId,
        methodId: selectedMethodId,
        tbcId: selectedTbcId,
        xml: buildFinalRequestXml(),
        context,
        timeout,
      })

      setResponse(res.data)
      setResponseVersion((v) => v + 1)
      toast.success(`Executado em ${formatDuration(res.data.duration)}`)

      // GetSchema on a dataserver/processo defaults straight to the table view — that's the whole
      // point of asking for a schema — parsed into per-table field lists (dataserver: real XSD
      // metadata; processo: inferred from the one sample instance TOTVS returns, see soap-schema.ts).
      const isSchemaCall = selectedMethod === "GETSCHEMA" || selectedMethod === "GETSCHEMA2"
      const entityType = selectedType?.type
      if (isSchemaCall && (entityType === "dataserver" || entityType === "process")) {
        const tables =
          entityType === "process"
            ? parseProcessSchema(res.data.xmlResponse)
            : parseDataServerSchema(res.data.xmlResponse)
        setSchemaTables(tables)
        setSchemaSourceType(entityType)
        setResponseTab("table")
      } else if (selectedMethod === "READVIEW" || selectedMethod === "READRECORD") {
        // Same idea as GetSchema above, just rendered from actual row data instead of field
        // metadata — see SoapDataTableView. ReadRecord's result is the exact same DataSet-row
        // shape ReadView's is (just without the NewDataSet wrapper), so the same structural parser
        // applies unchanged.
        let tables = parseReadViewResult(res.data.xmlResponse)

        if (tables.length === 0) {
          // A 200 with no SOAP fault but zero rows is exactly how TOTVS signals "no permission on
          // this dataserver" or "nothing to read" for ReadRecord/ReadView (confirmed in TOTVS's
          // own docs: an unmatched key returns "no more than the XSD", never a fault) — surfaced
          // the same way a real fault is (toast + response-box text), not left as a silent empty table.
          const message =
            "Nenhum dado retornado. Verifique se você possui permissão para este dataserver/registro ou se os dados informados realmente existem."
          setNoDataWarning(message)
          toast.error(message)
        } else if (selectedMethod === "READRECORD" && dataserverSchemaTables) {
          // ReadRecord's response only ever contains the tables that actually have a row — a
          // related table TOTVS checked but found nothing for is simply absent from the XML, so
          // cross-reference against the dataserver's own schema (already fetched for the primary
          // key above) to surface every table the user expects to see, flagging the missing ones.
          const foundNames = new Set(tables.map((t) => t.name))
          const missingTables: DataTable[] = dataserverSchemaTables
            .filter((t) => !foundNames.has(t.name))
            .map((t) => ({ name: t.name, columns: [], rows: [] }))
          tables = [...tables, ...missingTables]
        }

        setDataTables(tables)
        setResponseTab("table")
      }
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error || err.message : (err as Error).message
      setError(msg)
      toast.error(msg)
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
    if (!jsonData || typeof jsonData !== "object")
      return <p className="text-muted-foreground text-sm p-4">{emptyMessage}</p>
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
          <fieldset className="space-y-3 rounded-lg border border-input p-3">
            <legend className="px-1 text-sm font-medium text-muted-foreground">Destino da chamada</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  items={endpointTypes.map((t) => ({ value: t.id, label: `${t.label} (${t.type})` }))}
                  value={selectedTypeId || null}
                  onValueChange={(v) => {
                    const type = endpointTypes.find((t) => t.id === v)
                    if (type) handleSelectType(type)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {endpointTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label} ({t.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedType?.type === "dataserver" && (
                <div className="space-y-2">
                  <Label>Dataserver</Label>
                  <Combobox
                    items={dataservers.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
                    value={selectedDataserverId}
                    onValueChange={handleSelectDataserver}
                    placeholder="Selecionar dataserver..."
                    searchPlaceholder="Buscar dataserver..."
                    emptyText="Nenhum dataserver encontrado."
                  />
                </div>
              )}
              {selectedType?.type === "process" && (
                <div className="space-y-2">
                  <Label>Processo</Label>
                  <Combobox
                    items={processes.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }))}
                    value={selectedProcessId}
                    onValueChange={handleSelectProcess}
                    placeholder="Selecionar processo..."
                    searchPlaceholder="Buscar processo..."
                    emptyText="Nenhum processo encontrado."
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Método</Label>
                <Select
                  items={methods.map((m) => ({ value: m.id, label: `${m.label} (${m.method})` }))}
                  value={selectedMethodId || null}
                  onValueChange={(v) => handleSelectMethod(v || "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecionar método..." />
                  </SelectTrigger>
                  <SelectContent>
                    {methods.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label} ({m.method})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                      <SelectItem key={s.id} value={s.id}>
                        {s.code} - {s.internalName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  items={tbcsForClient.map((t) => ({
                    value: t.id,
                    label: `${t.name}${t.client ? ` (${t.client.name})` : ""}`,
                  }))}
                  value={selectedTbcId}
                  onValueChange={handleSelectTbc}
                  placeholder="Selecionar TBC..."
                  searchPlaceholder="Buscar TBC..."
                  emptyText="Nenhum TBC encontrado."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>URL da requisição</Label>
              <Input
                value={fullUrl}
                readOnly
                className="w-full font-mono text-xs"
                placeholder="Selecione o sistema e o TBC..."
              />
            </div>
            <div className="space-y-2">
              <Label>Tempo limite (ms)</Label>
              <Input
                type="number"
                value={timeout}
                onChange={(e) => setTimeout_(Number(e.target.value))}
                className="w-full max-w-40"
              />
            </div>
          </fieldset>

          {(isReadViewMethod || isDataserverPkMethod || isXmlParamMethod) && (
            <fieldset className="space-y-3 rounded-lg border border-input p-3">
              <legend className="px-1 text-sm font-medium text-muted-foreground">Parâmetros do método</legend>

              {isReadViewMethod && (
                <div className="space-y-2">
                  <Label>
                    Filtro (apenas a condição SQL — sem SELECT, ex.: CODCOLIGADA = 1 AND RA = &apos;123&apos;)
                  </Label>
                  <CodeEditor value={readViewFiltro} onChange={handleFiltroChange} language="sql" minHeight="120px" />
                </div>
              )}

              {isDataserverPkMethod &&
                (guidedParamsLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando chave primária do dataserver...
                  </p>
                ) : primaryKeyFields.length ? (
                  <div className="space-y-2">
                    <Label>Chave primária</Label>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {primaryKeyFields.map((field) => (
                        <div key={field.name} className="space-y-2">
                          <Label className="text-xs text-muted-foreground">
                            {field.caption || field.name} ({field.name})
                          </Label>
                          <Input
                            value={primaryKeyValues[field.name] ?? ""}
                            onChange={(e) => handlePrimaryKeyValueChange(field.name, e.target.value)}
                            className="w-full"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Selecione o dataserver e o TBC para carregar a chave primária automaticamente.
                  </p>
                ))}

              {isXmlParamMethod && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  {guidedParamsLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando estrutura de campos...
                    </>
                  ) : guidedParamsPending ? (
                    "Selecione a entidade e o TBC para carregar a estrutura automaticamente."
                  ) : (
                    'Estrutura carregada — edite os valores no XML da requisição (botão "Ver requisição").'
                  )}
                </p>
              )}
            </fieldset>
          )}

          <fieldset className="space-y-3 rounded-lg border border-input p-3">
            <legend className="px-1 text-sm font-medium text-muted-foreground">Contexto de execução</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <div className="space-y-2">
                <Label>Coligada</Label>
                <Input
                  type="number"
                  value={context.coligate}
                  onChange={(e) => setContext({ coligate: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Filial</Label>
                <Input
                  type="number"
                  value={context.branch}
                  onChange={(e) => setContext({ branch: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Nível de Ensino</Label>
                <Input
                  type="number"
                  value={context.levelEducation}
                  onChange={(e) => setContext({ levelEducation: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Código do Sistema</Label>
                <Input
                  value={context.codSystem}
                  onChange={(e) => setContext({ codSystem: e.target.value })}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input value={context.user} onChange={(e) => setContext({ user: e.target.value })} className="w-full" />
              </div>
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-2">
            <Button onClick={handleExecute} disabled={loading || guidedParamsPending}>
              {loading || guidedParamsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Executar
            </Button>
            <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline">
                    <Code2 className="h-4 w-4 mr-2" /> Ver requisição
                  </Button>
                }
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Requisição SOAP</DialogTitle>
                </DialogHeader>
                <DialogBody className="flex min-h-0 flex-1 flex-col">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="xml">
                        <Code2 className="h-3 w-3 mr-1" /> XML
                      </TabsTrigger>
                      <TabsTrigger value="json">
                        <FileJson className="h-3 w-3 mr-1" /> JSON
                      </TabsTrigger>
                      <TabsTrigger value="full">
                        <Globe className="h-3 w-3 mr-1" /> XML Completo
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {activeTab === "xml" ? (
                    <CodeEditor
                      value={xmlContent}
                      onChange={handleXmlChange}
                      language="xml"
                      resetKey={requestVersion}
                      minHeight="55vh"
                    />
                  ) : activeTab === "json" ? (
                    <CodeEditor
                      value={jsonContent}
                      onChange={handleJsonChange}
                      language="json"
                      resetKey={requestVersion}
                      minHeight="55vh"
                    />
                  ) : (
                    <CodeEditor value={fullEnvelope} language="xml" readOnly resetKey={fullEnvelope} minHeight="55vh" />
                  )}
                </DialogBody>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline">Fechar</Button>} />
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Resposta</span>
            {response && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{formatDuration(response.duration)}</Badge>
                <Badge variant={response.status < 400 ? "default" : "destructive"}>{response.status}</Badge>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {noDataWarning && (
            <Alert variant="destructive" className="mb-3">
              <TriangleAlert />
              <AlertTitle>Nenhum dado retornado</AlertTitle>
              <AlertDescription>{noDataWarning}</AlertDescription>
            </Alert>
          )}
          <Tabs value={responseTab} onValueChange={setResponseTab}>
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
                <CodeEditor
                  value={safeFormatXmlDeep(response.xmlResponse)}
                  language="xml"
                  readOnly
                  theme="dark"
                  resetKey={responseVersion}
                  minHeight="400px"
                />
              ) : error ? (
                <pre className="text-xs font-mono text-destructive whitespace-pre-wrap p-3">{error}</pre>
              ) : (
                <p className="text-muted-foreground text-sm p-4">Execute uma chamada para ver a resposta</p>
              )}
            </TabsContent>
            <TabsContent value="json" className="m-0">
              {response ? (
                <CodeEditor
                  value={JSON.stringify(response.jsonResponse, null, 2)}
                  language="json"
                  readOnly
                  theme="dark"
                  resetKey={responseVersion}
                  minHeight="400px"
                />
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
              <ScrollArea
                className={
                  schemaTables || dataTables
                    ? "h-[600px] rounded-lg border border-input p-3"
                    : "h-[400px] rounded-lg border border-input"
                }
              >
                {response && schemaTables ? (
                  <SoapSchemaView tables={schemaTables} showPrimaryKey={schemaSourceType === "dataserver"} />
                ) : response && dataTables ? (
                  <SoapDataTableView tables={dataTables} />
                ) : response ? (
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
  )
}
