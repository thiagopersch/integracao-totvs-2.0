import { prototipoCss } from "@/components/mapeador/prototipo/styles";
import { normalizeLargura, DEFAULT_DETALHES_CAMPOS, type MapeadorCampo, type MapeadorDetalheCampo, type MapeadorProjetoDTO } from "@/types/mapeador";

interface MappedCampo {
  tipo: string;
  label: string;
  obrigatorio: boolean;
  opcoes: string[];
  largura: number;
  alinhamento?: string;
  cor?: string;
  colunas: { largura: number; campos: MappedCampo[] }[];
  acaoBotao?: string;
  popupPassoId?: string | null;
  downloadNomeArquivo?: string;
  downloadMensagem?: string;
}

function mapCampo(c: MapeadorCampo): MappedCampo {
  return {
    tipo: c.tipo,
    label: c.label,
    obrigatorio: !!c.obrigatorio,
    opcoes: c.opcoesLista ?? [],
    largura: normalizeLargura(c.largura),
    alinhamento: c.alinhamento,
    cor: c.cor,
    colunas: (c.colunas ?? []).map((col) => ({
      largura: normalizeLargura(col.largura),
      campos: col.campos.map(mapCampo),
    })),
    acaoBotao: c.acaoBotao,
    popupPassoId: c.popupPassoId,
    downloadNomeArquivo: c.downloadNomeArquivo,
    downloadMensagem: c.downloadMensagem,
  };
}

/**
 * Builds a standalone, self-contained HTML document for the "Baixar .html" export: same visual
 * tokens as the live preview (components/mapeador/prototipo/styles.ts) but with a small vanilla-JS
 * renderer instead of React, so it opens and navigates on its own with no server/build step.
 */
export function renderPrototipoHtml(
  projetos: MapeadorProjetoDTO[],
  options: {
    corMarca?: string;
    corBarra?: string;
    bgImageUrl?: string;
    logoUrl?: string;
    detalhesTitulo?: string;
    minhasInscricoesLabel?: string;
    detalhesCampos?: MapeadorDetalheCampo[];
  }
) {
  const detalhesTitulo = options.detalhesTitulo || "Detalhes da inscrição";
  const minhasInscricoesLabel = options.minhasInscricoesLabel || "Minhas inscrições";
  const detalhesCampos = options.detalhesCampos?.length ? options.detalhesCampos : DEFAULT_DETALHES_CAMPOS;
  const detalhesRows = detalhesCampos.map((c) => [c.alias || c.nome, c.valorExemplo || "—"]);

  const data = projetos.map((p) => ({
    nome: p.nome,
    etapas: p.etapas.map((e) => ({
      nome: e.nome,
      feedbacks: e.feedbacks.map((f) => ({ feedback: f.feedback, logic: f.logic, tipo: f.tipo })),
      passos: e.camposPorEtapa.map((passo) => ({
        id: passo.id,
        tipo: passo.tipo,
        titulo: passo.titulo,
        ocultarBotaoAvancar: !!passo.ocultarBotaoAvancar,
        campos: passo.campos.map(mapCampo),
      })),
    })),
  }));

  const bg = options.bgImageUrl || "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=60";

  return `<!doctype html>
<html lang="pt-br">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Protótipo — ${escapeHtml(projetos[0]?.nome ?? "Mapeador")}</title>
<style>
body{margin:0;font-family:-apple-system,"system-ui","Segoe UI",Roboto,sans-serif}
${prototipoCss(".mapeador-proto")}
.mapeador-proto{--brand:${options.corMarca || "#0CC1AA"};--bar:${options.corBarra || "#0AA392"};}
.p-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:50;padding:20px}
.p-modal{background:#fff;border-radius:10px;padding:24px;max-width:480px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,.3)}
</style>
</head>
<body>
<div class="mapeador-proto">
  <div id="screen"></div>
  <div class="p-navbar">
    <button id="prev">◀</button>
    <select id="jump"></select>
    <button id="next">▶</button>
    <span class="cnt" id="cnt"></span>
  </div>
  <div id="modal-overlay" class="p-modal-overlay" style="display:none">
    <div class="p-modal" id="modal-content"></div>
  </div>
  <div id="download-toast" class="p-download-toast" style="display:none"></div>
</div>
<script>
const DATA = ${JSON.stringify(data)};
const BG = ${JSON.stringify(bg)};
const LOGO = ${JSON.stringify(options.logoUrl || "")};
const DETALHES_TITULO = ${JSON.stringify(detalhesTitulo)};
const MINHAS_INSCRICOES_LABEL = ${JSON.stringify(minhasInscricoesLabel)};
const DETALHES_ROWS = ${JSON.stringify(detalhesRows)};
const screens = [{kind:"landing"}];
DATA.forEach((projeto, pi) => {
  projeto.etapas.forEach((etapa, ei) => {
    const naoPopup = etapa.passos.filter(p => p.tipo !== 'popup');
    if (naoPopup.length === 0) screens.push({kind:"form", pi, ei, si:0});
    etapa.passos.forEach((p, si) => { if (p.tipo !== 'popup') screens.push({kind:"form", pi, ei, si}); });
    screens.push({kind:"portal", pi, ei});
  });
});
let current = 0;
const values = {};

function esc(s){ const d=document.createElement('div'); d.textContent = s==null?'':String(s); return d.innerHTML; }

function findPasso(passoId){
  for (const p of DATA) for (const e of p.etapas) { const found = e.passos.find(ps => ps.id === passoId); if (found) return found; }
  return null;
}

function showModal(html){
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
}
function hideModal(){
  document.getElementById('modal-overlay').style.display = 'none';
}
document.getElementById('modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') hideModal(); });

function openPopup(passoId){
  const passo = findPasso(passoId);
  if (!passo) return;
  const fields = passo.campos.filter(c=>c.tipo!=='botao').map((c,i)=>fieldHtml(c, 'popup.'+passoId+'.'+i)).join('');
  showModal('<h3 style="margin:0 0 16px;font-size:18px;font-weight:700">'+esc(passo.titulo||'Pop-up')+'</h3><div class="p-grid">'+fields+'</div><div style="margin-top:20px;text-align:right"><button class="p-btn solid" onclick="hideModal()">Fechar</button></div>');
}

function showDownloadToast(nome){
  const toast = document.getElementById('download-toast');
  toast.innerHTML = '<div class="hdr"><span>Histórico de downloads recentes</span><button type="button" class="close" onclick="hideDownloadToast()">✕</button></div>'
    + '<div class="row"><span class="ic">📄</span><div class="p-upload-txt"><button type="button" class="nm" onclick="openDocPreview(this.textContent)">'+esc(nome)+'</button><div class="meta">1 MB · Concluído</div></div></div>'
    + '<a class="link" href="#" onclick="return false">Histórico completo de downloads ↗</a>';
  toast.style.display = 'block';
}
function hideDownloadToast(){
  document.getElementById('download-toast').style.display = 'none';
}
function openDocPreview(nome){
  showModal('<h3 style="margin:0 0 16px;font-size:18px;font-weight:700">'+esc(nome)+'</h3><div class="p-doc-preview"><div class="banner">Documento ilustrativo — sem valor fiscal, gerado só para demonstração</div><div class="linha" style="width:60%"></div><div class="linha"></div><div class="linha"></div><div class="linha" style="width:40%"></div></div><div style="margin-top:20px;text-align:right"><button class="p-btn solid" onclick="hideModal()">Fechar</button></div>');
}
function simulateDownload(nome, mensagem){
  showDownloadToast(nome);
  showModal('<h3 style="margin:0 0 8px;font-size:18px;font-weight:700">'+esc(mensagem)+'</h3><p style="font-size:14px;color:#6b6b7b;margin:0 0 20px">Download realizado com sucesso, caso precise, você poderá voltar e baixar novamente.</p><div style="text-align:right"><button class="p-btn solid" onclick="hideModal();go(current+1)">PORTAL DO CANDIDATO</button></div>');
}

function fieldHtml(c, path){
  const req = c.obrigatorio ? '<span class="p-req">*</span>' : '';
  const largura = c.largura || 12;
  const pct = (largura / 12) * 100;
  const gapAdjust = 20 * (1 - largura / 12);
  const widthStyle = 'width:calc(' + pct + '% - ' + gapAdjust + 'px)';
  const textoEstilo = 'text-align:'+(c.alinhamento||'left')+(c.cor?';color:'+c.cor:'');
  let inner = '';
  switch(c.tipo){
    case 'titulo_pagina': inner = '<div class="p-title-inline" style="'+textoEstilo+'">'+esc(c.label)+'</div>'; break;
    case 'label_destaque': inner = '<div class="p-label-inline" style="'+textoEstilo+'">'+esc(c.label)+'</div>'; break;
    case 'texto_informativo': inner = '<p class="p-info" style="'+textoEstilo+'">'+esc(c.label)+'</p>'; break;
    case 'divisor': inner = '<hr class="p-hr">'; break;
    case 'agrupamento': {
      const colunas = (c.colunas||[]).map((coluna, i) => {
        const colLargura = coluna.largura || 12;
        const colPct = (colLargura / 12) * 100;
        const colGapAdjust = 20 * (1 - colLargura / 12);
        const colFields = (coluna.campos||[]).map((cf, j) => fieldHtml(cf, path+'.'+i+'.'+j)).join('');
        return '<div class="p-coluna" style="width:calc('+colPct+'% - '+colGapAdjust+'px)">'+colFields+'</div>';
      }).join('');
      inner = '<div class="p-grid">'+colunas+'</div>';
      break;
    }
    case 'select': {
      const opts = (c.opcoes||[]).map(o=>'<option value="'+esc(o)+'">'+esc(o)+'</option>').join('');
      inner = '<div class="p-fld"><label class="p-lbl">'+esc(c.label)+' '+req+'</label><select class="p-ctl" data-k="'+path+'"><option value="" disabled selected>Selecionar</option>'+opts+'</select></div>';
      break;
    }
    case 'radio': {
      const opts = (c.opcoes||[]).map(o=>'<label class="p-radio"><span class="p-dot"></span><input type="radio" class="sr-only" name="'+path+'" value="'+esc(o)+'"> '+esc(o)+'</label>').join('');
      inner = '<div class="p-fld"><label class="p-lbl">'+esc(c.label)+' '+req+'</label><div class="p-radios">'+opts+'</div></div>';
      break;
    }
    case 'check': {
      if (c.opcoes && c.opcoes.length) {
        const opts = c.opcoes.map(o=>'<label class="p-chk"><span class="p-box"></span><input type="checkbox" class="sr-only" data-k="'+path+'" value="'+esc(o)+'"> '+esc(o)+'</label>').join('');
        inner = '<div class="p-fld"><label class="p-lbl">'+esc(c.label)+' '+req+'</label><div style="display:flex;flex-wrap:wrap;gap:8px 24px">'+opts+'</div></div>';
      } else {
        inner = '<label class="p-chk"><span class="p-box"></span><input type="checkbox" class="sr-only" data-k="'+path+'"> '+esc(c.label)+' '+req+'</label>';
      }
      break;
    }
    case 'data':
      inner = '<div class="p-fld"><label class="p-lbl">'+esc(c.label)+' '+req+'</label><input type="date" class="p-ctl" data-k="'+path+'"></div>';
      break;
    case 'documento_upload':
      inner = '<label class="p-upload"><span class="p-upload-icon">📄</span>'
        + '<span class="p-upload-txt"><span class="nm">'+esc(c.label.toUpperCase())+' '+req+'</span><div class="fname" style="font-size:12px;color:#8a8a95"></div></span>'
        + '<span class="p-upload-btn">⬆ Anexar</span>'
        + '<input type="file" class="sr-only" data-upload="'+path+'"></label>';
      break;
    case 'pagamento_valor':
      inner = '<div class="p-money"><div class="p-mlbl">'+esc(c.label)+'</div><div class="p-mval">R$ 50,00</div></div>';
      break;
    case 'pagamento_formas':
      inner = '<div class="p-fld"><label class="p-lbl">'+esc(c.label)+'</label><div class="p-radios">'+(c.opcoes&&c.opcoes.length?c.opcoes:['Boleto','Pix','Cartão de crédito']).map(o=>'<label class="p-radio"><span class="p-dot"></span> '+esc(o)+'</label>').join('')+'</div></div>';
      break;
    default:
      inner = '<div class="p-fld"><label class="p-lbl">'+esc(c.label)+' '+req+'</label><input class="p-ctl" data-k="'+path+'"></div>';
  }
  const alinhavel = ['divisor','condicional','agrupamento','titulo_pagina','label_destaque','texto_informativo'].indexOf(c.tipo) === -1;
  const blocoStyle = alinhavel && (c.alinhamento==='center'||c.alinhamento==='right')
    ? widthStyle+';display:flex;justify-content:'+(c.alinhamento==='center'?'center':'flex-end')
    : widthStyle;
  return '<div style="'+blocoStyle+'">'+inner+'</div>';
}

function render(){
  const s = screens[current];
  const el = document.getElementById('screen');
  const brandMark = LOGO ? '<img src="'+LOGO+'" style="height:32px">' : '<span class="p-brand">EXEMPLO</span>';
  const topbar = '<div class="p-topbar">'+brandMark+'<button class="p-login">LOGIN</button></div>';
  const topbarProfile = '<div class="p-topbar">'+brandMark+'<button class="p-profile">Pedro ▾</button></div>';

  if (s.kind === 'landing') {
    const opts = DATA.map((p,i)=>'<option value="'+i+'">'+esc(p.nome)+'</option>').join('');
    el.innerHTML = topbar + '<div style="min-height:420px;display:flex;align-items:center;padding:40px;background:linear-gradient(rgba(0,0,0,.4),rgba(0,0,0,.4)),url('+BG+') center/cover">'
      + '<div style="max-width:420px;color:#fff"><h2 style="font-size:24px;margin-bottom:16px">Escolha o processo seletivo</h2>'
      + '<label class="p-lbl" style="color:#fff">Selecione uma opção *</label>'
      + '<select class="p-ctl" style="background:#fff;margin-bottom:16px">'+opts+'</select>'
      + '<div><button class="p-btn solid" id="landing-next">AVANÇAR</button></div></div></div>';
    document.getElementById('landing-next').onclick = () => go(current+1);
    return;
  }

  const projeto = DATA[s.pi];
  const etapa = projeto.etapas[s.ei];

  if (s.kind === 'portal') {
    const done = projeto.etapas.slice(0, s.ei+1);
    const next = projeto.etapas[s.ei+1];
    const detalhes = DETALHES_ROWS
      .map(([l,v]) => '<div class="p-detail-row"><div class="p-detail-lbl">'+esc(l)+'</div><div class="p-detail-val">'+esc(v)+'</div></div>').join('');
    function pickFeedback(e){ return (e.feedbacks||[]).find(f=>f.tipo==='positivo') || (e.feedbacks||[])[0]; }
    el.innerHTML = topbarProfile + '<div class="p-portal" style="background-image:url('+BG+')">'
      + '<div style="width:32%;min-width:280px;max-width:380px;display:flex;flex-direction:column;gap:16px">'
      + '<div class="p-card"><div class="p-card-title">'+esc(MINHAS_INSCRICOES_LABEL)+'</div><div class="p-card-value">'+esc(projeto.nome)+'</div></div>'
      + '<div class="p-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div class="p-card-value">'+esc(DETALHES_TITULO)+'</div></div>'+detalhes+'</div>'
      + '</div>'
      + '<div class="p-card" style="min-width:280px;flex:1;padding:0;overflow:hidden">'
      + '<div style="background:var(--brand);padding:16px;text-align:center;font-weight:600;color:#fff;font-size:14px">Acompanhe aqui o status da sua inscrição</div>'
      + '<div style="padding:20px">'
      + done.map((e, index) => {
          const fb = pickFeedback(e);
          const tipo = fb ? fb.tipo : 'positivo';
          const isPositivo = tipo === 'positivo';
          const icone = isPositivo ? '✓' : (tipo === 'negativo' ? '✕' : '!');
          const label = fb ? fb.feedback : 'Concluída';
          const isLastRow = index === done.length - 1 && !next;
          const rowStyle = isPositivo ? 'border-top:none;border-radius:0;padding:16px 20px;margin:'+(index===0?'-20px':'0')+' -20px '+(isLastRow?'-20px':'0')+';background:var(--brand)' : 'padding:16px 0';
          const icStyle = isPositivo ? 'border-color:#fff;color:#fff;background:transparent' : '';
          const titleStyle = isPositivo ? 'color:#fff' : '';
          const subStyle = isPositivo ? 'color:rgba(255,255,255,.85)' : 'color:#8a8a95';
          return '<div class="p-status-row" style="'+rowStyle+'"><span class="p-status-ic" style="'+icStyle+'">'+icone+'</span><div><div class="p-card-value" style="'+titleStyle+'">'+esc(e.nome)+'</div><div style="font-size:12px;font-style:italic;'+subStyle+'">'+esc(label)+'</div></div></div>';
        }).join('')
      + (next ? '<div class="p-status-row" style="justify-content:space-between"><div style="display:flex;align-items:center;gap:12px"><span class="p-status-ic">!</span><div><div class="p-card-value">'+esc(next.nome)+'</div><div style="font-size:12px;font-style:italic;color:#8a8a95">Aguardando conclusão</div></div></div><button class="p-btn ghost" id="portal-next" style="border:1px solid var(--brand)">Acessar</button></div>' : '')
      + '</div></div></div>';
    const btn = document.getElementById('portal-next');
    if (btn) btn.onclick = () => go(current+1);
    return;
  }

  const passo = etapa.passos[s.si];
  const steps = etapa.passos.map((p,i)=>{
    if (p.tipo === 'popup') return '';
    const status = i<s.si?'Concluído':(i===s.si?'Aguardando conclusão':'Pendente');
    return '<li'+(i>s.si?' style="opacity:.45"':'')+'><span class="ic'+(i<s.si?' done':'')+'">'+(i<s.si?'✓':(i+1))+'</span><div><div class="nm">'+esc(p.titulo)+'</div><div class="st">'+status+'</div></div></li>';
  }).join('');

  if (!passo) {
    el.innerHTML = topbar + '<div class="p-body"><div class="p-side" style="background-image:url('+BG+')"><div class="proc">'+esc(projeto.nome)+'</div><div class="etapa">'+esc(etapa.nome)+'</div><ul class="p-stepper">'+steps+'</ul></div><div class="p-main"><p class="p-info">Nenhum passo mapeado para esta etapa ainda.</p></div></div>';
    return;
  }

  const fields = passo.campos.filter(c=>c.tipo!=='botao').map((c,i)=>fieldHtml(c, s.pi+'.'+s.ei+'.'+s.si+'.'+i)).join('');
  const botoes = passo.campos.filter(c=>c.tipo==='botao');
  const botoesHtml = botoes.length
    ? botoes.map(b => {
        const isVoltar = /voltar/i.test(b.label);
        let attrs;
        if (b.acaoBotao === 'popup' && b.popupPassoId) attrs = ' data-popup="'+b.popupPassoId+'"';
        else if (b.acaoBotao === 'download') attrs = ' data-download="'+esc(b.downloadNomeArquivo||'Documento.pdf')+'" data-download-msg="'+esc(b.downloadMensagem||'Arquivo gerado com sucesso!')+'"';
        else attrs = ' data-nav="'+(isVoltar?'prev':'next')+'"';
        return '<button class="p-btn '+(isVoltar?'ghost':'solid')+'"'+attrs+'>'+esc(b.label.toUpperCase())+'</button>';
      }).join('')
    : (passo.ocultarBotaoAvancar ? '' : '<button class="p-btn solid" data-nav="next" style="margin-left:auto">AVANÇAR</button>');

  el.innerHTML = topbar + '<div class="p-body"><div class="p-side" style="background-image:url('+BG+')"><div class="proc">'+esc(projeto.nome)+'</div><div class="etapa">'+esc(etapa.nome)+'</div><ul class="p-stepper">'+steps+'</ul></div>'
    + '<div class="p-main"><h2 class="p-h1">'+esc(passo.titulo)+'</h2><div class="p-grid">'+fields+'</div><div class="p-actions">'+botoesHtml+'</div></div></div>';

  el.querySelectorAll('[data-nav]').forEach((b) => {
    b.addEventListener('click', () => go(b.getAttribute('data-nav') === 'prev' ? current-1 : current+1));
  });
  el.querySelectorAll('[data-popup]').forEach((b) => {
    b.addEventListener('click', () => openPopup(b.getAttribute('data-popup')));
  });
  el.querySelectorAll('[data-download]').forEach((b) => {
    b.addEventListener('click', () => simulateDownload(b.getAttribute('data-download'), b.getAttribute('data-download-msg')));
  });

  el.querySelectorAll('.p-radio, .p-chk').forEach((label) => {
    label.addEventListener('click', () => {
      const input = label.querySelector('input');
      if (input.type === 'radio') { input.checked = true; label.parentElement.querySelectorAll('.p-dot').forEach(d=>d.classList.remove('on')); label.querySelector('.p-dot').classList.add('on'); }
      else { input.checked = !input.checked; label.querySelector('.p-box').classList.toggle('on', input.checked); label.querySelector('.p-box').textContent = input.checked ? '✓' : ''; }
    });
  });

  el.querySelectorAll('[data-upload]').forEach((input) => {
    input.addEventListener('change', () => {
      const fname = input.closest('.p-upload').querySelector('.fname');
      fname.textContent = input.files && input.files[0] ? input.files[0].name : '';
    });
  });
}

function labelFor(s){
  if (s.kind === 'landing') return 'Seleção do processo seletivo';
  const projeto = DATA[s.pi]; const etapa = projeto.etapas[s.ei];
  if (s.kind === 'portal') return 'Portal do candidato — após "'+etapa.nome+'"';
  const passo = etapa.passos[s.si];
  return etapa.nome + ' › ' + (passo ? passo.titulo : 'Passo');
}

function buildJump(){
  const sel = document.getElementById('jump');
  let html = '<option value="0">1. '+esc(labelFor(screens[0]))+'</option>';
  let lastProc = null, group = '';
  screens.forEach((s, i) => {
    if (s.kind === 'landing') return;
    const proc = DATA[s.pi].nome;
    if (proc !== lastProc) { if (group) html += group + '</optgroup>'; group = '<optgroup label="'+esc(proc)+'">'; lastProc = proc; }
    group += '<option value="'+i+'">'+(i+1)+'. '+esc(labelFor(s))+'</option>';
  });
  if (group) html += group + '</optgroup>';
  sel.innerHTML = html;
}

function go(i){
  if (i < 0 || i >= screens.length) return;
  current = i;
  render();
  document.getElementById('jump').value = String(current);
  document.getElementById('cnt').textContent = (current+1) + ' / ' + screens.length;
  document.getElementById('prev').disabled = current === 0;
  document.getElementById('next').disabled = current === screens.length - 1;
}

buildJump();
document.getElementById('prev').onclick = () => go(current-1);
document.getElementById('next').onclick = () => go(current+1);
document.getElementById('jump').onchange = (e) => go(Number(e.target.value));
go(0);
</script>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
