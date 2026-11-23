/** Shared "read-only by default, edit on demand" behaviour of the standalone `.html` exports
 *  (Resumido RB-33 and Detalhado). The page opens locked; "Editar textos" makes the whole
 *  `[data-editable-root]` editable, edits persist in this browser (keyed by the document and a hash
 *  of its original content, so a regenerated file never picks up stale edits), "Gerar PDF" prints
 *  the current DOM — edits included — and "Baixar HTML com edições" bakes them into a read-only copy. */

export interface EditorButtonClasses {
  btn: string;
  primary: string;
  status: string;
}

export function editorActionsHtml(cls: EditorButtonClasses): string {
  return [
    `<span class="${cls.status}" id="edit-status">Somente leitura</span>`,
    `<button type="button" class="${cls.btn}" id="btn-reset" hidden>Descartar edições</button>`,
    `<button type="button" class="${cls.btn}" id="btn-edit" aria-pressed="false">Editar textos</button>`,
    `<button type="button" class="${cls.btn}" id="btn-save">Baixar HTML com edições</button>`,
    `<button type="button" class="${cls.btn} ${cls.primary}" id="btn-print">Gerar PDF</button>`,
  ].join("\n    ");
}

/** Edit-mode affordances, shared by both models (scoped to `body.editing`). */
export const EDITOR_EDIT_CSS = `
body.editing [data-editable-root] { outline: 2px dashed rgba(0,92,92,.35); outline-offset: 8px; border-radius: 4px; caret-color: #005c5c; }
body.editing [data-editable-root]:focus { outline-color: rgba(0,92,92,.7); }
body.editing [data-editable-root] :is(p, li, td, th, h1, h2, h3, h4, div):hover { background: rgba(0,92,92,.05); }
.edit-status-editing { color: #904d00 !important; font-weight: 600; }
@media print {
  body.editing [data-editable-root] { outline: none; }
  body.editing [data-editable-root] *:hover { background: none; }
}
`;

/** Top bar and buttons for the plain Detalhado page (the RB-33 page has its own design-system CSS). */
export const EDITOR_BASE_CSS = `
.ed-bar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 16px; background: #fff; border-bottom: 1px solid #d9dddc; }
.ed-title { font-weight: 700; font-size: 15px; }
.ed-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ed-btn { font: inherit; font-size: 14px; padding: 6px 14px; border: 1px solid #005c5c; border-radius: 6px; background: transparent; color: #005c5c; cursor: pointer; }
.ed-btn:hover { background: #e2fffe; }
.ed-btn-primary { background: #005c5c; color: #fff; border-color: transparent; }
.ed-btn-primary:hover { background: #004f4f; }
.ed-status { font-size: 12px; color: #505353; }
@media print { .ed-bar { display: none !important; } }
${EDITOR_EDIT_CSS}`;

export const EDITOR_SCRIPT = `
(function () {
  var root = document.querySelector("[data-editable-root]");
  if (!root) return;
  var body = document.body;
  var btnEdit = document.getElementById("btn-edit");
  var btnReset = document.getElementById("btn-reset");
  var btnPrint = document.getElementById("btn-print");
  var btnSave = document.getElementById("btn-save");
  var status = document.getElementById("edit-status");

  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
  var KEY = "doc-edits:" + (body.getAttribute("data-doc") || location.pathname) + ":" + hash(root.innerHTML);
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  var saved = read();
  if (saved) root.innerHTML = saved;
  function refreshReset() { if (btnReset) btnReset.hidden = !read(); }
  refreshReset();

  var editing = false, timer = null;
  function save() { clearTimeout(timer); timer = null; write(root.innerHTML); refreshReset(); }
  function setEditing(on) {
    editing = on;
    if (on) root.setAttribute("contenteditable", "true"); else root.removeAttribute("contenteditable");
    body.classList.toggle("editing", on);
    if (btnEdit) { btnEdit.textContent = on ? "Concluir edição" : "Editar textos"; btnEdit.setAttribute("aria-pressed", on ? "true" : "false"); }
    if (status) { status.textContent = on ? "Editando — alterações salvas neste navegador" : "Somente leitura"; status.classList.toggle("edit-status-editing", on); }
    if (on) root.focus(); else { if (timer) save(); if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur(); }
  }

  root.addEventListener("input", function () { if (!editing) return; clearTimeout(timer); timer = setTimeout(save, 400); });
  root.addEventListener("paste", function (ev) {
    if (!editing) return;
    ev.preventDefault();
    var text = (ev.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });
  if (btnEdit) btnEdit.addEventListener("click", function () { setEditing(!editing); });
  if (btnPrint) btnPrint.addEventListener("click", function () { if (editing) setEditing(false); window.print(); });
  if (btnReset) btnReset.addEventListener("click", function () {
    if (!confirm("Descartar todas as edições feitas neste navegador e voltar ao texto original?")) return;
    clear();
    location.reload();
  });
  if (btnSave) btnSave.addEventListener("click", function () {
    if (editing) setEditing(false);
    var clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll("[contenteditable]").forEach(function (el) { el.removeAttribute("contenteditable"); });
    clone.querySelectorAll(".toc a.active").forEach(function (a) { a.classList.remove("active"); });
    var cb = clone.querySelector("body"); if (cb) cb.classList.remove("editing");
    var rs = clone.querySelector("#btn-reset"); if (rs) rs.setAttribute("hidden", "");
    var blob = new Blob(["<!DOCTYPE html>\\n" + clone.outerHTML], { type: "text/html" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (document.title || "documentacao").replace(/[^\\w\\-]+/g, "_") + ".html";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  var links = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
  if (links.length) {
    var targets = links.map(function (a) { return document.getElementById(a.getAttribute("href").slice(1)); });
    var spy = function () {
      var current = 0;
      targets.forEach(function (t, i) { if (t && t.getBoundingClientRect().top < 140) current = i; });
      links.forEach(function (a, i) { a.classList.toggle("active", i === current); });
    };
    window.addEventListener("scroll", spy, { passive: true });
    spy();
  }
})();
`;
