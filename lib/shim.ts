/**
 * Runs inside every hosted page, in a sandboxed iframe with no access to this site.
 *
 * It provides the storage API WQA study files already call
 * (`window.claude.use("db")` with collection/doc/onSnapshot, and `use("downloads")`),
 * so existing files save responses here without edits. New templates can use
 * `window.testbench.db` and read their JSON from `window.testbench.data`.
 *
 * Every call is passed to the player page with postMessage; the player sends it
 * to /api/d/<slug>/db.
 */
const SHIM = String.raw`(function(){
if (window.__wqaTestbench) return; window.__wqaTestbench = 1;
var DATA = __DATA__;
var seq = 0, waiting = {}, listeners = [];
function rid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function call(op, args){
  return new Promise(function(res, rej){
    var id = ++seq; waiting[id] = { res: res, rej: rej };
    parent.postMessage({ wqa: 1, id: id, op: op, args: args }, "*");
    setTimeout(function(){ if (waiting[id]) { delete waiting[id]; rej(new Error("Saving timed out")); } }, 20000);
  });
}
window.addEventListener("message", function(e){
  if (e.source !== parent) return;
  var m = e.data; if (!m || !m.wqaReply) return;
  var w = waiting[m.id]; if (!w) return; delete waiting[m.id];
  if (m.error) w.rej(new Error(m.error)); else w.res(m.result);
});
function copy(v){ return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function docSnap(path, data){
  var id = path.split("/").pop();
  return { id: id, ref: docRef(path), exists: data != null, data: function(){ return data == null ? undefined : copy(data); } };
}
function refreshAll(){ listeners.forEach(function(l){ l.run(); }); }
function listen(run){
  var l = { run: run }; listeners.push(l); run();
  return function(){ listeners = listeners.filter(function(x){ return x !== l; }); };
}
setInterval(function(){ if (listeners.length && !document.hidden) refreshAll(); }, 10000);
function qsnap(rows, order, lim){
  rows = rows.slice();
  if (order) rows.sort(function(a, b){
    var x = a.data[order.f], y = b.data[order.f];
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    var c = x < y ? -1 : x > y ? 1 : 0; return order.dir === "desc" ? -c : c;
  });
  if (lim) rows = rows.slice(0, lim);
  var docs = rows.map(function(r){ return docSnap(r.path, r.data); });
  return { docs: docs, size: docs.length, empty: !docs.length, forEach: function(f){ docs.forEach(f); } };
}
function query(coll, order, lim){
  return {
    orderBy: function(f, dir){ return query(coll, { f: f, dir: dir || "asc" }, lim); },
    limit: function(n){ return query(coll, order, n); },
    get: function(){ return call("list", { collection: coll }).then(function(rows){ return qsnap(rows, order, lim); }); },
    onSnapshot: function(cb, err){
      return listen(function(){ call("list", { collection: coll }).then(function(rows){ cb(qsnap(rows, order, lim)); }, function(e){ if (err) err(e); }); });
    },
    add: function(data){ return call("add", { collection: coll, data: data }).then(function(r){ refreshAll(); return docRef(coll + "/" + r.id); }); },
    doc: function(id){ return docRef(coll + "/" + (id || rid())); }
  };
}
// Template drops: the JSON is already in the page, so content loads before the first render.
var FIXED = DATA != null ? { "config/content": DATA } : {};
function docRef(path){
  if (FIXED[path] !== undefined) return {
    id: path.split("/").pop(), path: path,
    get: function(){ return Promise.resolve(docSnap(path, FIXED[path])); },
    set: function(){ return Promise.reject(new Error("This test's content is set from the WQA dashboard.")); },
    update: function(){ return Promise.reject(new Error("This test's content is set from the WQA dashboard.")); },
    delete: function(){ return Promise.reject(new Error("This test's content is set from the WQA dashboard.")); },
    onSnapshot: function(cb){ cb(docSnap(path, FIXED[path])); return function(){}; }
  };
  return {
    id: path.split("/").pop(), path: path,
    get: function(){ return call("get", { path: path }).then(function(d){ return docSnap(path, d); }); },
    set: function(data, opts){ return call(opts && opts.merge ? "update" : "set", { path: path, data: data }).then(refreshAll); },
    update: function(data){ return call("update", { path: path, data: data }).then(refreshAll); },
    delete: function(){ return call("delete", { path: path }).then(refreshAll); },
    onSnapshot: function(cb, err){
      return listen(function(){ call("get", { path: path }).then(function(d){ cb(docSnap(path, d)); }, function(e){ if (err) err(e); }); });
    }
  };
}
var db = { collection: function(n){ return query(n); }, doc: function(p){ return docRef(p); } };
var downloads = { save: function(o){
  parent.postMessage({ wqa: 1, id: 0, op: "download", args: {
    filename: String(o && o.filename || "download.txt"),
    data: typeof (o && o.data) === "string" ? o.data : JSON.stringify(o && o.data, null, 2),
    mime: o && (o.mimeType || o.mime) || ""
  } }, "*");
  return Promise.resolve();
} };
window.claude = window.claude || {};
window.claude.use = function(name){
  if (name === "db") return Promise.resolve(db);
  if (name === "downloads") return Promise.resolve(downloads);
  return Promise.reject(new Error(name + " isn't available on WQA Testbench"));
};
window.testbench = { data: copy(DATA), db: db, downloads: downloads };
})();`;

function safeJson(v: unknown) {
  return JSON.stringify(v ?? null).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function injectShim(html: string, data: unknown) {
  const tag = `<script>${SHIM.replace("__DATA__", safeJson(data))}</script>`;
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) return html.slice(0, head.index + head[0].length) + tag + html.slice(head.index + head[0].length);
  const htmlTag = /<html(\s[^>]*)?>/i.exec(html);
  if (htmlTag) return html.slice(0, htmlTag.index + htmlTag[0].length) + tag + html.slice(htmlTag.index + htmlTag[0].length);
  const doctype = /<!doctype[^>]*>/i.exec(html);
  if (doctype) return html.slice(0, doctype.index + doctype[0].length) + tag + html.slice(doctype.index + doctype[0].length);
  return tag + html;
}
