/**
 * Material-Design-ish tokens extracted directly from the reference tool's rendered prototype
 * (https://rubeusscripttotvs.apprbs.com.br/rubeus/mapeador/index.html — inspected live via
 * devtools: the preview's <iframe> embeds Material Design Lite button/elevation styles plus a
 * custom field/radio/checkbox system). Scoped under `.mapeador-proto` so it never leaks globally.
 * `--brand`/`--bar`/`--field-bg`/`--field-radius`/`--btn-color`/`--btn-radius` are CSS vars so a
 * MapeadorTema (or per-project override) can repaint the whole preview by setting inline style vars.
 */
export function prototipoCss(scope = ".mapeador-proto") {
  return `
${scope}{--brand:#0CC1AA;--bar:#0AA392;--field-bg:rgba(0,0,0,.04);--field-radius:0px;--btn-color:#0CC1AA;--btn-radius:5px;font-family:-apple-system,"system-ui","Segoe UI",Roboto,sans-serif;color:#2b2b3c;}
${scope} .p-topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 24px;background:var(--bar)}
${scope} .p-brand{font-size:20px;font-weight:800;color:var(--brand);letter-spacing:.02em}
${scope} .p-login{border:1px solid rgba(0,0,0,.15);background:#fff;padding:8px 16px;border-radius:5px;font-size:13px;font-weight:600}
${scope} .p-body{display:flex;min-height:520px}
${scope} .p-side{width:320px;flex:none;background-size:cover;background-position:center;color:#fff;padding:34px 30px;position:relative}
${scope} .p-side:before{content:'';position:absolute;inset:0;background:rgba(20,20,30,.45)}
${scope} .p-side>*{position:relative}
${scope} .p-side .proc{font-size:15px;opacity:.95;text-shadow:-1px 2px 2px rgba(0,0,0,.36)}
${scope} .p-side .etapa{font-size:13px;opacity:.75;margin-bottom:26px;text-shadow:-1px 2px 2px rgba(0,0,0,.36)}
${scope} .p-stepper{list-style:none;margin:0;padding:0}
${scope} .p-stepper li{display:flex;gap:14px;align-items:flex-start;padding:11px 0}
${scope} .p-stepper .ic{width:34px;height:34px;flex:none;border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700}
${scope} .p-stepper .ic.done{background:var(--brand);border-color:var(--brand)}
${scope} .p-stepper .nm{font-size:17px;font-weight:600;line-height:1.2}
${scope} .p-stepper .st{font-size:12px;font-style:italic;opacity:.85}
${scope} .p-stepper li.todo{opacity:.45}
${scope} .p-main{flex:1;background:#fff;padding:40px 46px}
${scope} .p-h1{font-size:23px;font-weight:700;margin:0 0 20px}
${scope} .p-grid{display:flex;flex-wrap:wrap;gap:18px 20px}
${scope} .p-fld{display:flex;flex-direction:column;position:relative}
${scope} .p-lbl{font-size:14px;font-weight:400;color:#4e4d4d;margin-bottom:6px}
${scope} .p-req{color:#2b2b3c}
${scope} .p-ctl{background:var(--field-bg);height:52px;border-radius:var(--field-radius);display:flex;align-items:center;padding:0 12px;color:#2b2b3c;font-size:14px;border:none;width:100%;outline:none;font-family:inherit}
${scope} .p-ctl:focus{outline:2px solid var(--brand);outline-offset:-2px}
${scope} select.p-ctl{appearance:none;cursor:pointer}
${scope} .p-radios{display:flex;gap:22px;align-items:center;height:44px;flex-wrap:wrap}
${scope} .p-radio{display:flex;align-items:center;gap:8px;font-size:14px;cursor:pointer}
${scope} .p-dot{width:17px;height:17px;border:2px solid #777;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex:none}
${scope} .p-dot.on{border-color:var(--brand)}
${scope} .p-dot.on:after{content:'';width:9px;height:9px;background:var(--brand);border-radius:50%}
${scope} .p-chk{display:flex;align-items:flex-start;gap:10px;font-size:14px;cursor:pointer}
${scope} .p-box{width:18px;height:18px;border:2px solid #777;border-radius:3px;flex:none;display:flex;align-items:center;justify-content:center;margin-top:1px}
${scope} .p-box.on{background:var(--brand);border-color:var(--brand);color:#fff;font-size:12px;font-weight:700}
${scope} .p-money{text-align:center;margin:14px 0}
${scope} .p-mlbl{font-weight:700;font-size:16px}
${scope} .p-mval{color:var(--brand);font-size:32px;font-weight:800;margin-top:2px}
${scope} .p-hr{width:100%;border:none;border-top:1px solid rgba(0,0,0,.12);margin:2px 0}
${scope} .p-info{color:#6b6b7b;font-size:13px;line-height:1.6;margin:0}
${scope} .p-title-inline{font-size:19px;font-weight:800;color:#2b2b3c;margin:2px 0}
${scope} .p-label-inline{font-size:15px;font-weight:700;color:#2b2b3c}
${scope} .p-actions{display:flex;justify-content:space-between;margin-top:32px;gap:10px}
${scope} .p-btn{border:none;cursor:pointer;font-size:13px;font-weight:600;text-transform:uppercase;padding:10px 18px 9px;border-radius:var(--btn-radius);box-shadow:0 2px 2px rgba(0,0,0,.14),0 3px 1px -2px rgba(0,0,0,.2),0 1px 5px rgba(0,0,0,.12)}
${scope} .p-btn.ghost{background:#fff;color:var(--btn-color)}
${scope} .p-btn.solid{background:var(--btn-color);color:#fff}
${scope} .p-btn[disabled]{opacity:.5;cursor:not-allowed}
${scope} .p-portal{display:flex;flex-wrap:wrap;gap:28px;padding:36px;background-size:cover;background-position:center;position:relative;min-height:520px}
${scope} .p-portal:before{content:'';position:absolute;inset:0;background:rgba(20,20,30,.35)}
${scope} .p-portal>*{position:relative}
${scope} .p-card{background:#fff;border-radius:10px;padding:22px 24px;box-shadow:0 10px 30px rgba(0,0,0,.18)}
${scope} .p-card-title{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#8a8a95;margin-bottom:6px}
${scope} .p-card-value{font-size:16px;font-weight:600;color:#2b2b3c}
${scope} .p-status-row{display:flex;align-items:center;gap:14px;padding:16px 0;border-top:1px solid #eee}
${scope} .p-status-row:first-of-type{border-top:none}
${scope} .p-status-ic{width:34px;height:34px;border-radius:50%;border:2px solid var(--brand);color:var(--brand);display:flex;align-items:center;justify-content:center;flex:none;font-weight:700}
${scope} .p-status-ic.done{background:var(--brand);color:#fff}
${scope} .p-navbar{position:sticky;bottom:0;left:0;right:0;background:var(--bar);color:#fff;display:flex;align-items:center;gap:12px;padding:10px 16px;font-size:13px;z-index:20}
${scope} .p-navbar select{flex:1;padding:7px;border-radius:4px;border:none;font-size:13px;background:#fff;color:#2b2b3c}
${scope} .p-navbar button{background:var(--brand);color:#fff;border:none;padding:8px 14px;border-radius:4px;cursor:pointer;font-size:13px}
${scope} .p-navbar button[disabled]{opacity:.5;cursor:not-allowed}
${scope} .p-navbar .cnt{opacity:.8;white-space:nowrap}
${scope} .p-adjust-target{outline:2px dashed var(--brand);outline-offset:2px;cursor:pointer}
${scope} .p-edit-target{outline:2px dashed #f59e0b;outline-offset:2px;cursor:text}
`
}
