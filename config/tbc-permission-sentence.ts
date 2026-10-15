/**
 * Consulta SQL the client registers once in RM (Gestão › Consultas SQL) so the integration can see
 * which profiles the TBC user has in each system/coligada. Menu accesses themselves are NOT read by
 * SQL: RM stores them in GAUTZMENU by internal TAGMENU ids (encoded, and renumbered between
 * releases), so those are compared from the "Relatório de permissões dos perfis" PDF instead.
 */
export const PERMISSION_SENTENCE = {
  codSentenca: "RUBEUS.PERFIS.TBC",
  /** Registered as a global sentence (coligada 0, sistema G — Serviços Globais). */
  codColigada: 0,
  codSistema: "G",
  title: "Rubeus - Perfis do usuário TBC",
  sql: `SELECT G.CODCOLIGADA,
       G.CODSISTEMA,
       G.SUPERVISOR,
       U.CODPERFIL,
       P.NOME AS NOMEPERFIL
  FROM GPERMIS G
  LEFT JOIN GUSRPERFIL U
    ON U.CODUSUARIO = G.CODUSUARIO
   AND U.CODCOLIGADA = G.CODCOLIGADA
   AND U.CODSISTEMA = G.CODSISTEMA
  LEFT JOIN GPERFIL P
    ON P.CODCOLIGADA = U.CODCOLIGADA
   AND P.CODSISTEMA = U.CODSISTEMA
   AND P.CODPERFIL = U.CODPERFIL
 WHERE G.CODUSUARIO = :CODUSUARIO
 ORDER BY G.CODSISTEMA, G.CODCOLIGADA, U.CODPERFIL`,
} as const
