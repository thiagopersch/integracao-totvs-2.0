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

/** Props of the cookie textarea: a ~1KB value that is not a login password, so it is kept out of
 *  `type="password"` (autofill / password managers) and wraps inside a capped, scrollable box. */
export const COOKIE_TEXTAREA_PROPS = {
  id: "cookieHeader",
  rows: 3,
  className: "max-h-32 overflow-y-auto font-mono text-xs break-all md:text-xs",
  placeholder: "branch=master; client_id=...; inscricoes_session=...; XSRF-TOKEN=...",
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
} as const
