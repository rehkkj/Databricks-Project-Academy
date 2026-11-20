/* ==========================================================================
   Databricks Academy — app.js
   Núcleo da apostila: dados, persistência, rotas, telas, editor e efeitos.
   A camada de IA (ia.js) se registra em App.ia; este arquivo funciona sem ela.
   ========================================================================== */
"use strict";
(function () {

/* ---------- 1. Utilidades ---------- */
const App = (window.App = window.App || {});
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const clone = (v) => JSON.parse(JSON.stringify(v));
const clamp = (n, min, max, def) => { n = Number(n); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def; };
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const strip = (html) => { const d = document.createElement("div"); d.innerHTML = String(html || ""); return d.textContent.trim(); };
const slug = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const LETRAS = "ABCDEFGH";
const reduzMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const idLocal = (p) => p + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

function baixar(nome, conteudo, tipo = "application/json") {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: nome });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function lerArquivo(file, limite = 5 * 1024 * 1024) {
  if (!file) return Promise.reject(new Error("Nenhum arquivo selecionado."));
  if (file.size > limite) return Promise.reject(new Error("Arquivo maior que " + Math.round(limite / 1048576) + " MB."));
  return file.text();
}
function carregarScript(src, chave) {
  const sel = 'script[data-lib="' + chave + '"]';
  const existente = document.querySelector(sel);
  if (existente) return existente._p;
  const s = document.createElement("script");
  s.src = src; s.async = true; s.dataset.lib = chave; s.crossOrigin = "anonymous";
  s._p = new Promise((ok, falha) => { s.onload = ok; s.onerror = () => { s.remove(); falha(new Error("Não foi possível carregar " + chave + ". Verifique a conexão.")); }; });
  document.head.appendChild(s);
  return s._p;
}

/* Markdown mínimo e seguro para respostas da IA (escapa antes de formatar). */
function md(texto) {
  const blocos = [];
  let t = String(texto || "").replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, l, c) => { blocos.push('<pre><code>' + esc(c.replace(/\n$/, "")) + "</code></pre>"); return "\u0000" + (blocos.length - 1) + "\u0000"; });
  t = esc(t);
  const inline = (s) => s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|#[\w%.-]+)\)/g, (_, txt, url) => '<a href="' + url + '"' + (url[0] === "#" ? "" : ' target="_blank" rel="noopener noreferrer"') + ">" + txt + "</a>");
  const linhas = t.split("\n"); const out = []; let lista = null;
  const fecha = () => { if (lista) { out.push("</" + lista + ">"); lista = null; } };
  for (const l of linhas) {
    let m;
    if (/^\u0000\d+\u0000$/.test(l.trim())) { fecha(); out.push(l.trim()); continue; }
    if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (lista !== "ul") { fecha(); out.push("<ul>"); lista = "ul"; } out.push("<li>" + inline(m[1]) + "</li>"); continue; }
    if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (lista !== "ol") { fecha(); out.push("<ol>"); lista = "ol"; } out.push("<li>" + inline(m[1]) + "</li>"); continue; }
    fecha();
    if ((m = l.match(/^#{1,4}\s+(.*)/))) { out.push("<h3>" + inline(m[1]) + "</h3>"); continue; }
    if (l.trim()) out.push("<p>" + inline(l) + "</p>");
  }
  fecha();
  return '<div class="md">' + out.join("").replace(/\u0000(\d+)\u0000/g, (_, i) => blocos[i]) + "</div>";
}

/* Ícones em linha (traço fino, herdam currentColor). */
const ICONE = {
  sol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  lua: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  marca: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  casa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  livro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z"/></svg>',
  balao: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  lapis: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 20l4-1L19 8l-3-3L5 16zM14 7l3 3"/></svg>',
  relogio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
  radar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3l8 6-3 10H7L4 9z"/><path d="M12 8l4 3-1.5 5h-5L8 11z"/></svg>'
};

/* ---------- 2. Persistência ---------- */
const K = {
  conteudo: "apostilaDatabricksContent", progresso: "apostilaDatabricksProgress", stats: "apostilaDatabricksAnswerStats",
  rascunhos: "apostilaDatabricksCodeDrafts", tema: "apostilaDatabricksTheme", ajustes: "apostilaDatabricksSettings",
  modos: "apostilaDatabricksProfiles", modoAtivo: "apostilaDatabricksActiveProfile", temasSalvos: "apostilaDatabricksSavedThemes",
  logs: "databricksAcademySafeLogs", historico: "apostilaDatabricksTutorHistory", perfil: "databricksAcademyUserProfile",
  marcas: "dbAcademyLearningMarksV1", nivel: "dbAcademyLearningLevelV1", mapa: "dbAcademyMindmapLastV1", leve: "apostilaLite"
};
const LIMITE_MODOS = 20, LIMITE_TEMAS = 30;
const armazem = {
  ler(k, padrao) { try { const v = localStorage.getItem(k); return v == null ? padrao : JSON.parse(v); } catch (e) { return padrao; } },
  bruto(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  gravar(k, v) { try { localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v)); return true; } catch (e) { return false; } },
  apagar(k) { try { localStorage.removeItem(k); } catch (e) { /* sem acesso */ } }
};
/* Grava várias chaves de uma vez; se alguma falhar, devolve todas ao estado anterior. */
function gravarJuntos(pares) {
  const antes = pares.map(([k]) => [k, armazem.bruto(k)]);
  for (const [k, v] of pares) {
    const ok = v === undefined ? (armazem.apagar(k), true) : armazem.gravar(k, v);
    if (!ok) { antes.forEach(([k2, v2]) => v2 == null ? armazem.apagar(k2) : armazem.gravar(k2, v2)); return false; }
  }
  return true;
}

/* ---------- 3. Conteúdo padrão ---------- */
const CONTEUDO_PADRAO = [
  { t: "Fundamentos do Databricks", l: [
    { id: "lakehouse", t: "O que é o Lakehouse", d: "8 min", h: "O Lakehouse combina a flexibilidade de um data lake com recursos de gestão, confiabilidade e desempenho associados a um data warehouse.\n\nNo Databricks, os dados podem ser armazenados em tabelas Delta sobre armazenamento em nuvem. Compute, armazenamento e governança são componentes distintos.", q: [
      { p: "Qual característica melhor descreve a arquitetura Lakehouse?", o: ["Combina armazenamento aberto de data lake com recursos de gestão e confiabilidade.", "Exige que todos os dados sejam armazenados em um banco relacional proprietário.", "Elimina a necessidade de processamento distribuído.", "Armazena apenas dados estruturados em memória."], a: 0, e: "O Lakehouse aproxima a flexibilidade do data lake dos recursos de confiabilidade e gestão de um warehouse." },
      { p: "Em uma arquitetura Databricks, o armazenamento dos dados costuma ficar:", o: ["No armazenamento de objetos em nuvem, separado do compute.", "Dentro do navegador de cada usuário.", "Somente no disco local do driver.", "Em um arquivo temporário apagado após cada consulta."], a: 0, e: "Separar armazenamento e compute permite escalar e administrar cada camada independentemente." }
    ] },
    { id: "workspace", t: "Workspace, compute e notebooks", d: "7 min", h: "O workspace organiza notebooks, arquivos, consultas e outros ativos de trabalho. Notebooks podem combinar código, texto e visualizações.\n\nCompute é o recurso que executa as cargas de trabalho. Escolha um tipo e tamanho compatíveis com a tarefa, e encerre recursos interativos quando não forem mais necessários.", q: [
      { p: "Qual é a função principal do compute?", o: ["Executar consultas e código de processamento.", "Armazenar permanentemente todas as tabelas Delta.", "Definir os usuários do provedor de nuvem.", "Substituir o catálogo de dados."], a: 0, e: "Compute fornece recursos de execução; os dados podem permanecer em armazenamento separado." }
    ] }
  ] },
  { t: "Delta Lake e SQL", l: [
    { id: "delta-lake", t: "Tabelas Delta e transações", d: "9 min", h: "Delta Lake adiciona um log transacional ao armazenamento de dados, permitindo operações como leituras consistentes, controle de concorrência e evolução de esquema.\n\nUse tabelas gerenciadas conforme as necessidades de retenção e governança. Operações de escrita devem ser planejadas para evitar sobrescritas acidentais.", q: [
      { p: "O que o log transacional do Delta Lake possibilita?", o: ["Registrar alterações e oferecer leituras consistentes da tabela.", "Executar código Python sem compute.", "Substituir todas as permissões do catálogo.", "Converter automaticamente qualquer arquivo em tabela sem configuração."], a: 0, e: "O log Delta acompanha as transações da tabela e viabiliza recursos de consistência e concorrência." },
      { p: "Qual comando grava um DataFrame como tabela Delta usando PySpark?", o: ["df.write.format(\"delta\").saveAsTable(\"catalogo.esquema.tabela\")", "df.read.format(\"delta\").saveAsTable(\"catalogo.esquema.tabela\")", "spark.stop(\"catalogo.esquema.tabela\")", "df.sql(\"CREATE DELTA TABLE\")"], a: 0, e: "O writer do DataFrame permite definir o formato Delta e salvar o resultado como tabela." }
    ] },
    { id: "spark-sql", t: "Consultas com Spark SQL", d: "8 min", h: "Spark SQL permite consultar tabelas com SQL e também pode ser usado em notebooks. Prefira selecionar as colunas necessárias e aplicar filtros que reduzam os dados processados.\n\nEm ambientes com Unity Catalog, referencie tabelas usando o formato catalogo.esquema.tabela quando aplicável.", q: [
      { p: "Como consultar somente as colunas id e nome da tabela clientes no schema vendas?", o: ["SELECT id, nome FROM catalogo.vendas.clientes", "SELECT * FROM id, nome WHERE vendas.clientes", "READ clientes COLUMNS id, nome", "SHOW id, nome IN catalogo.vendas.clientes"], a: 0, e: "A forma de três partes identifica catálogo, schema e tabela; a lista de colunas evita ler colunas desnecessárias." }
    ] }
  ] },
  { t: "Engenharia de dados", l: [
    { id: "pyspark", t: "Transformações com PySpark", d: "8 min", h: "DataFrames do PySpark representam dados distribuídos e permitem compor transformações como select, filter e withColumn.\n\nMuitas transformações são avaliadas de forma preguiçosa: o plano é executado quando uma ação, como count ou write, é chamada. Isso permite ao Spark otimizar o plano.", q: [
      { p: "Qual chamada normalmente dispara a execução de um plano de DataFrame?", o: ["df.count()", "df.select(\"coluna\")", "df.filter(\"valor > 0\")", "df.withColumn(\"nova\", expr)"], a: 0, e: "count é uma ação. select, filter e withColumn são transformações que compõem o plano." }
    ] },
    { id: "autoloader", t: "Ingestão incremental com Auto Loader", d: "8 min", h: "O Auto Loader detecta e processa arquivos novos de forma incremental, sendo útil para ingestão contínua de dados em armazenamento de objetos.\n\nA configuração normalmente define o formato de origem, o caminho dos arquivos e diretórios de checkpoint e schema para acompanhar o progresso e a evolução do esquema.", q: [
      { p: "Para que serve o Auto Loader?", o: ["Detectar e ingerir arquivos novos de forma incremental.", "Substituir o armazenamento Delta por memória.", "Criar usuários e grupos do workspace.", "Executar apenas consultas SQL interativas."], a: 0, e: "O Auto Loader oferece ingestão incremental de arquivos, com suporte a estado e evolução de esquema." }
    ] }
  ] },
  { t: "Governança e operações", l: [
    { id: "unity-catalog", t: "Governança com Unity Catalog", d: "8 min", h: "Unity Catalog centraliza a governança de dados e ativos no Databricks. A hierarquia usual é metastore, catálogo, schema e objeto, como uma tabela ou view.\n\nAplique o princípio do menor privilégio: conceda apenas as permissões necessárias e revise acessos regularmente.", q: [
      { p: "Qual é a hierarquia usual para identificar uma tabela no Unity Catalog?", o: ["catalogo.esquema.tabela", "tabela.catalogo.esquema", "workspace.cluster.tabela", "metastore.usuario.arquivo"], a: 0, e: "Uma tabela é normalmente referenciada pelo catálogo, schema e nome do objeto." }
    ] },
    { id: "workflows", t: "Workflows e jobs", d: "7 min", h: "Jobs e Workflows automatizam tarefas, podem organizar etapas dependentes e permitem configurar agenda, compute, parâmetros e notificações.\n\nTorne as tarefas idempotentes sempre que possível, monitore falhas e evite incluir credenciais diretamente em notebooks ou código.", q: [
      { p: "Qual prática ajuda a tornar um job de dados mais confiável?", o: ["Monitorar falhas e projetar tarefas idempotentes.", "Guardar senhas diretamente no notebook.", "Ignorar dependências entre tarefas.", "Executar tudo no computador pessoal do autor."], a: 0, e: "Monitoramento e idempotência facilitam recuperação e reexecução segura de tarefas." }
    ] }
  ] }
];

/* ---------- 4. Validação do conteúdo ---------- */
const LINGUAGENS = ["SQL", "Python", "PySpark"];
const ehCodigo = (q) => q && q.mode === "code";
function questaoValida(q) {
  if (!isObj(q) || typeof q.p !== "string") return false;
  if (ehCodigo(q)) return LINGUAGENS.includes(q.language) && ["task", "starter", "e"].every((k) => q[k] == null || typeof q[k] === "string") && typeof q.solution === "string" && q.solution.trim() !== "";
  return Array.isArray(q.o) && q.o.length === 4 && q.o.every((o) => typeof o === "string") && Number.isInteger(q.a) && q.a >= 0 && q.a <= 3 && (q.e == null || typeof q.e === "string");
}
function conteudoValido(mods) {
  if (!Array.isArray(mods)) return false;
  const ids = new Set();
  for (const m of mods) {
    if (!isObj(m) || typeof m.t !== "string" || !Array.isArray(m.l)) return false;
    for (const l of m.l) {
      if (!isObj(l) || typeof l.id !== "string" || !/^[a-z0-9_-]+$/i.test(l.id) || ids.has(l.id)) return false;
      ids.add(l.id);
      if (typeof l.t !== "string" || typeof l.d !== "string" || typeof l.h !== "string" || !Array.isArray(l.q)) return false;
      if (l.studyCards != null && !Array.isArray(l.studyCards)) return false;
      if (!l.q.every(questaoValida)) return false;
    }
  }
  return true;
}
/* Enunciados aceitam só um subconjunto de HTML; atributos são descartados. */
const TAGS_OK = new Set(["B", "STRONG", "I", "EM", "CODE", "PRE", "BR", "P", "UL", "OL", "LI"]);
function htmlSeguro(html) {
  const tpl = document.createElement("template"); tpl.innerHTML = String(html || "");
  const limpa = (no) => Array.from(no.childNodes).map((n) => {
    if (n.nodeType === 3) return esc(n.textContent);
    if (n.nodeType !== 1) return "";
    const tag = n.tagName; const dentro = limpa(n);
    if (!TAGS_OK.has(tag)) return dentro;
    if (tag === "BR") return "<br>";
    const t = tag.toLowerCase();
    return "<" + t + ">" + dentro + "</" + t + ">";
  }).join("");
  return limpa(tpl.content);
}

/* ---------- 5. Estado ---------- */
const S = {
  mods: [], progresso: {}, stats: {}, rascunhos: {}, ajustes: null, tema: "claro",
  marcas: { questions: {}, lines: {} }, modos: [], temasSalvos: [], modoAtivo: "",
  perfil: { name: "", photo: "" }, nivel: "pleno", rota: "home", rotaAnterior: ""
};
const aulas = () => S.mods.flatMap((m) => m.l);
const acharAula = (id) => aulas().find((l) => l.id === id) || null;
const indiceModulo = (aula) => S.mods.findIndex((m) => m.l.includes(aula));
const moduloDe = (aula) => S.mods[indiceModulo(aula)];

function carregarConteudo() {
  const salvo = armazem.ler(K.conteudo, null);
  S.mods = conteudoValido(salvo) ? salvo : clone(CONTEUDO_PADRAO);
}
function salvarConteudo(msgOk) {
  if (!conteudoValido(S.mods)) { aviso("O conteúdo não passou na validação; nada foi salvo.", true); return false; }
  if (!armazem.gravar(K.conteudo, S.mods)) { aviso("O navegador recusou salvar o conteúdo (armazenamento cheio?).", true); return false; }
  if (msgOk) aviso(msgOk);
  return true;
}
function normalizarProgresso(p) {
  const out = {};
  if (!isObj(p)) return out;
  for (const l of aulas()) {
    if (!Array.isArray(p[l.id])) continue;
    const idx = [...new Set(p[l.id].filter((i) => Number.isInteger(i) && i >= 0 && i < l.q.length))];
    if (idx.length) out[l.id] = idx;
  }
  return out;
}
function normalizarStats(s) {
  const out = {};
  if (!isObj(s)) return out;
  const n = (v) => Math.floor(clamp(v, 0, 1e6, 0));
  for (const l of aulas()) {
    if (!isObj(s[l.id])) continue;
    for (const k of Object.keys(s[l.id])) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || i >= l.q.length || !isObj(s[l.id][k])) continue;
      (out[l.id] = out[l.id] || {})[i] = { correct: n(s[l.id][k].correct), wrong: n(s[l.id][k].wrong) };
    }
  }
  return out;
}
const salvarProgresso = () => armazem.gravar(K.progresso, S.progresso) || aviso("Não foi possível salvar o progresso.", true);
const salvarStats = () => armazem.gravar(K.stats, S.stats) || aviso("Não foi possível salvar as estatísticas.", true);

function atualizarPainelInicio() {
  const main = document.getElementById("principal");
  if (!main || S.ajustes.navigationMode !== "scroll" || main.dataset.continuo !== "1") return;
  /* No modo contínuo a home é montada apenas uma vez. Atualize todos os
     blocos derivados do progresso, não somente o placar. */
  const doc = new DOMParser().parseFromString(telaInicio(), "text/html");
  const atualPlacar = main.querySelector(".placar");
  const novoPlacar = doc.querySelector(".placar");
  if (atualPlacar && novoPlacar) atualPlacar.replaceWith(novoPlacar);
  const atualResumo = main.querySelector("[data-progress-live]");
  const novoResumo = doc.querySelector("[data-progress-live]");
  if (atualResumo && novoResumo) atualResumo.replaceWith(novoResumo);
  desenharIndice();
  if (novoPlacar) prepararAnimacoes(novoPlacar);
  if (novoResumo) prepararAnimacoes(novoResumo);
}

function registrarResposta(aulaId, qi, certo) {
  const a = (S.stats[aulaId] = S.stats[aulaId] || {});
  const r = (a[qi] = a[qi] || { correct: 0, wrong: 0 });
  if (certo) r.correct++; else r.wrong++;
  salvarStats(); atualizarPainelInicio();
  return r;
}
function concluirQuestao(aulaId, qi) {
  const lista = (S.progresso[aulaId] = S.progresso[aulaId] || []);
  if (!lista.includes(qi)) { lista.push(qi); salvarProgresso(); }
  atualizarPainelInicio();
  const main = document.getElementById("principal");
  if (main?.dataset.continuo === "1") {
    const secao = document.getElementById("sec-" + aulaId);
    const aula = acharAula(aulaId);
    if (secao && aula) {
      const feitas = (S.progresso[aulaId] || []).length;
      const meta = secao.querySelector(".aula-meta");
      const resolvida = meta && [...meta.querySelectorAll("span")].find((el) => /resolvida/.test(el.textContent));
      if (resolvida) resolvida.textContent = feitas + " resolvida" + (feitas === 1 ? "" : "s");
      const contador = secao.querySelector(".questoes-cab .mini");
      if (contador) contador.textContent = feitas + "/" + aula.q.length;
    }
  }
}

function limparDadosDaAula(aulaId) { delete S.progresso[aulaId]; delete S.stats[aulaId]; salvarProgresso(); salvarStats(); atualizarPainelInicio(); }
const aulaConcluida = (l) => l.q.length > 0 && (S.progresso[l.id] || []).length >= l.q.length && l.q.every((_, i) => (S.progresso[l.id] || []).includes(i));

/* Números do painel: conclusão por questões certas; acerto por tentativas. */
function estatisticas() {
  let total = 0, feitas = 0, certas = 0, erradas = 0;
  const porModulo = S.mods.map((m, mi) => {
    let mt = 0, mf = 0, mc = 0, me = 0;
    for (const l of m.l) {
      const feitasAula = S.progresso[l.id] || [];
      l.q.forEach((_, i) => {
        mt++;
        const st = (S.stats[l.id] || {})[i];
        const fez = feitasAula.includes(i);
        if (fez) mf++;
        if (st) { mc += st.correct; me += st.wrong; } else if (fez) mc += 1;
      });
    }
    total += mt; feitas += mf; certas += mc; erradas += me;
    return { mi, titulo: m.t, total: mt, feitas: mf, certas: mc, erradas: me, aulasFeitas: m.l.filter(aulaConcluida).length, aulas: m.l.length };
  });
  const tent = certas + erradas;
  const dificeis = porModulo.filter((m) => m.erradas > 0)
    .sort((a, b) => b.erradas - a.erradas || (a.certas / (a.total || 1)) - (b.certas / (b.total || 1))).slice(0, 3);
  return { total, feitas, certas, erradas, tentativas: tent, conclusao: total ? Math.round(feitas * 100 / total) : 0, acerto: tent ? Math.round(certas * 100 / tent) : 0, porModulo, dificeis };
}

/* ---------- 6. Aparência: padrões, desenhos completos, paletas, fontes ---------- */
const FONTES = ["IBM Plex Sans", "Newsreader", "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Nunito", "Raleway", "Merriweather", "Playfair Display", "Lora", "Source Sans 3", "JetBrains Mono", "DM Sans", "Space Grotesk", "Manrope", "Georgia", "system-ui"];
const FONTE_QUERY = {
  "IBM Plex Sans": "IBM+Plex+Sans:wght@400;500;600", "Newsreader": "Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400;1,6..72,500",
  "DM Sans": "DM+Sans", "Inter": "Inter:wght@300;400;500;600;700;800", "JetBrains Mono": "JetBrains+Mono:wght@400;700", "Lato": "Lato:wght@300;400;700",
  "Lora": "Lora", "Manrope": "Manrope", "Merriweather": "Merriweather:wght@300;400;700", "Montserrat": "Montserrat:wght@300;400;600;800",
  "Nunito": "Nunito:wght@300;400;600;700", "Open Sans": "Open+Sans", "Playfair Display": "Playfair+Display:wght@400;700", "Poppins": "Poppins:wght@300;400;600;700",
  "Raleway": "Raleway", "Roboto": "Roboto:wght@300;400;700", "Source Sans 3": "Source+Sans+3", "Space Grotesk": "Space+Grotesk"
};
const fontesCarregadas = new Set(["IBM Plex Sans", "Newsreader", "IBM Plex Mono"]);
function carregarFonte(nome) {
  if (!FONTE_QUERY[nome] || fontesCarregadas.has(nome)) return;
  fontesCarregadas.add(nome);
  document.head.appendChild(Object.assign(document.createElement("link"), { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=" + FONTE_QUERY[nome] + "&display=swap" }));
}
const carregarTodasFontes = () => FONTES.forEach(carregarFonte);
const pilhaFonte = (n) => n === "system-ui" ? "system-ui, sans-serif" : n === "Georgia" ? "Georgia, serif" : '"' + n + '", system-ui, sans-serif';

const CORES_CADERNO = {
  primary: "#c8502a", primaryLight: "#df7a4c", secondary: "#3e62a3", success: "#3d8654", danger: "#bf3d2e",
  dark: { bg: "#15191f", surface: "#20252d", card: "#1a1f26", cardHover: "#222831", border: "#343b46", text: "#ece6da", muted: "#a99f91" },
  light: { bg: "#f5f0e6", surface: "#ece4d5", card: "#fcf9f3", cardHover: "#f3ede1", border: "#ddd3c1", text: "#2b241c", muted: "#6b5f51" }
};
const DESENHOS = {
  caderno: { label: "Caderno técnico (padrão)", font: "IBM Plex Sans", titleFont: "Newsreader", radius: 6, headerBlur: 0, backgroundEffect: "off", colors: CORES_CADERNO },
  classic: { label: "Databricks clássico", font: "Inter", titleFont: "Inter", radius: 14, headerBlur: 20, backgroundEffect: "aurora", colors: {
    primary: "#ff5f3b", primaryLight: "#ff835f", secondary: "#6f8cff", success: "#20d67a", danger: "#ff6a6a",
    dark: { bg: "#071018", surface: "#101822", card: "#101822", cardHover: "#161f2c", border: "#29313a", text: "#f8fafc", muted: "#94a3b8" },
    light: { bg: "#f1f5f9", surface: "#ffffff", card: "#ffffff", cardHover: "#ffffff", border: "#cbd5e1", text: "#0f172a", muted: "#475569" } } },
  paper: { label: "Editorial de papel", font: "Georgia", titleFont: "Playfair Display", radius: 9, headerBlur: 0, backgroundEffect: "topography", colors: {
    primary: "#9a5b32", primaryLight: "#c17a51", secondary: "#517e77", success: "#398b67", danger: "#c65252",
    dark: { bg: "#1a1917", surface: "#25221f", card: "#292521", cardHover: "#332d28", border: "#4b4038", text: "#f5eee5", muted: "#b8aa9a" },
    light: { bg: "#f4efe6", surface: "#fffaf2", card: "#fffaf2", cardHover: "#efe6d8", border: "#d9cebd", text: "#342c24", muted: "#706355" } } },
  terminal: { label: "Terminal verde", font: "JetBrains Mono", titleFont: "JetBrains Mono", radius: 3, headerBlur: 0, backgroundEffect: "off", colors: {
    primary: "#34d399", primaryLight: "#86efac", secondary: "#38bdf8", success: "#4ade80", danger: "#fb7185",
    dark: { bg: "#06110e", surface: "#0b1c17", card: "#0b1c17", cardHover: "#122820", border: "#1e4537", text: "#d7ffe8", muted: "#7daf97" },
    light: { bg: "#e9f4ed", surface: "#f6fff8", card: "#f6fff8", cardHover: "#dff0e5", border: "#b6d2c0", text: "#123324", muted: "#486b58" } } },
  aurora: { label: "Aurora violeta", font: "Manrope", titleFont: "Manrope", radius: 18, headerBlur: 24, backgroundEffect: "galaxy", colors: {
    primary: "#a78bfa", primaryLight: "#c4b5fd", secondary: "#22d3ee", success: "#34d399", danger: "#fb7185",
    dark: { bg: "#080c1c", surface: "#10172b", card: "#10172b", cardHover: "#172441", border: "#2b3455", text: "#f5f3ff", muted: "#a5b4d2" },
    light: { bg: "#eef2ff", surface: "#ffffff", card: "#ffffff", cardHover: "#edf3ff", border: "#c7d2fe", text: "#1e1b4b", muted: "#5b6286" } } },
  clean: { label: "Minimalista azul", font: "DM Sans", titleFont: "DM Sans", radius: 10, headerBlur: 0, backgroundEffect: "off", colors: {
    primary: "#2563eb", primaryLight: "#60a5fa", secondary: "#06b6d4", success: "#16a34a", danger: "#dc2626",
    dark: { bg: "#0b1220", surface: "#111c2c", card: "#111c2c", cardHover: "#1a2a3f", border: "#29384c", text: "#edf2f7", muted: "#9aabc0" },
    light: { bg: "#f8fafc", surface: "#ffffff", card: "#ffffff", cardHover: "#f1f5f9", border: "#dbe3ec", text: "#172033", muted: "#64748b" } } }
};
const PALETAS = {
  databricks: ["Databricks", "#ff5f3b", "#ff835f", "#6f8cff", "#071018"], ocean: ["Oceano", "#0ea5e9", "#38bdf8", "#8b5cf6", "#071624"],
  forest: ["Floresta", "#16a34a", "#4ade80", "#0ea5a4", "#081811"], violet: ["Violeta", "#8b5cf6", "#c084fc", "#ec4899", "#130d20"],
  aurora: ["Aurora", "#23c9a8", "#63f5d2", "#7c7cff", "#071a22"], cherry: ["Cereja", "#e11d48", "#fb7185", "#f97316", "#1d0b13"],
  sunset: ["Pôr do sol", "#f97316", "#fbbf24", "#ec4899", "#1b100d"], graphite: ["Grafite", "#94a3b8", "#cbd5e1", "#64748b", "#101419"],
  sapphire: ["Safira", "#2563eb", "#60a5fa", "#06b6d4", "#08142b"], mint: ["Menta", "#10b981", "#6ee7b7", "#14b8a6", "#071b17"],
  sand: ["Areia", "#b77936", "#e2b875", "#547b72", "#201a12"], rose: ["Rosa", "#db2777", "#f472b6", "#a855f7", "#1b0e19"],
  cyber: ["Cyberpunk", "#e879f9", "#f0abfc", "#22d3ee", "#10091c"], mono: ["Monocromático", "#d1d5db", "#f3f4f6", "#9ca3af", "#111111"]
};
const CURSORES = { follower: "Ponto com anel seguidor", ring: "Anel", dot: "Ponto sólido", crosshair: "Mira", double: "Anéis duplos", orbit: "Órbita", square: "Quadrado", diamond: "Diamante", star: "Estrela", scanner: "Scanner", hexagon: "Hexágono", ripple: "Ondulação", brackets: "Molduras de foco", flower: "Flor giratória", butterfly: "Borboleta", portal: "Portal orbital" };
const LUZES = { off: "Sem luz ambiente", aura: "Aura suave", spotlight: "Holofote", ripple: "Onda", rings: "Anéis de luz", soft: "Brilho amplo", neon: "Neon duplo", warm: "Luz quente", pulse: "Pulso de luz", halo: "Halo", laser: "Linhas laser", spark: "Faíscas" };
const FUNDOS = { off: "Sem efeito animado", aurora: "Aurora líquida", topography: "Linhas topográficas", constellation: "Constelação", waves: "Ondas", prism: "Prisma cromático", mesh: "Nuvens em camadas", galaxy: "Galáxia" };
const CAMADAS = { grid: "Grade sutil", particles: "Partículas em movimento", orbs: "Luzes flutuantes", aurora: "Aurora de cores", lines: "Linhas diagonais", stars: "Pontos de luz", mouse: "Mostrar cursor personalizado" };
const FONTES_IA = ["inherit", "IBM Plex Sans", "Inter", "Poppins", "Montserrat", "Roboto", "Lato", "Nunito", "Georgia"];
const BALOES = { classic: "Clássico", soft: "Suave (cartões)", contrast: "Mínimo de alto contraste" };

const AJUSTES_PADRAO = {
  brand: "Databricks Academy", logo: "●", homeTitle: "Apostila Databricks",
  homeIntro: "Lakehouse, Delta Lake, Spark, Auto Loader, Unity Catalog e Workflows — com prática a cada aula e um tutor que explica onde você errou.",
  startLabel: "Começar pela primeira aula", practiceTitle: "Pratique",
  font: "IBM Plex Sans", titleFont: "Newsreader", siteDesign: "caderno", navigationMode: "pages", radius: 6, defaultTheme: "light",
  textScale: 100, cardOpacity: 92, headerBlur: 0, transparentCards: false,
  mouseEffect: "off", mouseStyle: "ring", mouseSize: 36, mouseEnlarge: false, mouseColor: "#c8502a", mouseAccent: "#3e62a3",
  mouseEffectColor: "#c8502a", mouseEffectAccent: "#3e62a3", hideNativeCursor: false, animateCursor: true, cursorDefaultsVersion: 4,
  backgroundEffect: "off", backgroundIntensity: 40, backgroundSpeed: 30,
  ai: { textScale: 100, font: "inherit", bubbleStyle: "classic", opacity: 94 },
  effects: { grid: false, particles: false, orbs: false, mouse: false, aurora: false, lines: false, stars: false },
  colors: CORES_CADERNO
};
const HEX = /^#[0-9a-f]{6}$/i;
const TEXTOS = { brand: 60, logo: 8, homeTitle: 120, homeIntro: 300, startLabel: 120, practiceTitle: 120 };
function normalizarAjustes(entrada) {
  const s = clone(AJUSTES_PADRAO);
  if (!isObj(entrada)) return s;
  for (const [k, max] of Object.entries(TEXTOS)) if (typeof entrada[k] === "string") s[k] = entrada[k].slice(0, max);
  if (FONTES.includes(entrada.font)) s.font = entrada.font;
  if (FONTES.includes(entrada.titleFont)) s.titleFont = entrada.titleFont;
  if (DESENHOS[entrada.siteDesign]) s.siteDesign = entrada.siteDesign;
  if (["pages", "scroll"].includes(entrada.navigationMode)) s.navigationMode = entrada.navigationMode;
  if (["dark", "light"].includes(entrada.defaultTheme)) s.defaultTheme = entrada.defaultTheme;
  const num = { radius: [0, 32], textScale: [85, 120], cardOpacity: [50, 100], headerBlur: [0, 40], mouseSize: [16, 96], backgroundIntensity: [0, 100], backgroundSpeed: [8, 60] };
  for (const [k, [a, b]] of Object.entries(num)) if (entrada[k] != null) s[k] = Math.round(clamp(entrada[k], a, b, s[k]));
  for (const k of ["transparentCards", "mouseEnlarge", "hideNativeCursor", "animateCursor"]) if (typeof entrada[k] === "boolean") s[k] = entrada[k];
  if (LUZES[entrada.mouseEffect]) s.mouseEffect = entrada.mouseEffect;
  if (CURSORES[entrada.mouseStyle]) s.mouseStyle = entrada.mouseStyle;
  for (const k of ["mouseColor", "mouseAccent", "mouseEffectColor", "mouseEffectAccent"]) if (HEX.test(entrada[k] || "")) s[k] = entrada[k];
  if (FUNDOS[entrada.backgroundEffect]) s.backgroundEffect = entrada.backgroundEffect;
  if (isObj(entrada.effects)) for (const k of Object.keys(s.effects)) if (typeof entrada.effects[k] === "boolean") s.effects[k] = entrada.effects[k];
  if (isObj(entrada.ai)) {
    if (entrada.ai.textScale != null) s.ai.textScale = Math.round(clamp(entrada.ai.textScale, 85, 140, 100));
    if (entrada.ai.opacity != null) s.ai.opacity = Math.round(clamp(entrada.ai.opacity, 60, 100, 94));
    if (FONTES_IA.includes(entrada.ai.font)) s.ai.font = entrada.ai.font;
    if (BALOES[entrada.ai.bubbleStyle]) s.ai.bubbleStyle = entrada.ai.bubbleStyle;
  }
  if (isObj(entrada.colors)) {
    for (const k of ["primary", "primaryLight", "secondary", "success", "danger"]) if (HEX.test(entrada.colors[k] || "")) s.colors[k] = entrada.colors[k];
    for (const modo of ["dark", "light"]) if (isObj(entrada.colors[modo])) for (const k of Object.keys(s.colors[modo])) if (HEX.test(entrada.colors[modo][k] || "")) s.colors[modo][k] = entrada.colors[modo][k];
  }
  s.cursorDefaultsVersion = 4;
  return s;
}
function aplicarDesenho(s, id) {
  const d = DESENHOS[id]; if (!d) return s;
  Object.assign(s, { siteDesign: id, font: d.font, titleFont: d.titleFont, radius: d.radius, headerBlur: d.headerBlur, backgroundEffect: d.backgroundEffect, colors: clone(d.colors),
    mouseColor: d.colors.primaryLight, mouseAccent: d.colors.secondary, mouseEffectColor: d.colors.primaryLight, mouseEffectAccent: d.colors.secondary,
    backgroundIntensity: id === "clean" || id === "caderno" ? 0 : id === "paper" || id === "terminal" ? 24 : 46, backgroundSpeed: id === "aurora" ? 36 : 30,
    transparentCards: id === "aurora", cardOpacity: 84 });
  return s;
}
function aplicarPaleta(s, id) {
  const p = PALETAS[id]; if (!p) return s;
  s.colors.primary = p[1]; s.colors.primaryLight = p[2]; s.colors.secondary = p[3];
  s.colors.dark.bg = p[4]; s.colors.dark.surface = p[4]; s.colors.dark.card = p[4];
  s.mouseColor = s.mouseEffectColor = p[2]; s.mouseAccent = s.mouseEffectAccent = p[3];
  return s;
}

/* Converte os ajustes em variáveis do tema; o CSS só consome tokens. */
function aplicarAjustes(s = S.ajustes) {
  const r = document.documentElement; const st = r.style;
  const modo = S.tema === "escuro" ? s.colors.dark : s.colors.light;
  const c = s.colors;
  const vars = {
    "--papel": modo.bg, "--folha": modo.card, "--folha-2": modo.surface, "--tinta": modo.text, "--tinta-2": modo.muted,
    "--tinta-3": "color-mix(in oklab, " + modo.muted + " 70%, " + modo.bg + ")", "--regua": modo.border,
    "--regua-forte": "color-mix(in oklab, " + modo.border + " 70%, " + modo.text + ")", "--folha-hover": modo.cardHover,
    "--brasa": c.primary, "--brasa-2": c.primaryLight, "--anil": c.secondary, "--certo": c.success, "--erro": c.danger,
    "--raio": s.radius + "px", "--escala": s.textScale / 100, "--blur-topo": s.headerBlur + "px",
    "--f-texto": pilhaFonte(s.font), "--f-titulo": pilhaFonte(s.titleFont || s.font),
    "--opac-folha": (s.transparentCards ? s.cardOpacity : 100) + "%",
    "--escala-ia": s.ai.textScale / 100, "--f-ia": s.ai.font === "inherit" ? "inherit" : pilhaFonte(s.ai.font), "--opac-datrics": s.ai.opacity + "%",
    "--cursor-cor": s.mouseColor, "--cursor-cor-2": s.mouseAccent, "--luz-cor": s.mouseEffectColor, "--luz-cor-2": s.mouseEffectAccent,
    "--cursor-tam": (s.mouseEnlarge ? s.mouseSize : 34) + "px", "--intensidade": s.backgroundIntensity / 100, "--velocidade": s.backgroundSpeed + "s"
  };
  for (const [k, v] of Object.entries(vars)) st.setProperty(k, String(v));
  if (s.transparentCards) st.setProperty("--folha", "color-mix(in oklab, " + modo.card + " " + s.cardOpacity + "%, transparent)");
  r.dataset.tema = S.tema;
  r.dataset.desenho = s.siteDesign;
  carregarFonte(s.font); carregarFonte(s.titleFont); if (s.ai.font !== "inherit") carregarFonte(s.ai.font);
  const nome = $("#marcaNome"); if (nome) nome.textContent = s.brand || AJUSTES_PADRAO.brand;
  const icone = $("#marcaIcone"); if (icone) icone.textContent = s.logo || "";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", modo.bg);
  efeitos.atualizar(s);
  App.ia?.aoMudarAjustes?.(s);
}
function salvarAjustes(msg) {
  S.ajustes = normalizarAjustes(S.ajustes);
  const ok = gravarJuntos([[K.ajustes, S.ajustes], [K.tema, S.tema === "escuro" ? "dark" : "light"]]);
  if (!ok) { aviso("Não foi possível salvar a personalização neste navegador.", true); return false; }
  aplicarAjustes();
  if (msg) aviso(msg);
  return true;
}

/* ---------- 7. Avisos e registro seguro ---------- */
function textoSeguro(msg) {
  return String(msg || "")
    .replace(/(sk|gsk|nvapi|pk|AIza)[-_A-Za-z0-9]{12,}/g, "[chave]")
    .replace(/Bearer\s+[-._A-Za-z0-9]+/gi, "Bearer [chave]")
    .replace(/((?:api[ _-]?key|token|secret|password|senha)\s*[:=]\s*)\S+/gi, "$1[oculto]")
    .replace(/https?:\/\/\S+/g, "[endereço externo]")
    .replace(/[A-Za-z0-9_-]{36,}/g, "[identificador]")
    .slice(0, 220);
}
function registrar(msg, erro) {
  const lista = armazem.ler(K.logs, []);
  const logs = Array.isArray(lista) ? lista : [];
  logs.unshift({ at: Date.now(), type: erro ? "Erro" : "Aviso", message: textoSeguro(msg) });
  armazem.gravar(K.logs, logs.slice(0, 50));
}
function aviso(msg, erro) {
  if (!msg) return false;
  registrar(msg, erro);
  const caixa = $("#avisos"); if (!caixa) return false;
  const el = Object.assign(document.createElement("div"), { className: "aviso" + (erro ? " err" : ""), textContent: msg });
  el.setAttribute("role", erro ? "alert" : "status");
  caixa.appendChild(el);
  while (caixa.children.length > 3) caixa.firstChild.remove();
  setTimeout(() => el.remove(), 3600);
  return false;
}
function abrirLogs() {
  const logs = armazem.ler(K.logs, []);
  const corpo = (Array.isArray(logs) && logs.length)
    ? '<ul class="logs-lista">' + logs.map((l) => '<li><time>' + esc(new Date(l.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })) + '</time><span class="' + (l.type === "Erro" ? "err" : "") + '">' + esc(l.message) + "</span></li>").join("") + "</ul>"
    : '<p class="discreto">Nenhum aviso registrado.</p>';
  dialogo({ titulo: "Registro do sistema", corpo: '<p class="mini discreto">Avisos recentes, sem chaves ou dados sensíveis. Guardamos os últimos 50.</p>' + corpo,
    botoes: [{ texto: "Limpar histórico", classe: "btn btn-perigo", acao: (d) => { armazem.apagar(K.logs); d.close(); aviso("Histórico de avisos apagado."); } }] });
}

/* Diálogo genérico baseado em <dialog>: foco preso, Esc fecha, devolve o foco. */
function dialogo({ titulo, corpo, botoes = [], largo = false, aoAbrir, aoFechar }) {
  const d = document.createElement("dialog");
  if (largo) d.classList.add("largo");
  d.innerHTML = '<div class="dlg-cab"><h2>' + esc(titulo) + '</h2><button type="button" class="icone-btn" data-fechar aria-label="Fechar">✕</button></div><div class="dlg-corpo">' + corpo + "</div>" +
    (botoes.length ? '<div class="dlg-pe">' + botoes.map((b, i) => '<button type="button" class="' + (b.classe || "btn") + '" data-b="' + i + '">' + esc(b.texto) + "</button>").join("") + "</div>" : "");
  document.body.appendChild(d);
  const origem = document.activeElement;
  d.addEventListener("click", (e) => {
    if (e.target === d || e.target.closest("[data-fechar]")) d.close();
    const b = e.target.closest("[data-b]"); if (b) botoes[+b.dataset.b].acao(d);
  });
  d.addEventListener("close", () => { aoFechar?.(d); d.remove(); origem?.focus?.(); });
  d.showModal();
  aoAbrir?.(d);
  return d;
}

/* ---------- 8. Efeitos: fundo animado e cursor ---------- */
const efeitos = (() => {
  let canvas, ctx, raf = 0, t0 = performance.now(), ajustes = null, pontos = [], w = 0, h = 0, dpr = 1;
  let cursor, luz, mx = -100, my = -100, cx = -100, cy = -100, cursorRaf = 0;
  const leve = () => document.documentElement.classList.contains("leve");
  const hexRgb = (hex, a) => { const n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; };

  function medir() {
    if (!canvas) return;
    dpr = Math.min(2, devicePixelRatio || 1); w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pontos = Array.from({ length: Math.round(Math.min(110, w * h / 14000)) }, () => ({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.6 + 0.4, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, f: Math.random() * 6.28 }));
  }
  function quadro(agora) {
    raf = 0;
    if (!ajustes || !ctx) return;
    const s = ajustes, c = s.colors, a = s.backgroundIntensity / 100;
    const ciclo = ((agora - t0) / 1000) / s.backgroundSpeed * Math.PI * 2;
    ctx.clearRect(0, 0, w, h);
    const p1 = c.primary, p2 = c.secondary, p3 = c.primaryLight;
    const mancha = (x, y, r, cor, al) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, hexRgb(cor, al)); g.addColorStop(1, hexRgb(cor, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); };
    switch (s.backgroundEffect) {
      case "aurora":
        mancha(w * (0.25 + 0.15 * Math.sin(ciclo)), h * 0.2, w * 0.55, p1, 0.32 * a);
        mancha(w * (0.75 + 0.12 * Math.cos(ciclo * 0.8)), h * 0.35, w * 0.5, p2, 0.28 * a);
        mancha(w * 0.5, h * (0.9 + 0.08 * Math.sin(ciclo * 1.3)), w * 0.45, p3, 0.2 * a); break;
      case "topography":
        ctx.lineWidth = 1;
        for (let i = 0; i < 14; i++) {
          ctx.strokeStyle = hexRgb(i % 3 ? p2 : p1, 0.22 * a); ctx.beginPath();
          for (let x = 0; x <= w; x += 16) { const y = h * (i / 13) + Math.sin(x / 160 + ciclo + i) * 26 + Math.cos(x / 90 - ciclo * 0.6 + i * 2) * 12; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
          ctx.stroke();
        } break;
      case "constellation":
        for (const p of pontos) { p.x = (p.x + p.vx + w) % w; p.y = (p.y + p.vy + h) % h; }
        ctx.lineWidth = 0.6;
        for (let i = 0; i < pontos.length; i++) for (let j = i + 1; j < pontos.length; j++) {
          const dx = pontos[i].x - pontos[j].x, dy = pontos[i].y - pontos[j].y, d2 = dx * dx + dy * dy;
          if (d2 < 14000) { ctx.strokeStyle = hexRgb(p2, (1 - d2 / 14000) * 0.4 * a); ctx.beginPath(); ctx.moveTo(pontos[i].x, pontos[i].y); ctx.lineTo(pontos[j].x, pontos[j].y); ctx.stroke(); }
        }
        ctx.fillStyle = hexRgb(p3, 0.7 * a); for (const p of pontos) { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); } break;
      case "waves":
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = hexRgb(i % 2 ? p2 : p1, 0.08 * a); ctx.beginPath(); ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h * (0.55 + i * 0.08) + Math.sin(x / (180 + i * 40) + ciclo * (1 + i * 0.2)) * (24 + i * 6));
          ctx.lineTo(w, h); ctx.fill();
        } break;
      case "prism": {
        const g = ctx.createLinearGradient(0, 0, w, h);
        const k = (Math.sin(ciclo) + 1) / 2;
        g.addColorStop(0, hexRgb(p1, 0.18 * a)); g.addColorStop(0.3 + k * 0.4, hexRgb(p2, 0.16 * a)); g.addColorStop(1, hexRgb(p3, 0.18 * a));
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); break;
      }
      case "mesh":
        for (let i = 0; i < 5; i++) mancha(w * (0.5 + 0.4 * Math.sin(ciclo * (0.5 + i * 0.15) + i * 1.7)), h * (0.5 + 0.4 * Math.cos(ciclo * (0.4 + i * 0.1) + i)), w * 0.35, [p1, p2, p3][i % 3], 0.16 * a); break;
      case "galaxy":
        mancha(w * 0.5, h * 0.45, Math.max(w, h) * 0.5, p2, 0.22 * a);
        ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(ciclo * 0.15);
        pontos.forEach((p, i) => { const ang = i * 0.5, rad = (i / pontos.length) * Math.max(w, h) * 0.55; ctx.fillStyle = hexRgb(i % 4 ? p3 : p1, (0.25 + 0.5 * Math.abs(Math.sin(ciclo * 2 + p.f))) * a); ctx.beginPath(); ctx.arc(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.6, p.r, 0, 6.28); ctx.fill(); });
        ctx.restore(); break;
    }
    const e = s.effects;
    const ae = Math.max(a, 0.35);
    if (e.aurora) { mancha(w * (0.2 + 0.1 * Math.sin(ciclo * 0.7)), 0, w * 0.6, p1, 0.18 * ae); mancha(w * 0.85, h * 0.1, w * 0.4, p2, 0.15 * ae); }
    if (e.orbs) for (let i = 0; i < 3; i++) mancha(w * (0.2 + i * 0.3) + Math.sin(ciclo + i * 2) * 60, h * (0.3 + (i % 2) * 0.4) + Math.cos(ciclo * 0.8 + i) * 50, 160, [p1, p2, p3][i], 0.25 * ae);
    if (e.lines) { ctx.strokeStyle = hexRgb(p2, 0.08 * ae); ctx.lineWidth = 1; const off = (ciclo * 40) % 60; for (let x = -h; x < w; x += 60) { ctx.beginPath(); ctx.moveTo(x + off, 0); ctx.lineTo(x + off + h, h); ctx.stroke(); } }
    if (e.particles) { ctx.fillStyle = hexRgb(p3, 0.45 * ae); pontos.slice(0, 50).forEach((p) => { p.y -= 0.25; if (p.y < 0) p.y = h; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); }); }
    if (e.stars) pontos.forEach((p) => { ctx.fillStyle = hexRgb("#ffffff", (0.15 + 0.35 * Math.abs(Math.sin(ciclo * 3 + p.f))) * ae); ctx.fillRect(p.x, (p.y * 1.7) % h, 1.2, 1.2); });
    const anima = !leve() && !reduzMovimento() && !document.hidden;
    if (anima && precisaCanvas(s)) raf = requestAnimationFrame(quadro);
  }
  const precisaCanvas = (s) => s.backgroundEffect !== "off" || ["particles", "orbs", "aurora", "lines", "stars"].some((k) => s.effects[k]);

  function moverCursor() {
    cursorRaf = 0;
    const seguir = ajustes && ajustes.animateCursor && !reduzMovimento() ? 0.22 : 1;
    cx += (mx - cx) * seguir; cy += (my - cy) * seguir;
    if (cursor) cursor.style.transform = "translate(" + cx + "px," + cy + "px)";
    if (luz) luz.style.transform = "translate(" + mx + "px," + my + "px)";
    if (Math.abs(mx - cx) > 0.3 || Math.abs(my - cy) > 0.3) cursorRaf = requestAnimationFrame(moverCursor);
  }
  function aoMover(e) { mx = e.clientX; my = e.clientY; if (!cursorRaf) cursorRaf = requestAnimationFrame(moverCursor); }
  function aoSobre(e) { if (cursor) cursor.classList.toggle("sobre", !!e.target.closest?.("a,button,input,select,textarea,[role=button],label")); }

  return {
    iniciar() {
      canvas = $("#fundoCanvas"); ctx = canvas.getContext("2d"); cursor = $("#cursorFx"); luz = $("#luzFx");
      addEventListener("resize", () => { medir(); this.redesenhar(); });
      document.addEventListener("visibilitychange", () => this.redesenhar());
      addEventListener("pointermove", aoMover, { passive: true });
      document.addEventListener("pointerover", aoSobre, { passive: true });
      medir();
    },
    redesenhar() { if (raf) cancelAnimationFrame(raf); raf = 0; if (ajustes && ctx) quadro(performance.now()); },
    atualizar(s) {
      ajustes = s;
      const fundo = $("#fundo"); if (!fundo) return;
      fundo.dataset.efeito = s.effects.grid ? "grade" : "";
      this.redesenhar();
      const temCursor = s.effects.mouse && matchMedia("(pointer: fine)").matches;
      cursor.hidden = !temCursor; cursor.dataset.estilo = s.mouseStyle; cursor.dataset.anima = s.animateCursor ? "sim" : "nao";
      luz.hidden = !temCursor || s.mouseEffect === "off"; luz.dataset.luz = s.mouseEffect;
      document.documentElement.classList.toggle("sem-cursor", temCursor && s.hideNativeCursor);
    }
  };
})();

/* Modo leve automático: aparelhos modestos, economia de dados ou movimento reduzido. */
(function detectarLeve() {
  let leve = false;
  try {
    const f = localStorage.getItem(K.leve);
    if (f === "1") leve = true;
    else if (f !== "0") leve = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4) || !!(navigator.connection && navigator.connection.saveData) || reduzMovimento();
  } catch (e) { /* modo completo */ }
  document.documentElement.classList.toggle("leve", !!leve);
})();

/* ---------- 9. Nível das explicações, marcações e perfil ---------- */
const NIVEIS = {
  eli5: ["ELI5", "Nível ELI5: explique como para quem está começando, com analogias do dia a dia, sem jargão; defina qualquer termo técnico em uma frase."],
  pleno: ["Pleno", "Nível Pleno: explique para um profissional de nível intermediário, com termos técnicos corretos e um exemplo prático curto."],
  arquiteto: ["Arquiteto", "Nível Arquiteto: aprofunde em trade-offs, desempenho, custo, governança, riscos e alternativas de arquitetura."]
};
const nivelAtual = () => NIVEIS[S.nivel] ? S.nivel : "pleno";
const instrucaoNivel = () => NIVEIS[nivelAtual()][1] + " ";
function definirNivel(n) {
  if (!NIVEIS[n]) return;
  S.nivel = n;
  if (!armazem.gravar(K.nivel, n)) aviso("Não foi possível salvar o nível neste navegador.", true);
  $$("#nivel button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.nivel === n)));
  aviso("Nível das explicações: " + NIVEIS[n][0] + ".");
}

function carregarMarcas() {
  const m = armazem.ler(K.marcas, null);
  S.marcas = isObj(m) && isObj(m.questions) && isObj(m.lines) ? m : { questions: {}, lines: {} };
}
const salvarMarcas = () => armazem.gravar(K.marcas, S.marcas) || aviso("Não foi possível salvar marcações: armazenamento cheio.", true);
function alternarTrecho(id, texto) {
  if (S.marcas.lines[id]) delete S.marcas.lines[id];
  else S.marcas.lines[id] = { text: String(texto || "").trim().slice(0, 180), at: Date.now() };
  salvarMarcas();
  return !!S.marcas.lines[id];
}
function alternarFavorito(aulaId, qi, cartao) {
  const id = aulaId + ":q:" + qi;
  if (S.marcas.questions[id]) delete S.marcas.questions[id];
  else S.marcas.questions[id] = { at: Date.now(), selected: cartao?.dataset.escolha != null && cartao.dataset.conferida ? Number(cartao.dataset.escolha) : null, correct: cartao?.dataset.conferida ? cartao.dataset.conferida === "certa" : null };
  salvarMarcas();
  return !!S.marcas.questions[id];
}

function carregarPerfil() {
  const p = armazem.ler(K.perfil, null);
  S.perfil = { name: isObj(p) && typeof p.name === "string" ? p.name.slice(0, 40) : "", photo: isObj(p) && typeof p.photo === "string" && p.photo.startsWith("data:image/") ? p.photo : "" };
}
function desenharPerfil() {
  const b = $("#perfilBtn"); if (!b) return;
  const nome = S.perfil.name.trim();
  b.innerHTML = '<span class="avatar">' + (S.perfil.photo ? '<img src="' + esc(S.perfil.photo) + '" alt="">' : esc(nome ? nome[0].toUpperCase() : "·")) + '</span><span class="perfil-nome">' + esc(nome || "Meu perfil") + "</span>";
  b.setAttribute("aria-label", "Perfil: " + (nome || "sem nome") + ". Abrir configurações do perfil");
}
function abrirPerfil() {
  let foto = S.perfil.photo;
  dialogo({
    titulo: "Seu perfil",
    corpo: '<label class="campo"><span>Como devemos chamar você?</span><input type="text" id="pfNome" maxlength="40" placeholder="Seu nome" value="' + esc(S.perfil.name) + '"></label>' +
      '<div class="campo"><span>Foto de perfil</span><div class="linha-btns"><span class="avatar" id="pfPrevia" style="width:56px;height:56px">' + (foto ? '<img src="' + esc(foto) + '" alt="">' : "·") + '</span><input type="file" id="pfFoto" accept="image/*"><button type="button" class="btn btn-texto btn-mini" id="pfSemFoto">Remover foto</button></div><small>Até 2 MB. Salvo somente neste navegador.</small></div>',
    botoes: [{ texto: "Salvar perfil", classe: "btn btn-tinta", acao: (d) => {
      const antes = S.perfil;
      S.perfil = { name: $("#pfNome", d).value.trim().slice(0, 40), photo: foto };
      if (!armazem.gravar(K.perfil, S.perfil)) { S.perfil = antes; return aviso("Não foi possível salvar a foto. Use uma imagem menor.", true); }
      desenharPerfil(); d.close();
      aviso(S.perfil.name ? "Perfil salvo. O Datrics vai chamar você de " + S.perfil.name + "." : "Perfil salvo.");
    } }],
    aoAbrir: (d) => {
      $("#pfNome", d).focus();
      $("#pfSemFoto", d).onclick = () => { foto = ""; $("#pfPrevia", d).textContent = "·"; };
      $("#pfFoto", d).onchange = (e) => {
        const f = e.target.files[0];
        if (!f || !f.type.startsWith("image/") || f.size > 2 * 1024 * 1024) { e.target.value = ""; return aviso("Escolha uma imagem de até 2 MB.", true); }
        const r = new FileReader();
        r.onload = () => { foto = String(r.result); $("#pfPrevia", d).innerHTML = '<img src="' + esc(foto) + '" alt="">'; };
        r.readAsDataURL(f);
      };
    }
  });
}

/* ---------- 10. Casca: topo, índice lateral, navegação móvel ---------- */
const ROTAS_FIXAS = { home: "Início", admin: "Editor", mindmap: "Mapa mental", skills: "Skills", bookmarks: "Marcados", "data-lab": "Dados", "ia-study": "Guia da IA" };
const COM_INDICE = new Set(["home", "ia-study", "aula"]);
const dois = (n) => String(n).padStart(2, "0");

function desenharIndice() {
  const ind = $("#indice"); if (!ind) return;
  const atual = S.rota;
  ind.innerHTML = '<h2>Sumário</h2><ol>' + S.mods.map((m, mi) => '<li><div class="mod-titulo"><span class="num">' + dois(mi + 1) + "</span>" + esc(m.t) + "</div><ol>" +
    m.l.map((l) => {
      const feitas = (S.progresso[l.id] || []).length;
      const estado = aulaConcluida(l) ? "feita" : feitas ? "parcial" : "";
      return '<li><a href="#' + encodeURIComponent(l.id) + '" data-estado="' + estado + '"' + (atual === l.id ? ' aria-current="page"' : "") + ">" + esc(l.t) + "</a></li>";
    }).join("") + "</ol></li>").join("") + '</ol><p class="mini"><a href="#ia-study">Como funciona e como configurar a IA</a></p>';
}
function abrirGavetaAulas() {
  const d = dialogo({ titulo: "Módulos e aulas", corpo: '<nav class="indice na-gaveta" aria-label="Aulas">' + $("#indice").innerHTML + "</nav>" });
  d.addEventListener("click", (e) => { if (e.target.closest("a")) d.close(); });
}
function marcarNavAtual() {
  const chave = ROTAS_FIXAS[S.rota] ? S.rota : "aula";
  $$("[data-rota]").forEach((a) => a.dataset.rota === chave ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
}
function desenharTema() {
  const b = $("#temaBtn"); if (!b) return;
  const escuro = S.tema === "escuro";
  b.innerHTML = escuro ? ICONE.lua : ICONE.sol;
  b.title = escuro ? "Tema escuro" : "Tema claro";
  b.setAttribute("aria-label", (escuro ? "Tema escuro" : "Tema claro") + " ativado. Alternar tema");
}
function alternarTema() {
  S.tema = S.tema === "escuro" ? "claro" : "escuro";
  aplicarAjustes(); desenharTema();
  if (!armazem.gravar(K.tema, S.tema === "escuro" ? "dark" : "light")) aviso("Não foi possível salvar a preferência de tema.", true);
}
function desenharAlternarModo() {
  const b = $("#alternarModo"); if (!b) return;
  const continuo = S.ajustes.navigationMode === "scroll";
  b.hidden = false;
  b.setAttribute("aria-pressed", String(continuo));
  b.setAttribute("aria-label", continuo ? "Mudar para páginas separadas" : "Mudar para página única");
  b.textContent = continuo ? "▤  Várias páginas" : "▣  Página única";
}
function alternarModo() {
  S.ajustes.navigationMode = S.ajustes.navigationMode === "scroll" ? "pages" : "scroll";
  salvarAjustes(S.ajustes.navigationMode === "scroll" ? "Rolagem contínua: a apostila inteira em uma página." : "Navegação por páginas separadas.");
  render();
}

/* ---------- 11. Roteador ---------- */
function rotaDoHash() {
  let h = ""; try { h = decodeURIComponent(location.hash.slice(1)); } catch (e) { h = ""; }
  return h || "home";
}
function render() {
  const pedida = rotaDoHash();
  const main = $("#principal");
  const continuo = S.ajustes.navigationMode === "scroll";
  if (pedida === "admin" && continuo) { S.ajustes.navigationMode = "pages"; salvarAjustes(); }
  const ehAula = !!acharAula(pedida);
  if (!ROTAS_FIXAS[pedida] && !ehAula) { history.replaceState(null, "", "#home"); return render(); }
  if (S.rota === "admin" && pedida !== "admin") editor.aoSair();
  S.rotaAnterior = S.rota; S.rota = pedida;
  const tipo = ehAula ? "aula" : pedida;

  /* No modo contínuo, home, aulas e guia moram num só documento: só rolamos até a seção. */
  if (S.ajustes.navigationMode === "scroll" && COM_INDICE.has(tipo)) {
    if (!main.dataset.continuo) { main.innerHTML = '<div class="rota">' + telaInicio() + aulas().map((l) => '<section id="sec-' + esc(l.id) + '" class="secao-continua">' + telaAula(l) + "</section>").join("") + '<section id="sec-ia-study">' + (App.ia?.telaGuia?.() || "") + "</section></div>"; main.dataset.continuo = "1"; ligarTela(main); }
    const alvo = pedida === "home" ? main : document.getElementById("sec-" + pedida);
    alvo?.scrollIntoView({ behavior: reduzMovimento() || !S.rotaAnterior ? "auto" : "smooth", block: "start" });
  } else {
    delete main.dataset.continuo;
    let html = "";
    if (ehAula) html = telaAula(acharAula(pedida));
    else if (tipo === "home") html = telaInicio();
    else if (tipo === "admin") html = editor.tela();
    else if (tipo === "mindmap") html = telaMapa();
    else if (tipo === "skills") html = telaSkills();
    else if (tipo === "bookmarks") html = telaMarcados();
    else if (tipo === "data-lab") html = laboratorio.tela();
    else if (tipo === "ia-study") html = App.ia?.telaGuia?.() || '<p>A camada de IA não carregou. Verifique se o arquivo ia.js está junto deste.</p>';
    main.innerHTML = '<div class="rota rota-entrando">' + html + "</div>";
    ligarTela(main);
    const rotaNova = main.querySelector(".rota");
    rotaNova?.addEventListener("animationend", () => rotaNova.classList.remove("rota-entrando"), { once: true });
    if (S.rotaAnterior && S.rotaAnterior !== S.rota) scrollTo({ top: 0, behavior: "auto" });
  }
  $("#estrutura").classList.toggle("sem-indice", !COM_INDICE.has(tipo));
  desenharIndice(); marcarNavAtual(); desenharAlternarModo(); observarSecoesContinuas();
  const aula = ehAula ? acharAula(pedida) : null;
  document.title = (aula ? aula.t + " · " : tipo === "admin" ? "Editor · " : ROTAS_FIXAS[tipo] && tipo !== "home" ? ROTAS_FIXAS[tipo] + " · " : "") + (S.ajustes.brand || AJUSTES_PADRAO.brand);
  App.ia?.aoMudarRota?.(aula);
}
/* Liga os comportamentos da tela recém-desenhada. */
function ligarTela(raiz) {
  $$(".questao", raiz).forEach(ligarQuestao);
  if ($("#mapaForm", raiz)) ligarMapa(raiz);
  if ($("#labTabela", raiz)) laboratorio.ligar(raiz);
  if ($("#editorRaiz", raiz)) editor.ligar(raiz);
  App.ia?.ligarGuia?.(raiz);
  prepararAnimacoes(raiz);
}

/* Animações leves e reversíveis durante a rolagem.
   O observador permanece único para evitar callbacks duplicados ao navegar. */
function prepararAnimacoes(raiz) {
  if (!raiz) return;
  if (reduzMovimento() || !("IntersectionObserver" in window)) {
    $$("[data-reveal]", raiz).forEach((el) => el.classList.add("revelado"));
    return;
  }
  const seletores = [
    ".rota h1", ".rota h2", ".rota .lead", ".rota .olho",
    ".rota .cartao", ".rota .card", ".rota .painel",
    ".rota .modulo-card", ".rota .questao", ".rota .stat",
    ".rota .callout", ".rota .secao-cab"
  ].join(",");
  const vistos = new Set();
  $$(seletores, raiz).forEach((el, i) => {
    if (el.closest(".menu-pop-portal, dialog") || el.hasAttribute("data-sem-animacao") || vistos.has(el)) return;
    vistos.add(el);
    el.dataset.reveal = "true";
    el.dataset.revealTipo = (i % 3 === 0) ? "subir" : (i % 3 === 1 ? "suave" : "zoom");
    el.style.setProperty("--reveal-delay", Math.min((i % 4) * 45, 135) + "ms");
    observerRevelacao?.observe(el);
  });
}

let observerRevelacao = null;
let sentidoRolagem = "descendo";
let ultimaPosicaoRolagem = window.scrollY || 0;
let quadroDirecao = false;
addEventListener("scroll", () => {
  if (quadroDirecao) return;
  quadroDirecao = true;
  requestAnimationFrame(() => {
    const y = window.scrollY || 0;
    if (Math.abs(y - ultimaPosicaoRolagem) > 2) sentidoRolagem = y < ultimaPosicaoRolagem ? "subindo" : "descendo";
    ultimaPosicaoRolagem = y;
    quadroDirecao = false;
  });
}, { passive: true });

if ("IntersectionObserver" in window) {
  observerRevelacao = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => {
      const el = entrada.target;
      el.dataset.revealSentido = sentidoRolagem;
      el.classList.toggle("revelado", entrada.isIntersecting);
    });
  }, { threshold: 0.04, rootMargin: "-2% 0px -2% 0px" });
}

/* No modo de página única, o sumário acompanha a seção realmente visível,
   mesmo quando o usuário rola manualmente em vez de clicar no índice. */
let observadorSecoes = null;
function observarSecoesContinuas() {
  if (observadorSecoes) observadorSecoes.disconnect();
  if (S.ajustes.navigationMode !== "scroll" || !("IntersectionObserver" in window)) return;
  const secoes = $$(".secao-continua, #sec-ia-study, #principal > .rota > .coluna-larga");
  if (!secoes.length) return;
  observadorSecoes = new IntersectionObserver((entradas) => {
    const candidatas = entradas.filter((e) => e.isIntersecting).sort((a,b) => b.intersectionRatio - a.intersectionRatio);
    if (!candidatas.length) return;
    const id = candidatas[0].target.id;
    const rota = id === "sec-ia-study" ? "ia-study" : id.startsWith("sec-") ? id.slice(4) : "home";
    S.rota = rota;
    const indice = $("#indice");
    if (!indice) return;
    $$("a[href]", indice).forEach((link) => {
      let destino = "";
      try { destino = decodeURIComponent(new URL(link.href, location.href).hash.slice(1)); } catch {}
      const ativo = destino === rota;
      if (ativo) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }, { threshold: [0.12, 0.28, 0.5], rootMargin: "-18% 0px -58% 0px" });
  secoes.forEach((secao) => observadorSecoes.observe(secao));
}

/* ---------- 12. Início ---------- */
function telaInicio() {
  const st = estatisticas(); const s = S.ajustes;
  const primeira = aulas()[0];
  const tudo = st.total > 0 && st.feitas === st.total;
  const nome = S.perfil.name.trim();
  return '<div class="coluna-larga">' +
    '<header class="abertura"><div><p class="olho">' + esc(nome ? "Bom estudo, " + nome : "Apostila interativa") + '</p><h1>' + esc(s.homeTitle) + '</h1><p class="lead">' + esc(s.homeIntro) + '</p>' +
    '<div class="linha-btns">' + (primeira ? '<a class="btn btn-tinta" href="#' + encodeURIComponent(primeira.id) + '">' + esc(s.startLabel) + "</a>" : "") + '<a class="btn btn-texto" href="#admin">' + ICONE.lapis + ' Editar conteúdo</a></div></div>' +
    '<aside class="placar" aria-label="Seu progresso"><dl>' +
      '<div><dt>Conclusão</dt><dd>' + st.conclusao + '%<small>' + st.feitas + " de " + st.total + '</small></dd><div class="barra"><i style="width:' + st.conclusao + '%"></i></div></div>' +
      '<div><dt>Acerto</dt><dd>' + st.acerto + "%<small>" + st.tentativas + " tentativa" + (st.tentativas === 1 ? "" : "s") + "</small></dd></div>" +
      '<div><dt>Acervo</dt><dd>' + st.total + "<small>questões · " + S.mods.length + " módulos · " + aulas().length + " aulas</small></dd></div>" +
    "</dl></aside></header>" +
    '<div data-progress-live>' +
    (tudo ? '<section class="secao nota-lateral"><p><strong>Você resolveu todas as questões da apostila.</strong> Dá para continuar treinando com questões novas ou tirar dúvidas pontuais.</p><div class="linha-btns"><button class="btn btn-brasa" data-ia-acao="gerador">Criar questões com IA</button><button class="btn" data-ia-acao="chat">Perguntar ao Datrics</button></div></section>' : "") +
    '<section class="secao"><div class="secao-cab"><h2>Trilha</h2><span class="mini mono discreto">' + st.certas + " acertos · " + st.erradas + " erros</span></div>" +
    '<ol class="sumario">' + S.mods.map((m, mi) => {
      const pm = st.porModulo[mi];
      const pct = pm.total ? Math.round(pm.feitas * 100 / pm.total) : 0;
      return '<li><span class="mod-num">' + dois(mi + 1) + '</span><div><h3>' + esc(m.t) + '</h3><p class="mod-meta">' + pm.aulasFeitas + "/" + pm.aulas + " aulas · " + pct + "% das questões · " + pm.erradas + " erro" + (pm.erradas === 1 ? "" : "s") + "</p><ol>" +
        m.l.map((l) => {
          const f = (S.progresso[l.id] || []).length;
          const estado = aulaConcluida(l) ? '<span class="estado feita">concluída</span>' : l.q.length ? '<span class="estado">' + f + "/" + l.q.length + "</span>" : '<span class="estado">' + esc(l.d) + "</span>";
          return '<li><a href="#' + encodeURIComponent(l.id) + '"><span class="aula-t">' + esc(l.t) + '</span><span class="pontilhado" aria-hidden="true"></span>' + estado + "</a></li>";
        }).join("") + (m.l.length ? "" : '<li class="mini discreto">Módulo sem aulas ainda.</li>') + "</ol></div></li>";
    }).join("") + "</ol></section>" +
    '<section class="secao"><div class="secao-cab"><h2>Onde você mais erra</h2></div>' +
    (st.dificeis.length ? '<ul class="dificuldades">' + st.dificeis.map((d) => {
      const tent = d.certas + d.erradas; const ac = tent ? Math.round(d.certas * 100 / tent) : 0;
      return '<li><div><strong>' + esc(d.titulo) + '</strong><div class="mini discreto">' + ac + "% de acerto · " + d.feitas + "/" + d.total + ' questões resolvidas</div><div class="barra"><i style="width:' + ac + '%"></i></div></div><span class="num">' + d.erradas + " erro" + (d.erradas === 1 ? "" : "s") + "</span></li>";
    }).join("") + "</ul>" : '<p class="discreto">Ainda não há erros registrados. Conforme você responder, os módulos que pedem revisão aparecem aqui.</p>') + "</section></div>" +
    '<section class="secao nota-lateral"><p class="olho">Estudo com IA</p><p>O Datrics responde dúvidas sobre a aula aberta, cria questões novas e explica por que uma alternativa está errada. Ele usa a chave de API da sua própria conta — e pode errar, então confira o que for importante.</p><div class="linha-btns"><a class="btn" href="#ia-study">Ler o guia de configuração</a><button class="btn btn-texto" data-ia-acao="chat">Abrir o Datrics</button></div></section>' +
    "</div>";
}

/* ---------- 13. Aula ---------- */
function paragrafos(texto) { return String(texto || "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean); }
function botaoMarcar(id, rotulo) {
  const on = !!S.marcas.lines[id];
  return '<button type="button" class="marcar-btn" data-marcar="' + esc(id) + '" aria-pressed="' + on + '" aria-label="' + (on ? "Desmarcar" : "Marcar") + " " + rotulo + '" title="Marcar para revisar depois">' + ICONE.marca + "</button>";
}
function telaAula(l) {
  const todas = aulas(); const i = todas.indexOf(l); const mi = indiceModulo(l);
  const ant = todas[i - 1], prox = todas[i + 1];
  const feitas = (S.progresso[l.id] || []).length;
  const corpo = paragrafos(l.h).map((p, pi) => {
    const id = l.id + ":line:" + pi;
    return '<p class="marcavel" data-marca-id="' + esc(id) + '" data-marcado="' + !!S.marcas.lines[id] + '">' + botaoMarcar(id, "este parágrafo") + esc(p).replace(/\n/g, "<br>") + "</p>";
  }).join("");
  const cards = Array.isArray(l.studyCards) && l.studyCards.length ? '<section aria-label="Estude antes de praticar"><p class="olho">Estude antes de praticar</p>' + l.studyCards.map((c, ci) => {
    const id = l.id + ":card:" + ci;
    return '<div class="cartao marcavel" data-marca-id="' + esc(id) + '" data-marcado="' + !!S.marcas.lines[id] + '">' + botaoMarcar(id, "este card") +
      '<p class="mini mono discreto">Card ' + (ci + 1) + '</p><h3>' + esc(c.title || "Conceito importante") + "</h3>" +
      (c.concept ? "<p><strong>" + esc(c.concept) + "</strong></p>" : "") + (c.explanation ? "<p>" + esc(c.explanation).replace(/\\n|\n/g, "<br>") + "</p>" : "") +
      (c.example ? '<p class="mini mono discreto">Exemplo</p><pre><code>' + esc(c.example) + "</code></pre>" : "") + "</div>";
  }).join("") + "</section>" : "";
  const tudoFeito = aulas().some((a) => a.q.length) && aulas().every((a) => !a.q.length || aulaConcluida(a));
  return '<article class="coluna" aria-labelledby="t-' + esc(l.id) + '">' +
    '<header class="aula-cab"><p class="olho">Módulo ' + dois(mi + 1) + " · " + esc(S.mods[mi].t) + '</p><h1 id="t-' + esc(l.id) + '">' + esc(l.t) + '</h1><div class="aula-meta"><span>' + esc(l.d) + "</span><span>" + l.q.length + " quest" + (l.q.length === 1 ? "ão" : "ões") + "</span>" + (l.q.length ? "<span>" + feitas + " resolvida" + (feitas === 1 ? "" : "s") + "</span>" : "") + "</div></header>" +
    '<div class="aula-corpo">' + (corpo || '<p class="discreto">Esta aula ainda não tem texto.</p>') + "</div>" + cards +
    '<div class="questoes-cab"><h2>' + esc(S.ajustes.practiceTitle || "Pratique") + '</h2><span class="mini mono discreto">' + feitas + "/" + l.q.length + "</span></div>" +
    (l.q.length ? l.q.map((q, qi) => ehCodigo(q) ? questaoCodigo(l, q, qi) : questaoMultipla(l, q, qi)).join("") : '<p class="discreto">Esta aula ainda não tem exercícios.</p>') +
    (tudoFeito ? '<p class="nota-lateral">Todas as questões da apostila estão resolvidas. Para seguir treinando, peça questões novas ao Datrics.</p>' : "") +
    '<p class="mini discreto"><a href="#ia-study">Como usar a IA com segurança</a></p>' +
    '<nav class="aula-rodape" aria-label="Navegação entre aulas">' + (ant ? '<a href="#' + encodeURIComponent(ant.id) + '"><small>Anterior</small><span>' + esc(ant.t) + "</span></a>" : "<span></span>") +
    (prox ? '<a href="#' + encodeURIComponent(prox.id) + '"><small>Próxima</small><span>' + esc(prox.t) + "</span></a>" : '<a href="#home"><small>Fim da trilha</small><span>Voltar ao início</span></a>') + "</nav></article>";
}
function topoQuestao(l, q, qi, rotulo) {
  const fav = !!S.marcas.questions[l.id + ":q:" + qi];
  const resolvida = (S.progresso[l.id] || []).includes(qi);
  return '<div class="q-topo"><span class="num">Q' + (qi + 1) + "</span>" + '<span class="etq">' + esc(q.lv || rotulo) + "</span>" + (resolvida ? '<span class="etq feita">resolvida</span>' : "") +
    '<button type="button" class="btn btn-texto btn-mini fav" data-fav aria-pressed="' + fav + '">' + (fav ? "★ Favoritada" : "☆ Favoritar") + "</button></div>";
}
const ferramentasIA = () => '<div class="q-ferr" role="group" aria-label="Ajuda da IA"><button type="button" class="btn btn-texto btn-mini" data-apoio="Ajuda">Ajuda</button><button type="button" class="btn btn-texto btn-mini" data-apoio="Dica">Dica</button><button type="button" class="btn btn-texto btn-mini" data-apoio="Explicação">Explicação</button></div><div data-ia-saida aria-live="polite"></div><div data-diag></div>';
function questaoMultipla(l, q, qi) {
  return '<section class="questao" data-aula="' + esc(l.id) + '" data-q="' + qi + '">' + topoQuestao(l, q, qi, "Teste prático") +
    '<div class="q-enunciado">' + htmlSeguro(q.p) + "</div>" +
    '<ol class="opcoes">' + q.o.map((o, oi) => '<li><button type="button" class="opcao" data-i="' + oi + '" aria-pressed="false"><span class="letra">' + LETRAS[oi] + '</span><span>' + esc(o) + "</span></button></li>").join("") + "</ol>" +
    '<div class="linha-btns q-acoes"><button type="button" class="btn btn-tinta" data-conferir>Conferir resposta</button><span class="mini discreto" data-dica-uso>Escolha uma alternativa e confira.</span></div>' +
    '<div data-retorno aria-live="polite"></div>' + ferramentasIA() + "</section>";
}
function questaoCodigo(l, q, qi) {
  const chave = l.id + ":" + qi;
  const codigo = (S.rascunhos[chave] || "").trim() ? S.rascunhos[chave] : q.starter || "";
  return '<section class="questao" data-aula="' + esc(l.id) + '" data-q="' + qi + '" data-codigo>' + topoQuestao(l, q, qi, "Prática de código · " + q.language) +
    '<div class="q-enunciado">' + htmlSeguro(q.p) + "</div>" + (q.task ? '<div class="nota-lateral pre">' + esc(q.task) + "</div>" : "") +
    '<div class="ide"><div class="ide-barra"><span>' + esc(q.language) + '</span><button type="button" class="btn btn-texto btn-mini" data-restaurar>Restaurar código inicial</button></div>' +
    '<textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Editor de código ' + esc(q.language) + '" data-editor>' + esc(codigo) + "</textarea>" +
    '<pre class="ide-saida" data-saida hidden></pre></div>' +
    '<div class="linha-btns q-acoes">' + (q.language === "Python" ? '<button type="button" class="btn" data-executar>▶ Executar Python</button>' : "") + '<button type="button" class="btn btn-tinta" data-avaliar>Avaliar meu código</button></div>' +
    '<p class="mini discreto">A IA revisa o código sem executá-lo. Não inclua dados pessoais nem segredos.' + (q.language === "Python" ? " O botão Executar roda Python isolado no seu navegador." : "") + "</p>" +
    '<div data-retorno aria-live="polite"></div>' + ferramentasIA() + "</section>";
}

/* ---------- 14. Comportamento das questões ---------- */
const ESPERA_IA = 12000;
const ultimaChamada = new Map();
function esperaRestante(chave) { const t = ultimaChamada.get(chave) || 0; return Math.max(0, ESPERA_IA - (Date.now() - t)); }

function ligarQuestao(card) {
  const aula = acharAula(card.dataset.aula); const qi = Number(card.dataset.q);
  const q = aula?.q[qi]; if (!q) return;
  const retorno = $("[data-retorno]", card);

  $("[data-fav]", card).onclick = (e) => {
    const on = alternarFavorito(aula.id, qi, card);
    e.currentTarget.setAttribute("aria-pressed", String(on));
    e.currentTarget.textContent = on ? "★ Favoritada" : "☆ Favoritar";
  };
  $$("[data-apoio]", card).forEach((b) => b.onclick = () => pedirApoio(card, aula, qi, b.dataset.apoio));

  if (!ehCodigo(q)) {
    const opcoes = $$(".opcao", card);
    const conferir = $("[data-conferir]", card);
    opcoes.forEach((b) => b.onclick = () => {
      card.dataset.escolha = b.dataset.i;
      opcoes.forEach((o) => { o.setAttribute("aria-pressed", String(o === b)); o.dataset.estado = o === b ? "escolhida" : ""; });
    });
    conferir.onclick = () => {
      if (card.dataset.escolha == null) { retorno.innerHTML = '<div class="q-retorno errado">Selecione uma alternativa antes de conferir.</div>'; return; }
      const escolha = Number(card.dataset.escolha); const certo = escolha === q.a;
      card.dataset.conferida = certo ? "certa" : "errada";
      const r = registrarResposta(aula.id, qi, certo);
      const fav = S.marcas.questions[aula.id + ":q:" + qi];
      if (fav) { fav.selected = escolha; fav.correct = certo; salvarMarcas(); }
      if (certo) {
        opcoes.forEach((o, oi) => { o.dataset.estado = oi === q.a ? "certa" : "apagada"; o.disabled = true; });
        retorno.innerHTML = '<div class="q-retorno certo"><strong>Correto.</strong>' + esc(q.e || "Você identificou o conceito corretamente.") + "</div>";
        conferir.disabled = true; $("[data-dica-uso]", card).textContent = "";
        concluirQuestao(aula.id, qi); $("[data-diag] .reforco", card)?.remove();
        desenharIndice();
      } else {
        /* O erro fica visível, mas o gabarito não: o aluno tenta de novo. */
        opcoes[escolha].dataset.estado = "errada";
        retorno.innerHTML = '<div class="q-retorno errado"><strong>Ainda não.</strong>' + esc((q.e || "Revise o conceito principal e observe qual condição resolve a questão.").slice(0, 220)) + " Escolha outra alternativa e confira de novo.</div>";
        delete card.dataset.escolha;
        opcoes.forEach((o) => o.setAttribute("aria-pressed", "false"));
        oferecerDiagnostico(card, aula, qi, escolha, r.wrong);
      }
    };
  } else {
    const ed = $("[data-editor]", card); const saida = $("[data-saida]", card); const chave = aula.id + ":" + qi;
    ed.addEventListener("keydown", (e) => {
      if (e.key !== "Tab" || e.shiftKey) return;
      e.preventDefault(); ed.setRangeText("    ", ed.selectionStart, ed.selectionEnd, "end"); ed.dispatchEvent(new Event("input"));
    });
    ed.addEventListener("input", () => { S.rascunhos[chave] = ed.value.slice(0, 12000); armazem.gravar(K.rascunhos, S.rascunhos); });
    $("[data-restaurar]", card).onclick = () => { ed.value = q.starter || ""; S.rascunhos[chave] = ed.value; armazem.gravar(K.rascunhos, S.rascunhos); retorno.innerHTML = ""; };
    const exec = $("[data-executar]", card);
    if (exec) exec.onclick = async () => {
      saida.hidden = false; saida.classList.remove("erro"); exec.setAttribute("aria-busy", "true"); exec.disabled = true;
      const r = await python.executar(ed.value, { aoEstado: (t) => saida.textContent = t });
      saida.textContent = r.saida; saida.classList.toggle("erro", !r.ok);
      exec.removeAttribute("aria-busy"); exec.disabled = false;
    };
    $("[data-avaliar]", card).onclick = async (e) => {
      const b = e.currentTarget; const codigo = ed.value.trim();
      if (!codigo) { retorno.innerHTML = '<div class="q-retorno errado">Escreva sua solução no editor antes de pedir a avaliação.</div>'; return; }
      if (!App.ia) return aviso("A camada de IA não está disponível.", true);
      b.disabled = true; ed.readOnly = true; b.setAttribute("aria-busy", "true");
      retorno.innerHTML = '<p class="status">A IA está revisando sua solução…</p>';
      try {
        const r = await App.ia.avaliarCodigo({ aula, q, codigo });
        registrarResposta(aula.id, qi, r.correct);
        retorno.innerHTML = '<div class="q-retorno ' + (r.correct ? "certo" : "errado") + '"><strong>' + (r.correct ? "Sua solução atende ao desafio." : "Ainda precisa de ajustes.") + "</strong>" + esc(r.feedback) + "</div>";
        if (r.correct) { concluirQuestao(aula.id, qi); desenharIndice(); b.removeAttribute("aria-busy"); return; }
      } catch (err) { retorno.innerHTML = '<div class="q-retorno errado">' + esc(err.message) + "</div>"; }
      b.disabled = false; ed.readOnly = false; b.removeAttribute("aria-busy");
    };
  }
}

async function pedirApoio(card, aula, qi, tipo) {
  const saida = $("[data-ia-saida]", card);
  const chave = aula.id + ":" + qi + ":" + tipo; const resta = esperaRestante(chave);
  if (resta) { saida.innerHTML = '<p class="status">Aguarde ' + Math.ceil(resta / 1000) + " s para pedir de novo.</p>"; return; }
  if (!App.ia) return aviso("A camada de IA não está disponível.", true);
  ultimaChamada.set(chave, Date.now());
  const botoes = $$("[data-apoio]", card); botoes.forEach((b) => b.disabled = true);
  saida.innerHTML = '<p class="status">Preparando ' + tipo.toLowerCase() + "…</p>";
  try {
    const texto = await App.ia.apoio({ aula, q: aula.q[qi], tipo });
    saida.innerHTML = '<div class="q-ia"><h4>' + esc(tipo) + "</h4>" + md(texto) + "</div>";
  } catch (err) { saida.innerHTML = '<p class="status err">Não foi possível obter ' + tipo.toLowerCase() + ": " + esc(err.message) + "</p>"; }
  botoes.forEach((b) => b.disabled = false);
}

function oferecerDiagnostico(card, aula, qi, escolha, erros) {
  const slot = $("[data-diag]", card);
  if (!$("[data-diagnosticar]", slot) && !$(".diag-resultado", slot)) {
    slot.insertAdjacentHTML("afterbegin", '<div class="q-ia diag-oferta"><button type="button" class="btn btn-mini" data-diagnosticar>Entender melhor este erro</button> <span class="mini discreto">Mostra o motivo, o conceito pré-requisito e uma questão focada (usa a IA).</span></div>');
  }
  const btn = $("[data-diagnosticar]", slot); if (btn) btn.onclick = () => diagnosticar(card, aula, qi, escolha);
  $(".reforco", slot)?.remove();
  if (erros >= 3) {
    slot.insertAdjacentHTML("beforeend", '<div class="q-ia reforco"><h4>Reforço</h4><p>Você já errou esta questão ' + erros + " vezes. Quer um reforço? Cada opção usa a IA e só roda depois da sua confirmação.</p>" +
      '<div class="linha-btns"><button type="button" class="btn btn-mini" data-reforco="Dica">Receber uma dica</button><button type="button" class="btn btn-mini" data-reforco="Explicação">Ver explicação</button><button type="button" class="btn btn-mini" data-reforco="foco">Praticar com questão focada</button></div></div>');
    $$("[data-reforco]", slot).forEach((b) => b.onclick = () => {
      if (!confirm("Esta ação usa a IA e gasta tokens extras. Deseja continuar?")) return;
      b.dataset.reforco === "foco" ? diagnosticar(card, aula, qi, escolha) : pedirApoio(card, aula, qi, b.dataset.reforco);
    });
  }
}
async function diagnosticar(card, aula, qi, escolha) {
  const slot = $("[data-diag]", card); const chave = "diag:" + aula.id + ":" + qi;
  const resta = esperaRestante(chave);
  let area = $(".diag-resultado", slot);
  if (!area) { area = Object.assign(document.createElement("div"), { className: "q-ia diag-resultado" }); slot.prepend(area); }
  if (resta) { area.innerHTML = '<p class="status">Aguarde ' + Math.ceil(resta / 1000) + " s para solicitar novamente.</p>"; return; }
  if (!App.ia) return aviso("A camada de IA não está disponível.", true);
  ultimaChamada.set(chave, Date.now());
  $(".diag-oferta", slot)?.remove();
  area.innerHTML = '<p class="status">Analisando o erro…</p>';
  try {
    const d = await App.ia.diagnostico({ aula, q: aula.q[qi], escolha });
    area.innerHTML = "<h4>Diagnóstico do erro</h4><p><strong>Motivo:</strong> " + esc(d.motivo) + "</p>" + (d.conceito ? "<p><strong>Conceito pré-requisito:</strong> " + esc(d.conceito) + "</p>" : "") + (d.micro ? "<p><strong>Em poucas palavras:</strong> " + esc(d.micro) + "</p>" : "") +
      '<div class="foco"><p class="olho">Nova questão focada</p><div class="q-enunciado">' + esc(d.nova.p || "") + '</div><ol class="opcoes">' + d.nova.o.map((o, i) => '<li><button type="button" class="opcao" data-foco="' + i + '"><span class="letra">' + LETRAS[i] + "</span><span>" + esc(o) + "</span></button></li>").join("") + '</ol><div data-foco-ret></div></div>';
    $$("[data-foco]", area).forEach((b) => b.onclick = () => {
      const i = Number(b.dataset.foco); const certo = i === d.nova.a;
      $$("[data-foco]", area).forEach((o, oi) => { o.disabled = true; o.dataset.estado = oi === d.nova.a ? "certa" : oi === i ? "errada" : "apagada"; });
      $("[data-foco-ret]", area).innerHTML = '<div class="q-retorno ' + (certo ? "certo" : "errado") + '"><strong>' + (certo ? "Correto." : "Não foi dessa vez.") + "</strong>" + esc(d.nova.e || "") + "</div>";
    });
  } catch (err) {
    area.innerHTML = '<p class="status err">Não foi possível gerar o diagnóstico: ' + esc(err.message) + '</p><button type="button" class="btn btn-mini" data-tentar>Tentar novamente</button>';
    $("[data-tentar]", area).onclick = () => diagnosticar(card, aula, qi, escolha);
  }
}

/* Marcação de trechos e atalhos de IA por delegação (vale para qualquer tela). */
document.addEventListener("click", (e) => {
  const m = e.target.closest("[data-marcar]");
  if (m) {
    const alvo = m.closest("[data-marca-id]"); const on = alternarTrecho(m.dataset.marcar, alvo.textContent);
    alvo.dataset.marcado = String(on); m.setAttribute("aria-pressed", String(on));
    m.setAttribute("aria-label", (on ? "Desmarcar" : "Marcar") + " trecho");
    return;
  }
  const ia = e.target.closest("[data-ia-acao]");
  if (ia) { e.preventDefault(); ia.dataset.iaAcao === "gerador" ? App.ia?.abrirGerador() : App.ia?.abrirChat(); }
});

/* ---------- 15. Python isolado (Pyodide em Web Worker) ---------- */
const python = (() => {
  const URL_PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
  const BLOQUEIOS = [/__import__/, /importlib/, /^\s*(import|from)\s+(os|sys|subprocess|socket|ctypes|shutil|pathlib|js|pyodide|asyncio|threading|multiprocessing)\b/m, /\bopen\s*\(/, /\beval\s*\(/, /\bexec\s*\(/, /\bcompile\s*\(/, /while\s+True\s*:/, /while\s+1\s*:/];
  const CODIGO_WORKER = `
    let py = null;
    self.onmessage = async (e) => {
      const { codigo, linhas, pandas, url } = e.data;
      try {
        if (!py) {
          const f = self.fetch.bind(self);
          self.fetch = (u, o) => String((u && u.url) || u).startsWith("https://cdn.jsdelivr.net/") ? f(u, o) : Promise.reject(new Error("rede bloqueada"));
          importScripts(url);
          py = await loadPyodide({ indexURL: url.replace(/pyodide\\.js$/, "") });
          self._f = self.fetch;
        }
        if (pandas && !self._pd) { self.fetch = self._f; await py.loadPackage("pandas"); await py.runPythonAsync("import pandas"); self._pd = 1; }
        self.fetch = () => Promise.reject(new Error("rede bloqueada"));
        self.XMLHttpRequest = undefined; self.WebSocket = undefined; self.EventSource = undefined;
        self.postMessage({ fase: "pronto" });
        let out = "";
        py.setStdout({ batched: (s) => { out += s + "\\n"; } });
        py.setStderr({ batched: (s) => { out += s + "\\n"; } });
        const ns = py.globals.get("dict")();
        if (linhas) ns.set("rows", py.toPy(linhas));
        await py.runPythonAsync(codigo, { globals: ns });
        self.postMessage({ fase: "fim", saida: out });
      } catch (err) { self.postMessage({ fase: "erro", saida: String((err && err.message) || err).slice(-1000) }); }
    };`;
  let worker = null, ocupado = false;
  function novoWorker() {
    const url = URL.createObjectURL(new Blob([CODIGO_WORKER], { type: "text/javascript" }));
    const w = new Worker(url); setTimeout(() => URL.revokeObjectURL(url), 1000); return w;
  }
  /* O runtime fica aquecido entre execuções; cada execução usa um namespace novo. */
  function executar(codigo, { linhas = null, pandas = false, limite = 3000, tempo = 4000, aoEstado = () => {} } = {}) {
    codigo = String(codigo || "");
    if (!codigo.trim()) return Promise.resolve({ ok: false, saida: "Escreva algum código antes de executar." });
    if (codigo.length > limite) return Promise.resolve({ ok: false, saida: "Limite: " + limite.toLocaleString("pt-BR") + " caracteres." });
    if (BLOQUEIOS.some((r) => r.test(codigo))) return Promise.resolve({ ok: false, saida: "Por segurança, este ambiente não permite acesso ao sistema ou à rede, eval/exec/open, nem laços infinitos explícitos." });
    if (ocupado) return Promise.resolve({ ok: false, saida: "Já existe uma execução em andamento." });
    ocupado = true;
    const frio = !worker;
    if (frio) worker = novoWorker();
    aoEstado(frio ? "Carregando o Python isolado (na primeira vez leva alguns segundos)…" : "Executando…");
    return new Promise((ok) => {
      const fim = (sucesso, texto, descartar) => {
        clearTimeout(timer); ocupado = false;
        if (worker) worker.onmessage = null;
        if (descartar && worker) { worker.terminate(); worker = null; }
        ok({ ok: sucesso, saida: (texto || "(sem saída)").slice(0, 4000) });
      };
      let timer = setTimeout(() => fim(false, "O ambiente Python não carregou em 60 segundos. Verifique a conexão.", true), 60000);
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.fase === "pronto") { clearTimeout(timer); aoEstado("Executando…"); timer = setTimeout(() => fim(false, "Tempo limite de " + tempo / 1000 + " segundos excedido (possível laço infinito). O processo foi encerrado.", true), tempo); }
        else if (m.fase === "fim") fim(true, m.saida.trimEnd());
        else fim(false, m.saida);
      };
      worker.onerror = (e) => fim(false, "Falha no ambiente Python: " + (e.message || "erro desconhecido"), true);
      worker.postMessage({ codigo, linhas, pandas, url: URL_PYODIDE });
    });
  }
  return { executar };
})();

/* ---------- 16. Marcados ---------- */
function telaMarcados() {
  const favs = Object.entries(S.marcas.questions).sort((a, b) => b[1].at - a[1].at).map(([id, info]) => {
    const [aulaId, , qs] = id.split(":"); const aula = acharAula(aulaId); const qi = Number(qs); const q = aula?.q[qi];
    if (!q) return "";
    const corpo = ehCodigo(q)
      ? "<p><strong>Linguagem:</strong> " + esc(q.language) + "</p>" + (q.task ? '<p class="pre">' + esc(q.task) + "</p>" : "") + "<pre><code>" + esc(S.rascunhos[aulaId + ":" + qi] || q.starter || "") + "</code></pre>"
      : '<ol class="opcoes">' + q.o.map((o, oi) => {
          const marcada = info.selected === oi;
          return '<li><div class="opcao" data-estado="' + (marcada ? (info.correct ? "certa" : "errada") : "") + '"><span class="letra">' + LETRAS[oi] + "</span><span>" + esc(o) + (marcada ? " <em class=\"mini\">— resposta registrada</em>" : "") + "</span></div></li>";
        }).join("") + "</ol>" + (info.selected == null ? '<p class="mini discreto">Ainda não havia resposta registrada quando foi favoritada.</p>' : '<p class="mini">Resultado registrado: <strong>' + (info.correct ? "Correta" : "Incorreta") + "</strong></p>");
    return '<li><div class="linha-btns"><a class="origem" href="#' + encodeURIComponent(aulaId) + '">' + esc(aula.t) + " · Questão " + (qi + 1) + '</a><button type="button" class="btn btn-texto btn-mini" data-desfavoritar="' + esc(id) + '">Remover favorito</button></div><div class="q-enunciado">' + htmlSeguro(q.p) + "</div>" + corpo + (q.e ? '<p class="mini discreto"><strong>Explicação:</strong> ' + esc(q.e) + "</p>" : "") + "</li>";
  }).filter(Boolean);
  const trechos = Object.entries(S.marcas.lines).sort((a, b) => b[1].at - a[1].at).map(([id, info]) => {
    const aula = acharAula(id.split(":")[0]);
    return '<li><div class="linha-btns"><a class="origem" href="#' + encodeURIComponent(id.split(":")[0]) + '">' + esc(aula ? aula.t : "Aula removida") + '</a><button type="button" class="btn btn-texto btn-mini" data-desmarcar="' + esc(id) + '">Desmarcar</button></div><blockquote>' + esc(info.text || "Trecho marcado") + "</blockquote></li>";
  });
  return '<div class="coluna"><p class="olho">Para revisar</p><h1>Itens marcados</h1><p class="lead">Questões favoritadas e trechos que você marcou nas aulas. Fica tudo neste navegador.</p>' +
    '<section class="secao"><h2>Questões favoritas</h2>' + (favs.length ? '<ul class="marcados-lista">' + favs.join("") + "</ul>" : '<p class="discreto">Nenhuma questão favoritada. Use ☆ Favoritar no topo de qualquer questão.</p>') + "</section>" +
    '<section class="secao"><h2>Trechos marcados</h2>' + (trechos.length ? '<ul class="marcados-lista">' + trechos.join("") + "</ul>" : '<p class="discreto">Nenhum trecho marcado. Passe o mouse na margem de um parágrafo e clique no marcador.</p>') + "</section></div>";
}
document.addEventListener("click", (e) => {
  const f = e.target.closest("[data-desfavoritar]"); const t = e.target.closest("[data-desmarcar]");
  if (f) { delete S.marcas.questions[f.dataset.desfavoritar]; salvarMarcas(); render(); }
  if (t) { delete S.marcas.lines[t.dataset.desmarcar]; salvarMarcas(); render(); }
});

/* ---------- 17. Skills: radar por módulo e mapa de calor por aula ---------- */
const faixaCalor = (p) => p == null ? "none" : p < 40 ? "0" : p < 60 ? "1" : p < 75 ? "2" : p < 90 ? "3" : "4";
const COR_CALOR = { none: "transparent", 0: "#c0392b", 1: "#e67e22", 2: "#d4ac0d", 3: "#58a55c", 4: "#1e8e4e" };
const nomeModulo = (t) => String(t || "").replace(/^[^\p{L}\p{N}]+/u, "").replace(/^\d+\s*[-.:)]\s*/, "").trim() || "Módulo";
function matrizSkills() {
  return S.mods.map((m) => {
    const ls = m.l.map((l) => {
      let c = 0, w = 0;
      l.q.forEach((_, i) => { const st = (S.stats[l.id] || {})[i]; if (st) { c += st.correct; w += st.wrong; } });
      const marcas = Object.keys(S.marcas.lines).filter((k) => k.startsWith(l.id + ":")).length;
      return { aula: l, certas: c, erradas: w, tent: c + w, feitas: (S.progresso[l.id] || []).length, total: l.q.length, marcas, nota: c + w ? Math.round(100 * c / (c + w)) : null };
    });
    const c = ls.reduce((s, x) => s + x.certas, 0), w = ls.reduce((s, x) => s + x.erradas, 0);
    const tq = ls.reduce((s, x) => s + x.total, 0), fq = ls.reduce((s, x) => s + x.feitas, 0);
    return { titulo: nomeModulo(m.t), aulas: ls, tent: c + w, nota: c + w ? Math.round(100 * c / (c + w)) : null, cobertura: tq ? Math.round(100 * fq / tq) : 0 };
  });
}
function telaSkills() {
  const mat = matrizSkills();
  const eixos = mat.filter((m) => m.tent > 0).slice(0, 8);
  let radar = '<p class="discreto">O radar aparece quando houver respostas em pelo menos 3 módulos.</p>';
  if (eixos.length >= 3) {
    const n = eixos.length, cx = 130, cy = 130, R = 78;
    const pt = (i, r) => { const a = 2 * Math.PI * i / n - Math.PI / 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
    const aneis = [25, 50, 75, 100].map((p) => '<polygon class="anel" points="' + eixos.map((_, i) => pt(i, R * p / 100).join(",")).join(" ") + '"/>').join("");
    const linhas = eixos.map((_, i) => { const [x, y] = pt(i, R); return '<line class="eixo" x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '"/>'; }).join("");
    const area = '<polygon class="area" points="' + eixos.map((m, i) => pt(i, R * m.nota / 100).join(",")).join(" ") + '"/>';
    const rot = eixos.map((m, i) => { const [x, y] = pt(i, 96); return '<text x="' + x + '" y="' + y + '" text-anchor="middle" dominant-baseline="middle">' + esc(m.titulo.slice(0, 16)) + "</text>"; }).join("");
    radar = '<svg class="radar-svg" viewBox="0 0 260 260" role="img" aria-label="Radar de acerto por módulo">' + aneis + linhas + area + rot + "</svg>";
  }
  const tabela = '<table class="tabela"><thead><tr><th>Módulo</th><th>Acerto</th><th>Tentativas</th><th>Cobertura</th></tr></thead><tbody>' + mat.map((m) => "<tr><td>" + esc(m.titulo) + '</td><td class="num">' + (m.nota == null ? "—" : m.nota + "%") + '</td><td class="num">' + m.tent + '</td><td class="num">' + m.cobertura + "%</td></tr>").join("") + "</tbody></table>";
  const calor = mat.length ? '<div class="calor">' + mat.map((m) => '<div class="calor-linha"><strong>' + esc(m.titulo) + '</strong><div class="calor-celulas">' + m.aulas.map((x, i) => {
    const f = faixaCalor(x.nota);
    const rot = x.aula.t + (x.nota == null ? " — sem tentativas" : " — " + x.nota + "% de acerto (" + x.certas + " certas, " + x.erradas + " erradas)") + " · " + x.feitas + "/" + x.total + " questões concluídas" + (x.marcas ? " · " + x.marcas + " marcação(ões)" : "");
    return '<a class="calor-celula" data-faixa="' + f + '" style="--calor:' + COR_CALOR[f] + '" href="#' + encodeURIComponent(x.aula.id) + '" title="' + esc(rot) + '" aria-label="' + esc(rot) + '">' + (i + 1) + ". " + esc(x.aula.t.slice(0, 28)) + (x.marcas ? " ★" : "") + "<br>" + (x.nota == null ? "—" : x.nota + "%") + "</a>";
  }).join("") + "</div></div>").join("") + "</div>" : '<p class="discreto">Nenhum módulo cadastrado.</p>';
  return '<div class="coluna-larga"><p class="olho">Domínio por tema</p><h1>Radar de skills</h1><p class="lead">Uma estimativa feita com as respostas guardadas neste navegador. Tema sem tentativas não é tema dominado — é tema não testado.</p>' +
    '<div class="grade-2"><div>' + radar + "</div><div>" + tabela + "</div></div>" +
    '<section class="secao"><h2>Mapa de calor por aula</h2><div class="legenda"><span><i style="background:' + COR_CALOR[0] + '"></i>&lt;40%</span><span><i style="background:' + COR_CALOR[1] + '"></i>40–59%</span><span><i style="background:' + COR_CALOR[2] + '"></i>60–74%</span><span><i style="background:' + COR_CALOR[3] + '"></i>75–89%</span><span><i style="background:' + COR_CALOR[4] + '"></i>90%+</span><span><i></i>sem tentativas</span><span>★ trecho marcado</span></div>' + calor + "</section></div>";
}

/* ---------- 18. Mapa mental ---------- */
const LIMITE_RAMOS = 12, LIMITE_SUB = 10;
const limpar = (t, max) => String(t == null ? "" : t).replace(/\s+/g, " ").trim().slice(0, max);
const textoNo = (v) => typeof v === "string" ? v : isObj(v) ? v.name || v.title || v.label || v.text || "" : "";
function normalizarMapa(m, raizPadrao) {
  if (!isObj(m) || !Array.isArray(m.branches)) return null;
  const root = limpar(m.root || raizPadrao, 120);
  const branches = m.branches.map((b) => ({ name: limpar(textoNo(b), 80), children: (Array.isArray(b && b.children) ? b.children : []).map((c) => limpar(textoNo(c), 100)).filter(Boolean) })).filter((b) => b.name);
  return root && branches.length ? { root, branches } : null;
}
function quebrar(texto, max, linhas) {
  const out = []; let atual = "";
  for (let p of String(texto).split(/\s+/).filter(Boolean)) {
    while (p.length > max) { if (atual) { out.push(atual); atual = ""; } out.push(p.slice(0, max - 1) + "-"); p = p.slice(max - 1); }
    if (!atual) atual = p; else if ((atual + " " + p).length <= max) atual += " " + p; else { out.push(atual); atual = p; }
  }
  if (atual) out.push(atual);
  if (out.length > linhas) { const r = out.slice(0, linhas); r[linhas - 1] = r[linhas - 1].replace(/.?$/, "…"); return r; }
  return out;
}
const CAIXA = { raiz: { x: 0, w: 230, c: 20, l: 4, h: 70 }, ramo: { x: 340, w: 230, c: 24, l: 3, h: 46 }, folha: { x: 666, w: 270, c: 34, l: 3, h: 38 } };
const CORES_RAMO = ["#c8502a", "#2f6fbf", "#2e8b57", "#7d4fb3", "#d4822d", "#138a8a", "#c2366b", "#6b7b80", "#a07d00", "#3b5bdb", "#0b7285", "#a61e4d"];
function caixa(tipo, texto) { const c = CAIXA[tipo]; const linhas = quebrar(texto, c.c, c.l); return { tipo, texto, linhas, x: c.x, w: c.w, h: Math.max(c.h, 18 + linhas.length * 17) }; }
function layoutMapa(mapa) {
  const raiz = caixa("raiz", mapa.root); const nos = [raiz]; const arestas = []; let y = 0;
  mapa.branches.forEach((b, bi) => {
    const ramo = caixa("ramo", b.name); ramo.cor = CORES_RAMO[bi % CORES_RAMO.length];
    const folhas = b.children.map((t) => Object.assign(caixa("folha", t), { cor: ramo.cor }));
    const hf = folhas.reduce((s, f) => s + f.h, 0) + Math.max(0, folhas.length - 1) * 12;
    const bloco = Math.max(ramo.h, hf);
    let fy = y + (bloco - hf) / 2;
    folhas.forEach((f) => { f.y = fy; fy += f.h + 12; nos.push(f); arestas.push({ de: ramo, para: f, w: 1.8, cor: ramo.cor }); });
    ramo.y = y + (bloco - ramo.h) / 2; nos.push(ramo); arestas.push({ de: raiz, para: ramo, w: 3, cor: ramo.cor });
    y += bloco + 28;
  });
  const altura = Math.max(y - 28, raiz.h); raiz.y = (altura - raiz.h) / 2;
  return { nos, arestas, largura: 936, altura };
}
function svgMapa(lay, exportar) {
  const P = 30, W = lay.largura + 2 * P, H = lay.altura + 2 * P;
  const cores = [...new Set(lay.arestas.map((a) => a.cor))];
  const defs = "<defs>" + cores.map((c, i) => '<marker id="seta' + i + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="' + c + '"/></marker>').join("") + "</defs>";
  const arestas = lay.arestas.map((a) => {
    const x1 = a.de.x + a.de.w, y1 = a.de.y + a.de.h / 2, x2 = a.para.x, y2 = a.para.y + a.para.h / 2, dx = (x2 - x1) / 2;
    return '<path d="M' + x1 + "," + y1 + " C" + (x1 + dx) + "," + y1 + " " + (x2 - dx) + "," + y2 + " " + x2 + "," + y2 + '" fill="none" stroke="' + a.cor + '" stroke-width="' + a.w + '" stroke-linecap="round" opacity="0.9" marker-end="url(#seta' + cores.indexOf(a.cor) + ')"/>';
  }).join("");
  const nos = lay.nos.map((n) => {
    const raiz = n.tipo === "raiz", folha = n.tipo === "folha";
    const fill = raiz ? "#2b241c" : folha ? "#fffdf8" : n.cor, stroke = raiz ? "#c8502a" : n.cor, cor = folha ? "#2b241c" : "#ffffff";
    const fs = raiz ? 15 : folha ? 13 : 14, fw = folha ? 500 : 700;
    const ty = n.y + n.h / 2 - (n.linhas.length - 1) * 17 / 2;
    return "<g><title>" + esc(n.texto) + '</title><rect x="' + n.x + '" y="' + n.y + '" width="' + n.w + '" height="' + n.h + '" rx="10" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (raiz ? 3 : 2) + '"/>' +
      '<text x="' + (n.x + n.w / 2) + '" text-anchor="middle" font-family="IBM Plex Sans, Arial, sans-serif" font-size="' + fs + '" font-weight="' + fw + '" fill="' + cor + '">' + n.linhas.map((l, i) => '<tspan x="' + (n.x + n.w / 2) + '" y="' + (ty + i * 17) + '" dominant-baseline="middle">' + esc(l) + "</tspan>").join("") + "</text></g>";
  }).join("");
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + -P + " " + -P + " " + W + " " + H + '" width="' + W + '" height="' + H + '">' + defs + (exportar ? '<rect x="' + -P + '" y="' + -P + '" width="' + W + '" height="' + H + '" fill="#ffffff"/>' : "") + '<g id="mmVista">' + arestas + nos + "</g></svg>";
}
let MAPA_ATUAL = null;
function telaMapa() {
  const salvo = normalizarMapa(armazem.ler(K.mapa, null));
  MAPA_ATUAL = salvo;
  return '<div class="coluna-larga"><p class="olho">Ferramenta de estudo</p><h1>Mapa mental</h1><p class="lead">Peça um tema e o Datrics devolve a estrutura; o desenho é feito aqui, e você pode arrastar, ampliar e baixar.</p>' +
    '<form id="mapaForm" class="grade-3"><label class="campo"><span>Tema do mapa</span><input type="text" id="mmTema" maxlength="100" placeholder="Ex.: Delta Lake — transações ACID" value="' + esc(salvo ? salvo.root : "") + '"></label>' +
    '<label class="campo"><span>O que explorar?</span><select id="mmFoco"><option value="Conceitos principais e relações">Conceitos e relações</option><option value="Arquitetura e componentes">Arquitetura e componentes</option><option value="Fluxo de implementação">Etapas de implementação</option><option value="Comparação e trade-offs">Comparações e trade-offs</option></select></label>' +
    '<div class="grade-2"><label class="campo"><span>Ramificações (1–12)</span><input type="number" id="mmRamos" min="1" max="12" value="8"></label><label class="campo"><span>Subtópicos (1–10)</span><input type="number" id="mmSub" min="1" max="10" value="5"></label></div>' +
    '<div class="linha-btns"><button type="submit" class="btn btn-tinta" id="mmGerar">Criar mapa mental com IA</button><span class="status" id="mmStatus" aria-live="polite"></span></div></form>' +
    '<div class="mapa-palco" id="mmPalco"><div class="mapa-vazio" id="mmVazio">' + (salvo ? "" : "Nenhum mapa ainda. Informe um tema acima.") + '</div><div class="mapa-ctrl" id="mmCtrl" hidden><button type="button" class="btn btn-texto btn-mini" data-zoom="1.25" aria-label="Ampliar">＋</button><button type="button" class="btn btn-texto btn-mini" data-zoom="0.8" aria-label="Reduzir">－</button><button type="button" class="btn btn-texto btn-mini" data-ajustar>Ajustar</button><button type="button" class="btn btn-texto btn-mini" data-baixar="svg">Baixar SVG</button><button type="button" class="btn btn-texto btn-mini" data-baixar="png">Baixar PNG</button></div></div></div>';
}
function mostrarMapa(palco, mapa) {
  const lay = layoutMapa(mapa);
  $("svg", palco)?.remove();
  palco.insertAdjacentHTML("afterbegin", svgMapa(lay, false));
  $("#mmVazio", palco).textContent = ""; $("#mmCtrl", palco).hidden = false;
  const svg = $("svg", palco); const vista = $("#mmVista", svg);
  const W = lay.largura + 60, H = lay.altura + 60;
  const v = { x: 0, y: 0, k: 1 };
  const aplicar = () => vista.setAttribute("transform", "translate(" + v.x + " " + v.y + ") scale(" + v.k + ")");
  const ajustar = (estrito) => {
    const cw = palco.clientWidth || 800, ch = palco.clientHeight || 500;
    svg.removeAttribute("width"); svg.removeAttribute("height"); svg.setAttribute("viewBox", "0 0 " + cw + " " + ch);
    let k = Math.min(cw / W, ch / H, 1.4); if (!estrito) k = Math.max(k, Math.min(0.55, cw / W)); v.k = Math.max(0.12, k);
    v.x = (cw - W * v.k) / 2 + 30 * v.k; v.y = estrito ? (ch - H * v.k) / 2 + 30 * v.k : 24; aplicar();
  };
  const zoom = (f, ax, ay) => {
    const r = palco.getBoundingClientRect(); ax = ax == null ? r.width / 2 : ax; ay = ay == null ? r.height / 2 : ay;
    const k = Math.min(3, Math.max(0.12, v.k * f)); v.x = ax - (ax - v.x) * (k / v.k); v.y = ay - (ay - v.y) * (k / v.k); v.k = k; aplicar();
  };
  ajustar(false);
  $$("[data-zoom]", palco).forEach((b) => b.onclick = () => zoom(Number(b.dataset.zoom)));
  $("[data-ajustar]", palco).onclick = () => ajustar(true);
  $$("[data-baixar]", palco).forEach((b) => b.onclick = () => baixarMapa(mapa, lay, b.dataset.baixar));
  palco.onwheel = (e) => { e.preventDefault(); const r = palco.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); };
  const ptrs = new Map(); let dist = 0;
  palco.onpointerdown = (e) => { if (e.target.closest(".mapa-ctrl")) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]); palco.setPointerCapture?.(e.pointerId); };
  palco.onpointermove = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const [px, py] = ptrs.get(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) { v.x += e.clientX - px; v.y += e.clientY - py; aplicar(); }
    else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const r = palco.getBoundingClientRect();
      if (dist) zoom(d / dist, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top); dist = d;
    }
  };
  palco.onpointerup = palco.onpointercancel = (e) => { ptrs.delete(e.pointerId); dist = 0; };
}
function baixarMapa(mapa, lay, tipo) {
  const nome = "mapa-mental-" + (slug(mapa.root.slice(0, 40)) || "databricks");
  const svg = svgMapa(lay, true);
  if (tipo === "svg") return baixar(nome + ".svg", svg, "image/svg+xml");
  const img = new Image(); const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  img.onload = () => {
    const W = lay.largura + 60, H = lay.altura + 60, k = Math.min(2, 8000 / Math.max(W, H));
    const c = Object.assign(document.createElement("canvas"), { width: Math.round(W * k), height: Math.round(H * k) });
    const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    c.toBlob((b) => b ? baixar(nome + ".png", b) : aviso("Não foi possível gerar o PNG; baixe o SVG.", true), "image/png");
  };
  img.onerror = () => { URL.revokeObjectURL(url); aviso("Não foi possível gerar o PNG; baixe o SVG.", true); };
  img.src = url;
}
function ligarMapa(raiz) {
  const palco = $("#mmPalco", raiz); const st = $("#mmStatus", raiz);
  if (MAPA_ATUAL) mostrarMapa(palco, MAPA_ATUAL);
  $("#mapaForm", raiz).onsubmit = async (e) => {
    e.preventDefault();
    const tema = limpar($("#mmTema", raiz).value, 100);
    if (!tema) { st.textContent = "Informe um tema específico."; st.className = "status err"; return; }
    const pedR = Math.floor(Number($("#mmRamos", raiz).value) || 8), pedS = Math.floor(Number($("#mmSub", raiz).value) || 5);
    const ramos = Math.min(LIMITE_RAMOS, Math.max(1, pedR)), sub = Math.min(LIMITE_SUB, Math.max(1, pedS));
    const avisos = [];
    if (pedR > LIMITE_RAMOS) avisos.push("ramificações limitadas a 12"); if (pedS > LIMITE_SUB) avisos.push("subtópicos limitados a 10");
    if (avisos.length) aviso("O pedido passou do teto suportado: " + avisos.join(" e ") + ".");
    if (!App.ia) return aviso("A camada de IA não está disponível.", true);
    if (ramos * sub > 60 && !confirm("Este mapa grande usa mais tokens (até ~" + App.ia.tokensMapa(ramos, sub) + " de saída). Continuar?")) return;
    const b = $("#mmGerar", raiz); b.disabled = true; b.setAttribute("aria-busy", "true");
    st.className = "status"; st.textContent = "Gerando o mapa… a API é escolhida automaticamente.";
    try {
      const r = await App.ia.mapaMental({ tema, foco: $("#mmFoco", raiz).value, ramos, sub, aoStatus: (t) => st.textContent = t });
      MAPA_ATUAL = r.mapa; armazem.gravar(K.mapa, r.mapa);
      mostrarMapa(palco, r.mapa);
      st.textContent = r.nota || "Mapa pronto. Arraste para mover; use a roda ou pinça para ampliar.";
    } catch (err) { st.className = "status err"; st.textContent = "Não foi possível gerar o mapa: " + err.message; }
    b.disabled = false; b.removeAttribute("aria-busy");
  };
}

/* ---------- 19. Laboratório de dados sujos ---------- */
const laboratorio = (() => {
  const COLS = ["id", "nome", "email", "cidade", "idade", "valor_pedido"];
  const NOMES = ["Ana", "Bruno", "Carla", "Diego", "Eva", "Felipe", "Gi", "Hugo", "Iara", "João"];
  const SOBRE = ["Silva", "Lima", "Souza", "Alves", "Costa", "Mendes", "Rocha", "Santos"];
  const CIDADES = ["São Paulo", "sao paulo", " Rio de Janeiro", "RIO DE JANEIRO", "Belo Horizonte ", "Curitiba", "curitiba", "Recife", ""];
  const sorte = (p) => Math.random() < p, pega = (a) => a[Math.floor(Math.random() * a.length)], entre = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  let linhas = [];
  function gerar() {
    const n = entre(8, 16); const out = [];
    for (let i = 0; i < n; i++) {
      const pn = pega(NOMES), sn = pega(SOBRE);
      const id = i > 0 && sorte(0.12) ? out[0][0] : String(100 + entre(0, n + 3));
      let nome = pn + " " + sn; if (sorte(0.22)) nome = "  " + nome + " "; if (sorte(0.12)) nome = null;
      let email = (sorte(0.5) ? pn + "." + sn : pn + sn).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + (sorte(0.18) ? "@email" : "@email.com"); if (sorte(0.13)) email = null;
      const idade = sorte(0.2) ? "" : sorte(0.15) ? "trinta" : String(entre(18, 72));
      let valor = sorte(0.18) ? "R$ " + entre(10, 999) : (Math.random() * 1000).toFixed(2); if (sorte(0.18)) valor = null;
      out.push([id, nome, email, pega(CIDADES), idade, valor]);
    }
    return out;
  }
  const tabelaHtml = () => '<div class="tabela-rolagem"><table class="tabela" id="labTabela"><thead><tr>' + COLS.map((c) => "<th>" + c + "</th>").join("") + "</tr></thead><tbody>" +
    linhas.map((l) => "<tr>" + l.map((v) => '<td contenteditable="true" spellcheck="false">' + (v == null ? "" : esc(v)) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  function lerTabela(raiz) { return $$("#labTabela tbody tr", raiz).map((tr) => $$("td", tr).map((td) => td.textContent === "" ? null : td.textContent)); }
  function validar(rows) {
    const vistos = new Set(); let dup = 0, vazios = 0, emails = 0, espacos = 0;
    for (const r of rows) {
      const id = (r[0] || "").trim(); if (id) { if (vistos.has(id)) dup++; vistos.add(id); }
      vazios += r.filter((v) => v == null || !String(v).trim()).length;
      if (r[2] && r[2].trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r[2].trim())) emails++;
      if (r.some((v) => typeof v === "string" && v !== v.trim())) espacos++;
    }
    return [["Registros", rows.length], ["IDs duplicados", dup], ["Campos vazios", vazios], ["E-mails inválidos", emails], ["Linhas com espaços extras", espacos]];
  }
  const PY_PADRAO = 'import pandas as pd\n\ndf = pd.DataFrame(rows, columns=["id", "nome", "email", "cidade", "idade", "valor_pedido"])\ndf = df.drop_duplicates()\ndf["nome"] = df["nome"].str.strip()\nprint(df.fillna("—").to_string(index=False))';
  async function rodarSql(sql, rows) {
    await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js", "sqljs");
    const SQL = await window.initSqlJs({ locateFile: (f) => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" + f });
    const db = new SQL.Database();
    try {
      db.run("CREATE TABLE dirty_data (" + COLS.map((c) => c + " TEXT").join(", ") + ")");
      const st = db.prepare("INSERT INTO dirty_data VALUES (?,?,?,?,?,?)"); rows.forEach((r) => st.run(r)); st.free();
      const res = db.exec(sql);
      if (!res.length) return "SQL executado. " + db.getRowsModified() + " linha(s) afetada(s).";
      return res.map((r) => r.columns.join(" | ") + "\n" + r.values.map((v) => v.map((x) => x == null ? "NULL" : x).join(" | ")).join("\n")).join("\n\n");
    } finally { db.close(); }
  }
  return {
    tela() {
      linhas = gerar();
      return '<div class="coluna-larga"><p class="olho">Laboratório de dados</p><h1>Limpeza de dados</h1><p class="lead">Uma tabela nova e bagunçada a cada visita: IDs repetidos, e-mails quebrados, espaços sobrando, idade escrita por extenso. Corrija à mão ou com SQL/Python e valide.</p>' +
        '<div class="linha-btns"><button type="button" class="btn" data-lab="novo">Gerar novos dados</button><button type="button" class="btn btn-tinta" data-lab="validar">Validar tabela atual</button></div>' +
        '<div id="labTabelaCaixa" class="secao">' + tabelaHtml() + '</div><div id="labDiag" aria-live="polite"></div>' +
        '<div class="lab"><div><label class="campo"><span>SQL (SQLite no navegador)</span><textarea id="labSql" spellcheck="false">SELECT * FROM dirty_data;</textarea></label><button type="button" class="btn" data-lab="sql">Executar SQL</button></div>' +
        '<div><label class="campo"><span>Python (pandas)</span><textarea id="labPy" spellcheck="false">' + esc(PY_PADRAO) + '</textarea></label><button type="button" class="btn" data-lab="py">Executar Python</button></div></div>' +
        '<pre class="ide-saida" id="labSaida" hidden></pre><p class="mini discreto">As execuções não alteram a tabela acima: a validação lê o que está escrito nas células. SQLite e Pyodide são baixados sob demanda.</p></div>';
    },
    ligar(raiz) {
      const saida = $("#labSaida", raiz);
      const mostra = (t, erro) => { saida.hidden = false; saida.textContent = t; saida.classList.toggle("erro", !!erro); };
      raiz.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-lab]"); if (!b) return;
        const acao = b.dataset.lab;
        if (acao === "novo") { linhas = gerar(); $("#labTabelaCaixa", raiz).innerHTML = tabelaHtml(); $("#labDiag", raiz).innerHTML = ""; return; }
        if (acao === "validar") { $("#labDiag", raiz).innerHTML = '<div class="contadores">' + validar(lerTabela(raiz)).map(([k, v]) => "<div><b>" + v + "</b>" + k + "</div>").join("") + "</div>"; return; }
        b.disabled = true; b.setAttribute("aria-busy", "true");
        try {
          if (acao === "sql") { mostra("Carregando SQLite…"); mostra(await rodarSql($("#labSql", raiz).value, lerTabela(raiz))); }
          if (acao === "py") { const r = await python.executar($("#labPy", raiz).value, { linhas: lerTabela(raiz), pandas: true, limite: 8000, tempo: 10000, aoEstado: (t) => mostra(t) }); mostra(r.saida, !r.ok); }
        } catch (err) { mostra((acao === "sql" ? "Erro SQL: " : "") + err.message, true); }
        b.disabled = false; b.removeAttribute("aria-busy");
      });
    }
  };
})();

/* ---------- 20. Editor do site ---------- */
const editor = (() => {
  const E = { aba: "overview", mi: 0, aulaId: "", qi: 0, sujo: false, temasImportados: [] };
  const ABAS = [["overview", "Visão geral"], ["modules", "Módulos"], ["lessons", "Aulas"], ["questions", "Questões"], ["appearance", "Aparência"], ["ai", "Personalizar IA"], ["backup", "Backup e modos"]];
  const opt = (v, rot, sel) => '<option value="' + esc(v) + '"' + (sel ? " selected" : "") + ">" + esc(rot) + "</option>";
  const pegar = (obj, cam) => cam.split(".").reduce((o, k) => o == null ? o : o[k], obj);
  const definir = (obj, cam, v) => { const ks = cam.split("."); const ult = ks.pop(); ks.reduce((o, k) => o[k], obj)[ult] = v; };

  function garantirSelecao() {
    if (!S.mods.length) { E.mi = 0; E.aulaId = ""; return; }
    E.mi = Math.min(Math.max(0, E.mi), S.mods.length - 1);
    const m = S.mods[E.mi];
    if (!m.l.some((l) => l.id === E.aulaId)) E.aulaId = m.l[0]?.id || "";
    const a = acharAula(E.aulaId);
    E.qi = a ? Math.min(Math.max(0, E.qi), Math.max(0, a.q.length - 1)) : 0;
  }
  function mudarConteudo(fn, msg) {
    const antes = clone(S.mods), pAntes = clone(S.progresso), sAntes = clone(S.stats);
    try { fn(); } catch (err) { S.mods = antes; return aviso(err.message, true); }
    if (!salvarConteudo(msg)) { S.mods = antes; S.progresso = pAntes; S.stats = sAntes; return false; }
    salvarProgresso(); salvarStats();
    redesenhar();
    return true;
  }
  const mover = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return false; arr.splice(j, 0, arr.splice(i, 1)[0]); return true; };
  function idUnico(titulo, exceto) {
    const base = slug(titulo) || "nova-aula"; let id = base, n = 2;
    while (aulas().some((l) => l.id === id && l !== exceto)) id = base + "-" + n++;
    return id;
  }

  /* --- telas das abas --- */
  function abaVisao() {
    return '<div class="contadores"><div><b>' + S.mods.length + "</b>módulos</div><div><b>" + aulas().length + "</b>aulas</div><div><b>" + aulas().reduce((s, l) => s + l.q.length, 0) + "</b>questões</div></div>" +
      "<p>Tudo o que aparece na apostila pode ser mudado aqui: módulos, aulas, questões (inclusive as criadas pela IA), aparência e o jeito do Datrics responder. As mudanças ficam neste navegador; use <strong>Backup e modos</strong> para levar a outro aparelho.</p>" +
      '<div class="linha-btns">' + ABAS.slice(1).map(([id, r]) => '<button type="button" class="btn" data-ir-aba="' + id + '">' + r + "</button>").join("") + "</div>";
  }
  function abaModulos() {
    return '<ol class="lista-edit" data-arrastar="modulo">' + S.mods.map((m, i) =>
      '<li draggable="true" data-i="' + i + '"><span class="num">' + dois(i + 1) + '</span><input type="text" maxlength="120" value="' + esc(m.t) + '" data-mod-titulo="' + i + '" aria-label="Nome do módulo ' + (i + 1) + '">' +
      '<span class="linha-btns"><span class="mini discreto">' + m.l.length + ' aulas</span><button type="button" class="btn btn-texto btn-mini" data-mod-mover="' + i + ':-1" aria-label="Subir"' + (i ? "" : " disabled") + '>↑</button><button type="button" class="btn btn-texto btn-mini" data-mod-mover="' + i + ':1" aria-label="Descer"' + (i < S.mods.length - 1 ? "" : " disabled") + '>↓</button><button type="button" class="btn btn-perigo btn-mini" data-mod-apagar="' + i + '">Excluir</button></span></li>').join("") + "</ol>" +
      '<button type="button" class="btn btn-tinta" data-acao="novo-modulo">+ Novo módulo</button><p class="mini discreto">Renomeie direto no campo (salva ao sair dele). Arraste as linhas ou use ↑ ↓ para reordenar.</p>';
  }
  function seletorModulo() { return '<label class="campo"><span>Módulo</span><select data-sel-modulo>' + S.mods.map((m, i) => opt(i, dois(i + 1) + " · " + m.t, i === E.mi)).join("") + "</select></label>"; }
  function abaAulas() {
    if (!S.mods.length) return '<p class="discreto">Crie um módulo primeiro.</p>';
    const m = S.mods[E.mi]; const a = acharAula(E.aulaId);
    return '<div class="grade-2">' + seletorModulo() + "<div></div></div>" +
      '<ol class="lista-edit" data-arrastar="aula">' + m.l.map((l, i) => '<li draggable="true" data-i="' + i + '"><span class="num">' + (i + 1) + '</span><button type="button" class="btn btn-texto" data-sel-aula="' + esc(l.id) + '"' + (l.id === E.aulaId ? ' aria-current="true"' : "") + ">" + esc(l.t) + '</button><span class="mini discreto">' + l.q.length + " questões</span></li>").join("") + "</ol>" +
      '<button type="button" class="btn" data-acao="nova-aula">+ Nova aula</button>' +
      (a ? '<div class="editor-bloco secao"><h3>Editando: ' + esc(a.t) + '</h3><div class="grade-3"><label class="campo"><span>Identificador na URL</span><input type="text" id="edAulaId" maxlength="80" value="' + esc(a.id) + '"><small>Letras, números, - e _.</small></label>' +
        '<label class="campo"><span>Título da aula</span><input type="text" id="edAulaT" maxlength="160" value="' + esc(a.t) + '"></label><label class="campo"><span>Duração estimada</span><input type="text" id="edAulaD" maxlength="40" value="' + esc(a.d) + '"></label></div>' +
        '<label class="campo"><span>Mover para o módulo</span><select id="edAulaMod">' + S.mods.map((mm, i) => opt(i, mm.t, i === E.mi)).join("") + "</select></label>" +
        '<label class="campo"><span>Conteúdo (uma linha em branco separa parágrafos)</span><textarea id="edAulaH" rows="10">' + esc(a.h) + "</textarea></label>" +
        '<div class="linha-btns"><button type="button" class="btn btn-tinta" data-acao="salvar-aula">Salvar aula</button><button type="button" class="btn btn-texto" data-acao="aula-subir">↑ Subir</button><button type="button" class="btn btn-texto" data-acao="aula-descer">↓ Descer</button><a class="btn btn-texto" href="#' + encodeURIComponent(a.id) + '">Ver aula</a><button type="button" class="btn btn-perigo" data-acao="apagar-aula">Excluir aula</button></div></div>' : '<p class="discreto">Este módulo ainda não tem aulas.</p>');
  }
  function partesEnunciado(p) {
    const t = document.createElement("template"); t.innerHTML = String(p || "");
    const pre = t.content.querySelector("pre"); const codigo = pre ? pre.textContent : ""; pre?.remove();
    return { texto: t.content.textContent.trim(), codigo };
  }
  function abaQuestoes() {
    const todas = aulas(); if (!todas.length) return '<p class="discreto">Crie uma aula primeiro.</p>';
    const a = acharAula(E.aulaId) || todas[0]; E.aulaId = a.id;
    const q = a.q[E.qi];
    let form = '<p class="discreto">Esta aula ainda não tem questões.</p>';
    if (q) {
      const base = '<label class="campo"><span>Enunciado</span><textarea id="edQP" rows="3">' + esc(ehCodigo(q) ? strip(q.p) : partesEnunciado(q.p).texto) + "</textarea></label>";
      const expl = '<label class="campo"><span>Explicação ou contexto</span><textarea id="edQE" rows="3">' + esc(q.e || "") + "</textarea></label>";
      if (ehCodigo(q)) {
        form = base + '<div class="grade-2"><label class="campo"><span>Linguagem</span><select id="edQLang">' + LINGUAGENS.map((l) => opt(l, l, l === q.language)).join("") + '</select></label><div></div></div>' +
          '<label class="campo"><span>Instruções e requisitos</span><textarea id="edQTask" rows="3">' + esc(q.task || "") + "</textarea></label>" +
          '<div class="grade-2"><label class="campo"><span>Código inicial</span><textarea id="edQStarter" rows="6" class="mono">' + esc(q.starter || "") + '</textarea></label><label class="campo"><span>Solução de referência (usada na correção)</span><textarea id="edQSol" rows="6" class="mono">' + esc(q.solution || "") + "</textarea></label></div>" + expl;
      } else {
        const partes = partesEnunciado(q.p); const lv = String(q.lv || "").replace(/^IA · /, "").split(" · ");
        const nivel = ["Fácil", "Médio", "Difícil"].find((n) => lv.includes(n)) || ""; const tipo = lv.filter((x) => x && x !== nivel).join(" · ");
        form = base + '<label class="campo"><span>Trecho de código (opcional)</span><textarea id="edQCod" rows="3" class="mono">' + esc(partes.codigo) + "</textarea></label>" +
          '<fieldset><legend>Alternativas — marque a correta</legend>' + q.o.map((o, i) => '<div class="op-edit"><input type="radio" name="edQA" value="' + i + '"' + (q.a === i ? " checked" : "") + ' aria-label="Alternativa ' + LETRAS[i] + ' é a correta"><input type="text" id="edQO' + i + '" value="' + esc(o) + '" aria-label="Alternativa ' + LETRAS[i] + '"><span class="letra mono">' + LETRAS[i] + "</span></div>").join("") + "</fieldset>" +
          '<div class="grade-2"><label class="campo"><span>Nível (opcional)</span><select id="edQNivel">' + ["", "Fácil", "Médio", "Difícil"].map((n) => opt(n, n || "Não informado", n === nivel)).join("") + '</select></label><label class="campo"><span>Tipo (opcional)</span><input type="text" id="edQTipo" maxlength="60" placeholder="Conceitual, Código, Cenário…" value="' + esc(tipo) + '"></label></div>' + expl;
      }
      form = '<div class="editor-bloco"><h3>Questão ' + (E.qi + 1) + (ehCodigo(q) ? " · prática de código" : "") + "</h3>" + form +
        '<div class="linha-btns"><button type="button" class="btn btn-tinta" data-acao="salvar-questao">Salvar questão</button><button type="button" class="btn btn-texto" data-acao="q-subir">↑ Subir</button><button type="button" class="btn btn-texto" data-acao="q-descer">↓ Descer</button><button type="button" class="btn btn-perigo" data-acao="apagar-questao">Excluir questão</button></div><p class="mini discreto">Salvar, mover ou excluir uma questão zera o progresso desta aula, porque as respostas antigas deixam de corresponder.</p></div>';
    }
    return '<div class="grade-2"><label class="campo"><span>Aula</span><select data-sel-aula-q>' + S.mods.map((m, mi) => '<optgroup label="' + esc(dois(mi + 1) + " · " + m.t) + '">' + m.l.map((l) => opt(l.id, l.t, l.id === a.id)).join("") + "</optgroup>").join("") + "</select></label>" +
      '<div class="linha-btns alinha-fim"><button type="button" class="btn btn-mini" data-acao="exportar-questoes">Exportar questões da aula</button><label class="btn btn-mini">Importar questões<input type="file" accept=".json,application/json" data-importar-questoes hidden></label></div></div>' +
      '<ol class="lista-edit">' + a.q.map((qq, i) => '<li><span class="num">Q' + (i + 1) + '</span><button type="button" class="btn btn-texto" data-sel-q="' + i + '"' + (i === E.qi ? ' aria-current="true"' : "") + ">" + esc((strip(qq.p) || "Questão sem enunciado").slice(0, 90)) + '</button><span class="mini discreto">' + (ehCodigo(qq) ? qq.language : "múltipla escolha") + "</span></li>").join("") + "</ol>" +
      '<div class="linha-btns secao"><button type="button" class="btn" data-acao="nova-questao">+ Múltipla escolha</button><button type="button" class="btn" data-acao="nova-pratica">+ Prática de código</button></div>' + form;
  }
  const faixa = (cam, rot, min, max, passo = 1, suf = "") => '<label class="campo"><span>' + rot + ' <output class="mono" data-saida-de="' + cam + '">' + pegar(S.ajustes, cam) + suf + '</output></span><input type="range" min="' + min + '" max="' + max + '" step="' + passo + '" value="' + pegar(S.ajustes, cam) + '" data-aj="' + cam + '" data-suf="' + suf + '"></label>';
  const caixaChk = (cam, rot) => '<label class="check"><input type="checkbox" data-aj="' + cam + '"' + (pegar(S.ajustes, cam) ? " checked" : "") + "> " + rot + "</label>";
  const texto = (cam, rot, max, area) => '<label class="campo"><span>' + rot + "</span>" + (area ? '<textarea rows="2" maxlength="' + max + '" data-aj="' + cam + '">' + esc(pegar(S.ajustes, cam)) + "</textarea>" : '<input type="text" maxlength="' + max + '" value="' + esc(pegar(S.ajustes, cam)) + '" data-aj="' + cam + '">') + "</label>";
  const escolha = (cam, rot, mapa) => '<label class="campo"><span>' + rot + '</span><select data-aj="' + cam + '">' + Object.entries(mapa).map(([v, r]) => opt(v, r, pegar(S.ajustes, cam) === v)).join("") + "</select></label>";
  const cor = (cam, rot) => '<label class="cor"><input type="color" value="' + esc(pegar(S.ajustes, cam)) + '" data-aj="' + cam + '"> ' + rot + "</label>";
  const lista = (arr) => Object.fromEntries(arr.map((x) => [x, x]));
  const NOMES_COR = { bg: "Fundo da página", surface: "Superfícies e campos", card: "Folhas e cartões", cardHover: "Cartão em destaque", border: "Bordas e réguas", text: "Texto principal", muted: "Texto secundário" };
  function abaAparencia() {
    const s = S.ajustes;
    return (E.sujo ? '<p class="nota-lateral">Há mudanças de aparência ainda não salvas. Elas somem se você sair do editor sem salvar.</p>' : "") +
      '<details open class="editor-bloco"><summary><strong>Desenho completo</strong></summary><p class="mini discreto">Troca de uma vez fontes, cores, cantos e fundo.</p><div class="amostras">' + Object.entries(DESENHOS).map(([id, d]) => '<button type="button" class="amostra" data-desenho="' + id + '" aria-pressed="' + (s.siteDesign === id) + '"><i style="background:' + d.colors.light.bg + '"></i><i style="background:' + d.colors.primary + '"></i><i style="background:' + d.colors.dark.bg + '"></i><span>' + esc(d.label) + "</span></button>").join("") + "</div></details>" +
      '<details class="editor-bloco"><summary><strong>Paletas prontas (14)</strong></summary><p class="mini discreto">Mudam as cores de destaque e o fundo do tema escuro.</p><div class="amostras">' + Object.entries(PALETAS).map(([id, p]) => '<button type="button" class="amostra" data-paleta="' + id + '"><i style="background:' + p[1] + '"></i><i style="background:' + p[3] + '"></i><i style="background:' + p[4] + '"></i><span>' + esc(p[0]) + "</span></button>").join("") + "</div></details>" +
      '<details class="editor-bloco"><summary><strong>Identidade e fontes</strong></summary><div class="grade-2">' + texto("brand", "Nome do site", 60) + texto("logo", "Ícone ao lado do nome", 8) + texto("homeTitle", "Título da página inicial", 120) + texto("startLabel", "Texto do botão de início", 120) + "</div>" + texto("homeIntro", "Apresentação da página inicial", 300, true) + texto("practiceTitle", "Título da seção de exercícios", 120) +
        '<div class="grade-2">' + escolha("font", "Fonte do texto", lista(FONTES)) + escolha("titleFont", "Fonte dos títulos", lista(FONTES)) + '</div><p class="mini discreto" id="previaFonte">Prévia: <span style="font-family:var(--f-titulo);font-size:1.4rem">Delta Lake guarda o histórico</span> — <span>Aa Bb Cc 123</span></p></details>' +
      '<details class="editor-bloco"><summary><strong>Folhas e layout</strong></summary><div class="grade-2">' + faixa("radius", "Arredondamento", 0, 32, 1, "px") + faixa("textScale", "Tamanho do texto", 85, 120, 1, "%") + faixa("headerBlur", "Desfoque do topo", 0, 40, 1, "px") + faixa("cardOpacity", "Opacidade das folhas (se transparentes)", 50, 100, 1, "%") + "</div>" + caixaChk("transparentCards", "Folhas levemente transparentes") +
        '<div class="grade-2">' + escolha("defaultTheme", "Tema ao abrir o site", { light: "Claro (papel)", dark: "Escuro (lousa)" }) + escolha("navigationMode", "Navegação", { pages: "Páginas separadas", scroll: "Rolagem contínua" }) + "</div></details>" +
      '<details class="editor-bloco"><summary><strong>Cores personalizadas</strong></summary><h3>Marca</h3><div class="cores">' + cor("colors.primary", "Principal") + cor("colors.primaryLight", "Principal clara") + cor("colors.secondary", "Secundária") + cor("colors.success", "Acerto") + cor("colors.danger", "Erro") + "</div>" +
        ["light", "dark"].map((m) => "<h3>" + (m === "light" ? "Tema claro" : "Tema escuro") + '</h3><div class="cores">' + Object.entries(NOMES_COR).map(([k, r]) => cor("colors." + m + "." + k, r)).join("") + "</div>").join("") + "</details>" +
      '<details class="editor-bloco"><summary><strong>Fundo e efeitos</strong></summary><div class="grade-2">' + escolha("backgroundEffect", "Fundo animado", FUNDOS) + "<div></div>" + faixa("backgroundIntensity", "Intensidade", 0, 100, 5, "%") + faixa("backgroundSpeed", "Duração de um ciclo", 8, 60, 2, "s") + "</div>" +
        '<fieldset><legend>Camadas</legend>' + Object.entries(CAMADAS).filter(([k]) => k !== "mouse").map(([k, r]) => caixaChk("effects." + k, r)).join("") + '</fieldset><p class="mini discreto">Em aparelhos modestos, com economia de dados ou com "reduzir movimento" ativo, o fundo fica parado.</p></details>' +
      '<details class="editor-bloco"><summary><strong>Cursor</strong></summary>' + caixaChk("effects.mouse", "Mostrar cursor personalizado (só com mouse)") + '<div class="grade-2">' + escolha("mouseStyle", "Formato", CURSORES) + escolha("mouseEffect", "Luz ambiente", LUZES) + "</div>" + caixaChk("mouseEnlarge", "Usar tamanho ajustável") + faixa("mouseSize", "Tamanho", 16, 96, 2, "px") +
        '<div class="cores">' + cor("mouseColor", "Contorno") + cor("mouseAccent", "Detalhes") + cor("mouseEffectColor", "Luz principal") + cor("mouseEffectAccent", "Luz secundária") + "</div>" + caixaChk("hideNativeCursor", "Esconder o cursor do sistema") + caixaChk("animateCursor", "Cursor segue com suavidade") + "</details>" +
      '<div class="linha-btns"><button type="button" class="btn btn-tinta" data-acao="salvar-aparencia">Salvar personalização</button><button type="button" class="btn" data-acao="descartar-aparencia"' + (E.sujo ? "" : " disabled") + '>Descartar mudanças</button><button type="button" class="btn btn-perigo" data-acao="padrao-aparencia">Restaurar aparência padrão</button></div>';
  }
  function abaIA() {
    return '<p>Ajusta a janela do Datrics, as respostas e o gerador.</p><div class="grade-2">' + faixa("ai.textScale", "Tamanho do texto da IA", 85, 140, 1, "%") + faixa("ai.opacity", "Opacidade da janela", 60, 100, 1, "%") +
      escolha("ai.font", "Fonte da IA", Object.fromEntries(FONTES_IA.map((f) => [f, f === "inherit" ? "Mesma do site" : f]))) + escolha("ai.bubbleStyle", "Estilo das mensagens", BALOES) + "</div>" +
      '<div class="editor-bloco balao-' + S.ajustes.ai.bubbleStyle + '" id="previaIA"><div class="conversa"><div class="msg eu">Explica o Auto Loader em uma frase?</div><div class="msg ia"><span class="autor">Datrics</span>Ele percebe arquivos novos numa pasta da nuvem e ingere só o que chegou, guardando o ponto onde parou num checkpoint.</div></div></div>' +
      '<div class="linha-btns"><button type="button" class="btn btn-tinta" data-acao="salvar-aparencia">Salvar personalização da IA</button><button type="button" class="btn btn-perigo" data-acao="padrao-ia">Restaurar padrão da IA</button></div>';
  }
  function abaBackup() {
    const modoSel = (E.modoSel = E.modoSel || S.modoAtivo || ""); const temaSel = E.temaSel || "";
    return '<section class="editor-bloco"><h3>Modos salvos</h3><p class="mini discreto">Um modo guarda conteúdo, aparência e temas — útil para ter, por exemplo, uma versão "certificação" e outra "básico". Não leva progresso nem chaves de API. Até ' + LIMITE_MODOS + " modos.</p>" +
        '<div class="grade-2"><label class="campo"><span>Seus modos</span><select id="edModo">' + opt("", S.modos.length ? "Escolha um modo" : "Nenhum modo salvo", !modoSel) + S.modos.map((m) => opt(m.id, m.name + (m.id === S.modoAtivo ? " (ativo)" : ""), m.id === modoSel)).join("") + '</select></label><label class="campo"><span>Nome do modo</span><input type="text" id="edModoNome" maxlength="48" placeholder="Ex.: Preparação para certificação"></label></div>' +
        '<div class="linha-btns"><button type="button" class="btn btn-tinta" data-acao="modo-salvar">Salvar modo atual</button><button type="button" class="btn" data-acao="modo-atualizar">Atualizar selecionado</button><button type="button" class="btn" data-acao="modo-ativar">Ativar selecionado</button><button type="button" class="btn" data-acao="modo-exportar">Exportar</button><label class="btn">Importar modo<input type="file" accept=".json,application/json" data-importar-modo hidden></label><button type="button" class="btn btn-perigo" data-acao="modo-apagar">Excluir</button></div></section>' +
      '<section class="editor-bloco"><h3>Temas de aparência</h3><p class="mini discreto">Guarde combinações de cores, fontes e efeitos para alternar depois. Até ' + LIMITE_TEMAS + " temas.</p>" +
        '<div class="grade-2"><label class="campo"><span>Temas salvos</span><select id="edTema">' + opt("", S.temasSalvos.length ? "Escolha um tema" : "Nenhum tema salvo", !temaSel) + S.temasSalvos.map((t) => opt(t.id, t.name, t.id === temaSel)).join("") + '</select></label><label class="campo"><span>Nome do tema</span><input type="text" id="edTemaNome" maxlength="48"></label></div>' +
        '<div class="linha-btns"><button type="button" class="btn btn-tinta" data-acao="tema-salvar">Salvar aparência como tema</button><button type="button" class="btn" data-acao="tema-aplicar">Aplicar</button><button type="button" class="btn" data-acao="tema-atualizar">Atualizar selecionado</button><button type="button" class="btn btn-perigo" data-acao="tema-apagar">Excluir</button></div>' +
        '<div class="editor-bloco tema-importacao"><h4>Importar temas de outro backup</h4><p class="mini discreto">Escolha um backup A ou B e selecione somente os temas que deseja trazer. Seus módulos, aulas, questões, progresso e aparência atual não serão alterados.</p>' +
        '<label class="btn">Escolher backup JSON<input type="file" accept=".json,application/json" data-importar-temas hidden></label>' +
        '<div id="temaImportPreview" aria-live="polite">' + (E.temasImportados.length ? renderizarPreviaTemas() : '<p class="mini discreto">Nenhum arquivo selecionado.</p>') + '</div></div></section>' +
      '<section class="editor-bloco"><h3>Backup completo</h3><p class="mini discreto">Conteúdo, progresso, estatísticas, aparência e temas em um arquivo .json. Chaves de API ficam de fora (elas têm backup criptografado próprio no gerador de questões). Backups da versão anterior da apostila também são aceitos.</p>' +
        '<div class="linha-btns"><button type="button" class="btn btn-tinta" data-acao="backup-baixar">Baixar backup completo</button><label class="btn">Importar arquivo<input type="file" accept=".json,application/json" data-importar-backup hidden></label></div>' +
        '<label class="campo secao"><span>Ou cole o JSON do backup</span><textarea id="edBackupTexto" rows="5" class="mono"></textarea></label><button type="button" class="btn" data-acao="backup-colar">Validar e importar o JSON acima</button></section>' +
      '<section class="editor-bloco"><h3>Recomeçar</h3><div class="linha-btns"><button type="button" class="btn btn-perigo" data-acao="zerar-progresso">Zerar progresso e estatísticas</button><button type="button" class="btn btn-perigo" data-acao="zerar-tudo">Restaurar o site inteiro para o padrão</button></div></section>';
  }
  function tela() {
    garantirSelecao();
    const corpo = { overview: abaVisao, modules: abaModulos, lessons: abaAulas, questions: abaQuestoes, appearance: abaAparencia, ai: abaIA, backup: abaBackup }[E.aba]();
    return '<div class="coluna-larga" id="editorRaiz"><p class="olho">Painel de controle</p><h1>Editor do site</h1><p class="lead">Conteúdo, exercícios, aparência e backups. Fica salvo neste navegador.</p>' +
      '<div class="abas" role="tablist">' + ABAS.map(([id, r]) => '<button type="button" role="tab" aria-selected="' + (E.aba === id) + '" data-aba="' + id + '">' + r + "</button>").join("") + '</div><div role="tabpanel">' + corpo + "</div></div>";
  }
  function redesenhar() {
    const raiz = $("#editorRaiz"); if (!raiz) return;
    const y = scrollY;
    raiz.outerHTML = tela();
    ligar($("#principal")); scrollTo(0, y);
  }

  /* --- ações --- */
  function salvarAula() {
    const a = acharAula(E.aulaId); if (!a) return;
    const id = $("#edAulaId").value.trim(), t = $("#edAulaT").value.trim(), d = $("#edAulaD").value.trim(), h = $("#edAulaH").value, destino = Number($("#edAulaMod").value);
    if (!t) return aviso("Informe o título da aula.", true);
    if (!/^[a-z0-9_-]+$/i.test(id)) return aviso("O identificador aceita só letras, números, - e _.", true);
    if (aulas().some((l) => l.id === id && l !== a)) return aviso("Já existe outra aula com esse identificador.", true);
    if (!S.mods[destino]) return aviso("Módulo de destino inválido.", true);
    mudarConteudo(() => {
      if (id !== a.id) {
        if (S.progresso[a.id]) { S.progresso[id] = S.progresso[a.id]; delete S.progresso[a.id]; }
        if (S.stats[a.id]) { S.stats[id] = S.stats[a.id]; delete S.stats[a.id]; }
      }
      Object.assign(a, { id, t, d, h });
      if (destino !== E.mi) { S.mods[E.mi].l.splice(S.mods[E.mi].l.indexOf(a), 1); S.mods[destino].l.push(a); E.mi = destino; }
      E.aulaId = id;
    }, "Aula salva.");
  }
  function salvarQuestao() {
    const a = acharAula(E.aulaId); const q = a?.q[E.qi]; if (!q) return;
    const p = $("#edQP").value.trim(); const e = $("#edQE").value.trim();
    if (!p) return aviso("Escreva o enunciado.", true);
    let nova;
    if (ehCodigo(q)) {
      const sol = $("#edQSol").value; if (!sol.trim()) return aviso("A solução de referência é obrigatória.", true);
      const language = $("#edQLang").value;
      nova = { mode: "code", p: esc(p), task: $("#edQTask").value, language, starter: $("#edQStarter").value, solution: sol, e, lv: "Prática de código · " + language };
    } else {
      const o = [0, 1, 2, 3].map((i) => $("#edQO" + i).value.trim());
      if (o.some((x) => !x)) return aviso("Preencha as quatro alternativas.", true);
      if (new Set(o).size < 4) return aviso("As alternativas precisam ser diferentes entre si.", true);
      const marcada = $('input[name="edQA"]:checked'); const cod = $("#edQCod").value;
      const prefixo = /^IA · /.test(q.lv || "") ? "IA · " : "";
      const lv = [$("#edQNivel").value, $("#edQTipo").value.trim().slice(0, 60)].filter(Boolean).join(" · ");
      nova = { p: esc(p) + (cod.trim() ? "<pre><code>" + esc(cod) + "</code></pre>" : ""), o, a: Number(marcada ? marcada.value : 0), e };
      if (lv || prefixo) nova.lv = prefixo + lv || undefined;
    }
    mudarConteudo(() => { a.q[E.qi] = nova; delete S.progresso[a.id]; if (S.stats[a.id]) delete S.stats[a.id][E.qi]; }, "Questão salva.");
  }
  function exportarQuestoes() {
    const a = acharAula(E.aulaId); if (!a) return;
    baixar("questoes-" + (a.id || "aula") + ".json", JSON.stringify({ format: "databricks-questions", version: 1, exportedAt: new Date().toISOString(), lesson: { id: a.id, title: a.t }, questions: a.q }, null, 2));
  }
  async function importarQuestoes(file) {
    const a = acharAula(E.aulaId); if (!a) return aviso("Escolha uma aula.", true);
    try {
      const d = JSON.parse(await lerArquivo(file));
      if (d.format !== "databricks-questions" || d.version !== 1 || !Array.isArray(d.questions)) throw new Error("Arquivo de questões inválido.");
      const qs = d.questions.map((q) => {
        if (ehCodigo(q)) {
          if (typeof q.p !== "string" || !LINGUAGENS.includes(q.language) || !String(q.solution || "").trim()) throw new Error("Há uma prática de código incompleta no arquivo.");
          return { mode: "code", p: q.p, task: String(q.task || ""), language: q.language, starter: String(q.starter || ""), solution: String(q.solution), e: String(q.e || ""), lv: "Prática de código · " + q.language };
        }
        if (typeof q.p !== "string" || !Array.isArray(q.o) || q.o.length !== 4 || !Number.isInteger(q.a) || q.a < 0 || q.a > 3) throw new Error("Há uma questão de múltipla escolha inválida no arquivo.");
        const n = { p: q.p, o: q.o.map(String), a: q.a, e: String(q.e || "") }; if (typeof q.lv === "string") n.lv = q.lv; return n;
      });
      if (!confirm("Substituir as " + a.q.length + " questões de \"" + a.t + "\" pelas " + qs.length + " do arquivo?")) return;
      mudarConteudo(() => { a.q = qs; delete S.progresso[a.id]; delete S.stats[a.id]; E.qi = 0; }, qs.length + " questões importadas.");
    } catch (err) { aviso(err.message.startsWith("Unexpected") ? "O arquivo não é um JSON válido." : err.message, true); }
  }

  /* Modos, temas e backup */
  const fotoAtual = () => ({ modules: clone(S.mods), settings: clone(S.ajustes), currentTheme: S.tema === "escuro" ? "dark" : "light", themes: clone(S.temasSalvos) });
  const normTema = (t) => isObj(t) && typeof t.name === "string" && t.name.trim() && isObj(t.settings) ? { id: typeof t.id === "string" ? t.id : idLocal("tema"), name: t.name.trim().slice(0, 48), settings: normalizarAjustes(t.settings), currentTheme: t.currentTheme === "dark" ? "dark" : "light" } : null;
  const normModo = (m) => isObj(m) && typeof m.name === "string" && m.name.trim() && conteudoValido(m.modules) ? { id: typeof m.id === "string" ? m.id : idLocal("modo"), name: m.name.trim().slice(0, 48), createdAt: m.createdAt || new Date().toISOString(), modules: m.modules, settings: normalizarAjustes(m.settings), currentTheme: m.currentTheme === "dark" ? "dark" : "light", themes: (Array.isArray(m.themes) ? m.themes : []).map(normTema).filter(Boolean).slice(0, LIMITE_TEMAS) } : null;
  const gravarModos = () => armazem.gravar(K.modos, S.modos) || aviso("Não foi possível salvar os modos (armazenamento cheio?).", true);
  const gravarTemas = () => armazem.gravar(K.temasSalvos, S.temasSalvos) || aviso("Não foi possível salvar os temas.", true);
  const mesmaQuestao = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  /* Ao trocar de conteúdo, mantém progresso só onde a aula e a questão são idênticas. */
  function progressoCompativel(novos) {
    const antigos = new Map(aulas().map((l) => [l.id, l])); const p = {}, s = {};
    novos.flatMap((m) => m.l).forEach((l) => {
      const v = antigos.get(l.id); if (!v) return;
      l.q.forEach((q, i) => {
        if (!v.q[i] || !mesmaQuestao(q, v.q[i])) return;
        if ((S.progresso[l.id] || []).includes(i)) (p[l.id] = p[l.id] || []).push(i);
        if (S.stats[l.id]?.[i]) (s[l.id] = s[l.id] || {})[i] = S.stats[l.id][i];
      });
    });
    return [p, s];
  }
  function aplicarFoto(f, ativo) {
    const antes = { mods: S.mods, ajustes: S.ajustes, tema: S.tema, temas: S.temasSalvos, p: S.progresso, s: S.stats };
    const [p, s] = progressoCompativel(f.modules);
    S.mods = clone(f.modules); S.ajustes = normalizarAjustes(f.settings); S.tema = f.currentTheme === "dark" ? "escuro" : "claro"; S.temasSalvos = f.themes || []; S.progresso = p; S.stats = s;
    const ok = gravarJuntos([[K.conteudo, S.mods], [K.ajustes, S.ajustes], [K.tema, f.currentTheme], [K.temasSalvos, S.temasSalvos], [K.progresso, p], [K.stats, s], [K.modoAtivo, ativo || undefined]]);
    if (!ok) { Object.assign(S, { mods: antes.mods, ajustes: antes.ajustes, tema: antes.tema, temasSalvos: antes.temas, progresso: antes.p, stats: antes.s }); return aviso("Não foi possível ativar: o navegador recusou salvar.", true); }
    S.modoAtivo = ativo || ""; E.sujo = false; aplicarAjustes(); desenharTema(); return true;
  }
  function acaoModo(acao) {
    const sel = $("#edModo").value; const nome = $("#edModoNome").value.trim().slice(0, 48); const m = S.modos.find((x) => x.id === sel);
    if (acao === "modo-salvar") {
      if (!nome) return aviso("Dê um nome ao modo.", true);
      if (S.modos.length >= LIMITE_MODOS) return aviso("Limite de " + LIMITE_MODOS + " modos atingido. Exclua um antes.", true);
      const novo = Object.assign({ id: idLocal("modo"), name: nome, createdAt: new Date().toISOString() }, fotoAtual());
      S.modos.push(novo); if (gravarModos()) { S.modoAtivo = novo.id; armazem.gravar(K.modoAtivo, novo.id); E.modoSel = novo.id; aviso("Modo \"" + nome + "\" salvo."); }
    } else if (!m) return aviso("Selecione um modo.", true);
    else if (acao === "modo-atualizar") { Object.assign(m, fotoAtual(), { name: nome || m.name }); if (gravarModos()) aviso("Modo atualizado."); }
    else if (acao === "modo-ativar") { if (confirm("Ativar \"" + m.name + "\"? O conteúdo e a aparência atuais serão substituídos (salve-os como modo antes, se quiser).") && aplicarFoto(m, m.id)) aviso("Modo \"" + m.name + "\" ativo."); }
    else if (acao === "modo-exportar") baixar((m.name.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "modo-databricks") + ".json", JSON.stringify({ format: "databricks-site-mode", version: 1, exportedAt: new Date().toISOString(), name: m.name, modules: m.modules, settings: m.settings, currentTheme: m.currentTheme, themes: m.themes }, null, 2));
    else if (acao === "modo-apagar") { if (!confirm("Excluir o modo \"" + m.name + "\"? O site aberto agora não muda.")) return; S.modos = S.modos.filter((x) => x !== m); if (S.modoAtivo === m.id) { S.modoAtivo = ""; armazem.apagar(K.modoAtivo); } gravarModos(); E.modoSel = ""; aviso("Modo excluído."); }
    redesenhar();
  }
  async function importarModo(file) {
    try {
      const d = JSON.parse(await lerArquivo(file));
      if (!["databricks-site-mode", "apostila-databricks-backup"].includes(d.format) || d.version !== 1) throw new Error("Arquivo de modo inválido.");
      if (S.modos.length >= LIMITE_MODOS) throw new Error("Limite de " + LIMITE_MODOS + " modos atingido.");
      const m = normModo(Object.assign({}, d, { id: idLocal("modo"), createdAt: new Date().toISOString(), name: d.name || "Modo importado" }));
      if (!m) throw new Error("O modo importado tem conteúdo inválido.");
      let base = m.name, n = 2; while (S.modos.some((x) => x.name === m.name)) m.name = (base.slice(0, 44) + " " + n++).slice(0, 48);
      S.modos.push(m); if (gravarModos()) aviso("Modo \"" + m.name + "\" importado. Ative-o quando quiser."); E.modoSel = m.id; redesenhar();
    } catch (err) { aviso(/JSON/.test(err.message) ? "O arquivo não é um JSON válido." : err.message, true); }
  }
  function renderizarPreviaTemas() {
    const lista = E.temasImportados || [];
    if (!lista.length) return '<p class="mini discreto">Nenhum tema encontrado nesse arquivo.</p>';
    const duplicados = lista.filter((x) => S.temasSalvos.some((t) => t.name.toLowerCase() === x.name.toLowerCase())).length;
    return '<div class="tema-import-lista"><p class="mini">' + lista.length + ' tema(s) encontrado(s). Marque os que deseja importar' + (duplicados ? ' · ' + duplicados + ' com nome já existente' : '') + '.</p>' +
      lista.map((t, i) => '<label class="tema-import-item"><input type="checkbox" data-tema-import-index="' + i + '" checked><span><strong>' + esc(t.name) + '</strong><small>' + (t.currentTheme === 'dark' ? 'Tema escuro' : 'Tema claro') + '</small></span></label>').join('') +
      '<div class="linha-btns"><button type="button" class="btn btn-tinta" data-acao="tema-importar-selecionados">Importar temas selecionados</button><button type="button" class="btn" data-acao="tema-importar-cancelar">Cancelar</button></div></div>';
  }
  async function prepararImportacaoTemas(file) {
    if (!file) return;
    try {
      const d = JSON.parse(await lerArquivo(file));
      let lista = Array.isArray(d) ? d : (d && Array.isArray(d.themes) ? d.themes : null);
      const formatos = ['apostila-databricks-backup', 'databricks-site-mode'];
      if (!lista || (!Array.isArray(d) && (!formatos.includes(d.format) || d.version !== 1))) throw new Error('Selecione um backup completo ou arquivo de modo compatível (.json).');
      const validos = lista.map(normTema).filter(Boolean);
      if (!validos.length) throw new Error('Esse arquivo não contém temas válidos.');
      if (validos.length > 100) throw new Error('O arquivo contém temas demais para importar de uma vez (máximo: 100).');
      E.temasImportados = validos;
      const preview = $('#temaImportPreview'); if (preview) preview.innerHTML = renderizarPreviaTemas();
      aviso(validos.length + ' tema(s) encontrado(s). Selecione os que deseja importar.');
    } catch (err) { E.temasImportados = []; const preview = $('#temaImportPreview'); if (preview) preview.innerHTML = '<p class="mini discreto">Nenhum arquivo selecionado.</p>'; aviso(err.message || 'Não foi possível ler o arquivo.', true); }
  }
  function importarTemasSelecionados() {
    const marcados = $$('[data-tema-import-index]:checked').map((el) => E.temasImportados[Number(el.dataset.temaImportIndex)]).filter(Boolean);
    if (!marcados.length) return aviso('Marque pelo menos um tema para importar.', true);
    const espaco = LIMITE_TEMAS - S.temasSalvos.length;
    if (espaco <= 0) return aviso('Você já atingiu o limite de ' + LIMITE_TEMAS + ' temas salvos.', true);
    const antes = clone(S.temasSalvos); let adicionados = 0, ignorados = 0;
    for (const original of marcados) {
      const tema = normTema(original); if (!tema) { ignorados++; continue; }
      const existeIgual = S.temasSalvos.some((x) => x.currentTheme === tema.currentTheme && JSON.stringify(x.settings) === JSON.stringify(tema.settings));
      if (existeIgual) { ignorados++; continue; }
      if (S.temasSalvos.length >= LIMITE_TEMAS) break;
      tema.id = idLocal('tema');
      const base = tema.name; let nome = base, n = 2;
      while (S.temasSalvos.some((x) => x.name.toLowerCase() === nome.toLowerCase())) nome = (base.slice(0, 43) + ' ' + n++).slice(0, 48);
      tema.name = nome; S.temasSalvos.push(tema); adicionados++;
    }
    if (!adicionados) return aviso('Nenhum tema novo foi adicionado: os selecionados já existem ou são iguais aos salvos.', true);
    if (!gravarTemas()) { S.temasSalvos = antes; return aviso('Não foi possível salvar os temas. Libere espaço no armazenamento e tente novamente.', true); }
    E.temasImportados = []; E.temaSel = '';
    aviso(adicionados + ' tema(s) importado(s)' + (ignorados ? ' · ' + ignorados + ' duplicado(s) ignorado(s)' : '') + '. Seu conteúdo e progresso foram preservados.');
    redesenhar();
  }
  function acaoTema(acao) {
    const sel = $("#edTema").value; const nome = $("#edTemaNome").value.trim().slice(0, 48); const t = S.temasSalvos.find((x) => x.id === sel);
    if (acao === "tema-salvar") {
      if (!nome) return aviso("Dê um nome ao tema.", true);
      if (S.temasSalvos.length >= LIMITE_TEMAS) return aviso("Limite de " + LIMITE_TEMAS + " temas atingido.", true);
      const novo = { id: idLocal("tema"), name: nome, settings: clone(normalizarAjustes(S.ajustes)), currentTheme: S.tema === "escuro" ? "dark" : "light" };
      S.temasSalvos.push(novo); if (gravarTemas()) { E.temaSel = novo.id; aviso("Tema salvo."); }
    } else if (!t) return aviso("Selecione um tema.", true);
    else if (acao === "tema-aplicar") { S.ajustes = normalizarAjustes(t.settings); S.tema = t.currentTheme === "dark" ? "escuro" : "claro"; E.sujo = false; if (salvarAjustes("Tema \"" + t.name + "\" aplicado.")) desenharTema(); }
    else if (acao === "tema-atualizar") { Object.assign(t, { name: nome || t.name, settings: clone(normalizarAjustes(S.ajustes)), currentTheme: S.tema === "escuro" ? "dark" : "light" }); if (gravarTemas()) aviso("Tema atualizado."); }
    else if (acao === "tema-apagar") { if (!confirm("Excluir o tema \"" + t.name + "\"?")) return; S.temasSalvos = S.temasSalvos.filter((x) => x !== t); gravarTemas(); E.temaSel = ""; }
    redesenhar();
  }
  function baixarBackup() {
    baixar("backup-apostila-databricks-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify({ format: "apostila-databricks-backup", version: 1, exportedAt: new Date().toISOString(), modules: S.mods, progress: S.progresso, answerStats: S.stats, settings: S.ajustes, currentTheme: S.tema === "escuro" ? "dark" : "light", themes: S.temasSalvos }, null, 2));
  }
  function importarBackup(textoJson) {
    let d; try { d = JSON.parse(textoJson); } catch (e) { return aviso("O conteúdo não é um JSON válido.", true); }
    if (!isObj(d) || d.format !== "apostila-databricks-backup" || d.version !== 1 || !conteudoValido(d.modules)) return aviso("Este não é um backup válido da apostila.", true);
    if (d.themes != null && (!Array.isArray(d.themes) || d.themes.length > LIMITE_TEMAS)) return aviso("A lista de temas do backup é inválida.", true);
    if (!confirm("Importar este backup? Conteúdo, progresso, aparência e temas atuais serão substituídos.")) return;
    const antes = { mods: S.mods, p: S.progresso, s: S.stats, aj: S.ajustes, tema: S.tema, temas: S.temasSalvos };
    S.mods = d.modules; S.progresso = normalizarProgresso(d.progress); S.stats = normalizarStats(d.answerStats); S.ajustes = normalizarAjustes(d.settings);
    S.tema = (d.currentTheme || S.ajustes.defaultTheme) === "dark" ? "escuro" : "claro"; S.temasSalvos = (d.themes || []).map(normTema).filter(Boolean);
    const ok = gravarJuntos([[K.conteudo, S.mods], [K.progresso, S.progresso], [K.stats, S.stats], [K.ajustes, S.ajustes], [K.tema, S.tema === "escuro" ? "dark" : "light"], [K.temasSalvos, S.temasSalvos], [K.modoAtivo, undefined]]);
    if (!ok) { Object.assign(S, { mods: antes.mods, progresso: antes.p, stats: antes.s, ajustes: antes.aj, tema: antes.tema, temasSalvos: antes.temas }); return aviso("Não foi possível importar: o navegador recusou salvar.", true); }
    S.modoAtivo = ""; E.sujo = false; E.modoSel = E.temaSel = ""; aplicarAjustes(); desenharTema(); aviso("Backup importado."); redesenhar();
  }

  /* --- ligação de eventos --- */
  function ligar(main) {
    const raiz = $("#editorRaiz", main); if (!raiz) return;
    if (E.aba === "appearance" || E.aba === "ai") carregarTodasFontes();
    raiz.onclick = (e) => {
      const t = e.target.closest("button, [data-sel-aula], [data-sel-q]"); if (!t) return;
      const d = t.dataset;
      if (d.aba) { E.aba = d.aba; return redesenhar(); }
      if (d.irAba) { E.aba = d.irAba; return redesenhar(); }
      if (d.selAula) { E.aulaId = d.selAula; return redesenhar(); }
      if (d.selQ != null) { E.qi = Number(d.selQ); return redesenhar(); }
      if (d.modMover) { const [i, dir] = d.modMover.split(":").map(Number); return mudarConteudo(() => { mover(S.mods, i, dir); if (E.mi === i) E.mi = i + dir; }); }
      if (d.modApagar != null) { const m = S.mods[+d.modApagar]; if (confirm("Excluir \"" + m.t + "\" e suas " + m.l.length + " aulas?")) mudarConteudo(() => { m.l.forEach((l) => { delete S.progresso[l.id]; delete S.stats[l.id]; }); S.mods.splice(+d.modApagar, 1); }, "Módulo excluído."); return; }
      if (d.desenho) { aplicarDesenho(S.ajustes, d.desenho); E.sujo = true; aplicarAjustes(); return redesenhar(); }
      if (d.paleta) { aplicarPaleta(S.ajustes, d.paleta); E.sujo = true; aplicarAjustes(); return redesenhar(); }
      const a = acharAula(E.aulaId);
      switch (d.acao) {
        case "novo-modulo": return mudarConteudo(() => { S.mods.push({ t: "Novo módulo", l: [] }); E.mi = S.mods.length - 1; E.aba = "modules"; }, "Módulo criado.");
        case "nova-aula": return mudarConteudo(() => { const l = { id: idUnico("Nova aula"), t: "Nova aula", d: "5 min", h: "", q: [] }; S.mods[E.mi].l.push(l); E.aulaId = l.id; }, "Aula criada.");
        case "salvar-aula": return salvarAula();
        case "aula-subir": case "aula-descer": { const arr = S.mods[E.mi].l; return mudarConteudo(() => mover(arr, arr.indexOf(a), d.acao === "aula-subir" ? -1 : 1)); }
        case "apagar-aula": if (a && confirm("Excluir a aula \"" + a.t + "\" e suas " + a.q.length + " questões?")) mudarConteudo(() => { S.mods[E.mi].l.splice(S.mods[E.mi].l.indexOf(a), 1); delete S.progresso[a.id]; delete S.stats[a.id]; E.aulaId = ""; }, "Aula excluída."); return;
        case "nova-questao": return a && mudarConteudo(() => { a.q.push({ p: "Nova questão", o: ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"], a: 0, e: "" }); E.qi = a.q.length - 1; }, "Questão criada. Edite o texto abaixo.");
        case "nova-pratica": return a && mudarConteudo(() => { a.q.push({ mode: "code", p: "Nova prática de código", task: "", language: "Python", starter: "", solution: "print('ok')", e: "", lv: "Prática de código · Python" }); E.qi = a.q.length - 1; }, "Prática criada. Edite abaixo.");
        case "salvar-questao": return salvarQuestao();
        case "q-subir": case "q-descer": return a && mudarConteudo(() => { if (mover(a.q, E.qi, d.acao === "q-subir" ? -1 : 1)) { E.qi += d.acao === "q-subir" ? -1 : 1; delete S.progresso[a.id]; delete S.stats[a.id]; } });
        case "apagar-questao": if (a && confirm("Excluir esta questão?")) mudarConteudo(() => { a.q.splice(E.qi, 1); delete S.progresso[a.id]; delete S.stats[a.id]; E.qi = Math.max(0, E.qi - 1); }, "Questão excluída."); return;
        case "exportar-questoes": return exportarQuestoes();
        case "salvar-aparencia": if (salvarAjustes("Personalização salva.")) { E.sujo = false; redesenhar(); } return;
        case "descartar-aparencia": S.ajustes = normalizarAjustes(armazem.ler(K.ajustes, null)); E.sujo = false; aplicarAjustes(); return redesenhar();
        case "padrao-aparencia": if (confirm("Voltar toda a aparência (inclusive textos da página inicial) ao padrão?")) { const ia = S.ajustes.ai; S.ajustes = normalizarAjustes(null); S.ajustes.ai = ia; E.sujo = false; salvarAjustes("Aparência restaurada."); redesenhar(); } return;
        case "padrao-ia": if (confirm("Restaurar o visual padrão do Datrics?")) { S.ajustes.ai = clone(AJUSTES_PADRAO.ai); salvarAjustes("Datrics restaurado."); redesenhar(); } return;
        case "modo-salvar": case "modo-atualizar": case "modo-ativar": case "modo-exportar": case "modo-apagar": return acaoModo(d.acao);
        case "tema-salvar": case "tema-aplicar": case "tema-atualizar": case "tema-apagar": return acaoTema(d.acao);
        case "tema-importar-selecionados": return importarTemasSelecionados();
        case "tema-importar-cancelar": E.temasImportados = []; return redesenhar();
        case "backup-baixar": return baixarBackup();
        case "backup-colar": return importarBackup($("#edBackupTexto").value);
        case "zerar-progresso": if (confirm("Apagar todo o progresso e as estatísticas? O conteúdo fica.")) { S.progresso = {}; S.stats = {}; armazem.apagar(K.progresso); armazem.apagar(K.stats); aviso("Progresso zerado."); } return;
        case "zerar-tudo": if (confirm("Restaurar o site inteiro? Módulos, questões, progresso, aparência, temas e modos salvos serão apagados.")) {
          [K.conteudo, K.ajustes, K.progresso, K.stats, K.tema, K.modos, K.modoAtivo, K.temasSalvos].forEach(armazem.apagar);
          Object.assign(S, { mods: clone(CONTEUDO_PADRAO), ajustes: normalizarAjustes(null), progresso: {}, stats: {}, modos: [], temasSalvos: [], modoAtivo: "" });
          S.tema = S.ajustes.defaultTheme === "dark" ? "escuro" : "claro"; E.sujo = false; Object.assign(E, { mi: 0, aulaId: "", qi: 0, aba: "overview" });
          aplicarAjustes(); desenharTema(); aviso("Site restaurado ao padrão."); redesenhar();
        } return;
      }
    };
    raiz.oninput = (e) => {
      const el = e.target; const cam = el.dataset.aj; if (!cam) return;
      const v = el.type === "checkbox" ? el.checked : el.type === "range" ? Number(el.value) : el.value;
      definir(S.ajustes, cam, v);
      const out = $('[data-saida-de="' + cam + '"]', raiz); if (out) out.textContent = v + (el.dataset.suf || "");
      if (cam === "font" || cam === "titleFont") carregarFonte(v);
      if (cam === "ai.bubbleStyle") $("#previaIA").className = "editor-bloco balao-" + v;
      E.sujo = true; aplicarAjustes();
      const desc = $('[data-acao="descartar-aparencia"]', raiz); if (desc) desc.disabled = false;
    };
    raiz.onchange = (e) => {
      const el = e.target;
      if (el.dataset.modTitulo != null) { const t = el.value.trim(); if (!t) { el.value = S.mods[+el.dataset.modTitulo].t; return aviso("Informe um nome para o módulo.", true); } return mudarConteudo(() => { S.mods[+el.dataset.modTitulo].t = t; }, "Módulo renomeado."); }
      if (el.matches("[data-sel-modulo]")) { E.mi = Number(el.value); E.aulaId = ""; E.qi = 0; return redesenhar(); }
      if (el.matches("[data-sel-aula-q]")) { E.aulaId = el.value; E.mi = indiceModulo(acharAula(el.value)); E.qi = 0; return redesenhar(); }
      if (el.matches("[data-importar-questoes]")) return importarQuestoes(el.files[0]);
      if (el.matches("[data-importar-modo]")) return importarModo(el.files[0]);
      if (el.matches("[data-importar-backup]")) { lerArquivo(el.files[0]).then((t) => { $("#edBackupTexto").value = t; importarBackup(t); }, (err) => aviso(err.message, true)); return; }
      if (el.matches("[data-importar-temas]")) { prepararImportacaoTemas(el.files[0]); el.value = ""; return; }
      if (el.id === "edModo") E.modoSel = el.value;
      if (el.id === "edTema") E.temaSel = el.value;
    };
    /* Arrastar para reordenar módulos e aulas. */
    $$("[data-arrastar] li", raiz).forEach((li) => {
      li.ondragstart = (e) => { li.classList.add("arrastando"); e.dataTransfer.setData("text/plain", li.dataset.i); e.dataTransfer.effectAllowed = "move"; };
      li.ondragend = () => li.classList.remove("arrastando");
      li.ondragover = (e) => { e.preventDefault(); li.classList.add("alvo"); };
      li.ondragleave = () => li.classList.remove("alvo");
      li.ondrop = (e) => {
        e.preventDefault(); li.classList.remove("alvo");
        const de = Number(e.dataTransfer.getData("text/plain")), para = Number(li.dataset.i); if (de === para || Number.isNaN(de)) return;
        const arr = li.parentElement.dataset.arrastar === "modulo" ? S.mods : S.mods[E.mi].l;
        mudarConteudo(() => { arr.splice(para, 0, arr.splice(de, 1)[0]); if (arr === S.mods && E.mi === de) E.mi = para; }, "Ordem atualizada.");
      };
    });
  }
  /* Sair do editor com aparência não salva devolve o visual salvo. */
  function aoSair() {
    if (!E.sujo) return;
    S.ajustes = normalizarAjustes(armazem.ler(K.ajustes, null)); E.sujo = false; aplicarAjustes();
    aviso("Mudanças de aparência não salvas foram descartadas.");
  }
  return { tela, ligar, aoSair, estado: E };
})();

/* ---------- 21. Menus do topo ---------- */
function menuPop(botao, itens) {
  const existente = document.getElementById("menuIAFlutuante");
  if (existente) { existente.remove(); $$('[data-abrir-ia]').forEach((b) => b.setAttribute("aria-expanded", "false")); return; }
  const m = document.createElement("div"); m.id = "menuIAFlutuante"; m.className = "menu-pop menu-pop-portal"; m.setAttribute("role", "menu");
  m.innerHTML = itens.map((it, i) => '<button type="button" role="menuitem" data-item="' + i + '">' + esc(it.texto) + (it.dica ? "<small>" + esc(it.dica) + "</small>" : "") + "</button>").join("");
  document.body.appendChild(m);
  const posicionar = () => {
    const r = botao.getBoundingClientRect(), w = Math.max(220, m.offsetWidth || 220);
    const left = Math.max(8, Math.min(r.left, innerWidth - w - 8));
    m.style.left = left + "px"; m.style.top = Math.min(innerHeight - m.offsetHeight - 8, r.bottom + 7) + "px";
  };
  $$('[data-abrir-ia]').forEach((b) => b.setAttribute("aria-expanded", String(b === botao)));
  posicionar(); m.querySelector("button")?.focus();
  const fechar = (e) => {
    if (e && (m.contains(e.target) || e.target === botao || botao.contains(e.target))) return;
    m.remove(); $$('[data-abrir-ia]').forEach((b) => b.setAttribute("aria-expanded", "false"));
    document.removeEventListener("click", fechar, true); document.removeEventListener("keydown", tecla);
    removeEventListener("resize", posicionar); removeEventListener("scroll", posicionar, true);
  };
  const tecla = (e) => { if (e.key === "Escape") { fechar(); botao.focus(); } };
  m.onclick = (e) => { const b = e.target.closest("[data-item]"); if (b) { const acao = itens[+b.dataset.item].acao; fechar(); acao(); } };
  setTimeout(() => { document.addEventListener("click", fechar, true); document.addEventListener("keydown", tecla); addEventListener("resize", posicionar); addEventListener("scroll", posicionar, true); });
}

const itensIA = () => [
  { texto: "Tirar uma dúvida", dica: "Abre o Datrics com o contexto desta tela", acao: () => App.ia?.abrirChat() },
  { texto: "Criar questões", dica: "Gerador, chaves de API e backup criptografado", acao: () => App.ia?.abrirGerador() },
  { texto: "Guia de configuração", dica: "Como conseguir chaves gratuitas", acao: () => { location.hash = "#ia-study"; } },
  { texto: "Avisos recentes", dica: "Registro do que aconteceu no site", acao: abrirLogs }
];

/* ---------- 22. Inicialização ---------- */
function iniciar() {
  carregarConteudo();
  S.progresso = normalizarProgresso(armazem.ler(K.progresso, {}));
  S.stats = normalizarStats(armazem.ler(K.stats, {}));
  const r = armazem.ler(K.rascunhos, {}); S.rascunhos = isObj(r) ? r : {};
  S.ajustes = normalizarAjustes(armazem.ler(K.ajustes, null));
  const tema = armazem.bruto(K.tema);
  S.tema = (tema === "dark" || tema === "light" ? tema : S.ajustes.defaultTheme) === "dark" ? "escuro" : "claro";
  carregarMarcas(); carregarPerfil();
  S.nivel = NIVEIS[armazem.bruto(K.nivel)] ? armazem.bruto(K.nivel) : "pleno";
  const modos = armazem.ler(K.modos, []); S.modos = Array.isArray(modos) ? modos.filter((m) => isObj(m) && typeof m.id === "string" && conteudoValido(m.modules)).slice(0, LIMITE_MODOS) : [];
  const temas = armazem.ler(K.temasSalvos, []); S.temasSalvos = Array.isArray(temas) ? temas.filter((t) => isObj(t) && typeof t.name === "string" && isObj(t.settings)).slice(0, LIMITE_TEMAS) : [];
  S.modoAtivo = armazem.bruto(K.modoAtivo) || "";

  efeitos.iniciar();
  aplicarAjustes(); desenharTema(); desenharPerfil();
  $$("#nivel button").forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.nivel === S.nivel)); b.title = "Nível das explicações: " + NIVEIS[b.dataset.nivel][0]; b.onclick = () => definirNivel(b.dataset.nivel); });
  $("#temaBtn").onclick = alternarTema;
  $("#perfilBtn").onclick = abrirPerfil;
  $("#logsBtn").onclick = abrirLogs;
  $("#alternarModo").onclick = alternarModo;
  $$("[data-abrir-aulas]").forEach((b) => b.onclick = abrirGavetaAulas);
  $$("[data-abrir-ia]").forEach((b) => b.onclick = () => menuPop(b, itensIA()));

  App.ia?.iniciar?.();
  addEventListener("hashchange", render);
  render();
}

Object.assign(App, {
  $, $$, esc, md, clone, isObj, slug, clamp, strip, baixar, lerArquivo, carregarScript, aviso, dialogo, armazem, K, S, ICONE, LETRAS,
  aulas, acharAula, indiceModulo, conteudoValido, questaoValida, salvarConteudo, htmlSeguro, ehCodigo,
  instrucaoNivel, nivelAtual, normalizarAjustes, aplicarAjustes, salvarAjustes, aplicarPaleta, aplicarDesenho, desenharTema,
  PALETAS, DESENHOS, FUNDOS, CURSORES, LUZES, FONTES, CAMADAS, render, desenharIndice, normalizarMapa, limpar,
  aulaAtual: () => acharAula(S.rota),
  idAulaUnico(titulo) { const base = slug(titulo) || "aula"; let id = base, n = 2; while (acharAula(id)) id = base + "-" + n++; return id; },
  testes: { estatisticas, normalizarAjustes, conteudoValido, layoutMapa, quebrar, faixaCalor, matrizSkills, normalizarProgresso, normalizarStats, textoSeguro }
});
document.addEventListener("DOMContentLoaded", iniciar);
})();
