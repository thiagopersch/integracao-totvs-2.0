/** The 5 real TOTVS RM webservice "folders" confirmed live against a TBC (wsConsultaSQL/wsDataServer/wsProcess/wsFormulaVisual/wsReport MEX WSDLs).
 *  Kept out of services/soap.service.ts (which pulls in nodemailer via notification.service.ts)
 *  so client components can import the label map without dragging server-only code into the bundle. */
export type WsName = "wsDataServer" | "wsConsultaSQL" | "wsProcess" | "wsFormulaVisual" | "wsReport";

/** Friendly label per ws "folder" — used to tell the user which kind of TOTVS call (dataserver,
 *  processo, consulta SQL, relatório, fórmula visual) a call or failed notification came from. */
export const WS_NAME_LABELS: Record<WsName, string> = {
  wsDataServer: "Dataserver",
  wsConsultaSQL: "Consulta SQL",
  wsProcess: "Processo",
  wsFormulaVisual: "Fórmula Visual",
  wsReport: "Relatório",
};
