/** Shared header of the cookie inputs: where to copy the portal admin `Cookie` header from. */
export function CredentialsHelp() {
  return (
    <div>
      <p className="text-sm font-medium">Cookie da sessão do portal admin</p>
      <p className="text-xs text-muted-foreground">
        Faça login em admin.portal.apprbs.com.br → DevTools (F12) → aba <strong>Network</strong> → clique em qualquer requisição para
        admin.portal.apprbs.com.br → Headers → Request Headers → copie o valor inteiro de <strong>Cookie</strong> (precisa conter
        client_id, inscricoes_session e XSRF-TOKEN).
      </p>
    </div>
  )
}
