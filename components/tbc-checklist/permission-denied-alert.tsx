"use client"

import { ShieldAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export type DeniedDataserver = { code: string; name: string }

interface PermissionDeniedAlertProps {
  /** TBC user the SOAP calls authenticate as — the one missing the TOTVS access profile. */
  tbcUser?: string
  dataservers: DeniedDataserver[]
}

function label(dataserver: DeniedDataserver) {
  return dataserver.name && dataserver.name !== dataserver.code ? `${dataserver.name} (${dataserver.code})` : dataserver.code
}

/** Shown in place of the fields when TOTVS refused the TBC user access to one or more Data
 *  Servers. The failed calls are already in Rastreamento de Atividades (soapService logs them). */
export function PermissionDeniedAlert({ tbcUser, dataservers }: PermissionDeniedAlertProps) {
  if (!dataservers.length) return null
  const user = tbcUser ? `O usuário "${tbcUser}" configurado no TBC` : "O usuário configurado no TBC"

  return (
    <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
      <ShieldAlert />
      <AlertTitle>Sem permissão no TOTVS</AlertTitle>
      <AlertDescription>
        {dataservers.length === 1 ? (
          <p>
            {user} não possui permissão para acessar o Data Server <strong>{label(dataservers[0])}</strong>.
          </p>
        ) : (
          <>
            <p>{user} não possui permissão para acessar os Data Servers:</p>
            <ul className="list-disc pl-5">
              {dataservers.map((d) => (
                <li key={d.code}>
                  <strong>{label(d)}</strong>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="text-xs">
          Ajuste o perfil de acesso desse usuário no TOTVS RM. A falha foi registrada em Rastreamento de Atividades.
        </p>
      </AlertDescription>
    </Alert>
  )
}
