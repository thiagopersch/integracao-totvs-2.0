import { prototipoCss } from "@/components/mapeador/prototipo/styles";
import { normalizeLargura, type MapeadorCampo, type MapeadorProjetoDTO } from "@/types/mapeador";

interface MappedCampo {
  tipo: string;
  label: string;
  obrigatorio: boolean;
  opcoes: string[];
  largura: number;
  alinhamento?: string;
  cor?: string;
  colunas: { largura: number; campos: MappedCampo[] }[];
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
  };
}

/**
 * Builds a standalone, self-contained HTML document for the "Baixar .html" export: same visual
 * tokens as the live preview (components/mapeador/prototipo/styles.ts) but with a small vanilla-JS
 * renderer instead of React, so it opens and navigates on its own with no server/build step.
 */
export function renderPrototipoHtml(projetos: MapeadorProjetoDTO[], options: { corMarca?: string; corBarra?: string; bgImageUrl?: string; logoUrl?: string }) {
  const data = projetos.map((p) => ({
    nome: p.nome,
    etapas: p.etapas.map((e) => ({
      nome: e.nome,
      feedbacks: e.feedbacks.map((f) => ({ feedback: f.feedback, logic: f.logic, tipo: f.tipo })),
      passos: e.camposPorEtapa.map((passo) => ({
        titulo: passo.titulo,
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
</div>
<script>
const DATA = ${JSON.stringify(data)};
const BG = ${JSON.stringify(bg)};
const LOGO = ${JSON.stringify(options.logoUrl || "")};
const screens = [{kind:"landing"}];
DATA.forEach((projeto, pi) => {
  projeto.etapas.forEach((etapa, ei) => {
    if (etapa.passos.length === 0) screens.push({kind:"form", pi, ei, si:0});
    etapa.passos.forEach((_, si) => screens.push({kind:"form", pi, ei, si}));
    screens.push({kind:"portal", pi, ei});
  });
});
let current = 0;
const values = {};

function esc(s){ const d=document.createElement('div'); d.textContent = s==null?'':String(s); return d.innerHTML; }

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
      inner = '<div class="p-fld"><label class="p-lbl">'+esc(c.label)+' '+req+'</label><input type="file" class="p-ctl"></div>';
      break;
    case 'pagamento_valor':
      inner = '<div class="p-money"><div class="p-mlbl">'+esc(c.label)+'</div><div class="p-mval">R$ 50,00</div></div>';
      break;
    case 'pagamento_formas':
      inner = '<div class="p-fld"><label class="p-lbl">'+esc(c.label)+'</label><div class="p-radios">'+['Boleto','Pix','Cartão de crédito'].map(o=>'<label class="p-radio"><span class="p-dot"></span> '+o+'</label>').join('')+'</div></div>';
      break;
    default:
      inner = '<div class="p-fld"><label class="p-lbl">'+esc(c.label)+' '+req+'</label><input class="p-ctl" data-k="'+path+'"></div>';
  }
  return '<div style="'+widthStyle+'">'+inner+'</div>';
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
    const detalhes = [['Curso','Administração'],['Modalidade','Presencial'],['Campus','Sede'],['Forma de Ingresso','Vestibular Presencial']]
      .map(([l,v]) => '<div class="p-detail-row"><div class="p-detail-lbl">'+l+'</div><div class="p-detail-val">'+v+'</div></div>').join('');
    function pickFeedback(e){ return (e.feedbacks||[]).find(f=>f.tipo==='positivo') || (e.feedbacks||[])[0]; }
    el.innerHTML = topbarProfile + '<div class="p-portal" style="background-image:url('+BG+')">'
      + '<div style="width:28%;min-width:260px;max-width:340px;display:flex;flex-direction:column;gap:16px">'
      + '<div class="p-card"><div class="p-card-title">Minhas inscrições</div><div class="p-card-value">'+esc(projeto.nome)+'</div></div>'
      + '<div class="p-card"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><div class="p-card-value">Detalhes da inscrição</div></div>'+detalhes+'</div>'
      + '</div>'
      + '<div class="p-card" style="min-width:320px;flex:1;padding:0;overflow:hidden">'
      + '<div style="background:var(--brand);padding:16px;text-align:center;font-weight:600;color:#fff;font-size:14px">Acompanhe aqui o status da sua inscrição</div>'
      + '<div style="padding:20px">'
      + done.map(e => {
          const fb = pickFeedback(e);
          const tipo = fb ? fb.tipo : 'positivo';
          const isPositivo = tipo === 'positivo';
          const icone = isPositivo ? '✓' : (tipo === 'negativo' ? '✕' : '!');
          const label = fb ? fb.feedback : 'Concluída';
          const rowStyle = isPositivo ? 'border-top:none;border-radius:8px;padding:16px;margin:4px 0;background:var(--brand)' : 'padding:16px 0';
          const icStyle = isPositivo ? 'border-color:#fff;color:#fff;background:transparent' : '';
          const titleStyle = isPositivo ? 'color:#fff' : '';
          const subStyle = isPositivo ? 'color:rgba(255,255,255,.85)' : 'color:#8a8a95';
          return '<div class="p-status-row" style="'+rowStyle+'"><span class="p-status-ic" style="'+icStyle+'">'+icone+'</span><div><div class="p-card-value" style="'+titleStyle+'">'+esc(e.nome)+'</div><div style="font-size:12px;font-style:italic;'+subStyle+'">'+esc(label)+'</div></div></div>';
        }).join('')
      + (next ? '<div class="p-status-row" style="justify-content:space-between"><div style="display:flex;align-items:center;gap:12px"><span class="p-status-ic">!</span><div><div class="p-card-value">'+esc(next.nome)+'</div><div style="font-size:12px;font-style:italic;color:#8a8a95">Aguardando conclusão</div></div></div><button class="p-btn ghost" id="portal-next" style="border:1px solid #ddd">Acessar</button></div>' : '')
      + '</div></div></div>';
    const btn = document.getElementById('portal-next');
    if (btn) btn.onclick = () => go(current+1);
    return;
  }

  const passo = etapa.passos[s.si];
  const steps = etapa.passos.map((p,i)=>{
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
    ? botoes.map(b => '<button class="p-btn '+(/voltar/i.test(b.label)?'ghost':'solid')+'" data-nav="'+(/voltar/i.test(b.label)?'prev':'next')+'">'+esc(b.label.toUpperCase())+'</button>').join('')
    : '<button class="p-btn solid" data-nav="next" style="margin-left:auto">AVANÇAR</button>';

  el.innerHTML = topbar + '<div class="p-body"><div class="p-side" style="background-image:url('+BG+')"><div class="proc">'+esc(projeto.nome)+'</div><div class="etapa">'+esc(etapa.nome)+'</div><ul class="p-stepper">'+steps+'</ul></div>'
    + '<div class="p-main"><h2 class="p-h1">'+esc(passo.titulo)+'</h2><div class="p-grid">'+fields+'</div><div class="p-actions">'+botoesHtml+'</div></div></div>';

  el.querySelectorAll('[data-nav]').forEach((b) => {
    b.addEventListener('click', () => go(b.getAttribute('data-nav') === 'prev' ? current-1 : current+1));
  });

  el.querySelectorAll('.p-radio, .p-chk').forEach((label) => {
    label.addEventListener('click', () => {
      const input = label.querySelector('input');
      if (input.type === 'radio') { input.checked = true; label.parentElement.querySelectorAll('.p-dot').forEach(d=>d.classList.remove('on')); label.querySelector('.p-dot').classList.add('on'); }
      else { input.checked = !input.checked; label.querySelector('.p-box').classList.toggle('on', input.checked); label.querySelector('.p-box').textContent = input.checked ? '✓' : ''; }
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
