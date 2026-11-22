/** CSS of the standalone RB-33 HTML export — the Rubeus Design System tokens and document
 *  classes copied from the reference page (PRESENCIAL_RB-33.html), plus a few additions for this
 *  generator at the end. Values are the design system's; edit only the additions. */
export const RB33_CSS = `/* Rubeus Design System — tokens semânticos (fonte: artifact "Rubeus Design System (Teste)", tokens.css). Não editar valores aqui; só usar var(--rb-*). */
:root {
  --rb-shadow-color-15: #00000026;
  --rb-shadow-color-30: #0000004d;
  --rb-brand-red: #ff0031;
  --rb-brand-red-light: #f0758d;
  --rb-brand-red-dark: #99001d;
  --rb-brand-teal: #0da6a6;
  --rb-bg-neutral-primary: #fbfdfc;
  --rb-bg-neutral-secondary: #f8faf9;
  --rb-bg-neutral-tertiary: #eff1f0;
  --rb-bg-neutral-disable: #dbe4e4;
  --rb-bg-inverse-primary: #0e1211;
  --rb-bg-inverse-secondary: #2e3131;
  --rb-bg-inverse-tertiary: #505353;
  --rb-bg-brand-bold-primary: #006a6a;
  --rb-bg-brand-bold-secondary: #7c9695;
  --rb-bg-brand-bold-tertiary: #7f92ae;
  --rb-bg-brand-subtle-primary: #e2fffe;
  --rb-bg-brand-subtle-secondary: #cee7e7;
  --rb-bg-brand-subtle-tertiary: #eaf1ff;
  --rb-bg-success-subtle: #eaffea;
  --rb-bg-success-bold: #006030;
  --rb-bg-warning-subtle: #ffede2;
  --rb-bg-warning-bold: #ffba3d;
  --rb-bg-error-subtle: #ffedea;
  --rb-bg-error-bold: #a80710;
  --rb-bg-info-subtle: #eaf1ff;
  --rb-bg-info-bold: #41546d;
  --rb-text-neutral-primary: #191c1c;
  --rb-text-neutral-secondary: #2e3131;
  --rb-text-neutral-subtle: #505353;
  --rb-text-neutral-disable: #899392;
  --rb-text-brand-primary: #004f4f;
  --rb-text-brand-tertiary: #354860;
  --rb-text-brand-on-primary: #fbfdfc;
  --rb-text-brand-on-primary-subtle: #dcf6f5;
  --rb-text-brand-on-secondary: #fbfdfc;
  --rb-text-brand-on-tertiary: #fbfdfc;
  --rb-text-inverse-primary: #f8faf9;
  --rb-text-inverse-secondary: #f8faf9;
  --rb-text-inverse-tertiary: #f8faf9;
  --rb-text-inverse-subtle: #e1e3e2;
  --rb-text-inverse-brand: #3dbcbc;
  --rb-text-success-on-subtle: #005229;
  --rb-text-success-on-bold: #f5fff3;
  --rb-text-warning-on-subtle: #904d00;
  --rb-text-warning-on-bold: #3d1e00;
  --rb-text-error-on-subtle: #7e0007;
  --rb-text-error-on-bold: #ffffff;
  --rb-text-info-on-subtle: #354860;
  --rb-text-info-on-bold: #f8f9ff;
  --rb-border-neutral-primary: #e1e3e2;
  --rb-border-neutral-secondary: #c5c7c6;
  --rb-border-neutral-tertiary: #a9acab;
  --rb-border-neutral-disable: #bfc8c8;
  --rb-border-inverse-primary: #444747;
  --rb-border-inverse-secondary: #505353;
  --rb-border-inverse-tertiary: #757877;
  --rb-border-brand-primary: #005c5c;
  --rb-border-brand-secondary: #7c9695;
  --rb-border-brand-tertiary: #7f92ae;
  --rb-border-success-subtle: #2ac36e;
  --rb-border-success-bold: #c3ffce;
  --rb-border-warning-subtle: #ffba3d;
  --rb-border-warning-bold: #ffdcc2;
  --rb-border-error-subtle: #a80710;
  --rb-border-error-bold: #ffedea;
  --rb-border-info-subtle: #b5c8e6;
  --rb-border-info-bold: #f8f9ff;
  --rb-icon-neutral-subtle: #505353;
  --rb-icon-neutral-disable: #899392;
  --rb-icon-neutral-help: #8e9191;
  --rb-icon-brand-primary: #004f4f;
  --rb-icon-brand-secondary: #293f3f;
  --rb-icon-brand-tertiary: #41546d;
  --rb-icon-brand-on-primary: #fbfdfc;
  --rb-icon-brand-on-secondary: #fbfdfc;
  --rb-icon-brand-on-tertiary: #fbfdfc;
  --rb-icon-inverse-primary: #f8faf9;
  --rb-icon-inverse-secondary: #f8faf9;
  --rb-icon-inverse-subtle: #e1e3e2;
  --rb-icon-inverse-brand: #3dbcbc;
  --rb-icon-inverse-on-tertiary: #f8faf9;
  --rb-icon-success-on-subtle: #006030;
  --rb-icon-success-on-bold: #c3ffce;
  --rb-icon-warning-on-subtle: #ff8f0e;
  --rb-icon-warning-on-bold: #3d1e00;
  --rb-icon-error-on-subtle: #93000a;
  --rb-icon-error-on-bold: #ffdad6;
  --rb-icon-info-on-subtle: #41546d;
  --rb-icon-info-on-bold: #f8f9ff;
  --rb-bg-brand-bold-primary-hover: #005c5c;
  --rb-bg-brand-bold-primary-active: #004f4f;
  --rb-bg-neutral-hover: #eff1f0;
  --rb-bg-error-bold-hover: #93000a;
  --rb-shadow-1: 0 1px 3px 1px #00000026, 0 1px 2px 0 #0000004d;
  --rb-space-xs: 4px;
  --rb-space-s: 8px;
  --rb-space-m: 16px;
  --rb-space-l: 24px;
  --rb-space-xl: 32px;
  --rb-space-2xl: 48px;
  --rb-radius-sm: 4px;
  --rb-radius-md: 8px;
  --rb-radius-lg: 16px;
  --rb-radius-pill: 999px;
  --rb-weight-regular: 400;
  --rb-weight-medium: 500;
  --rb-weight-bold: 700;
  --rb-font-family: "Roboto", "Segoe UI", system-ui, sans-serif;
  --rb-duration-fast: 120ms;
  --rb-easing: cubic-bezier(0.4, 0, 0.2, 1);
}

/* ---------- variáveis da aplicação, repontadas para os tokens do DS ---------- */
:root {
  --teal: var(--rb-bg-brand-bold-primary);
  --teal-dark: var(--rb-bg-brand-bold-primary-hover);
  --teal-deep: var(--rb-text-brand-primary);
  --teal-container: var(--rb-bg-brand-subtle-primary);
  --amber-container: var(--rb-bg-warning-subtle);
  --amber-deep: var(--rb-text-warning-on-subtle);

  --color-bg: var(--rb-bg-neutral-secondary);
  --color-surface: var(--rb-bg-neutral-primary);
  --color-surface-alt: var(--rb-bg-neutral-tertiary);
  --color-border: var(--rb-border-neutral-primary);
  --color-border-strong: var(--rb-border-neutral-secondary);
  --color-text: var(--rb-text-neutral-primary);
  --color-text-muted: var(--rb-text-neutral-subtle);
  --color-accent: var(--teal);
  --color-accent-strong: var(--teal-deep);
  --color-accent-soft: var(--teal-container);
  --color-warn: var(--amber-deep);
  --color-warn-soft: var(--amber-container);
  --color-danger: var(--rb-bg-error-bold);

  --radius: var(--rb-radius-lg);
  --radius-pill: var(--rb-radius-pill);
  --elevation-1: var(--rb-shadow-1);
  --elevation-2: var(--rb-shadow-1), 0 4px 12px var(--rb-shadow-color-15);

  --font-sans: var(--rb-font-family);
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--color-text);
  background: var(--color-bg);
  -webkit-font-smoothing: antialiased;
}

/* ---------- topbar ---------- */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rb-space-m);
  padding: 12px var(--rb-space-l);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand { display: flex; align-items: center; gap: 10px; }
.brand-logo { width: 32px; height: 32px; flex-shrink: 0; display: block; }
.brand-text { display: flex; flex-direction: column; line-height: 1.2; }
.brand h1 {
  font-size: 16px;
  line-height: 24px;
  margin: 0;
  font-weight: var(--rb-weight-bold);
  color: var(--color-text);
}
.brand h1 .brand-thin { font-weight: var(--rb-weight-medium); color: var(--teal-deep); margin-left: 4px; }
.brand .sub {
  font-size: 11px;
  font-weight: var(--rb-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: .08em;
  margin-top: 1px;
}
.topbar-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

/* ---------- badge de status (rb-badge denso) ---------- */
.badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  line-height: 20px;
  padding: 2px 10px;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  font-weight: var(--rb-weight-medium);
}
.badge-idle { background: var(--rb-bg-neutral-tertiary); color: var(--rb-text-neutral-secondary); }
.badge-loading { background: var(--rb-bg-warning-subtle); color: var(--rb-text-warning-on-subtle); border-color: var(--rb-border-warning-subtle); }
.badge-ready { background: var(--rb-bg-success-subtle); color: var(--rb-text-success-on-subtle); border-color: var(--rb-border-success-subtle); }
.badge-error { background: var(--rb-bg-error-subtle); color: var(--rb-text-error-on-subtle); border-color: var(--rb-border-error-subtle); }

/* ---------- botões (rb-button sm; .btn = secondary, .btn-primary = primary) ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--rb-space-s);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 20px;
  font-weight: var(--rb-weight-medium);
  letter-spacing: .1px;
  padding: 6px 16px;
  border: 1px solid var(--rb-border-brand-primary);
  border-radius: var(--rb-radius-md);
  background: transparent;
  color: var(--rb-text-brand-primary);
  cursor: pointer;
  transition: background-color var(--rb-duration-fast) var(--rb-easing),
              border-color var(--rb-duration-fast) var(--rb-easing),
              color var(--rb-duration-fast) var(--rb-easing);
}
.btn:hover:not(:disabled) { background: var(--rb-bg-brand-subtle-primary); }
.btn:focus-visible { outline: 2px solid var(--rb-border-brand-primary); outline-offset: 2px; }
.btn:disabled {
  background: var(--rb-bg-neutral-disable);
  border-color: transparent;
  color: var(--rb-text-neutral-disable);
  cursor: not-allowed;
}
.btn-primary {
  background: var(--rb-bg-brand-bold-primary);
  border-color: transparent;
  color: var(--rb-text-brand-on-primary);
}
.btn-primary:hover:not(:disabled) { background: var(--rb-bg-brand-bold-primary-hover); }
.btn-primary:active:not(:disabled) { background: var(--rb-bg-brand-bold-primary-active); }

/* ---------- painel de conexão (rb-card) ---------- */
.sidebar {
  position: sticky;
  top: 84px;
  width: 232px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: calc(100vh - 110px);
  overflow-y: auto;
}

.layout {
  display: flex;
  align-items: flex-start;
  max-width: 1180px;
  margin: 0 auto 80px;
  gap: var(--rb-space-l);
  padding: 0 20px;
}

/* ---------- toc — a posição sticky e o scroll ficam no .sidebar (pai), que
   também segura o .portal-nav quando ativo, pra tudo rolar junto ---------- */
.toc {
  width: 232px;
  flex-shrink: 0;
  font-size: 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 10px;
}
.toc:empty { display: none; }
.toc a {
  display: block;
  padding: 8px 10px;
  color: var(--color-text-muted);
  text-decoration: none;
  border-radius: var(--rb-radius-md);
  font-weight: var(--rb-weight-medium);
  line-height: 20px;
  margin-bottom: 2px;
  border-left: 2px solid transparent;
}
.toc a:hover { background: var(--rb-bg-neutral-hover); color: var(--color-text); }
.toc a:focus-visible { outline: 2px solid var(--rb-border-brand-primary); outline-offset: 2px; }
.toc a.active { background: var(--teal-container); color: var(--teal-deep); border-left-color: var(--rb-border-brand-primary); }

.doc {
  flex: 1;
  min-width: 0;
}

.doc h1 { font-size: 28px; line-height: 36px; font-weight: var(--rb-weight-bold); margin-bottom: 6px; }
.doc .subtitle {
  color: var(--color-text-muted);
  font-size: 14px;
  margin-bottom: 28px;
  font-family: var(--font-mono);
}

/* ---------- grade de escolha de processo (portal_id sem selective_process_id) ---------- */
.etapa {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: var(--rb-space-xl) var(--rb-space-xl) var(--rb-space-xl);
  margin-bottom: 20px;
}
.etapa h2 { font-size: 18px; line-height: 28px; font-weight: var(--rb-weight-medium); margin: 0 0 4px; }
.etapa .internal-id {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 22px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border);
}

/* eyebrow do DS, com o filete teal à esquerda */
.section-label {
  font-size: 14px;
  line-height: 20px;
  font-weight: var(--rb-weight-medium);
  text-transform: uppercase;
  letter-spacing: .08em;
  color: var(--teal-deep);
  margin: 26px 0 10px;
  padding-left: 11px;
  border-left: 3px solid var(--rb-border-brand-primary);
}
.section-label:first-of-type { margin-top: 0; }

.section-body { font-size: 15px; }
.section-body p, .section-body li { font-size: 15px; line-height: 1.65; }
.section-body ul { margin: 6px 0; padding-left: 24px; }
.section-body ul ul { margin-top: 4px; }
.section-body > p { margin: 0; }

.editable {
  min-height: 24px;
  padding: 8px 10px;
  border-radius: var(--rb-radius-md);
  border: 1px dashed transparent;
  white-space: pre-line;
  transition: border-color var(--rb-duration-fast) var(--rb-easing), background-color var(--rb-duration-fast) var(--rb-easing);
}
.editable:hover, .editable:focus {
  border-color: var(--rb-border-neutral-secondary);
  background: var(--rb-bg-neutral-hover);
  outline: none;
}
.editable:focus {
  border-style: solid;
  border-color: var(--rb-border-brand-primary);
  background: var(--rb-bg-neutral-primary);
  box-shadow: 0 0 0 3px var(--rb-bg-brand-subtle-primary);
}
.editable:empty::before {
  content: attr(data-placeholder);
  color: var(--color-text-muted);
  font-style: italic;
}

.step-block { margin-bottom: 20px; }
.step-block:last-child { margin-bottom: 0; }
.step-block > .step-name {
  font-weight: var(--rb-weight-medium);
  margin-bottom: 8px;
  font-size: 16px;
  line-height: 24px;
}
.step-block li { margin-bottom: 6px; }
.field-required::after { content: " *"; color: var(--rb-text-error-on-subtle); font-weight: var(--rb-weight-bold); }
.field-note {
  display: block;
  font-size: 13px;
  color: var(--color-text-muted);
  margin: 2px 0 2px 2px;
  line-height: 1.5;
}
.field-cond {
  font-style: italic;
  color: var(--color-text-muted);
  font-size: 14px;
  white-space: pre-line;
}
.query-code {
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--teal-deep);
}
/* tag = rb-badge brand, versão densa */
.tag {
  display: inline-block;
  font-size: 11px;
  line-height: 16px;
  font-weight: var(--rb-weight-medium);
  text-transform: uppercase;
  letter-spacing: .04em;
  color: var(--teal-deep);
  background: var(--teal-container);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  margin-right: 8px;
  vertical-align: 1px;
}

.feedback-item { margin-bottom: 10px; line-height: 1.65; font-size: 15px; white-space: pre-line; }
.feedback-item:last-child { margin-bottom: 0; }
.feedback-item .fb-label { font-weight: var(--rb-weight-medium); }

.actions-list { list-style: none; padding-left: 0; margin: 6px 0 0; display: flex; flex-direction: column; gap: 10px; }
.actions-list > li {
  padding: var(--rb-space-m);
  background: var(--rb-bg-neutral-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--rb-radius-md);
  font-size: 14px;
  white-space: pre-line;
}
.actions-list > li > .action-btn-title { font-weight: var(--rb-weight-medium); margin-bottom: 8px; color: var(--color-text); }
.actions-list .action-ref {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-text-muted);
}

/* ---------- tabela ---------- */
.actions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-top: 4px;
  background: var(--rb-bg-neutral-primary);
}
.actions-table th, .actions-table td {
  border: 1px solid var(--color-border);
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
}
.actions-table th {
  background: var(--rb-bg-neutral-tertiary);
  color: var(--rb-text-neutral-secondary);
  font-weight: var(--rb-weight-medium);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.actions-table th:first-child, .actions-table td:first-child { width: 18%; white-space: nowrap; }
.actions-table th:last-child, .actions-table td:last-child { width: 32%; white-space: pre-line; }
.actions-table td.muted-cell { color: var(--color-text-muted); }
.actions-table tbody tr:nth-child(even) { background: var(--rb-bg-neutral-secondary); }
.actions-table tbody tr:hover { background: var(--rb-bg-neutral-hover); }
.actions-list ul {
  margin: 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.actions-list ul li {
  background: var(--color-surface);
  border: none;
  border-left: 3px solid var(--rb-bg-brand-subtle-secondary);
  padding: 6px 6px 6px 12px;
  margin: 0;
  border-radius: var(--rb-radius-sm);
  line-height: 1.55;
}
.inactive-tag {
  font-size: 12px;
  color: var(--rb-text-warning-on-subtle);
  font-weight: var(--rb-weight-medium);
}

.auto-flag {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-left: 8px;
  font-weight: var(--rb-weight-regular);
  text-transform: none;
  letter-spacing: normal;
}

@media (max-width: 760px) {
  .topbar { flex-wrap: wrap; padding: 12px var(--rb-space-m); }
  .layout { flex-direction: column; padding: 0 var(--rb-space-m); }
  .sidebar { position: static; width: 100%; max-height: none; }
  .toc { width: 100%; }
  .panel { margin: var(--rb-space-m); }
  .etapa { padding: var(--rb-space-l) var(--rb-space-m); }
}

@media print {
  .topbar, .sidebar, #connectionPanel { display: none !important; }
  .layout { display: block; max-width: none; padding: 0; }
  .etapa { border: none; padding: 0; margin-bottom: 32px; break-inside: avoid; }
}

/* ---------- complementos do gerador (integracao-totvs) ---------- */
.topbar { position: sticky; top: 0; z-index: 10; }
.sidebar { position: sticky; top: 80px; align-self: flex-start; max-height: calc(100vh - 100px); overflow: auto; }
.layout { margin-top: 24px; }
.toc .toc-group { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--color-text-muted); padding: 10px 10px 4px; font-weight: var(--rb-weight-medium); }
.process-block + .process-block { margin-top: 48px; padding-top: 32px; border-top: 2px solid var(--color-border); }
.fonte-dados { font-size: 13px; color: var(--color-text-muted); margin: -12px 0 18px; font-family: var(--font-mono); }
.step-block > .fonte-dados { margin: -4px 0 8px; }
.action-cond { display: block; font-size: 12px; font-style: italic; color: var(--color-text-muted); font-weight: var(--rb-weight-regular); margin-top: 2px; }
.script-code { display: block; margin: 4px 0 6px; padding: 8px 10px; background: var(--rb-bg-neutral-tertiary); border-radius: var(--rb-radius-sm); font-family: var(--font-mono); font-size: 12px; white-space: pre-wrap; color: var(--color-text); }
.actions-table th:first-child, .actions-table td:first-child { white-space: normal; width: 20%; }
.notes-saved { font-size: 12px; color: var(--color-text-muted); }
@media print { .etapa { break-inside: auto; } .editable:empty { display: none; } }
`;
