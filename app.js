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
  marcas: "dbAcademyLearningMarksV1", nivel: "dbAcademyLearningLevelV1", mapa: "dbAcademyMindmapLastV1", mapaChat: "dbAcademyMindmapChatV1", feynman: "dbAcademyFeynmanHistoryV1", leve: "apostilaLite", curriculo: "apostilaDatabricksCurriculumVersion"
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
  {
    "t": "Fundamentos do Databricks",
    "l": [
      {
        "id": "lakehouse",
        "t": "O que é o Lakehouse",
        "d": "12 min",
        "h": "## O que é uma arquitetura Lakehouse\n\nLakehouse é uma arquitetura que combina a flexibilidade e o custo eficiente de um data lake com recursos de gestão, confiabilidade e desempenho associados a um data warehouse. A proposta é trabalhar com diferentes tipos de dados e cargas de trabalho sobre uma base de armazenamento aberta, sem criar cópias desnecessárias para cada ferramenta.\n\nNo Databricks, tabelas Delta são frequentemente usadas como camada confiável para dados armazenados em object storage na nuvem. O formato Delta acrescenta um log transacional, controle de versões e validações ao armazenamento em arquivos Parquet.\n\n## Por que usar Lakehouse\n\n- **Dados diversos:** permite trabalhar com dados estruturados, semiestruturados e não estruturados.\n- **Separação de responsabilidades:** armazenamento e compute podem escalar de forma independente.\n- **Governança:** políticas de acesso e descoberta podem ser aplicadas de forma centralizada.\n- **Múltiplas cargas:** engenharia, BI, analytics e machine learning podem compartilhar dados governados.\n\n## Data lake, data warehouse e Lakehouse\n\nUm data lake costuma priorizar flexibilidade e armazenamento de baixo custo, mas pode exigir mais trabalho para garantir qualidade e consistência. Um data warehouse tradicional prioriza dados estruturados, modelagem e consultas analíticas. O Lakehouse procura aproximar esses benefícios, mantendo formatos abertos e processamento distribuído.\n\n## Exemplo de fluxo\n\nUma equipe pode receber arquivos brutos de vendas, validar os registros, padronizar colunas e publicar tabelas prontas para análise. O mesmo conjunto governado pode alimentar dashboards e modelos analíticos.\n\n```python\n# Exemplo ilustrativo de leitura de uma tabela Delta\ndf = spark.read.format(\"delta\").load(\"/dados/vendas\")\ndf.select(\"data\", \"categoria\", \"valor\").show(5)\n```\n\nA escolha da arquitetura não elimina a necessidade de modelagem, monitoramento ou governança. Ela oferece uma base comum para implementar esses cuidados.",
        "q": [
          {
            "p": "Qual é a ideia central de uma arquitetura Lakehouse?",
            "o": [
              "Manter um data lake para dados brutos e copiar tudo para um warehouse separado.",
              "Guardar todos os dados em um único banco relacional, com esquema rígido, fixo e definido antes da carga.",
              "Unir a flexibilidade de um data lake com a confiabilidade e a gestão de um data warehouse.",
              "Processar dados apenas em streaming, descartando o histórico depois da leitura."
            ],
            "a": 2,
            "e": "O Lakehouse busca uma base aberta e flexível, com transações, governança e desempenho, sem exigir cópias separadas para cada ferramenta."
          },
          {
            "p": "Qual recurso do Delta Lake oferece transações ACID sobre arquivos guardados em object storage?",
            "o": [
              "O log de transações, que registra cada commit feito na tabela.",
              "O particionamento por data, que isola cada escrita em uma pasta própria.",
              "O formato Parquet, que já garante atomicidade em qualquer escrita.",
              "O cache em disco dos workers, que replica os arquivos entre os nós."
            ],
            "a": 0,
            "e": "Parquet e partições organizam os dados, mas é o log de transações que define quais arquivos formam cada versão e controla a concorrência."
          },
          {
            "p": "Uma equipe só precisa de mais processamento durante o fechamento do mês. Por que separar armazenamento e compute ajuda nesse caso?",
            "o": [
              "Os dados são replicados para cada cluster, o que acelera as leituras.",
              "O armazenamento cresce sozinho conforme o número de nós aumenta.",
              "O compute deixa de precisar de permissão para ler as tabelas.",
              "Permite aumentar o compute por alguns dias sem copiar nem mover os dados."
            ],
            "a": 3,
            "e": "Com as camadas separadas, o compute escala para cima e para baixo de forma independente, enquanto os dados continuam no mesmo lugar."
          },
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: reconstrua os arquivos ativos de uma tabela a partir do log de transações.",
            "task": "Implemente arquivos_ativos(log, versao=None). O log é uma lista de commits; cada commit é uma lista de ações (\"add\", arquivo) ou (\"remove\", arquivo). Reaplique os commits do primeiro até o de índice versao (inclusive) e devolva a lista ORDENADA dos arquivos ainda ativos. Se versao for None, use o log inteiro. Isso é o princípio do time travel do Delta Lake.",
            "starter": `log = [
    [("add", "a.parquet"), ("add", "b.parquet")],
    [("remove", "a.parquet"), ("add", "c.parquet")],
    [("add", "d.parquet")],
]

def arquivos_ativos(log, versao=None):
    # TODO: reaplique os commits e devolva os arquivos ativos, ordenados
    return []

print(arquivos_ativos(log))
print(arquivos_ativos(log, 0))`,
            "solution": `def arquivos_ativos(log, versao=None):
    ultimo = len(log) - 1 if versao is None else versao
    ativos = set()
    for commit in log[:ultimo + 1]:
        for acao, arquivo in commit:
            if acao == "add":
                ativos.add(arquivo)
            elif acao == "remove":
                ativos.discard(arquivo)
    return sorted(ativos)`,
            "tests": `assert callable(arquivos_ativos), 'Crie a função arquivos_ativos(log, versao=None)'
log_t = [[("add", "a.parquet"), ("add", "b.parquet")], [("remove", "a.parquet"), ("add", "c.parquet")], [("add", "d.parquet")]]
assert arquivos_ativos(log_t) == ['b.parquet', 'c.parquet', 'd.parquet'], 'Sem versao, reaplique o log inteiro'
assert arquivos_ativos(log_t, 0) == ['a.parquet', 'b.parquet'], 'versao=0 usa só o primeiro commit'
assert arquivos_ativos(log_t, 1) == ['b.parquet', 'c.parquet'], 'remove deve tirar o arquivo da lista'
assert arquivos_ativos([]) == [], 'Log vazio não tem arquivos'
print('5 verificações passaram.')`,
            "e": "O log de transações é uma sequência de commits de add/remove. Reaplicar os commits até uma versão reconstrói o estado da tabela naquele ponto.",
            "lv": "Prática de código · Python"
          }
        ],
        "studyCards": [
          {
            "title": "Lakehouse em uma frase",
            "concept": "Uma base comum para armazenar, processar e governar diferentes tipos de dados.",
            "explanation": "A arquitetura aproxima a flexibilidade de um data lake dos controles e da confiabilidade esperados em um warehouse. O objetivo é reduzir silos e cópias, sem abrir mão de qualidade e governança.",
            "example": "Arquivos brutos → tabelas Delta confiáveis → consultas SQL, dashboards e modelos analíticos."
          },
          {
            "title": "O papel do Delta Lake",
            "concept": "Delta Lake adiciona transações e controle de versões às tabelas.",
            "explanation": "O log transacional acompanha operações de escrita e permite leituras consistentes, histórico e validações. Os dados continuam armazenados em arquivos, normalmente no object storage.",
            "example": "spark.read.format(\"delta\").load(\"/dados/vendas\")"
          }
        ]
      },
      {
        "id": "workspace",
        "t": "Workspace, compute e notebooks",
        "d": "11 min",
        "h": "## Organização do trabalho\n\nO workspace reúne ativos usados no desenvolvimento e na operação de dados: notebooks, arquivos, consultas, dashboards, jobs e outros recursos. Ele facilita a colaboração, mas não deve ser confundido com o local físico onde todos os dados são armazenados.\n\nNotebooks combinam células de código, texto e resultados. Podem ser usados para exploração, desenvolvimento de pipelines, documentação e análises reproduzíveis.\n\n## O que é compute\n\nCompute é a capacidade de processamento usada para executar consultas e código. Dependendo da carga de trabalho, pode envolver clusters, SQL warehouses ou compute serverless, conforme os recursos habilitados no workspace.\n\nDimensione o compute conforme volume, concorrência, latência esperada e custo. Um recurso maior nem sempre resolve um pipeline mal otimizado.\n\n## Boas práticas com notebooks\n\n1. Divida o trabalho em etapas pequenas e nomeadas.\n2. Documente premissas, origem dos dados e resultado esperado.\n3. Evite credenciais fixas no código.\n4. Separe exploração interativa de tarefas recorrentes de produção.\n5. Encerre recursos interativos quando não forem mais necessários.\n\n## Exemplo de análise em notebook\n\n```python\nvendas = spark.table(\"comercial.gold.vendas\")\nresumo = vendas.groupBy(\"categoria\").sum(\"valor\")\ndisplay(resumo)\n```\n\nO notebook organiza a análise; a execução acontece no compute selecionado. O resultado pode ser compartilhado ou transformado em uma tarefa agendada.",
        "q": [
          {
            "p": "Qual é a função do workspace no Databricks?",
            "o": [
              "Guardar fisicamente todas as tabelas e arquivos de dados da empresa.",
              "Organizar notebooks, consultas, jobs e outros ativos de trabalho de uma equipe.",
              "Executar o processamento distribuído das consultas e gerenciar o ciclo de vida do compute de cada equipe.",
              "Aplicar permissões de acesso a dados em todas as contas da organização."
            ],
            "a": 1,
            "e": "O workspace reúne e organiza os ativos de desenvolvimento e operação. Os dados ficam em armazenamento separado e o processamento roda no compute."
          },
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: encontre credenciais escritas direto no código de um notebook.",
            "task": "Implemente achar_segredos(codigo). Receba o texto do código e devolva a lista dos números de linha (começando em 1) em que uma variável com nome contendo password, senha, token, secret ou api_key (sem diferenciar maiúsculas) recebe um texto literal entre aspas. Atribuições que usam dbutils.secrets.get(...) NÃO são problema e não entram na lista.",
            "starter": `codigo = 'import requests\\ntoken = "abc123"\\nsenha = dbutils.secrets.get("escopo", "senha")\\nAPI_KEY = \\'xyz\\'\\nnome = "Ana"'

def achar_segredos(codigo):
    # TODO: percorra as linhas e devolva os números das que expõem segredos
    return []

print(achar_segredos(codigo))`,
            "solution": `import re

def achar_segredos(codigo):
    achados = []
    padrao = r"^\\s*\\w*(password|senha|token|secret|api_key)\\w*\\s*=\\s*[\\"']"
    for numero, linha in enumerate(codigo.splitlines(), start=1):
        if re.search(padrao, linha, re.IGNORECASE):
            achados.append(numero)
    return achados`,
            "tests": `assert callable(achar_segredos), 'Crie a função achar_segredos(codigo)'
teste = 'import requests\\ntoken = "abc123"\\nsenha = dbutils.secrets.get("escopo", "senha")\\nAPI_KEY = \\'xyz\\'\\nnome = "Ana"\\npassword="123"'
assert achar_segredos(teste) == [2, 4, 6], 'Esperado [2, 4, 6]: token, API_KEY e password com texto literal'
assert achar_segredos('x = 1\\ny = "ok"') == [], 'Sem segredos deve devolver lista vazia'
assert achar_segredos('SECRET_KEY = dbutils.secrets.get("a", "b")') == [], 'secrets.get não é segredo exposto'
print('3 verificações passaram.')`,
            "e": "Credenciais literais no código vazam por versionamento, cópias e logs. O padrão correto é ler de um secret scope ou de identidade gerenciada.",
            "lv": "Prática de código · Python"
          },
          {
            "p": "Um notebook precisa executar uma consulta pesada. O que fornece CPU e memória para rodá-la?",
            "o": [
              "O workspace, que guarda o código e também o executa.",
              "O catálogo de dados ao qual a tabela consultada pertence.",
              "O repositório Git conectado ao notebook.",
              "Um compute (cluster ou SQL warehouse) anexado ao notebook."
            ],
            "a": 3,
            "e": "Notebook guarda o código; quem executa é o compute anexado, com os recursos de CPU, memória e runtime."
          },
          {
            "p": "Qual prática é mais adequada para um notebook que roda em produção?",
            "o": [
              "Ler credenciais de um secret scope e documentar as etapas do processo.",
              "Guardar o token em uma variável no topo para facilitar a manutenção.",
              "Executar manualmente todos os dias para conferir cada resultado.",
              "Usar o mesmo notebook em teste e produção, trocando apenas os dados."
            ],
            "a": 0,
            "e": "Segredos ficam em um mecanismo seguro, e o notebook de produção deve ser documentado, versionado, monitorado e separado do ambiente de teste."
          }
        ],
        "studyCards": [
          {
            "title": "Workspace não é armazenamento",
            "concept": "Workspace organiza ativos; tabelas e arquivos podem residir no armazenamento em nuvem.",
            "explanation": "Notebooks e consultas são recursos de trabalho. Os dados persistentes costumam ficar em storage externo, acessados pelo compute.",
            "example": "Notebook: análise_vendas | Tabela: comercial.gold.vendas"
          },
          {
            "title": "Escolha de compute",
            "concept": "Dimensione processamento de acordo com a carga, não por tentativa aleatória.",
            "explanation": "Considere tamanho dos dados, paralelismo, número de usuários, tempo de resposta e orçamento. Revise métricas antes de aumentar recursos.",
            "example": "Carga pequena e exploratória → compute enxuto; processamento distribuído recorrente → compute dimensionado e monitorado."
          }
        ]
      },
      {
        "id": "arquitetura-dados",
        "t": "Arquitetura e fluxo de dados",
        "d": "13 min",
        "h": "## Do dado bruto ao dado confiável\n\nUm fluxo analítico transforma dados de origem em informação útil. Em uma plataforma Lakehouse, é comum organizar as etapas em camadas para separar ingestão, limpeza e disponibilização.\n\nO padrão Medallion usa três camadas conceituais:\n\n- **Bronze:** dados ingeridos com pouca transformação, preservando a origem.\n- **Silver:** dados limpos, tipados, deduplicados e integrados.\n- **Gold:** dados agregados ou modelados para consumo analítico e de negócio.\n\n## Responsabilidade de cada camada\n\nA camada Bronze ajuda a reprocessar dados e auditar a ingestão. Silver concentra regras de qualidade, padronização e integração. Gold oferece estruturas orientadas a indicadores, relatórios e aplicações.\n\nNem todo projeto precisa de exatamente três camadas físicas. O padrão é uma forma de organizar responsabilidades; adapte-o ao domínio, ao volume e aos requisitos.\n\n## Exemplo de fluxo\n\n```python\nbronze = spark.read.format(\"delta\").table(\"raw.vendas\")\nsilver = bronze.dropDuplicates([\"id_venda\"]).filter(\"valor >= 0\")\nsilver.write.format(\"delta\").mode(\"overwrite\").saveAsTable(\"trusted.vendas\")\n```\n\nEm produção, valide a estratégia de escrita, particionamento, histórico e reprocessamento antes de usar `overwrite`. Prefira operações incrementais quando o cenário exigir atualização contínua.",
        "q": [
          {
            "p": "Qual é a principal finalidade da camada Bronze na arquitetura Medallion?",
            "o": [
              "Guardar apenas métricas já agregadas para alimentar dashboards.",
              "Armazenar dados já limpos, deduplicados e com todas as regras de negócio aplicadas para consumo.",
              "Conter somente amostras dos dados para testes de desempenho.",
              "Preservar os dados ingeridos próximos da origem, permitindo auditoria e reprocessamento."
            ],
            "a": 3,
            "e": "Bronze guarda o dado como chegou. Isso dá rastreabilidade e permite reconstruir Silver e Gold se uma regra mudar."
          },
          {
            "p": "Uma tabela recebe pedidos duplicados e datas gravadas como texto. Em qual camada essa limpeza costuma acontecer?",
            "o": [
              "Bronze, que deve corrigir tudo antes de gravar.",
              "Silver, onde os dados são padronizados, tipados e deduplicados.",
              "Gold, que corrige os dados a cada consulta de negócio.",
              "Em nenhuma, pois a limpeza é feita pelo próprio dashboard."
            ],
            "a": 1,
            "e": "Silver concentra limpeza, tipagem, deduplicação e integração. Bronze preserva o original e Gold entrega dados prontos para o negócio."
          },
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: construa uma tabela Gold com o total de vendas pagas por categoria.",
            "task": "Implemente agregar_gold(vendas). Cada venda é um dicionário com categoria, valor e status. Some o valor apenas das vendas com status \"pago\", agrupando por categoria, arredonde o total para 2 casas e devolva uma lista de tuplas (categoria, total) ordenada do maior total para o menor. Em caso de empate, ordene pelo nome da categoria.",
            "starter": `vendas = [
    {"categoria": "Livros", "valor": 40.0, "status": "pago"},
    {"categoria": "Games", "valor": 100.0, "status": "pago"},
    {"categoria": "Livros", "valor": 25.5, "status": "cancelado"},
    {"categoria": "Games", "valor": 19.9, "status": "pago"},
]

def agregar_gold(vendas):
    # TODO: filtre as vendas pagas, agrupe por categoria e some
    return []

print(agregar_gold(vendas))`,
            "solution": `def agregar_gold(vendas):
    totais = {}
    for venda in vendas:
        if venda["status"] == "pago":
            totais[venda["categoria"]] = totais.get(venda["categoria"], 0) + venda["valor"]
    return sorted(((c, round(t, 2)) for c, t in totais.items()), key=lambda item: (-item[1], item[0]))`,
            "tests": `assert callable(agregar_gold), 'Crie a função agregar_gold(vendas)'
v = [
    {"categoria": "A", "valor": 10.0, "status": "pago"},
    {"categoria": "B", "valor": 5.5, "status": "pago"},
    {"categoria": "A", "valor": 2.5, "status": "cancelado"},
    {"categoria": "B", "valor": 4.5, "status": "pago"},
    {"categoria": "C", "valor": 7.0, "status": "pago"},
    {"categoria": "D", "valor": 99.0, "status": "cancelado"},
]
assert agregar_gold(v) == [("A", 10.0), ("B", 10.0), ("C", 7.0)], 'Some só vendas pagas; empate ordena por categoria'
assert agregar_gold([]) == [], 'Lista vazia deve devolver lista vazia'
assert agregar_gold([{"categoria": "X", "valor": 0.1, "status": "pago"}, {"categoria": "X", "valor": 0.2, "status": "pago"}]) == [("X", 0.3)], 'Arredonde o total para 2 casas'
print('3 verificações passaram.')`,
            "e": "A camada Gold entrega dados já agregados para consumo. Filtrar status e agrupar por categoria é o tipo de regra de negócio que vive nessa camada.",
            "lv": "Prática de código · Python"
          },
          {
            "p": "Qual camada costuma servir indicadores e tabelas prontas para análise de negócio?",
            "o": [
              "Bronze, com o histórico bruto de cada fonte de dados.",
              "Silver, com um registro por evento exatamente como chegou.",
              "Gold, com dados modelados e agregados para consumo.",
              "Checkpoint, com o estado de cada fluxo de ingestão."
            ],
            "a": 2,
            "e": "Gold reúne dados modelados ou agregados para dashboards, relatórios e análises."
          }
        ],
        "studyCards": [
          {
            "title": "Camadas Medallion",
            "concept": "Bronze preserva; Silver qualifica; Gold serve ao consumo.",
            "explanation": "A separação torna mais claras as responsabilidades de ingestão, qualidade e modelagem analítica. Ela também facilita investigar em qual etapa surgiu um problema.",
            "example": "Bronze: eventos originais → Silver: eventos deduplicados → Gold: vendas por categoria e mês."
          },
          {
            "title": "Qualidade em cada etapa",
            "concept": "Regras de qualidade precisam ser explícitas e monitoradas.",
            "explanation": "Valide campos obrigatórios, tipos, faixas aceitáveis, duplicidades e reconciliação de volumes. Registre rejeições para investigação, em vez de descartá-las silenciosamente.",
            "example": "assert silver.filter(\"id_venda IS NULL\").count() == 0"
          }
        ]
      }
    ]
  },
  {
    "t": "Delta Lake e SQL",
    "l": [
      {
        "id": "delta-lake",
        "t": "Tabelas Delta e transações",
        "d": "14 min",
        "h": "## Como uma tabela Delta funciona\n\nDelta Lake é uma camada de armazenamento de tabelas que combina arquivos de dados, geralmente Parquet, com um log transacional. O log registra operações e metadados necessários para que leitores vejam uma versão consistente da tabela.\n\nEsse mecanismo dá suporte a transações ACID, histórico de versões, evolução de esquema e controle de concorrência. Os recursos disponíveis e as configurações recomendadas dependem da versão e do ambiente Databricks.\n\n## Operações de leitura e escrita\n\nÉ possível ler uma tabela Delta com Spark ou consultá-la com SQL. Ao escrever, escolha conscientemente entre append, overwrite e operações de atualização. `overwrite` substitui dados conforme o escopo configurado e pode causar perda se usado sem cuidado.\n\n```python\ndf = spark.read.format(\"delta\").load(\"/lake/vendas\")\ndf.write.format(\"delta\").mode(\"append\").saveAsTable(\"comercial.silver.vendas\")\n```\n\n## Histórico e recuperação\n\nO histórico permite inspecionar versões anteriores e apoiar auditoria ou recuperação. A retenção de arquivos e metadados precisa ser planejada: não presuma que uma versão antiga ficará disponível indefinidamente.\n\n## Quando usar Delta\n\nDelta é indicado para tabelas analíticas que precisam de escrita confiável, leituras consistentes e evolução controlada. Defina também chaves de negócio, regras de qualidade e política de retenção.",
        "q": [
          {
            "p": "Qual componente define quais arquivos pertencem a cada versão de uma tabela Delta?",
            "o": [
              "O transaction log (_delta_log), com os commits da tabela.",
              "O metastore do workspace, que lista os arquivos Parquet de cada versão.",
              "O nome da pasta de partição, que identifica a versão dos dados.",
              "O esquema da tabela, que guarda o caminho de cada arquivo."
            ],
            "a": 0,
            "e": "O _delta_log registra as operações de cada commit. É a partir dele que o Delta sabe quais arquivos compõem cada versão."
          },
          {
            "p": "Qual modo de escrita adiciona novas linhas sem apagar as que já existem na tabela?",
            "o": [
              "overwrite, que substitui o conteúdo conforme o escopo da escrita.",
              "ignore, que grava apenas se a tabela ainda não existir.",
              "append, que acrescenta as linhas novas ao final da tabela.",
              "errorifexists, que combina as linhas novas com as antigas por chave."
            ],
            "a": 2,
            "e": "append acrescenta dados. overwrite substitui, ignore não faz nada se já existir e errorifexists falha. Nenhum deles faz merge por chave, que é papel do MERGE."
          },
          {
            "p": "Por que é preciso cuidado ao usar overwrite em uma tabela Delta?",
            "o": [
              "Ele apaga o histórico de versões imediatamente, então o time travel deixa de funcionar na hora.",
              "Pode substituir dados que deveriam ser preservados, dependendo do escopo da escrita.",
              "Ele só pode ser usado em tabelas que não têm nenhuma partição.",
              "Ele exige recriar a tabela com um novo esquema a cada execução."
            ],
            "a": 1,
            "e": "Um overwrite mal escopado troca dados que deveriam ficar. As versões antigas ainda existem até um VACUUM, mas o resultado corrente já estará errado."
          },
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: simule os modos de escrita append, overwrite, ignore e errorifexists.",
            "task": "Implemente escrever(tabela, novas, modo). tabela é uma lista de linhas, ou None quando a tabela ainda não existe. Modos: \"append\" devolve tabela + novas; \"overwrite\" devolve só as novas; \"ignore\" devolve a tabela atual se ela existir, senão as novas; \"errorifexists\" levanta ValueError se a tabela existir, senão devolve as novas. Qualquer outro modo levanta ValueError. Nunca altere a lista original: devolva uma nova lista.",
            "starter": `def escrever(tabela, novas, modo):
    # TODO: trate cada modo de escrita
    return tabela

base = [1, 2]
print(escrever(base, [3], "append"))
print(escrever(base, [3], "overwrite"))`,
            "solution": `def escrever(tabela, novas, modo):
    existe = tabela is not None
    if modo == "append":
        return (list(tabela) if existe else []) + list(novas)
    if modo == "overwrite":
        return list(novas)
    if modo == "ignore":
        return list(tabela) if existe else list(novas)
    if modo == "errorifexists":
        if existe:
            raise ValueError("A tabela já existe")
        return list(novas)
    raise ValueError("Modo inválido: " + str(modo))`,
            "tests": `assert callable(escrever), 'Crie a função escrever(tabela, novas, modo)'
base_t = [1, 2]
assert escrever(base_t, [3], "append") == [1, 2, 3], 'append acrescenta ao final'
assert base_t == [1, 2], 'Não altere a lista original'
assert escrever(base_t, [3], "overwrite") == [3], 'overwrite substitui tudo'
assert escrever(base_t, [3], "ignore") == [1, 2], 'ignore mantém a tabela existente'
assert escrever(None, [3], "ignore") == [3], 'ignore grava se a tabela não existe'
assert escrever(None, [3], "append") == [3], 'append em tabela inexistente cria com as novas'
assert escrever(None, [3], "errorifexists") == [3], 'errorifexists grava se a tabela não existe'
def _falha(tabela, modo):
    try:
        escrever(tabela, [3], modo)
    except ValueError:
        return True
    return False
assert _falha(base_t, "errorifexists"), 'errorifexists deve levantar ValueError se a tabela existe'
assert _falha(base_t, "upsert"), 'Modo desconhecido deve levantar ValueError'
print('9 verificações passaram.')`,
            "e": "Cada modo de escrita tem um contrato diferente. Conhecer esse contrato evita apagar dados com overwrite ou duplicar registros com append.",
            "lv": "Prática de código · Python"
          }
        ],
        "studyCards": [
          {
            "title": "Transaction log",
            "concept": "O log Delta registra alterações e define versões consistentes da tabela.",
            "explanation": "O log é a base dos recursos transacionais. Ele permite que leitores identifiquem quais arquivos pertencem a uma versão e acompanhem alterações realizadas.",
            "example": "DESCRIBE HISTORY comercial.silver.vendas;"
          },
          {
            "title": "Append x Overwrite",
            "concept": "Append acrescenta; overwrite substitui o escopo configurado.",
            "explanation": "Escolha o modo conforme a semântica da carga. Em pipelines repetíveis, avalie merge ou estratégias incrementais para evitar duplicação e perda de dados.",
            "example": "df.write.format(\"delta\").mode(\"append\").saveAsTable(\"comercial.silver.vendas\")"
          }
        ]
      },
      {
        "id": "spark-sql",
        "t": "Consultas com Spark SQL",
        "d": "13 min",
        "h": "## Consultar dados com SQL\n\nSpark SQL permite consultar tabelas e views usando uma linguagem familiar para análise. Em Databricks, as consultas podem ser executadas em notebooks, no SQL editor e em tarefas automatizadas.\n\nUma referência de tabela no Unity Catalog normalmente usa três partes: `catalogo.esquema.tabela`. Essa forma deixa explícita a localização lógica do objeto.\n\n## Estrutura de uma consulta\n\n```sql\nSELECT categoria, SUM(valor) AS total_vendas\nFROM comercial.gold.vendas\nWHERE data_venda >= DATE '2026-01-01'\nGROUP BY categoria\nORDER BY total_vendas DESC;\n```\n\n`SELECT` define as colunas ou expressões retornadas; `FROM` indica a origem; `WHERE` filtra linhas; `GROUP BY` agrega; `ORDER BY` ordena o resultado.\n\n## Joins e agregações\n\nUse joins para combinar tabelas relacionadas. Antes de combinar, entenda a cardinalidade das chaves: uma relação um-para-muitos pode multiplicar linhas e alterar somas. Confira contagens e valores antes e depois do join.\n\n## Consultas eficientes\n\nEvite `SELECT *` em tabelas largas quando só algumas colunas são necessárias. Filtre o quanto antes, verifique o plano de execução e use estatísticas e particionamento quando fizer sentido. Otimização deve ser orientada por métricas, não apenas por regras genéricas.",
        "q": [
          {
            "p": "Qual cláusula descarta linhas individuais ANTES de os grupos serem formados?",
            "o": [
              "HAVING, que descarta linhas antes de formar os grupos.",
              "WHERE, que filtra as linhas antes do GROUP BY.",
              "ORDER BY, que remove as linhas fora da faixa informada.",
              "LIMIT, que filtra as linhas pelo valor de uma coluna."
            ],
            "a": 1,
            "e": "WHERE atua nas linhas antes da agregação. HAVING filtra os grupos já agregados, ORDER BY ordena e LIMIT corta a quantidade."
          },
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: simule em Python um SELECT com WHERE, GROUP BY, HAVING e ORDER BY.",
            "task": "Implemente consulta(linhas, minimo, limite_total). linhas é uma lista de tuplas (categoria, valor). Equivale a: SELECT categoria, SUM(valor) AS total FROM t WHERE valor >= minimo GROUP BY categoria HAVING SUM(valor) > limite_total ORDER BY total DESC. Devolva uma lista de tuplas (categoria, total); em empate de total, ordene pela categoria.",
            "starter": `linhas = [("A", 50), ("A", 70), ("B", 30), ("B", 40), ("C", 200), ("A", 5)]

def consulta(linhas, minimo, limite_total):
    # TODO: WHERE -> GROUP BY -> HAVING -> ORDER BY
    return []

print(consulta(linhas, 10, 100))`,
            "solution": `def consulta(linhas, minimo, limite_total):
    totais = {}
    for categoria, valor in linhas:
        if valor >= minimo:
            totais[categoria] = totais.get(categoria, 0) + valor
    filtrados = [(c, t) for c, t in totais.items() if t > limite_total]
    return sorted(filtrados, key=lambda item: (-item[1], item[0]))`,
            "tests": `assert callable(consulta), 'Crie a função consulta(linhas, minimo, limite_total)'
dados = [("A", 50), ("A", 70), ("B", 30), ("B", 40), ("C", 200), ("A", 5)]
assert consulta(dados, 10, 100) == [("C", 200), ("A", 120)], 'WHERE tira ("A", 5) e HAVING tira B (70)'
assert consulta(dados, 0, 100) == [("C", 200), ("A", 125)], 'Com minimo=0 o valor 5 entra no total de A'
assert consulta(dados, 60, 60) == [("C", 200), ("A", 70)], 'O HAVING usa a soma depois do WHERE'
assert consulta([], 0, 0) == [], 'Sem linhas, resultado vazio'
print('4 verificações passaram.')`,
            "e": "WHERE reduz as linhas antes da agregação; HAVING filtra os grupos depois. Trocar a ordem muda o resultado, como os testes mostram.",
            "lv": "Prática de código · Python"
          },
          {
            "p": "Para obter o total de vendas por categoria, qual construção agrupa as linhas antes de aplicar SUM?",
            "o": [
              "GROUP BY categoria, que colapsa as linhas de cada categoria em uma só.",
              "PARTITION BY categoria, que mantém todas as linhas e repete o total em cada uma.",
              "ORDER BY categoria, que soma as linhas conforme a sequência da tabela.",
              "DISTINCT categoria, que soma apenas os valores sem repetição."
            ],
            "a": 0,
            "e": "GROUP BY gera uma linha por grupo. PARTITION BY é usado em funções de janela e preserva as linhas originais."
          },
          {
            "p": "O que verificar antes de unir duas tabelas com JOIN para não inflar o resultado?",
            "o": [
              "Se as duas tabelas têm o mesmo número de colunas.",
              "Se as duas tabelas estão guardadas no mesmo catálogo e no mesmo schema do metastore.",
              "Se a coluna de junção está ordenada de forma crescente.",
              "Se a chave é única na tabela de dimensão, para não multiplicar linhas."
            ],
            "a": 3,
            "e": "Chaves repetidas no lado \"um\" do relacionamento multiplicam as linhas. Cardinalidade e unicidade devem ser conferidas antes do JOIN."
          }
        ],
        "studyCards": [
          {
            "title": "Anatomia de uma consulta",
            "concept": "SELECT escolhe; FROM origina; WHERE filtra; GROUP BY agrega; ORDER BY ordena.",
            "explanation": "Entender a função de cada cláusula ajuda a construir consultas legíveis e a localizar erros de lógica ou de agregação.",
            "example": "SELECT categoria, COUNT(*) FROM vendas WHERE valor > 0 GROUP BY categoria;"
          },
          {
            "title": "JOIN sem surpresas",
            "concept": "A cardinalidade do relacionamento influencia o número de linhas do resultado.",
            "explanation": "Verifique se a chave é única na dimensão e se há registros sem correspondência. Compare contagens e totais antes e depois da combinação.",
            "example": "SELECT v.id_venda, c.segmento FROM vendas v LEFT JOIN clientes c ON v.id_cliente = c.id_cliente;"
          }
        ]
      },
      {
        "id": "transacoes-delta",
        "t": "MERGE, evolução de esquema e histórico",
        "d": "12 min",
        "h": "## Atualizações incrementais\n\nPipelines de dados frequentemente recebem registros novos e alterações de registros existentes. O comando `MERGE INTO` permite combinar uma origem com uma tabela de destino usando uma condição de correspondência.\n\n```sql\nMERGE INTO comercial.silver.clientes AS destino\nUSING atualizacao_clientes AS origem\nON destino.id_cliente = origem.id_cliente\nWHEN MATCHED THEN UPDATE SET *\nWHEN NOT MATCHED THEN INSERT *;\n```\n\nA condição `ON` deve refletir a chave de negócio. Se a origem tiver várias linhas para a mesma chave, a operação pode ser ambígua; deduplique ou defina uma regra antes do merge.\n\n## Evolução de esquema\n\nEvolução de esquema permite adaptar a estrutura da tabela quando novas colunas ou mudanças são esperadas. Habilite esse comportamento de forma consciente e documente contratos de dados. Aceitar qualquer alteração automaticamente pode esconder incompatibilidades entre produtores e consumidores.\n\n## Histórico de versões\n\nO histórico Delta ajuda a entender operações realizadas e versões disponíveis. Use-o para auditoria e investigação. A recuperação de versões depende das políticas de retenção e da disponibilidade dos arquivos correspondentes.\n\n## Boas práticas\n\n- Defina uma chave estável para identificar registros.\n- Torne a ingestão idempotente sempre que possível.\n- Registre contagens de inserções, atualizações e rejeições.\n- Teste alterações de esquema em ambiente controlado.",
        "q": [
          {
            "p": "Para que serve o comando MERGE INTO em uma tabela Delta?",
            "o": [
              "Unir arquivos pequenos em arquivos maiores para acelerar as leituras.",
              "Combinar duas tabelas em um novo notebook sem alterar o destino.",
              "Mesclar versões antigas da tabela em uma só, descartando o histórico e liberando espaço em disco.",
              "Atualizar linhas correspondentes e inserir as novas em uma única operação transacional."
            ],
            "a": 3,
            "e": "MERGE compara origem e destino por uma condição, atualiza o que casa e insere o que é novo. Compactar arquivos pequenos é papel do OPTIMIZE."
          },
          {
            "p": "Antes de executar um MERGE por chave, o que a origem precisa garantir?",
            "o": [
              "Que as colunas estejam em ordem alfabética.",
              "Que a tabela de destino esteja vazia e sem partições, para evitar qualquer conflito de escrita.",
              "Que cada chave apareça uma só vez ou que exista regra clara para resolver conflitos.",
              "Que a origem seja uma tabela Delta, e não uma view."
            ],
            "a": 2,
            "e": "Várias linhas de origem para a mesma chave tornam a correspondência ambígua e podem causar erro ou resultado incorreto."
          },
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: implemente um upsert (MERGE) por chave sobre listas de dicionários.",
            "task": "Implemente merge(destino, origem, chave). Para cada linha da origem: se a chave já existir no destino, atualize os campos dessa linha com os valores da origem; se não existir, insira a linha no final. Se a origem tiver a mesma chave mais de uma vez, levante ValueError. Preserve a ordem do destino e NÃO altere as listas originais.",
            "starter": `destino = [{"id": 1, "nome": "Ana", "saldo": 10}, {"id": 2, "nome": "Bia", "saldo": 20}]
origem = [{"id": 2, "nome": "Bia", "saldo": 25}, {"id": 3, "nome": "Caio", "saldo": 5}]

def merge(destino, origem, chave):
    # TODO: valide chaves duplicadas, atualize as existentes e insira as novas
    return destino

print(merge(destino, origem, "id"))`,
            "solution": `def merge(destino, origem, chave):
    chaves = [linha[chave] for linha in origem]
    if len(chaves) != len(set(chaves)):
        raise ValueError("A origem tem chaves duplicadas")
    por_chave = {linha[chave]: linha for linha in origem}
    resultado, usadas = [], set()
    for linha in destino:
        k = linha[chave]
        if k in por_chave:
            resultado.append({**linha, **por_chave[k]})
            usadas.add(k)
        else:
            resultado.append(dict(linha))
    for linha in origem:
        if linha[chave] not in usadas:
            resultado.append(dict(linha))
    return resultado`,
            "tests": `assert callable(merge), 'Crie a função merge(destino, origem, chave)'
d = [{"id": 1, "nome": "Ana", "saldo": 10}, {"id": 2, "nome": "Bia", "saldo": 20}]
o = [{"id": 2, "nome": "Bia", "saldo": 25}, {"id": 3, "nome": "Caio", "saldo": 5}]
r = merge(d, o, "id")
assert r == [{"id": 1, "nome": "Ana", "saldo": 10}, {"id": 2, "nome": "Bia", "saldo": 25}, {"id": 3, "nome": "Caio", "saldo": 5}], 'Atualize id 2 e insira id 3'
assert d[1]["saldo"] == 20 and len(d) == 2, 'Não altere o destino original'
assert merge(d, [], "id") == d, 'Origem vazia mantém o destino'
try:
    merge(d, [{"id": 9, "nome": "X", "saldo": 1}, {"id": 9, "nome": "Y", "saldo": 2}], "id")
    falhou = False
except ValueError:
    falhou = True
assert falhou, 'Chave duplicada na origem deve levantar ValueError'
print('4 verificações passaram.')`,
            "e": "MERGE é um upsert transacional. A validação de chaves duplicadas na origem evita correspondências ambíguas.",
            "lv": "Prática de código · Python"
          },
          {
            "p": "Qual risco existe ao permitir evolução de esquema sem governança?",
            "o": [
              "Mudanças incompatíveis podem chegar a quem consome a tabela sem validação.",
              "A tabela deixa de registrar novas versões no log.",
              "As colunas antigas são apagadas automaticamente do histórico e dos arquivos já gravados.",
              "As permissões de acesso são reiniciadas a cada alteração."
            ],
            "a": 0,
            "e": "Contratos de dados e validações evitam que uma coluna nova ou alterada quebre dashboards e pipelines que dependem da tabela."
          }
        ],
        "studyCards": [
          {
            "title": "MERGE para cargas incrementais",
            "concept": "Uma chave e uma regra clara determinam se o registro será atualizado ou inserido.",
            "explanation": "MERGE é útil para sincronizar dimensões e tabelas que recebem atualizações. Deduplicar a origem e validar a chave são passos importantes antes da operação.",
            "example": "WHEN MATCHED THEN UPDATE SET destino.nome = origem.nome WHEN NOT MATCHED THEN INSERT (id, nome) VALUES (origem.id, origem.nome)"
          },
          {
            "title": "Contrato de esquema",
            "concept": "Evolução de esquema precisa ser planejada e comunicada.",
            "explanation": "Novas colunas, mudanças de tipo e remoções afetam consumidores. Versione contratos e teste compatibilidade antes de publicar alterações.",
            "example": "Antes de adicionar uma coluna obrigatória, defina valor padrão, backfill e compatibilidade dos leitores."
          }
        ]
      }
    ]
  },
  {
    "t": "Engenharia de dados",
    "l": [
      {
        "id": "pyspark",
        "t": "Transformações com PySpark",
        "d": "14 min",
        "h": "## DataFrames distribuídos\n\nPySpark é a interface Python para trabalhar com Apache Spark. Um DataFrame representa dados distribuídos em linhas e colunas e permite expressar transformações sem gerenciar manualmente cada partição.\n\nAs transformações mais comuns incluem `select`, `filter`, `withColumn`, `groupBy` e `join`. Em geral, essas operações retornam novos DataFrames, em vez de alterar o objeto original.\n\n```python\nfrom pyspark.sql import functions as F\n\nvendas = spark.table(\"comercial.silver.vendas\")\nresultado = (\n    vendas.filter(F.col(\"valor\") > 0)\n          .groupBy(\"categoria\")\n          .agg(F.sum(\"valor\").alias(\"total\"))\n)\ndisplay(resultado)\n```\n\n## Avaliação preguiçosa\n\nO Spark costuma construir um plano lógico quando você encadeia transformações. A execução ocorre quando uma ação, como `count`, `show`, `collect` ou `write`, precisa produzir um resultado.\n\nEvite `collect()` em conjuntos grandes: ele traz os dados para o processo driver e pode consumir memória excessiva. Prefira agregações distribuídas e amostras limitadas para inspeção.\n\n## Joins e particionamento\n\nJoins podem exigir movimentação de dados entre partições. Conheça o tamanho das tabelas, a distribuição das chaves e o plano de execução. Broadcast join pode ajudar quando uma das tabelas é pequena, mas deve ser usado com critério.\n\n## Código legível e reutilizável\n\nSepare transformações em etapas nomeadas, use funções de `pyspark.sql.functions` e evite UDFs quando operações nativas resolvem o problema. Funções nativas costumam permitir mais otimizações pelo Catalyst.",
        "q": [
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: construa um mini DataFrame com avaliação preguiçosa (lazy evaluation).",
            "task": "Implemente a classe MiniDataFrame(linhas) com os métodos filter(cond), with_column(nome, fn), collect() e count(). filter e with_column NÃO executam nada: apenas devolvem um NOVO MiniDataFrame com o passo registrado no plano, sem alterar o original. collect() e count() são as ações: só elas aplicam o plano, na ordem, e devolvem as linhas (lista de dicionários) ou a quantidade.",
            "starter": `class MiniDataFrame:
    def __init__(self, linhas, plano=()):
        self._linhas = list(linhas)
        self._plano = tuple(plano)

    def filter(self, cond):
        # TODO: devolva um novo MiniDataFrame com o passo no plano
        return self

    def with_column(self, nome, fn):
        # TODO: idem, para criar uma coluna
        return self

    def collect(self):
        # TODO: aplique o plano e devolva as linhas
        return []

    def count(self):
        return len(self.collect())

df = MiniDataFrame([{"valor": 1}, {"valor": -2}, {"valor": 3}])
print(df.filter(lambda l: l["valor"] > 0).count())`,
            "solution": `class MiniDataFrame:
    def __init__(self, linhas, plano=()):
        self._linhas = list(linhas)
        self._plano = tuple(plano)

    def filter(self, cond):
        return MiniDataFrame(self._linhas, self._plano + (("filter", cond),))

    def with_column(self, nome, fn):
        return MiniDataFrame(self._linhas, self._plano + (("coluna", (nome, fn)),))

    def collect(self):
        linhas = [dict(l) for l in self._linhas]
        for tipo, arg in self._plano:
            if tipo == "filter":
                linhas = [l for l in linhas if arg(l)]
            else:
                nome, fn = arg
                linhas = [{**l, nome: fn(l)} for l in linhas]
        return linhas

    def count(self):
        return len(self.collect())`,
            "tests": `assert 'MiniDataFrame' in globals(), 'Crie a classe MiniDataFrame'
chamadas = []
def _positivo(l):
    chamadas.append(1)
    return l["valor"] > 0
base_df = MiniDataFrame([{"valor": 1}, {"valor": -2}, {"valor": 3}])
df2 = base_df.filter(_positivo).with_column("dobro", lambda l: l["valor"] * 2)
assert chamadas == [], 'Transformações são preguiçosas: nada pode executar antes de uma ação'
assert df2.count() == 2, 'count() deve aplicar o plano e contar 2 linhas'
assert len(chamadas) == 3, 'A condição deve rodar uma vez por linha quando a ação é chamada'
assert df2.collect() == [{"valor": 1, "dobro": 2}, {"valor": 3, "dobro": 6}], 'collect() devolve as linhas transformadas'
assert len(base_df.collect()) == 3, 'O DataFrame original não pode ser alterado (imutabilidade)'
print('5 verificações passaram.')`,
            "e": "No Spark, transformações apenas montam um plano e as ações o executam. A imutabilidade permite ao otimizador reorganizar o plano antes de rodar.",
            "lv": "Prática de código · Python"
          },
          {
            "p": "Qual das opções é uma ação que normalmente dispara a execução de um DataFrame?",
            "o": [
              "df.select(\"categoria\")",
              "df.filter(\"valor > 0\")",
              "df.count()",
              "df.withColumn(\"ano\", F.year(\"data\"))"
            ],
            "a": 2,
            "e": "count() é uma ação e dispara o job. select, filter e withColumn são transformações preguiçosas que apenas montam o plano."
          },
          {
            "p": "Por que collect() deve ser usado com cuidado em DataFrames grandes?",
            "o": [
              "Porque remove as partições do DataFrame original.",
              "Porque traz todas as linhas para a memória do driver, que pode estourar.",
              "Porque grava o resultado inteiro em disco, em um único arquivo, antes de devolvê-lo ao cliente.",
              "Porque reexecuta o job uma vez para cada coluna."
            ],
            "a": 1,
            "e": "collect() leva o resultado inteiro para um único processo, o driver. Em dados grandes, isso causa falta de memória."
          },
          {
            "p": "Qual prática costuma favorecer a otimização de consultas PySpark?",
            "o": [
              "Converter o DataFrame em lista Python antes de filtrar.",
              "Criar uma UDF Python para cada operação, mesmo as simples, para ter mais controle do código.",
              "Chamar collect() depois de cada transformação para validar.",
              "Preferir funções nativas do Spark, que o otimizador consegue planejar."
            ],
            "a": 3,
            "e": "Funções nativas são conhecidas pelo Catalyst e rodam na JVM, sem o custo de ida e volta para o Python."
          }
        ],
        "studyCards": [
          {
            "title": "Transformação x ação",
            "concept": "Transformações montam o plano; ações solicitam a execução.",
            "explanation": "select, filter e groupBy descrevem operações. count, show e write acionam o processamento para produzir ou persistir resultados.",
            "example": "filtrado = df.filter(F.col(\"valor\") > 0)  # transformação\\nfiltrado.count()  # ação"
          },
          {
            "title": "Evite collect em grandes volumes",
            "concept": "Mantenha o processamento distribuído sempre que possível.",
            "explanation": "collect traz todos os registros ao driver. Para inspecionar dados, use limit, show ou agregações que reduzam o volume transferido.",
            "example": "df.select(\"categoria\").distinct().show(20)"
          }
        ]
      },
      {
        "id": "autoloader",
        "t": "Ingestão incremental com Auto Loader",
        "d": "13 min",
        "h": "## O que é Auto Loader\n\nAuto Loader é um recurso do Databricks para detectar e ingerir arquivos novos de forma incremental a partir do armazenamento em nuvem. Ele é útil quando sistemas de origem publicam arquivos continuamente e o pipeline precisa processar somente o que chegou.\n\nA leitura costuma ser feita com `cloudFiles`, informando o formato dos arquivos, o caminho de origem e diretórios de checkpoint e schema.\n\n```python\nentrada = (\n    spark.readStream.format(\"cloudFiles\")\n      .option(\"cloudFiles.format\", \"json\")\n      .option(\"cloudFiles.schemaLocation\", \"/checkpoints/vendas/schema\")\n      .load(\"/landing/vendas\")\n)\n```\n\n## Checkpoint e estado\n\nO checkpoint guarda informações necessárias para retomar o processamento e evitar reprocessamento indevido. Deve ficar em um caminho persistente e exclusivo para a consulta. Não apague o checkpoint sem entender o impacto no estado do pipeline.\n\n## Evolução de esquema\n\nFontes podem adicionar campos ao longo do tempo. Configure o modo de evolução conforme o contrato esperado e monitore colunas inesperadas. Dados incompatíveis devem ser encaminhados para tratamento, não ignorados silenciosamente.\n\n## Operação confiável\n\nUse `writeStream` com destino Delta, defina `checkpointLocation`, acompanhe atrasos e falhas e planeje reprocessamento. Teste a recuperação após interrupções e valide se os dados foram ingeridos exatamente conforme a regra do negócio.",
        "q": [
          {
            "p": "Qual é o principal objetivo do Auto Loader?",
            "o": [
              "Detectar e ingerir de forma incremental os arquivos novos que chegam ao armazenamento.",
              "Recarregar toda a pasta de origem a cada execução, relendo todos os arquivos para garantir a consistência.",
              "Converter arquivos CSV em tabelas SQL sem precisar de compute.",
              "Copiar tabelas Delta entre workspaces de forma automática."
            ],
            "a": 0,
            "e": "O Auto Loader descobre arquivos novos e os processa de forma incremental, sem reler tudo a cada execução."
          },
          {
            "p": "Qual é a função do checkpoint em um fluxo de ingestão?",
            "o": [
              "Armazenar uma cópia dos dados brutos de cada lote para consultas futuras e auditoria.",
              "Validar o esquema de cada arquivo antes da leitura.",
              "Definir quais usuários podem executar o fluxo.",
              "Guardar o progresso do fluxo para retomar de onde parou após uma falha."
            ],
            "a": 3,
            "e": "O checkpoint mantém o estado do fluxo (o que já foi lido) e permite recuperação sem reprocessar nem perder dados."
          },
          {
            "p": "Onde deve ficar o checkpoint de um pipeline de produção?",
            "o": [
              "Em um diretório temporário do driver, recriado a cada execução.",
              "Em uma pasta compartilhada por todos os fluxos da equipe.",
              "Em um local persistente e exclusivo de cada fluxo de ingestão.",
              "Dentro da própria pasta de origem dos arquivos lidos."
            ],
            "a": 2,
            "e": "O checkpoint precisa sobreviver a reinicializações e não deve ser compartilhado entre fluxos, para não misturar o estado de cada um."
          },
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: simule a ingestão incremental com checkpoint.",
            "task": "Implemente ingerir_novos(listados, checkpoint). listados é a lista de nomes de arquivos hoje na pasta (pode ter repetidos) e checkpoint é a lista dos já processados. Devolva uma tupla (novos, checkpoint_atualizado): novos são os arquivos ainda não processados, sem repetição e ordenados; checkpoint_atualizado é a lista ordenada de todos os arquivos já processados. NÃO altere a lista checkpoint recebida.",
            "starter": `def ingerir_novos(listados, checkpoint):
    # TODO: descubra os arquivos novos e atualize o checkpoint
    return [], checkpoint

novos, ck = ingerir_novos(["a.json", "b.json", "c.json", "b.json"], ["a.json"])
print(novos, ck)`,
            "solution": `def ingerir_novos(listados, checkpoint):
    processados = set(checkpoint)
    novos = sorted(set(listados) - processados)
    atualizado = sorted(processados | set(novos))
    return novos, atualizado`,
            "tests": `assert callable(ingerir_novos), 'Crie a função ingerir_novos(listados, checkpoint)'
ck_inicial = ["a.json"]
novos_t, ck_t = ingerir_novos(["a.json", "b.json", "c.json", "b.json"], ck_inicial)
assert novos_t == ["b.json", "c.json"], 'Devolva só os arquivos ainda não processados, sem repetição'
assert ck_t == ["a.json", "b.json", "c.json"], 'O checkpoint deve incluir os arquivos recém processados'
assert ck_inicial == ["a.json"], 'Não altere o checkpoint recebido'
novos2, ck2 = ingerir_novos(["a.json", "b.json", "c.json"], ck_t)
assert novos2 == [] and ck2 == ck_t, 'Rodar de novo sem arquivos novos não deve reprocessar nada'
print('4 verificações passaram.')`,
            "e": "O checkpoint guarda o que já foi processado. Com ele, rodar o fluxo de novo é seguro e não duplica dados.",
            "lv": "Prática de código · Python"
          }
        ],
        "studyCards": [
          {
            "title": "cloudFiles",
            "concept": "Auto Loader usa cloudFiles para descobrir arquivos novos e ingerir dados incrementalmente.",
            "explanation": "A configuração define formato, origem, local de schema e estado. O pipeline pode então processar arquivos conforme chegam ao storage.",
            "example": "spark.readStream.format(\"cloudFiles\").option(\"cloudFiles.format\", \"json\").load(\"/landing/eventos\")"
          },
          {
            "title": "Checkpoint é parte do pipeline",
            "concept": "Sem checkpoint persistente, a recuperação e a continuidade ficam comprometidas.",
            "explanation": "Mantenha o caminho protegido, persistente e específico para a consulta. Mudanças no checkpoint devem fazer parte de um procedimento de operação documentado.",
            "example": ".option(\"checkpointLocation\", \"/checkpoints/vendas\")"
          }
        ]
      },
      {
        "id": "pipelines-etl",
        "t": "Pipelines ETL e qualidade de dados",
        "d": "15 min",
        "h": "## ETL e ELT\n\nETL significa extrair, transformar e carregar. ELT carrega os dados primeiro em uma plataforma de destino e transforma depois, aproveitando a capacidade de processamento do ambiente analítico. A escolha depende da origem, do destino, da governança e dos requisitos de latência.\n\nEm ambos os casos, um pipeline confiável precisa controlar entradas, transformações, saídas e falhas. A transformação não deve ser apenas um conjunto de comandos: ela representa regras de negócio que precisam ser testadas.\n\n## Qualidade de dados\n\nValide campos obrigatórios, tipos, valores permitidos, unicidade e relacionamentos. Separe registros inválidos para investigação e acompanhe métricas como volume recebido, rejeições e atraso de processamento.\n\n```python\nfrom pyspark.sql import functions as F\n\nvalidos = df.filter(\n    F.col(\"id_venda\").isNotNull() &\n    (F.col(\"valor\") >= 0)\n)\ninvalidos = df.subtract(validos)\n```\n\nO exemplo é ilustrativo: em pipelines de grande volume, prefira expressar regras de qualidade em uma única passagem e evite recalcular o mesmo conjunto de dados sem necessidade.\n\n## Idempotência e reprocessamento\n\nUma tarefa idempotente pode ser executada novamente sem produzir duplicações ou efeitos colaterais indesejados. Use chaves de negócio, controle de lotes e operações de merge quando apropriado.\n\n## Observabilidade\n\nRegistre duração, volume, contagem de rejeições, última execução bem-sucedida e causa de falhas. Alertas devem apontar um problema acionável, não apenas gerar ruído.",
        "q": [
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: normalize os dados de clientes antes de publicar a camada Silver.",
            "task": "Implemente limpar_registros(rows). Cada linha tem [id, nome, email, cidade, idade, valor_pedido]. Remova IDs duplicados (mantenha a primeira ocorrência), aplique strip em nome/cidade, converta email para minúsculas, converta idade e valor_pedido para números quando possível e descarte linhas sem ID ou com email inválido. Retorne uma lista de listas na mesma ordem de colunas.",
            "starter": `rows = [
    ["1", " Ana Silva ", "ANA@EXEMPLO.COM", " sao paulo ", "30", "R$ 10,50"],
    ["1", "Ana duplicada", "ana2@exemplo.com", "Rio", "31", "20"],
    ["2", "Bia Costa", "email-invalido", "Recife", "vinte", "5"],
]

def limpar_registros(rows):
    # TODO: remova duplicados, normalize os campos e valide o e-mail
    return rows

resultado = limpar_registros(rows)
print(resultado)`,
            "solution": `def limpar_registros(rows):
    vistos = set()
    resultado = []
    for linha in rows:
        id_, nome, email, cidade, idade, valor = linha
        id_ = str(id_ or '').strip()
        nome = str(nome or '').strip()
        email = str(email or '').strip().lower()
        cidade = str(cidade or '').strip().title()
        if not id_ or id_ in vistos or '@' not in email or '.' not in email.split('@')[-1]:
            continue
        vistos.add(id_)
        try: idade = int(idade)
        except (TypeError, ValueError): idade = None
        try: valor = float(str(valor).replace('R$', '').replace(' ', '').replace(',', '.'))
        except (TypeError, ValueError): valor = None
        resultado.append([id_, nome, email, cidade, idade, valor])
    return resultado`,
            "tests": `assert callable(limpar_registros), 'Crie a função limpar_registros(rows)'
resultado_teste = limpar_registros([['1',' Ana ','ANA@EXEMPLO.COM ',' sao paulo ','30','R$ 10,50'], ['1','Ana 2','a2@exemplo.com','Rio','31','20'], ['2','Bia','email-invalido','Recife','vinte','5']])
assert len(resultado_teste) == 1, 'Deve remover ID duplicado e email inválido'
assert resultado_teste[0][1] == 'Ana', 'Remova espaços do nome'
assert resultado_teste[0][2] == 'ana@exemplo.com', 'Normalize email para minúsculas'
assert resultado_teste[0][3] == 'Sao Paulo', 'Padronize cidade'
assert resultado_teste[0][4] == 30, 'Converta idade para inteiro'
assert abs(resultado_teste[0][5] - 10.5) < 0.001, 'Converta valor monetário para número'
print('7 verificações passaram.')`
          },
          {
            "p": "Qual é a diferença geral entre ETL e ELT?",
            "o": [
              "ETL carrega os dados antes de transformá-los; ELT transforma antes de extrair.",
              "ETL transforma antes de carregar; ELT carrega primeiro e transforma no destino.",
              "ETL só funciona com SQL; ELT só funciona com Python.",
              "ETL serve para dados em lote; ELT elimina a etapa de extração."
            ],
            "a": 1,
            "e": "A distinção principal é a ordem em que a transformação e o carregamento acontecem. Ambos precisam extrair os dados da origem."
          },
          {
            "p": "O que significa tornar uma tarefa idempotente?",
            "o": [
              "Executá-la uma única vez e bloquear qualquer nova tentativa.",
              "Registrar um log detalhado de cada linha que ela processa, para poder auditar depois.",
              "Poder reexecutá-la sem duplicar nem alterar indevidamente o resultado final.",
              "Processar os dados sempre na mesma ordem em que chegaram."
            ],
            "a": 2,
            "e": "Idempotência torna reexecuções seguras, algo essencial em recuperação de falhas e em reprocessamentos."
          },
          {
            "p": "Qual métrica ajuda a identificar problemas de qualidade na ingestão?",
            "o": [
              "A proporção de registros rejeitados pelas regras de validação.",
              "O tempo médio de espera na fila do compute antes do início de cada execução.",
              "O número de colunas da tabela de destino.",
              "A quantidade de notebooks existentes no workspace."
            ],
            "a": 0,
            "e": "Acompanhar volume e taxa de rejeição revela mudanças inesperadas na origem ou nas regras de validação."
          }
        ],
        "studyCards": [
          {
            "title": "ETL e ELT",
            "concept": "A ordem entre transformação e carregamento muda conforme a arquitetura.",
            "explanation": "ETL transforma antes do destino; ELT carrega primeiro e transforma usando a plataforma analítica. Ambos exigem validação, rastreabilidade e controle de falhas.",
            "example": "ELT: arquivos landing → tabelas bronze → transformação silver → agregações gold."
          },
          {
            "title": "Idempotência",
            "concept": "Reexecutar uma tarefa não deve duplicar o resultado.",
            "explanation": "Chaves estáveis, identificação de lotes e operações incrementais ajudam a tornar a execução repetível e segura.",
            "example": "MERGE por id_evento em vez de inserir cegamente o mesmo lote a cada tentativa."
          }
        ]
      }
    ]
  },
  {
    "t": "Governança e operações",
    "l": [
      {
        "id": "unity-catalog",
        "t": "Governança com Unity Catalog",
        "d": "14 min",
        "h": "## Governança centralizada\n\nUnity Catalog oferece governança centralizada para dados e ativos do Databricks. Ele organiza objetos em uma hierarquia lógica e permite administrar permissões, descoberta, linhagem e auditoria de acordo com os recursos habilitados no ambiente.\n\nA referência usual para uma tabela é `catalogo.esquema.tabela`. O metastore é a camada de governança que contém catálogos; cada catálogo contém schemas; schemas organizam tabelas, views, volumes e outros objetos.\n\n## Princípio do menor privilégio\n\nConceda apenas as permissões necessárias para a função de cada pessoa ou grupo. Prefira conceder permissões a grupos gerenciados, em vez de configurar acessos individuais repetidamente.\n\n```sql\nGRANT SELECT ON TABLE comercial.gold.vendas\nTO `analistas`;\n```\n\nRevise concessões periodicamente e remova acessos que deixaram de ser necessários. Permissão de leitura não deve ser confundida com permissão de alteração ou administração.\n\n## Linhagem e auditoria\n\nA linhagem ajuda a entender de onde os dados vieram e quais ativos dependem de uma tabela. Logs e auditoria apoiam investigações, conformidade e análise de incidentes.\n\n## Organização dos objetos\n\nDefina convenções de nomes, separe ambientes quando necessário e documente o propósito de schemas e tabelas. Uma boa organização reduz ambiguidades e facilita a descoberta de dados confiáveis.",
        "q": [
          {
            "p": "Qual é a hierarquia usual para identificar uma tabela no Unity Catalog?",
            "o": [
              "esquema.catalogo.tabela",
              "workspace.catalogo.tabela",
              "catalogo.tabela.coluna",
              "catalogo.esquema.tabela"
            ],
            "a": 3,
            "e": "A referência de três níveis identifica catálogo, schema e objeto, nessa ordem de contenção."
          },
          {
            "p": "O que recomenda o princípio do menor privilégio?",
            "o": [
              "Conceder a cada pessoa ou grupo só as permissões que a função exige.",
              "Dar permissão total a um grupo e remover quando surgir um problema.",
              "Compartilhar uma conta de serviço entre todos os projetos da equipe.",
              "Manter permissões temporárias até a próxima auditoria anual."
            ],
            "a": 0,
            "e": "Menor privilégio reduz a exposição e limita o impacto de erros ou de uso indevido."
          },
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: verifique permissões com herança na hierarquia catálogo.esquema.tabela.",
            "task": "Implemente tem_permissao(grants, grupos, usuario, objeto, privilegio). grants é uma lista de tuplas (principal, objeto, privilegio). grupos é um dicionário usuario -> lista de grupos. Uma permissão vale se algum principal (o usuário ou um grupo dele) tiver o MESMO privilégio no próprio objeto ou em um objeto pai (herança: \"main\" cobre \"main.vendas.pedidos\"). Cuidado: \"main.vendas\" NÃO cobre \"main.vendas_old.t\". Sem concessão, a resposta é False. Devolva sempre um bool.",
            "starter": `grants = [("analistas", "main.vendas", "SELECT"), ("ana", "main.rh", "SELECT")]
grupos = {"ana": ["analistas"]}

def tem_permissao(grants, grupos, usuario, objeto, privilegio):
    # TODO: considere o usuário, seus grupos e a herança pelos objetos pai
    return False

print(tem_permissao(grants, grupos, "ana", "main.vendas.pedidos", "SELECT"))`,
            "solution": `def tem_permissao(grants, grupos, usuario, objeto, privilegio):
    principais = {usuario} | set(grupos.get(usuario, []))
    for principal, alvo, priv in grants:
        if principal in principais and priv == privilegio:
            if objeto == alvo or objeto.startswith(alvo + "."):
                return True
    return False`,
            "tests": `assert callable(tem_permissao), 'Crie a função tem_permissao(...)'
g = [("analistas", "main.vendas", "SELECT"), ("ana", "main.rh", "SELECT"), ("ops", "main", "USE CATALOG")]
gr = {"ana": ["analistas"], "caio": ["ops"]}
assert tem_permissao(g, gr, "ana", "main.vendas.pedidos", "SELECT") is True, 'Grupo + herança deve permitir'
assert tem_permissao(g, gr, "ana", "main.rh.salarios", "SELECT") is True, 'Concessão direta ao usuário deve valer'
assert tem_permissao(g, gr, "ana", "main.vendas.pedidos", "MODIFY") is False, 'Privilégio diferente não vale'
assert tem_permissao(g, gr, "caio", "main.vendas.pedidos", "SELECT") is False, 'Grupo ops não tem SELECT'
assert tem_permissao(g, gr, "bia", "main.vendas", "SELECT") is False, 'Sem grupos nem concessão: negado'
assert tem_permissao(g, gr, "ana", "main.vendas_old.t", "SELECT") is False, 'main.vendas não cobre main.vendas_old'
print('6 verificações passaram.')`,
            "e": "No Unity Catalog, permissões em um objeto pai são herdadas pelos filhos. O acesso é negado por padrão e o princípio do menor privilégio guia as concessões.",
            "lv": "Prática de código · Python"
          },
          {
            "p": "Para que serve a linhagem de dados (data lineage)?",
            "o": [
              "Registrar quem fez login no workspace em cada dia.",
              "Rastrear a origem, as transformações e as dependências entre tabelas.",
              "Controlar quais colunas cada usuário pode consultar.",
              "Medir o custo de computação de cada consulta executada, por usuário e por tabela."
            ],
            "a": 1,
            "e": "A linhagem mostra de onde um dado veio e quem depende dele, o que ajuda a avaliar o impacto de uma mudança."
          }
        ],
        "studyCards": [
          {
            "title": "Hierarquia do Unity Catalog",
            "concept": "Metastore → catálogo → schema → tabela ou outro objeto.",
            "explanation": "A hierarquia organiza os ativos e fornece contexto para permissões e descoberta. Use nomes de três partes para referenciar tabelas quando aplicável.",
            "example": "comercial.gold.vendas"
          },
          {
            "title": "Menor privilégio",
            "concept": "Permita somente o necessário, pelo tempo necessário.",
            "explanation": "Organize acessos por grupos e funções. Revise concessões e evite credenciais compartilhadas ou permissões administrativas sem justificativa.",
            "example": "GRANT SELECT ON TABLE comercial.gold.vendas TO `analistas`;"
          }
        ]
      },
      {
        "id": "workflows",
        "t": "Workflows e jobs",
        "d": "13 min",
        "h": "## Automatizar tarefas\n\nJobs e Workflows permitem agendar e orquestrar tarefas de dados. Um workflow pode conter várias tarefas, dependências, parâmetros e configurações de execução, facilitando a organização de processos que antes eram disparados manualmente.\n\nUma tarefa pode executar notebook, script, consulta SQL ou outro tipo de atividade compatível com o ambiente. Defina dependências explícitas para que etapas ocorram na ordem correta.\n\n## Planejamento de execução\n\nConfigure agenda, parâmetros, compute e política de tentativas de acordo com a criticidade. Uma nova tentativa pode recuperar falhas transitórias, mas não corrige um erro permanente de lógica ou de dados.\n\n## Monitoramento\n\nAcompanhe duração, estado, logs e saída de cada tarefa. Configure notificações para falhas relevantes e mantenha instruções de recuperação. Não envie segredos em parâmetros visíveis ou logs.\n\n## Exemplo de fluxo\n\n1. Ingerir arquivos novos.\n2. Validar schema e qualidade.\n3. Atualizar tabelas Silver.\n4. Publicar agregações Gold.\n5. Notificar consumidores sobre a conclusão.\n\nO workflow deve ser testado com dados vazios, entradas duplicadas, falhas intermediárias e reexecução.",
        "q": [
          {
            "p": "Qual é a principal finalidade de um Workflow (Job) no Databricks?",
            "o": [
              "Guardar o código dos notebooks com controle de versão.",
              "Definir quem pode ler as tabelas de cada catálogo.",
              "Orquestrar tarefas e suas dependências em um processo automatizado e agendado.",
              "Dimensionar automaticamente o armazenamento e o compute das tabelas Delta de cada projeto."
            ],
            "a": 2,
            "e": "Workflows coordenam tarefas, dependências, parâmetros, agendamento e execução."
          },
          {
            "p": "Por que configurar tentativas automáticas (retries) com cuidado?",
            "o": [
              "Porque corrigem qualquer tipo de falha, desde que o limite de tentativas configurado seja alto.",
              "Porque substituem as validações de qualidade na entrada dos dados.",
              "Porque só funcionam em tarefas SQL, nunca em notebooks.",
              "Porque ajudam em falhas transitórias, mas não corrigem erros de lógica ou de dados."
            ],
            "a": 3,
            "e": "Uma nova tentativa recupera falhas temporárias (rede, indisponibilidade). Um erro permanente precisa de correção."
          },
          {
            "p": "O que deve ser monitorado em um job de produção?",
            "o": [
              "Somente se o job terminou, sem olhar duração nem logs.",
              "Estado, duração, logs e falhas de cada tarefa, com alerta para o que for relevante.",
              "Apenas o custo total do mês e o número de execuções, sem nenhum detalhe de cada tarefa.",
              "O número de linhas de código de cada notebook."
            ],
            "a": 1,
            "e": "Esses sinais mostram atrasos, falhas e mudanças de comportamento antes que o consumidor do dado perceba."
          },
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: calcule a ordem de execução das tarefas de um workflow.",
            "task": "Implemente ordem_execucao(tarefas). tarefas é um dicionário nome -> lista de dependências. Devolva a lista de nomes em uma ordem válida (cada tarefa só depois das suas dependências). Quando várias tarefas estiverem prontas ao mesmo tempo, escolha a de menor nome em ordem alfabética. Levante ValueError se existir dependência de uma tarefa que não existe ou se houver ciclo.",
            "starter": `tarefas = {
    "ingerir": [],
    "validar": ["ingerir"],
    "atualizar_silver": ["validar"],
    "publicar_gold": ["atualizar_silver"],
}

def ordem_execucao(tarefas):
    # TODO: ordene respeitando as dependências e detecte problemas
    return list(tarefas)

print(ordem_execucao(tarefas))`,
            "solution": `def ordem_execucao(tarefas):
    for nome, deps in tarefas.items():
        for dep in deps:
            if dep not in tarefas:
                raise ValueError("Dependência inexistente: " + dep)
    pendentes = {nome: set(deps) for nome, deps in tarefas.items()}
    ordem = []
    while pendentes:
        prontas = sorted(n for n, deps in pendentes.items() if not deps)
        if not prontas:
            raise ValueError("Ciclo entre as tarefas")
        escolhida = prontas[0]
        ordem.append(escolhida)
        del pendentes[escolhida]
        for deps in pendentes.values():
            deps.discard(escolhida)
    return ordem`,
            "tests": `assert callable(ordem_execucao), 'Crie a função ordem_execucao(tarefas)'
t1 = {"publicar_gold": ["atualizar_silver"], "ingerir": [], "validar": ["ingerir"], "atualizar_silver": ["validar"], "notificar": ["publicar_gold"]}
assert ordem_execucao(t1) == ["ingerir", "validar", "atualizar_silver", "publicar_gold", "notificar"], 'Respeite a cadeia de dependências'
assert ordem_execucao({"c": ["a", "b"], "b": [], "a": []}) == ["a", "b", "c"], 'Tarefas prontas saem em ordem alfabética'
def _falha(t):
    try:
        ordem_execucao(t)
    except ValueError:
        return True
    return False
assert _falha({"a": ["b"], "b": ["a"]}), 'Ciclo deve levantar ValueError'
assert _falha({"a": ["x"]}), 'Dependência inexistente deve levantar ValueError'
print('4 verificações passaram.')`,
            "e": "Um workflow é um grafo de tarefas sem ciclos. A ordem de execução vem das dependências, e ciclos ou dependências inexistentes precisam ser rejeitados antes de rodar.",
            "lv": "Prática de código · Python"
          }
        ],
        "studyCards": [
          {
            "title": "Dependências entre tarefas",
            "concept": "Uma etapa só deve iniciar quando suas pré-condições forem atendidas.",
            "explanation": "Organize ingestão, validação e publicação em tarefas claras. Isso facilita identificar onde ocorreu uma falha e executar novamente apenas o necessário.",
            "example": "Ingestão → validação → transformação → publicação → notificação."
          },
          {
            "title": "Retry não é correção",
            "concept": "Tentativas automáticas tratam falhas transitórias, não defeitos de lógica.",
            "explanation": "Defina limite de tentativas, intervalos e alertas. Investigue erros recorrentes e evite loops de execução que aumentam custo sem resolver a causa.",
            "example": "Falha temporária de rede: retry pode ajudar. Coluna obrigatória inexistente: corrija o contrato ou a transformação."
          }
        ]
      },
      {
        "id": "seguranca-monitoramento",
        "t": "Segurança, custos e monitoramento",
        "d": "14 min",
        "h": "## Segurança operacional\n\nProteja credenciais usando mecanismos de secrets e identidades gerenciadas disponíveis no ambiente. Evite inserir tokens em notebooks, arquivos versionados, parâmetros abertos ou mensagens de log.\n\nSepare ambientes de desenvolvimento, homologação e produção quando o risco e o processo exigirem. Restrinja permissões, monitore acessos e estabeleça procedimentos para rotação de credenciais.\n\n## Monitoramento de custos\n\nCompute, armazenamento e transferências podem gerar custos diferentes. Acompanhe utilização, duração dos jobs, concorrência e recursos ociosos. Tags e convenções de nomes ajudam a atribuir custos a equipes e produtos.\n\n## Observabilidade de pipelines\n\nUma operação madura acompanha métricas técnicas e de negócio: volume ingerido, atraso, registros rejeitados, duração, falhas e atualização mais recente. Defina limites e alertas com base no comportamento esperado.\n\n## Resposta a incidentes\n\nQuando um pipeline falhar, identifique o ponto da falha, preserve logs, avalie impacto nos consumidores e siga o procedimento de recuperação. Antes de reprocessar, confirme se a operação é idempotente e se não haverá duplicação.\n\n## Checklist de produção\n\n- Segredos fora do código.\n- Permissões revisadas.\n- Alertas acionáveis.\n- Logs sem dados sensíveis.\n- Custos e recursos ociosos acompanhados.\n- Procedimento de rollback e reprocessamento documentado.",
        "q": [
          {
            "p": "Onde devem ser guardados tokens e credenciais usados por pipelines?",
            "o": [
              "Em um secret scope ou em identidade gerenciada, fora do código.",
              "Em um arquivo de configuração versionado junto ao código.",
              "Em um parâmetro do job, visível na tela de execuções.",
              "Em variáveis do notebook, escondidas na saída das células."
            ],
            "a": 0,
            "e": "Secrets e identidades gerenciadas reduzem a exposição. Parâmetros, logs e repositórios acabam espalhando a credencial."
          },
          {
            "mode": "code",
            "language": "Python",
            "p": "Desafio de código: gere alertas de frescor para tabelas com ingestão atrasada.",
            "task": "Implemente alertas_de_frescor(tabelas, agora, limite_min). tabelas é um dicionário nome -> data/hora da última ingestão no formato \"AAAA-MM-DD HH:MM\"; agora usa o mesmo formato. Devolva a lista ORDENADA dos nomes cujo atraso seja MAIOR que limite_min minutos (atraso exatamente igual ao limite não alerta). Dica: use datetime.strptime.",
            "starter": `from datetime import datetime

tabelas = {"vendas": "2026-11-23 08:00", "clientes": "2026-11-23 09:50"}

def alertas_de_frescor(tabelas, agora, limite_min):
    # TODO: calcule o atraso de cada tabela em minutos
    return []

print(alertas_de_frescor(tabelas, "2026-11-23 10:00", 60))`,
            "solution": `from datetime import datetime

def alertas_de_frescor(tabelas, agora, limite_min):
    formato = "%Y-%m-%d %H:%M"
    instante = datetime.strptime(agora, formato)
    alertas = []
    for nome, ultima in tabelas.items():
        atraso = (instante - datetime.strptime(ultima, formato)).total_seconds() / 60
        if atraso > limite_min:
            alertas.append(nome)
    return sorted(alertas)`,
            "tests": `assert callable(alertas_de_frescor), 'Crie a função alertas_de_frescor(tabelas, agora, limite_min)'
tb = {"vendas": "2026-11-23 08:00", "clientes": "2026-11-23 09:50", "estoque": "2026-11-22 23:00"}
assert alertas_de_frescor(tb, "2026-11-23 10:00", 60) == ["estoque", "vendas"], 'vendas (120 min) e estoque (660 min) passam de 60'
assert alertas_de_frescor(tb, "2026-11-23 10:00", 120) == ["estoque"], 'Atraso igual ao limite não alerta'
assert alertas_de_frescor(tb, "2026-11-23 10:00", 1000) == [], 'Nenhuma tabela passa de 1000 min'
assert alertas_de_frescor({}, "2026-11-23 10:00", 10) == [], 'Sem tabelas, sem alertas'
print('4 verificações passaram.')`,
            "e": "Frescor é a métrica mais direta de atraso. Alertar quando ele passa de um limite transforma monitoramento em ação.",
            "lv": "Prática de código · Python"
          },
          {
            "p": "Qual indicador pode revelar que um pipeline de ingestão está atrasado?",
            "o": [
              "A taxa de nulos: proporção de valores ausentes em cada coluna.",
              "O frescor: tempo entre a chegada do dado e sua disponibilidade para consumo.",
              "A cardinalidade: quantidade de valores distintos de cada coluna da tabela de destino.",
              "O tamanho médio dos arquivos Parquet de cada partição."
            ],
            "a": 1,
            "e": "Frescor (freshness) mede quanto tempo os dados levam para chegar ao consumidor e é o principal sinal de atraso."
          },
          {
            "p": "O que verificar antes de reprocessar uma tarefa depois de um incidente?",
            "o": [
              "Se o cluster tem mais núcleos e mais memória do que tinha na execução original.",
              "Se o notebook foi alterado depois da última sexta-feira.",
              "Se a tarefa é idempotente e se repetir a execução pode duplicar efeitos.",
              "Se o dashboard já foi atualizado manualmente por alguém."
            ],
            "a": 2,
            "e": "Sem idempotência, reprocessar pode duplicar linhas, e-mails ou cobranças. Essa análise vem antes de qualquer reexecução."
          }
        ],
        "studyCards": [
          {
            "title": "Credenciais seguras",
            "concept": "Segredos não devem ficar embutidos no código ou nos logs.",
            "explanation": "Use secrets, identidades gerenciadas e políticas de acesso. Restrinja quem pode ler credenciais e planeje sua rotação.",
            "example": "dbutils.secrets.get(scope=\"producao\", key=\"token-api\")"
          },
          {
            "title": "Sinais de saúde do pipeline",
            "concept": "Monitore dados, execução e impacto para o consumidor.",
            "explanation": "Volume, atraso, rejeições, duração e falhas mostram dimensões diferentes da saúde do processo. Defina alertas que levem a uma ação clara.",
            "example": "freshness > limite esperado → alerta para investigar atraso de ingestão."
          }
        ]
      }
    ]
  }
];

/* ---------- 4. Validação do conteúdo ---------- */
const LINGUAGENS = ["SQL", "Python", "PySpark"];
const ehCodigo = (q) => q && q.mode === "code";
function questaoValida(q) {
  if (!isObj(q) || typeof q.p !== "string") return false;
  if (ehCodigo(q)) return LINGUAGENS.includes(q.language) && ["task", "starter", "e"].every((k) => q[k] == null || typeof q[k] === "string") && typeof q.solution === "string" && q.solution.trim() !== "" && (q.tests == null || typeof q.tests === "string");
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
  perfil: { name: "", photo: "" }, nivel: "unico", rota: "home", rotaAnterior: ""
};
const aulas = () => S.mods.flatMap((m) => m.l);
const acharAula = (id) => aulas().find((l) => l.id === id) || null;
const indiceModulo = (aula) => S.mods.findIndex((m) => m.l.includes(aula));
const moduloDe = (aula) => S.mods[indiceModulo(aula)];

/* Enunciados das questões padrão anteriores (todas com a resposta em A).
   Servem só para reconhecer o que deve ser substituído na migração abaixo. */
const PROMPTS_PADRAO_ANTIGOS = new Set([
  "Qual é a ideia central de uma arquitetura Lakehouse?",
  "Qual recurso do Delta Lake ajuda a oferecer transações confiáveis sobre arquivos?",
  "Por que separar armazenamento e compute pode ser vantajoso?",
  "Qual é a função de um workspace no Databricks?",
  "O que fornece capacidade para executar o código de um notebook?",
  "Qual prática é recomendada para notebooks usados em produção?",
  "Qual é a principal finalidade da camada Bronze?",
  "Em qual camada normalmente são aplicadas padronização e deduplicação?",
  "Qual camada costuma servir indicadores e análises de negócio?",
  "Qual componente registra as transações de uma tabela Delta?",
  "Qual modo de escrita adiciona novos registros sem substituir os existentes?",
  "Por que usar overwrite exige cuidado?",
  "Qual cláusula filtra linhas antes da agregação?",
  "Qual cláusula reúne registros para calcular agregações por categoria?",
  "O que deve ser verificado antes de combinar duas tabelas com JOIN?",
  "Para que serve o comando MERGE INTO em Delta Lake?",
  "O que deve ser garantido na origem antes de um MERGE por chave?",
  "Qual é um risco de permitir evolução de esquema sem governança?",
  "Qual das opções é uma ação que normalmente dispara a execução de um DataFrame?",
  "Por que collect() deve ser usado com cuidado em grandes DataFrames?",
  "Qual prática costuma favorecer a otimização de consultas PySpark?",
  "Qual é o principal objetivo do Auto Loader?",
  "Qual é a função do checkpoint em um fluxo de ingestão?",
  "Onde deve ficar o checkpoint de um pipeline de produção?",
  "Desafio de código: normalize os dados de clientes antes de publicar a camada Silver.",
  "Qual é a diferença geral entre ETL e ELT?",
  "O que significa tornar uma tarefa idempotente?",
  "Qual métrica ajuda a identificar problemas de qualidade na ingestão?",
  "Qual é a hierarquia usual para identificar uma tabela no Unity Catalog?",
  "O que recomenda o princípio do menor privilégio?",
  "Para que serve a linhagem de dados?",
  "Qual é a principal finalidade de um Workflow?",
  "Por que configurar tentativas automáticas com cuidado?",
  "O que deve ser monitorado em um job de produção?",
  "Onde devem ser armazenados tokens e credenciais usados por pipelines?",
  "Qual indicador pode revelar atraso em um pipeline de ingestão?",
  "O que verificar antes de reprocessar uma tarefa após incidente?"
]);
const CHAVE_QUESTOES_V2 = "dbAcademyQuestoesBalanceadasV2";

/* Troca as questões padrão antigas pelas novas (gabarito balanceado + desafio de código
   em cada aula). Questões criadas pelo usuário ou pela IA são preservadas, e o progresso é
   zerado apenas nas aulas cujas questões mudaram, pois os índices deixam de coincidir. */
function migrarQuestoesPadrao() {
  if (armazem.bruto(CHAVE_QUESTOES_V2) === "1") return;
  const progresso = armazem.ler(K.progresso, {}) || {};
  const stats = armazem.ler(K.stats, {}) || {};
  const rascunhos = armazem.ler(K.rascunhos, {}) || {};
  const marcas = armazem.ler(K.marcas, null);
  let mudou = false, marcasMudaram = false;
  for (const origem of CONTEUDO_PADRAO.flatMap((m) => m.l)) {
    const destino = acharAula(origem.id);
    if (!destino || !Array.isArray(destino.q) || !destino.q.some((q) => PROMPTS_PADRAO_ANTIGOS.has(q && q.p))) continue;
    /* A assinatura inclui as alternativas (ou a solução), pois alguns enunciados não mudaram. */
    const assinatura = (q) => (q && q.p) + "||" + (q && Array.isArray(q.o) ? q.o.join("|") + "#" + q.a : (q && q.solution) || "");
    const novas = new Set(origem.q.map(assinatura));
    if (origem.q.every((q) => destino.q.some((d) => assinatura(d) === assinatura(q)))) continue; /* aula já está na versão nova */
    const extras = destino.q.filter((q) => !PROMPTS_PADRAO_ANTIGOS.has(q && q.p) && !novas.has(assinatura(q)));
    destino.q = clone(origem.q).concat(extras);
    delete progresso[destino.id]; delete stats[destino.id];
    Object.keys(rascunhos).forEach((k) => { if (k.startsWith(destino.id + ":")) delete rascunhos[k]; });
    if (isObj(marcas) && isObj(marcas.questions)) Object.keys(marcas.questions).forEach((k) => { if (k.startsWith(destino.id + ":q:")) { delete marcas.questions[k]; marcasMudaram = true; } });
    mudou = true;
  }
  if (mudou) {
    armazem.gravar(K.conteudo, S.mods);
    armazem.gravar(K.progresso, progresso); armazem.gravar(K.stats, stats); armazem.gravar(K.rascunhos, rascunhos);
    if (marcasMudaram) armazem.gravar(K.marcas, marcas);
  }
  armazem.gravar(CHAVE_QUESTOES_V2, "1");
}

const VERSAO_CURRICULO = "2026-11-20-trilha-ampliada-v1";
let trilhaRecriada = false;
function carregarConteudo() {
  const versao = armazem.bruto(K.curriculo);
  if (versao !== VERSAO_CURRICULO) {
    /* Substitui a trilha anterior uma única vez pela nova estrutura.
       Preferências, temas, chaves de API e backups salvos são preservados. */
    S.mods = clone(CONTEUDO_PADRAO);
    armazem.gravar(K.conteudo, S.mods);
    armazem.gravar(K.curriculo, VERSAO_CURRICULO);
    armazem.gravar(CHAVE_QUESTOES_V2, "1");
    armazem.apagar(K.progresso);
    armazem.apagar(K.stats);
    armazem.apagar(K.marcas);
    trilhaRecriada = true;
    return;
  }
  const salvo = armazem.ler(K.conteudo, null);
  S.mods = conteudoValido(salvo) ? salvo : clone(CONTEUDO_PADRAO);
  /* Migração aditiva: inclui o primeiro desafio executável sem apagar aulas,
     questões, progresso ou personalizações já existentes. */
  const chaveMigracaoIDE = "dbAcademyIDEChallengeMigrationV1";
  if (armazem.bruto(chaveMigracaoIDE) !== "1") {
    const origem = CONTEUDO_PADRAO.flatMap((m) => m.l).find((l) => l.id === "pipelines-etl");
    const destino = acharAula("pipelines-etl");
    const desafio = origem?.q.find((q) => ehCodigo(q) && q.tests);
    if (destino && desafio && !destino.q.some((q) => q.mode === "code" && q.tests && q.p === desafio.p)) {
      destino.q.push(clone(desafio));
      armazem.gravar(K.conteudo, S.mods);
    }
    armazem.gravar(chaveMigracaoIDE, "1");
  }
  migrarQuestoesPadrao();
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
const NIVEIS = { unico: ["Padrão", "Explique com clareza técnica progressiva: comece pelo objetivo e pelos conceitos essenciais, defina termos quando necessário, apresente exemplos executáveis e aprofunde em decisões, desempenho, custo, governança e riscos quando o assunto exigir. Adapte a profundidade à pergunta sem simplificar demais nem presumir experiência avançada."] };
const nivelAtual = () => "unico";
const instrucaoNivel = () => NIVEIS.unico[1] + " ";
function definirNivel() {
  S.nivel = "unico";
  armazem.gravar(K.nivel, "unico");
  const seletor = $("#nivel"); if (seletor) seletor.hidden = true;
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
const ROTAS_FIXAS = { home: "Início", admin: "Editor", mindmap: "Mapa mental", skills: "Skills", bookmarks: "Marcados", "data-lab": "Dados", "ia-study": "Guia da IA", feynman: "Ensine o Estagiário" };
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
    else if (tipo === "feynman") html = telaFeynman();
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
  if ($("#mmChatForm", raiz)) ligarMapa(raiz);
  if ($("#feynmanRaiz", raiz)) ligarFeynman(raiz);
  if ($("[data-lab-page]", raiz)) laboratorio.ligar(raiz);
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
    '<section class="secao home-apresentacao" aria-labelledby="home-apresentacao-titulo"><div class="home-apresentacao-cab"><p class="olho">Mais que um chatbot</p><h2 id="home-apresentacao-titulo">Aprenda, pratique e acompanhe sua evolução em um só lugar.</h2><p class="lead">A Databricks Academy combina uma trilha organizada, exercícios, laboratórios práticos e ferramentas de IA contextualizadas. Em vez de apenas entregar respostas, a plataforma ajuda você a construir conhecimento e testar o que realmente aprendeu.</p></div><div class="home-recursos">' +
      '<article class="home-recurso"><span class="home-recurso-num">01 / APRENDIZADO</span><h3>Trilha e aulas</h3><p>Conteúdo organizado por módulos, com atividades e acompanhamento de conclusão.</p><a class="btn btn-texto" href="#' + encodeURIComponent(primeira?.id || "home") + '">Explorar aulas →</a></article>' +
      '<article class="home-recurso"><span class="home-recurso-num">02 / COMPETÊNCIAS</span><h3>Radar de Skills</h3><p>Veja seu domínio por assunto, acertos, tentativas e pontos que merecem revisão.</p><a class="btn btn-texto" href="#skills">Ver minhas skills →</a></article>' +
      '<article class="home-recurso"><span class="home-recurso-num">03 / MÃO NA MASSA</span><h3>Limpeza de dados</h3><p>Trabalhe com dados bagunçados e pratique transformações usando SQL e Python diretamente no navegador.</p><a class="btn btn-texto" href="#data-lab">Abrir laboratório →</a></article>' +
      '<article class="home-recurso"><span class="home-recurso-num">04 / IA CONTEXTUAL</span><h3>Datrics e Feynman</h3><p>Tire dúvidas sobre a aula, peça questões quando quiser ou explique uma solução para um estagiário virtual.</p><div class="linha-btns"><button class="btn btn-texto" type="button" data-ia-acao="chat">Conversar com Datrics</button><a class="btn btn-texto" href="#feynman">Ensinar o estagiário →</a></div></article>' +
      '<article class="home-recurso"><span class="home-recurso-num">05 / VISUALIZAÇÃO</span><h3>Mapas mentais</h3><p>Transforme temas complexos em mapas visuais para revisar relações e conceitos.</p><a class="btn btn-texto" href="#mindmap">Criar mapa mental →</a></article>' +
      '<article class="home-recurso"><span class="home-recurso-num">06 / PERSONALIZAÇÃO</span><h3>Edite a plataforma</h3><p>Adapte o conteúdo ao seu estudo: crie e organize módulos, aulas e questões, personalize a aparência e gerencie seus dados e backups.</p><a class="btn btn-texto" href="#admin">Conhecer o Editor →</a></article>' +
    '</div></section>' +
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
  const textoAula = String(l.h || "").trim();
  const temMarkdown = /(^|\n)\s{0,3}(#{1,6}\s|[-*•]\s|\d+[.)]\s)|\*\*[^*]+\*\*|`[^`]+`|```/m.test(textoAula);
  let corpo;
  if (temMarkdown) {
    /* Conteúdo criado pelo Datrics é Markdown. Renderize-o com o mesmo
       processador seguro usado nas respostas do tutor, em vez de exibir
       literalmente ##, ** e listas. Mantém a ação de marcar parágrafos. */
    let indiceParagrafo = 0;
    corpo = md(textoAula).replace(/<p>/g, () => {
      const pi = indiceParagrafo++;
      const id = l.id + ":line:" + pi;
      return '<p class="marcavel" data-marca-id="' + esc(id) + '" data-marcado="' + !!S.marcas.lines[id] + '">' + botaoMarcar(id, "este parágrafo");
    });
  } else {
    corpo = paragrafos(textoAula).map((p, pi) => {
      const id = l.id + ":line:" + pi;
      return '<p class="marcavel" data-marca-id="' + esc(id) + '" data-marcado="' + !!S.marcas.lines[id] + '">' + botaoMarcar(id, "este parágrafo") + esc(p).replace(/\n/g, "<br>") + "</p>";
    }).join("");
  }
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
  return '<section class="questao" data-aula="' + esc(l.id) + '" data-q="' + qi + '" data-codigo>' + topoQuestao(l, q, qi, "IDE prática · " + q.language) +
    '<div class="q-enunciado">' + htmlSeguro(q.p) + "</div>" + (q.task ? '<div class="nota-lateral pre">' + esc(q.task) + "</div>" : "") +
    '<div class="ide ide-completa"><div class="ide-barra"><span>IDE · ' + esc(q.language) + ' · execução local</span><button type="button" class="btn btn-texto btn-mini" data-restaurar>Restaurar código inicial</button></div>' +
    '<textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Editor de código ' + esc(q.language) + '" data-editor>' + esc(codigo) + "</textarea>" +
    '<div class="ide-status" data-editor-status>Editor pronto · código salvo neste navegador</div><div class="ide-resultado" data-saida hidden></div></div>' +
    '<div class="linha-btns q-acoes">' + (q.language === "Python" ? '<button type="button" class="btn" data-executar>▶ ' + (q.tests ? 'Executar código e testes' : 'Executar Python') + '</button>' : q.language === "SQL" ? '<button type="button" class="btn" data-executar-sql>▶ Executar SQL</button>' : '') +
    '<button type="button" class="btn btn-tinta" data-avaliar>Avaliar com IA</button></div>' +
    '<p class="mini discreto">Python executa em ambiente isolado; SQL executa em SQLite com uma tabela de treino. PySpark exige um workspace Databricks conectado. Testes objetivos são executados de verdade quando configurados.</p>' +
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
    const cm = criarEditorIDE(ed, q.language === "SQL" ? "text/x-sql" : "python");
    const obterCodigo = () => cm ? cm.getValue() : ed.value;
    const definirCodigo = (v) => { if (cm) cm.setValue(v); else ed.value = v; };
    const salvarRascunho = () => { S.rascunhos[chave] = obterCodigo().slice(0, 12000); armazem.gravar(K.rascunhos, S.rascunhos); };
    if (cm) cm.on("change", salvarRascunho); else ed.addEventListener("input", salvarRascunho);
    ed.addEventListener("keydown", (e) => { if (e.key !== "Tab" || e.shiftKey || cm) return; e.preventDefault(); ed.setRangeText("    ", ed.selectionStart, ed.selectionEnd, "end"); ed.dispatchEvent(new Event("input")); });
    $("[data-restaurar]", card).onclick = () => { definirCodigo(q.starter || ""); salvarRascunho(); retorno.innerHTML = ""; };
    const exec = $("[data-executar]", card);
    if (exec) exec.onclick = async () => {
      saida.hidden = false; saida.innerHTML = '<div class="ide-console">Preparando execução…</div>'; exec.setAttribute("aria-busy", "true"); exec.disabled = true;
      const r = await python.executar(obterCodigo(), { testes: q.tests || "", aoEstado: (t) => { const st = $("[data-editor-status]", card); if (st) st.textContent = t; } });
      saida.innerHTML = '<div class="ide-console ' + (r.ok ? 'ok' : 'erro') + '">' + esc(r.saida) + '</div>';
      if (r.ok && q.tests) { registrarResposta(aula.id, qi, true); concluirQuestao(aula.id, qi); retorno.innerHTML = '<div class="q-retorno certo"><strong>Desafio concluído!</strong> Todos os testes objetivos passaram. A questão foi marcada como resolvida.</div>'; desenharIndice(); }
      else if (!r.ok && q.tests) retorno.innerHTML = '<div class="q-retorno errado"><strong>Os testes ainda não passaram.</strong> Leia a saída, corrija o código e execute novamente.</div>';
      exec.removeAttribute("aria-busy"); exec.disabled = false;
    };
    const execSql = $("[data-executar-sql]", card);
    if (execSql) execSql.onclick = async () => {
      saida.hidden = false; saida.innerHTML = '<div class="ide-console">Carregando SQLite…</div>'; execSql.disabled = true;
      try {
        const t = await laboratorio.executarQuestaoSQL(obterCodigo());
        saida.innerHTML = '<div class="ide-result-head"><strong>Consulta executada</strong><span>' + t.values.length + ' linha(s)</span></div>' + laboratorio.renderResultadoQuestao(t);
      } catch (err) { saida.innerHTML = '<div class="ide-console erro">' + esc(err.message) + '</div>'; }
      finally { execSql.disabled = false; }
    };
    $("[data-avaliar]", card).onclick = async (e) => {
      const b = e.currentTarget; const codigo = (cm ? cm.getValue() : ed.value).trim();
      if (!codigo) { retorno.innerHTML = '<div class="q-retorno errado">Escreva sua solução no editor antes de pedir a avaliação.</div>'; return; }
      if (!App.ia) return aviso("A camada de IA não está disponível.", true);
      b.disabled = true; if (cm) cm.setOption("readOnly", true); else ed.readOnly = true; b.setAttribute("aria-busy", "true");
      retorno.innerHTML = '<p class="status">A IA está revisando sua solução…</p>';
      try {
        const r = await App.ia.avaliarCodigo({ aula, q, codigo });
        registrarResposta(aula.id, qi, r.correct);
        retorno.innerHTML = '<div class="q-retorno ' + (r.correct ? "certo" : "errado") + '"><strong>' + (r.correct ? "Sua solução atende ao desafio." : "Ainda precisa de ajustes.") + "</strong>" + esc(r.feedback) + "</div>";
        if (r.correct) { concluirQuestao(aula.id, qi); desenharIndice(); b.removeAttribute("aria-busy"); return; }
      } catch (err) { retorno.innerHTML = '<div class="q-retorno errado">' + esc(err.message) + "</div>"; }
      b.disabled = false; if (cm) cm.setOption("readOnly", false); else ed.readOnly = false; b.removeAttribute("aria-busy");
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

/* ---------- IDE de código (CodeMirror com fallback acessível) ---------- */
function criarEditorIDE(textarea, mode, options = {}) {
  if (!textarea) return null;
  if (!window.CodeMirror || textarea._cm) return textarea._cm || null;
  const cm = window.CodeMirror.fromTextArea(textarea, { mode, theme: "default", lineNumbers: true, indentUnit: 4, tabSize: 4, indentWithTabs: false, lineWrapping: false, autofocus: false, viewportMargin: 20, extraKeys: { "Ctrl-Enter": (editor) => editor.getTextArea().closest(".lab-editor, .questao")?.querySelector("[data-lab=sql], [data-lab=py], [data-executar]")?.click() } });
  textarea._cm = cm;
  if (options.height) cm.setSize("100%", options.height);
  requestAnimationFrame(() => cm.refresh());
  return cm;
}

/* ---------- 15. Python isolado (Pyodide em Web Worker) ---------- */
const python = (() => {
  const URL_PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";
  const BLOQUEIOS = [/__import__/, /importlib/, /^\s*(import|from)\s+(os|sys|subprocess|socket|ctypes|shutil|pathlib|js|pyodide|asyncio|threading|multiprocessing)\b/m, /\bopen\s*\(/, /\beval\s*\(/, /\bexec\s*\(/, /\bcompile\s*\(/, /while\s+True\s*:/, /while\s+1\s*:/];
  const CODIGO_WORKER = `
    let py = null;
    self.onmessage = async (e) => {
      const { codigo, linhas, pandas, testes, url } = e.data;
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
        if (testes && testes.trim()) await py.runPythonAsync(testes, { globals: ns });
        let tabela = null;
        if (ns.has("df")) {
          try { const raw = await py.runPythonAsync("df.head(200).to_json(orient='split', date_format='iso')", { globals: ns }); tabela = JSON.parse(raw); } catch (_) {}
        }
        self.postMessage({ fase: "fim", saida: out, tabela, testes: !!(testes && testes.trim()) });
      } catch (err) { self.postMessage({ fase: "erro", saida: String((err && err.message) || err).slice(-1000) }); }
    };`;
  let worker = null, ocupado = false;
  function novoWorker() {
    const url = URL.createObjectURL(new Blob([CODIGO_WORKER], { type: "text/javascript" }));
    const w = new Worker(url); setTimeout(() => URL.revokeObjectURL(url), 1000); return w;
  }
  /* O runtime fica aquecido entre execuções; cada execução usa um namespace novo. */
  function executar(codigo, { linhas = null, pandas = false, testes = "", limite = 8000, tempo = 10000, aoEstado = () => {} } = {}) {
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
      const fim = (sucesso, texto, descartar, meta = {}) => {
        clearTimeout(timer); ocupado = false;
        if (worker) worker.onmessage = null;
        if (descartar && worker) { worker.terminate(); worker = null; }
        ok({ ok: sucesso, saida: (texto || "(sem saída)").slice(0, 6000), tabela: meta.tabela || null, testes: !!meta.testes });
      };
      let timer = setTimeout(() => fim(false, "O ambiente Python não carregou em 60 segundos. Verifique a conexão.", true), 60000);
      worker.onmessage = (e) => {
        const m = e.data;
        if (m.fase === "pronto") { clearTimeout(timer); aoEstado("Executando…"); timer = setTimeout(() => fim(false, "Tempo limite de " + tempo / 1000 + " segundos excedido (possível laço infinito). O processo foi encerrado.", true), tempo); }
        else if (m.fase === "fim") fim(true, m.saida.trimEnd(), false, m);
        else fim(false, m.saida);
      };
      worker.onerror = (e) => fim(false, "Falha no ambiente Python: " + (e.message || "erro desconhecido"), true);
      worker.postMessage({ codigo, linhas, pandas, testes, url: URL_PYODIDE });
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
  const branches = m.branches.map((b) => ({ name: limpar(textoNo(b), 80), children: (Array.isArray(b && b.children) ? b.children : []).map((c) => limpar(textoNo(c), 240)).filter(Boolean) })).filter((b) => b.name);
  const sources = Array.isArray(m.sources) ? m.sources.filter((f) => f && /^https?:\/\//i.test(String(f.url || ""))).slice(0, 10).map((f) => ({ title: limpar(f.title || f.titulo || "Fonte consultada", 180), url: String(f.url), snippet: limpar(f.snippet || f.texto || "", 500) })) : [];
  return root && branches.length ? { root, branches, sources } : null;
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
/* Layout editorial radial/simétrico: assunto central, ramificações coloridas
   e cartões explicativos externos, inspirado no modelo de mapa mental solicitado. */
const CORES_RAMO = ["#e7a13c", "#e86f51", "#bd6bb7", "#668bd7", "#55a77b", "#e28bba", "#5daeb4", "#9a83cf", "#c18b4b", "#6395a8", "#c66d6d", "#7d9b54"];
function quebrar(texto, max, linhas) {
  const out = []; let atual = "";
  for (const p of String(texto).split(/\s+/).filter(Boolean)) {
    if (!atual) atual = p;
    else if ((atual + " " + p).length <= max) atual += " " + p;
    else { out.push(atual); atual = p; }
  }
  if (atual) out.push(atual);
  if (out.length > linhas) { const r = out.slice(0, linhas); r[linhas - 1] = r[linhas - 1].replace(/[.,;:]?$/, "…"); return r; }
  return out;
}
function textoCartao(children) {
  return children.length ? children : ["Conceitos fundamentais, aplicações práticas e relações com os demais tópicos do tema."];
}
function layoutMapa(mapa) {
  const W = 1880, margemY = 90, gapY = 34, centroX = 940, raizW = 330, raizH = 116;
  const lados = { esquerda: [], direita: [] };
  mapa.branches.forEach((b, i) => {
    const lado = i % 2 ? "direita" : "esquerda";
    const detalhes = textoCartao(b.children).slice(0, 6);
    const linhasDetalhe = detalhes.map((t) => quebrar(t, 38, 3));
    const detalheH = Math.max(142, 54 + linhasDetalhe.reduce((n, ls) => n + ls.length * 18 + 12, 0));
    lados[lado].push({ b, i, detalhes, linhasDetalhe, detalheH });
  });
  const alturas = ["esquerda", "direita"].map((lado) => lados[lado].reduce((n, item) => n + item.detalheH, 0) + Math.max(0, lados[lado].length - 1) * gapY);
  const H = Math.max(900, ...alturas) + margemY * 2;
  const centroY = H / 2;
  const raiz = { tipo: "raiz", texto: mapa.root, x: centroX - raizW/2, y: centroY - raizH/2, w: raizW, h: raizH, cor: "#37313c", linhas: quebrar(mapa.root, 23, 3) };
  const nos = [raiz], arestas = [];
  ["esquerda", "direita"].forEach((lado) => {
    const arr = lados[lado];
    const total = alturas[lado === "esquerda" ? 0 : 1];
    let cursor = centroY - total / 2;
    arr.forEach((item) => {
      const { b, i, detalhes, linhasDetalhe, detalheH } = item;
      const cor = CORES_RAMO[i % CORES_RAMO.length], dir = lado === "direita" ? 1 : -1;
      const ramoW = 260, ramoH = 78, detalheW = 340;
      const ramoX = dir > 0 ? 1160 : 460, detalheX = dir > 0 ? 1480 : 60;
      const y = cursor + detalheH / 2;
      const ramo = { tipo: "ramo", texto: b.name, x: ramoX, y: y - ramoH/2, w: ramoW, h: ramoH, cor, linhas: quebrar(b.name, 25, 2) };
      const detalhe = { tipo: "detalhe", texto: b.name, itens: detalhes, linhasItens: linhasDetalhe, x: detalheX, y: y - detalheH/2, w: detalheW, h: detalheH, cor };
      nos.push(ramo, detalhe);
      const x1 = dir > 0 ? raiz.x + raiz.w : raiz.x, x2 = dir > 0 ? ramo.x : ramo.x + ramo.w;
      arestas.push({ x1, y1: centroY, x2, y2: y, cor, w: 4 });
      const bx1 = dir > 0 ? ramo.x + ramo.w : ramo.x, bx2 = dir > 0 ? detalhe.x : detalhe.x + detalhe.w;
      arestas.push({ x1: bx1, y1: y, x2: bx2, y2: y, cor, w: 3 });
      cursor += detalheH + gapY;
    });
  });
  return { nos, arestas, largura: W, altura: H };
}
function svgMapa(lay, exportar) {
  const P = 44, W = lay.largura + P * 2, H = lay.altura + P * 2;
  const fundo = "#f5f2ec";
  const defs = '<defs><filter id="sombraMapa" x="-20%" y="-20%" width="150%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#25212b" flood-opacity=".16"/></filter></defs>';
  const arestas = lay.arestas.map((a) => {
    const dx = Math.abs(a.x2 - a.x1) * .48;
    const c1 = a.x1 < a.x2 ? a.x1 + dx : a.x1 - dx;
    const c2 = a.x1 < a.x2 ? a.x2 - dx : a.x2 + dx;
    return '<path d="M'+a.x1+' '+a.y1+' C'+c1+' '+a.y1+' '+c2+' '+a.y2+' '+a.x2+' '+a.y2+'" fill="none" stroke="'+a.cor+'" stroke-width="'+a.w+'" stroke-linecap="round" opacity=".9"/>';
  }).join("");
  const nos = lay.nos.map((n) => {
    if (n.tipo === "raiz") {
      const ty = n.y + n.h/2 - (n.linhas.length-1)*25/2;
      return '<g filter="url(#sombraMapa)"><rect x="'+n.x+'" y="'+n.y+'" width="'+n.w+'" height="'+n.h+'" rx="22" fill="'+n.cor+'" stroke="#51465b" stroke-width="3"/><text text-anchor="middle" font-family="Arial,sans-serif" font-size="25" font-weight="800" fill="#fff">'+n.linhas.map((l,i)=>'<tspan x="'+(n.x+n.w/2)+'" y="'+(ty+i*27)+'" dominant-baseline="middle">'+esc(l)+'</tspan>').join("")+'</text></g>';
    }
    if (n.tipo === "ramo") {
      const ty = n.y+n.h/2-(n.linhas.length-1)*22/2;
      return '<g filter="url(#sombraMapa)"><rect x="'+n.x+'" y="'+n.y+'" width="'+n.w+'" height="'+n.h+'" rx="19" fill="'+n.cor+'" stroke="'+n.cor+'" stroke-width="2"/><text text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#fff">'+n.linhas.map((l,i)=>'<tspan x="'+(n.x+n.w/2)+'" y="'+(ty+i*23)+'" dominant-baseline="middle">'+esc(l)+'</tspan>').join("")+'</text></g>';
    }
    let y = n.y + 34;
    const titulo = '<text x="'+(n.x+20)+'" y="'+y+'" font-family="Arial,sans-serif" font-size="16" font-weight="700" fill="#28242d">'+esc(n.texto)+'</text>';
    y += 20;
    const itens = n.linhasItens.map((ls, i) => {
      const bloco = '<circle cx="'+(n.x+22)+'" cy="'+(y+2)+'" r="4" fill="'+n.cor+'"/>' + ls.map((l,j)=>'<text x="'+(n.x+36)+'" y="'+(y+j*17)+'" font-family="Arial,sans-serif" font-size="13.5" fill="#514c55">'+esc(l)+'</text>').join("");
      y += ls.length*17 + 12; return bloco;
    }).join("");
    return '<g filter="url(#sombraMapa)"><rect x="'+n.x+'" y="'+n.y+'" width="'+n.w+'" height="'+n.h+'" rx="17" fill="#fffefa" stroke="'+n.cor+'" stroke-width="2.5"/><rect x="'+n.x+'" y="'+n.y+'" width="'+n.w+'" height="27" rx="15" fill="'+n.cor+'" opacity=".16"/>'+titulo+itens+'</g>';
  }).join("");
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+(-P)+' '+(-P)+' '+W+' '+H+'" width="'+W+'" height="'+H+'">'+defs+(exportar?'<rect x="'+(-P)+'" y="'+(-P)+'" width="'+W+'" height="'+H+'" fill="'+fundo+'"/>':'')+'<g id="mmVista">'+arestas+nos+'</g></svg>';
}
/* ---------- Prática: Ensine o Estagiário (Feynman invertida) ---------- */
const FEYNMAN_CASOS = [
 {id:"collect",area:"PySpark",title:"O relatório que derrubou o driver",level:"Intermediário",ticket:"Precisamos exportar todos os clientes para uma regra Python. Fiz assim; roda rápido no meu teste com 500 linhas.",code:'clientes = spark.table("silver.clientes")\nlinhas = clientes.collect()\nresultado = [regra_python(x) for x in linhas]',hint:"O volume de produção pode ser muito maior que o teste local.",answer:"collect() transfere todas as linhas para a memória do driver. Em grande volume pode causar OOM, gargalo de rede e indisponibilidade. Prefira expressar a regra com funções nativas Spark, mapPartitions quando apropriado, ou processar distribuído sem materializar tudo no driver."},
 {id:"partition",area:"Delta Lake",title:"Particionamento por cliente",level:"Intermediário",ticket:"Para acelerar consultas por cliente, particionei a tabela por user_id. Temos milhões de usuários e muitos arquivos pequenos.",code:'df.write.format("delta").partitionBy("user_id").mode("overwrite").saveAsTable("silver.eventos")',hint:"Pense na cardinalidade e no número de diretórios/arquivos gerados.",answer:"user_id tem alta cardinalidade e cria partições demais, aumentando metadados e small files. Use partições de baixa cardinalidade e filtros comuns (por exemplo, data), avalie liquid clustering/Z-ORDER conforme plataforma e padrão de consulta."},
 {id:"vacuum",area:"Delta Lake",title:"Limpeza agressiva no lake",level:"Avançado",ticket:"O storage está caro. Quero apagar imediatamente arquivos antigos para liberar espaço, então defini retenção zero.",code:'spark.conf.set("spark.databricks.delta.retentionDurationCheck.enabled", "false")\nspark.sql("VACUUM prod.fato RETAIN 0 HOURS")',hint:"Considere leitores concorrentes, time travel e transações longas.",answer:"Retenção zero pode remover arquivos ainda necessários para leitores, writers ou time travel, causando falhas e perda de capacidade de recuperação. Mantenha a retenção segura padrão ou política validada com janela maior que a duração máxima de operações; não desative a proteção sem análise operacional."},
 {id:"cross",area:"Spark SQL",title:"Crescimento inesperado no faturamento",level:"Intermediário",ticket:"Juntei vendas e regiões para incluir o nome da região. O resultado ficou 400 vezes maior.",code:'SELECT v.order_id, v.amount, r.region_name\nFROM sales v\nJOIN regions r ON v.country = r.country OR r.country IS NOT NULL',hint:"A condição do JOIN pode estar conectando quase todas as linhas.",answer:"A condição OR r.country IS NOT NULL é verdadeira para praticamente todas as linhas e pode produzir um produto cartesiano. Faça JOIN pela chave correta, valide unicidade/dimensões e compare contagens antes/depois."},
 {id:"udf",area:"PySpark",title:"UDF para uma tarefa simples",level:"Intermediário",ticket:"Criei uma UDF Python para normalizar texto. O job está muito mais lento que a versão anterior.",code:'from pyspark.sql.functions import udf\nfrom pyspark.sql.types import StringType\n\n@udf(StringType())\ndef normalizar(s):\n    return s.strip().lower() if s else None\n\ndf = df.withColumn("email_norm", normalizar("email"))',hint:"Spark já possui funções nativas para operações de string.",answer:"UDF Python pode exigir serialização e atravessar a fronteira JVM/Python, limitando otimizações Catalyst. Prefira trim(lower(col('email'))) e funções nativas; use UDF apenas quando não houver expressão equivalente e após medir."},
 {id:"merge-schema",area:"Delta Lake",title:"Coluna nova que desaparece",level:"Intermediário",ticket:"O produtor começou a enviar a coluna campaign_id, mas a tabela Delta não reflete o novo campo após a gravação.",code:'df_novo.write.format("delta").mode("append").saveAsTable("bronze.eventos")',hint:"Compare o schema de origem e destino e a política de evolução do schema.",answer:"A gravação append não deve ser presumida como evolução automática do schema. Valide compatibilidade e habilite evolução de schema de forma explícita e controlada (por exemplo, mergeSchema na operação suportada ou opção recomendada pela versão), com governança para evitar drift."},
 {id:"autoloader",area:"Auto Loader",title:"Arquivos que nunca chegam",level:"Avançado",ticket:"O pipeline lê arquivos novos, mas alguns arquivos antigos não são processados depois que reinicio o job. Configurei a descoberta em modo directory listing e movo os arquivos entre pastas.",code:'(spark.readStream.format("cloudFiles")\n .option("cloudFiles.format", "json")\n .option("cloudFiles.useNotifications", "false")\n .load(input_path))',hint:"Pense em checkpoint, estado de descoberta e movimentação/renomeação dos arquivos.",answer:"Auto Loader depende do checkpoint para registrar arquivos já descobertos e processados. Mover/renomear arquivos e reutilizar checkpoint pode não equivaler a uma nova chegada. Mantenha caminhos de entrada imutáveis, checkpoint persistente e estratégia de descoberta apropriada; para reprocessar, planeje novo checkpoint/ backfill controlado."},
 {id:"uc",area:"Unity Catalog",title:"Permissão ampla demais",level:"Intermediário",ticket:"Para resolver erro de acesso do analista, concedi acesso total ao catálogo inteiro. Agora ele consegue alterar tabelas de produção.",code:'GRANT ALL PRIVILEGES ON CATALOG analytics TO `analistas`;',hint:"Princípio do menor privilégio e escopo do grant.",answer:"ALL PRIVILEGES no catálogo é amplo e pode permitir ações além da leitura necessária. Conceda USE CATALOG, USE SCHEMA e SELECT nos objetos necessários, preferencialmente via grupos e grants no menor escopo. Revise herança e ownership."},
 {id:"workflow",area:"Workflows",title:"Job duplicando processamento",level:"Intermediário",ticket:"Configurei retries ilimitados e duas execuções simultâneas para garantir que nunca fique atrasado. Agora a mesma partição é processada duas vezes.",code:'max_concurrent_runs = 2\nmax_retries = -1\n# tarefa grava resultados por append sem chave idempotente',hint:"Retries e concorrência exigem idempotência e controle de escrita.",answer:"Execuções concorrentes e retries ilimitados podem duplicar efeitos quando a tarefa não é idempotente. Use chave de negócio/merge idempotente, limite concorrência conforme dependências, retries finitos com backoff e monitore falhas/estado."},
 {id:"cache",area:"Spark SQL",title:"Cache que consome toda a memória",level:"Avançado",ticket:"Para acelerar todos os dashboards, persisti cada DataFrame intermediário em memória e nunca removi o cache.",code:'for tabela in tabelas:\n    df = spark.table(tabela)\n    df.cache()\n    df.count()',hint:"Cache não é armazenamento gratuito e count materializa a avaliação.",answer:"Cache indiscriminado ocupa memória e pode provocar eviction, spill e pressão no cluster. Persista apenas datasets reutilizados e caros, escolha nível de storage adequado, acompanhe uso e faça unpersist após o último consumidor."}
];
let FEYNMAN_ATUAL = null;
function telaFeynman() {
 const hist = armazem.ler(K.feynman, []); const score = hist.reduce((a,x)=>a+(Number(x.score)||0),0); const media = hist.length ? (score/hist.length).toFixed(1) : "—";
 return '<div class="coluna-larga feynman-page" id="feynmanRaiz"><p class="olho">Prática deliberada · técnica Feynman invertida</p><h1>Ensine o Estagiário</h1><p class="lead">O estagiário traz um problema real. Você explica como mentor; depois recebe uma avaliação técnica estruturada.</p><div class="feynman-stats"><div><strong>'+hist.length+'</strong><span>casos concluídos</span></div><div><strong>'+media+'</strong><span>média / 10</span></div><div><strong>10</strong><span>casos offline</span></div></div><section class="feynman-ticket"><header><div><span class="ticket-kicker">CHAMADO · <span id="fyArea">PySpark</span></span><h2 id="fyTitle">O estagiário precisa de ajuda</h2></div><span class="pill" id="fyLevel">Caso prático</span></header><p id="fyStory">Carregando cenário…</p><pre class="fy-code"><code id="fyCode"></code></pre><p class="fy-hint"><strong>Pista:</strong> <span id="fyHint">Explique o impacto em produção e a alternativa correta.</span></p><div class="fy-actions"><button class="btn" type="button" id="fyNext">Trocar cenário</button><button class="btn btn-tinta" type="button" id="fyNewAI">Gerar caso inédito com IA</button></div></section><section class="feynman-answer"><label for="fyAnswer"><span class="ticket-kicker">SUA EXPLICAÇÃO · MENTOR</span><textarea id="fyAnswer" rows="6" placeholder="Explique com suas palavras: por que está errado, qual o impacto real e como você corrigiria…"></textarea></label><div class="fy-actions"><span class="mini discreto" id="fyMode">Modo offline disponível · nenhuma chave necessária</span><button class="btn btn-tinta" type="button" id="fySubmit">Avaliar minha explicação</button></div></section><section class="feynman-feedback" id="fyFeedback" hidden aria-live="polite"></section><section class="feynman-history"><h2>Histórico de mentorias</h2><div id="fyHistory"></div></section></div>';
}
function renderFeynmanCase(root, c) { FEYNMAN_ATUAL=c; root.querySelector('#fyArea').textContent=c.area; root.querySelector('#fyTitle').textContent=c.title; root.querySelector('#fyLevel').textContent=c.level; root.querySelector('#fyStory').textContent=c.ticket; root.querySelector('#fyCode').textContent=c.code||'Caso conceitual: identifique a decisão de arquitetura inadequada.'; root.querySelector('#fyHint').textContent=c.hint||'Considere escala, custo, confiabilidade e manutenção.'; root.querySelector('#fyAnswer').value=''; root.querySelector('#fyFeedback').hidden=true; }
function desenharHistoricoFy(root){ const h=armazem.ler(K.feynman,[]); root.querySelector('#fyHistory').innerHTML=h.length?h.slice(-8).reverse().map(x=>'<div class="fy-history-row"><span>'+esc(x.title)+'</span><strong>'+Number(x.score).toFixed(1)+'/10</strong><small>'+esc(x.date)+'</small></div>').join(''):'<p class="mini discreto">Suas avaliações aparecerão aqui.</p>'; }
function ligarFeynman(root){ let idx=Math.floor(Math.random()*FEYNMAN_CASOS.length); renderFeynmanCase(root,FEYNMAN_CASOS[idx]); desenharHistoricoFy(root); root.querySelector('#fyNext').onclick=()=>{let n=idx;while(n===idx&&FEYNMAN_CASOS.length>1)n=Math.floor(Math.random()*FEYNMAN_CASOS.length);idx=n;renderFeynmanCase(root,FEYNMAN_CASOS[idx]);}; root.querySelector('#fyNewAI').onclick=async()=>{if(!App.ia?.gerarCasoFeynman)return aviso('Camada de IA indisponível.',true); const b=root.querySelector('#fyNewAI');b.disabled=true;root.querySelector('#fyMode').textContent='A IA está preparando um chamado…';try{const c=await App.ia.gerarCasoFeynman();renderFeynmanCase(root,c);root.querySelector('#fyMode').textContent='Caso inédito gerado com IA.';}catch(e){aviso('Não foi possível gerar caso inédito: '+e.message,true);}finally{b.disabled=false;}}; root.querySelector('#fySubmit').onclick=async()=>{const answer=root.querySelector('#fyAnswer').value.trim();if(answer.length<25)return aviso('Explique um pouco mais antes de enviar (mínimo 25 caracteres).',true);const b=root.querySelector('#fySubmit');b.disabled=true;try{let fb;if(App.ia?.avaliarFeynman){try{fb=await App.ia.avaliarFeynman({caso:FEYNMAN_ATUAL,resposta:answer});}catch(e){fb=avaliarOffline(FEYNMAN_ATUAL,answer);root.querySelector('#fyMode').textContent='Avaliação local: API indisponível.';}}else fb=avaliarOffline(FEYNMAN_ATUAL,answer);const item={title:FEYNMAN_ATUAL.title,score:fb.score,date:new Date().toLocaleDateString('pt-BR'),area:FEYNMAN_ATUAL.area};const h=armazem.ler(K.feynman,[]);h.push(item);armazem.gravar(K.feynman,h.slice(-100));root.querySelector('#fyFeedback').innerHTML='<div class="fy-feedback-head"><span class="ticket-kicker">REAÇÃO DO ESTAGIÁRIO</span><p>'+esc(fb.reaction)+'</p></div><div class="fy-rubric"><h3>Avaliação do mentor · '+fb.score+'/10</h3>'+[['Clareza didática',fb.clarity],['Precisão técnica',fb.technical],['Solução proposta',fb.solution]].map(([n,v])=>'<div><span>'+n+'</span><strong>'+v+'/10</strong></div>').join('')+'</div><p><strong>O que faltou:</strong> '+esc(fb.missing)+'</p><h3>Referência técnica</h3><p>'+esc(fb.reference)+'</p><pre class="fy-code"><code>'+esc(FEYNMAN_ATUAL.answer)+'</code></pre>';root.querySelector('#fyFeedback').hidden=false;desenharHistoricoFy(root);}catch(e){aviso('Falha na avaliação: '+e.message,true);}finally{b.disabled=false;}}; }
function avaliarOffline(c,a){const t=a.toLowerCase();const clarity=Math.min(10,Math.max(3,Math.round(3+t.split(/\s+/).length/18)));const technical=Math.min(10,Math.max(2,(c.keywords||['driver','memória','performance','partição','schema','join','permissão','checkpoint','idempotência','cache']).filter(k=>t.includes(k)).length*2+2));const solution=Math.min(10,Math.max(2,(/prefira|use |utilize|corrig|alternativ|substitu|evit|particion|merge|select|trim|lower|checkpoint|idempot/i.test(t)?6:2)));const score=Number(((clarity+technical+solution)/3).toFixed(1));return{score,clarity,technical,solution,reaction:score>=7?'Boa! Entendi a correção. Como você validaria essa solução em um volume dez vezes maior?':'Acho que entendi, mas você pode explicar qual seria o impacto concreto para o custo e a estabilidade do job?',missing:'Mencione também monitoramento, validação em escala e efeitos operacionais, quando aplicável.',reference:c.answer};}

let MAPA_ATUAL = null;
let MAPA_CHAT = [];
function desenharChatMapa(raiz) {
  const lista = $("#mmChatMensagens", raiz);
  if (!lista) return;
  lista.innerHTML = MAPA_CHAT.map((m) => '<div class="mm-chat-msg ' + (m.role === "user" ? "user" : "assistant") + '"><span class="mm-chat-autor">' + (m.role === "user" ? "Você" : "Datrics · Mapas") + '</span><p>' + esc(m.text) + '</p></div>').join("");
  lista.scrollTop = lista.scrollHeight;
}
function telaMapa() {
  const salvo = normalizarMapa(armazem.ler(K.mapa, null));
  MAPA_ATUAL = salvo;
  MAPA_CHAT = armazem.ler(K.mapaChat, []);
  if (!Array.isArray(MAPA_CHAT)) MAPA_CHAT = [];
  if (!MAPA_CHAT.length) MAPA_CHAT = [{ role: "assistant", text: "Olá! Sou seu assistente de mapas mentais. Diga o assunto e o que você quer entender. Por exemplo: ‘Monte um mapa mental de Python para iniciantes, incluindo sintaxe, estruturas de dados, funções e bibliotecas, com explicações e exemplos’. Você pode pedir ajustes depois." }];
  return '<div class="coluna-larga mm-pagina"><p class="olho">Ferramenta de estudo · criação por conversa</p><h1>Mapa mental</h1><p class="lead">Converse com o Datrics em um chat separado. Peça um mapa do seu jeito e veja o infográfico ser montado ao lado.</p>' +
    '<div class="mm-workspace"><section class="mm-chat" aria-label="Chat para criar mapas mentais"><header class="mm-chat-top"><div><strong>Datrics</strong><span>Assistente de mapas mentais</span></div><button type="button" class="btn btn-texto btn-mini" id="mmNovoChat" title="Limpar conversa e começar outro mapa">Nova conversa</button></header>' +
    '<div class="mm-chat-mensagens" id="mmChatMensagens" aria-live="polite"></div><form id="mmChatForm" class="mm-chat-form"><label class="sr-only" for="mmChatInput">Descreva o mapa mental que deseja criar</label><textarea id="mmChatInput" rows="3" maxlength="1600" placeholder="Peça seu mapa mental... Ex.: Crie um mapa sobre Python, do básico ao avançado, com exemplos práticos." required></textarea><div class="mm-chat-acoes"><span class="mini discreto">Você pode pedir para criar, aprofundar ou reorganizar o mapa.</span><button type="submit" class="btn btn-tinta" id="mmGerar">Criar mapa</button></div><span class="status" id="mmStatus" aria-live="polite"></span></form></section>' +
    '<section class="mm-resultado"><div class="mm-resultado-top"><div><strong>Seu mapa mental</strong><span>Infográfico visual · arraste para navegar</span></div><span class="mini discreto" id="mmMapaInfo">' + (salvo ? esc(salvo.root) : "Aguardando seu pedido") + '</span></div>' +
    '<div class="mapa-palco" id="mmPalco"><div class="mapa-vazio" id="mmVazio">' + (salvo ? "" : "Seu mapa aparecerá aqui depois que você enviar uma mensagem no chat.") + '</div><div class="mapa-ctrl" id="mmCtrl" hidden><button type="button" class="btn btn-texto btn-mini" data-zoom="1.25" aria-label="Ampliar">＋</button><button type="button" class="btn btn-texto btn-mini" data-zoom="0.8" aria-label="Reduzir">－</button><button type="button" class="btn btn-texto btn-mini" data-ajustar>Ajustar</button><button type="button" class="btn btn-texto btn-mini" data-baixar="svg">Baixar SVG</button><button type="button" class="btn btn-texto btn-mini" data-baixar="png">Baixar PNG</button></div></div><div class="mm-fontes" id="mmFontes" aria-live="polite"></div></section></div></div>';
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
function desenharFontesMapa(raiz, fontes) {
  const el = $("#mmFontes", raiz);
  if (!el) return;
  const lista = Array.isArray(fontes) ? fontes : [];
  el.innerHTML = lista.length
    ? '<details class="mm-fontes-detalhe"><summary>Fontes consultadas na web (' + lista.length + ')</summary><ol>' + lista.map((f) => '<li><a href="' + esc(f.url) + '" target="_blank" rel="noopener noreferrer">' + esc(f.title || f.titulo || f.url) + '</a>' + (f.snippet || f.texto ? '<p>' + esc(f.snippet || f.texto).slice(0, 360) + '</p>' : '') + '</li>').join("") + '</ol></details>'
    : '<p class="mini discreto">As fontes consultadas aparecerão aqui.</p>';
}
function ligarMapa(raiz) {
  const palco = $("#mmPalco", raiz), st = $("#mmStatus", raiz), form = $("#mmChatForm", raiz);
  desenharChatMapa(raiz);
  if (MAPA_ATUAL) mostrarMapa(palco, MAPA_ATUAL);
  desenharFontesMapa(raiz, MAPA_ATUAL?.sources || []);
  const novo = $("#mmNovoChat", raiz);
  if (novo) novo.onclick = () => {
    if (MAPA_CHAT.length > 1 && !confirm("Começar uma nova conversa? O mapa atual continuará salvo.")) return;
    MAPA_CHAT = [{ role: "assistant", text: "Conversa reiniciada! Qual assunto você quer transformar em um mapa mental?" }];
    armazem.gravar(K.mapaChat, MAPA_CHAT); desenharChatMapa(raiz); $("#mmChatInput", raiz).focus();
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const pedido = limpar($("#mmChatInput", raiz).value, 1600);
    if (!pedido) return;
    if (!App.ia) return aviso("A camada de IA não está disponível.", true);
    MAPA_CHAT.push({ role: "user", text: pedido });
    armazem.gravar(K.mapaChat, MAPA_CHAT); desenharChatMapa(raiz);
    $("#mmChatInput", raiz).value = "";
    const b = $("#mmGerar", raiz); b.disabled = true; b.setAttribute("aria-busy", "true");
    st.className = "status"; st.textContent = "Entendendo seu pedido; a pesquisa na web será usada quando estiver disponível…";
    try {
      const r = await App.ia.mapaMental({ pedido, tema: pedido.slice(0, 100), foco: "Conceitos, relações, aplicações e exemplos", ramos: 8, sub: 5, mapaAtual: MAPA_ATUAL, aoStatus: (t) => st.textContent = t });
      MAPA_ATUAL = { ...r.mapa, sources: (r.fontes || []).map((f) => ({ title: f.titulo, url: f.url, snippet: f.texto })) };
      armazem.gravar(K.mapa, MAPA_ATUAL);
      mostrarMapa(palco, MAPA_ATUAL);
      desenharFontesMapa(raiz, MAPA_ATUAL.sources);
      $("#mmMapaInfo", raiz).textContent = r.mapa.root;
      const qtdFontes = (r.fontes || []).length;
      const baseResposta = qtdFontes
        ? " com apoio de " + qtdFontes + " fonte(s) consultada(s) na web"
        : " usando conhecimento geral da IA, pois a pesquisa na web não retornou fontes acessíveis";
      const resposta = (r.nota ? r.nota + " " : "") + (MAPA_CHAT.length > 2 && MAPA_ATUAL ? "Mapa atualizado: " : "Mapa criado: ") + r.mapa.root + ". Organizei " + r.mapa.branches.length + " ramificações com explicações" + baseResposta + ". Você pode pedir para aprofundar, corrigir ou reorganizar qualquer parte.";
      MAPA_CHAT.push({ role: "assistant", text: resposta });
      st.textContent = "Mapa pronto. Se quiser, peça alterações aqui no chat.";
    } catch (err) {
      const mensagem = "Não consegui concluir o mapa desta vez: " + err.message + ". Tente reformular o pedido ou reduzir a quantidade de detalhes.";
      MAPA_CHAT.push({ role: "assistant", text: mensagem });
      st.className = "status err"; st.textContent = mensagem;
    }
    armazem.gravar(K.mapaChat, MAPA_CHAT); desenharChatMapa(raiz);
    b.disabled = false; b.removeAttribute("aria-busy");
  };
}

/* ---------- 19. Laboratório de dados sujos + IDE executável ---------- */
const laboratorio = (() => {
  const COLS = ["id", "nome", "email", "cidade", "idade", "valor_pedido"];
  const NOMES = ["Ana", "Bruno", "Carla", "Diego", "Eva", "Felipe", "Gi", "Hugo", "Iara", "João"];
  const SOBRE = ["Silva", "Lima", "Souza", "Alves", "Costa", "Mendes", "Rocha", "Santos"];
  const CIDADES = ["São Paulo", "sao paulo", " Rio de Janeiro", "RIO DE JANEIRO", "Belo Horizonte ", "Curitiba", "curitiba", "Recife", ""];
  const sorte = (p) => Math.random() < p, pega = (a) => a[Math.floor(Math.random() * a.length)], entre = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  let linhas = [], originalLinhas = [], sqlDb = null, sqlReady = false, pythonResultado = null, editores = {};
  function gerar() {
    const n = entre(10, 16), out = [];
    for (let i = 0; i < n; i++) {
      const pn = pega(NOMES), sn = pega(SOBRE);
      const id = i > 0 && sorte(0.16) ? out[0][0] : String(100 + entre(0, n + 3));
      let nome = pn + " " + sn; if (sorte(0.25)) nome = "  " + nome + " "; if (sorte(0.1)) nome = null;
      let email = (sorte(0.5) ? pn + "." + sn : pn + sn).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + (sorte(0.2) ? "@email" : "@email.com"); if (sorte(0.12)) email = null;
      const idade = sorte(0.16) ? "" : sorte(0.12) ? "trinta" : String(entre(18, 72));
      let valor = sorte(0.2) ? "R$ " + entre(10, 999) : (Math.random() * 1000).toFixed(2); if (sorte(0.15)) valor = null;
      out.push([id, nome, email, pega(CIDADES), idade, valor]);
    }
    return out;
  }
  const tabelaHtml = (rows = linhas, cols = COLS) => '<div class="tabela-rolagem"><table class="tabela lab-grid"><thead><tr>' + cols.map((c) => "<th>" + esc(c) + "</th>").join("") + "</tr></thead><tbody>" +
    rows.map((l) => "<tr>" + l.map((v) => '<td>' + (v == null ? '<span class="null-cell">NULL</span>' : esc(v)) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  function validar(rows) {
    const vistos = new Set(); let dup = 0, vazios = 0, emails = 0, espacos = 0;
    for (const r of rows) {
      const id = String(r[0] ?? "").trim(); if (id) { if (vistos.has(id)) dup++; vistos.add(id); }
      vazios += r.filter((v) => v == null || !String(v).trim()).length;
      if (r[2] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(r[2]).trim())) emails++;
      if (r.some((v) => typeof v === "string" && v !== v.trim())) espacos++;
    }
    return [["Registros", rows.length], ["IDs duplicados", dup], ["Campos vazios", vazios], ["E-mails inválidos", emails], ["Linhas com espaços extras", espacos]];
  }
  const SQL_PADRAO = `SELECT * FROM dirty_data ORDER BY id;`;
  const PY_PADRAO = `import pandas as pd

# A tabela original está disponível na variável rows.
df = pd.DataFrame(rows, columns=["id", "nome", "email", "cidade", "idade", "valor_pedido"])

# MISSÃO: complete a limpeza abaixo.
# 1) Remova IDs duplicados, mantendo a primeira ocorrência.
# 2) Remova espaços de nome/cidade e padronize email em minúsculas.
# 3) Converta idade e valor_pedido para números (use errors="coerce").
# 4) Remova e-mails inválidos e linhas sem campos obrigatórios.

# Escreva sua solução aqui. O DataFrame final deve continuar se chamando df.
df`;

  function fecharDb() { try { sqlDb?.close(); } catch (_) {} sqlDb = null; sqlReady = false; }
  async function obterDb(rows) {
    if (sqlDb && sqlReady) return sqlDb;
    await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js", "sqljs");
    const SQL = await window.initSqlJs({ locateFile: (f) => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" + f });
    sqlDb = new SQL.Database();
    sqlDb.run("CREATE TABLE dirty_data (id TEXT, nome TEXT, email TEXT, cidade TEXT, idade TEXT, valor_pedido TEXT)");
    const st = sqlDb.prepare("INSERT INTO dirty_data VALUES (?,?,?,?,?,?)");
    rows.forEach((r) => st.run(COLS.map((_, i) => r[i] == null ? null : String(r[i])))); st.free(); sqlReady = true;
    return sqlDb;
  }
  function consultaTabela(db, sql = "SELECT * FROM dirty_data") {
    const r = db.exec(sql); if (!r.length) return { columns: COLS, values: [], changes: db.getRowsModified() };
    return { columns: r[0].columns, values: r[0].values, changes: db.getRowsModified() };
  }
  function mostrarTabela(slot, tabela) {
    if (!tabela || !tabela.columns) { slot.innerHTML = ""; return; }
    slot.innerHTML = '<div class="ide-result-head"><strong>Resultado executado</strong><span>' + tabela.values.length + ' linha(s) · ' + tabela.columns.length + ' coluna(s)</span></div>' + tabelaHtml(tabela.values, tabela.columns);
  }
  function mostrarDiagnostico(root, rows) {
    const v = validar(rows), ok = v[1][1] === 0 && v[2][1] === 0 && v[3][1] === 0 && v[4][1] === 0;
    $("#labDiag", root).innerHTML = '<div class="lab-diagnostico"><div class="contadores">' + v.map(([k, n]) => '<div><b>' + n + '</b>' + k + '</div>').join("") + '</div><p class="' + (ok ? 'lab-ok' : 'lab-pendente') + '">' + (ok ? 'Objetivo atingido: não foram encontrados duplicados, campos vazios, e-mails inválidos ou espaços extras.' : 'Ainda existem problemas. Continue ajustando a consulta ou o código e valide novamente.') + '</p></div>';
  }
  return {
    async executarQuestaoSQL(sql) {
      await carregarScript("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js", "sqljs");
      const SQL = await window.initSqlJs({ locateFile: (f) => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" + f });
      const db = new SQL.Database();
      try {
        db.run("CREATE TABLE dirty_data (id TEXT, nome TEXT, email TEXT, cidade TEXT, idade TEXT, valor_pedido TEXT)");
        const sample = [["1"," Ana Silva ","ANA@EXEMPLO.COM"," sao paulo ","30","R$ 10,50"],["1","Ana duplicada","ana2@exemplo.com","Rio","31","20"],["2","Bia Costa","email-invalido","Recife","vinte","5"],["3","Caio Lima","caio@exemplo.com","Curitiba","28","99.90"]];
        const st = db.prepare("INSERT INTO dirty_data VALUES (?,?,?,?,?,?)"); sample.forEach((r) => st.run(r)); st.free();
        const res = db.exec(String(sql || ""));
        if (res.length) return { columns: res[0].columns, values: res[0].values };
        const fallback = db.exec("SELECT * FROM dirty_data ORDER BY id")[0];
        return { columns: fallback.columns, values: fallback.values, changes: db.getRowsModified() };
      } finally { db.close(); }
    },
    renderResultadoQuestao(tabela) { return tabelaHtml(tabela.values || [], tabela.columns || []); },
    tela() {
      linhas = gerar(); originalLinhas = clone(linhas); fecharDb(); pythonResultado = null; editores = {};
      return '<div class="coluna-larga lab-page" data-lab-page><p class="olho">Laboratório prático · SQL + Python</p><h1>Limpeza de dados</h1><p class="lead">Você recebeu uma tabela operacional com dados sujos. Sua missão é corrigir os registros de verdade, executar consultas e conferir o resultado em uma grade — não apenas imprimir comandos.</p>' +
        '<section class="lab-missao"><div><span class="ticket-kicker">MISSÃO</span><h2>Prepare a tabela para a camada Silver</h2><p>Remova IDs duplicados, normalize nome, e-mail e cidade, converta idade e valor do pedido para números e elimine registros sem ID, nome, cidade, idade, valor ou com e-mail inválido.</p></div><div class="lab-meta"><span><b id="labTotal">' + linhas.length + '</b> linhas de origem</span><span><b>2</b> linguagens</span><span><b>1</b> objetivo verificável</span></div></section>' +
        '<div class="linha-btns lab-toolbar"><button type="button" class="btn" data-lab="novo">↻ Novo conjunto de dados</button><button type="button" class="btn btn-tinta" data-lab="validar">✓ Verificar qualidade</button><button type="button" class="btn btn-texto" data-lab="reset">Restaurar banco original</button></div>' +
        '<section class="lab-dataset"><div class="lab-section-head"><div><p class="olho">Fonte de dados</p><h3>dirty_data</h3></div><span class="mini discreto">Amostra real do banco em memória</span></div><div id="labTabelaCaixa">' + tabelaHtml() + '</div><div id="labDiag" aria-live="polite"></div></section>' +
        '<section class="lab-ide-wrap"><div class="lab-section-head"><div><p class="olho">Ambiente de desenvolvimento</p><h2>SQL & Python IDE</h2></div><span class="pill">Execução local isolada</span></div>' +
        '<div class="lab"><article class="lab-editor"><div class="ide-barra"><span>▣ SQL · SQLite</span><span class="mini">Banco persistente nesta sessão</span></div><textarea id="labSql" spellcheck="false">' + esc(SQL_PADRAO) + '</textarea><div class="ide-actions"><button type="button" class="btn btn-tinta" data-lab="sql">▶ Executar SQL</button><span class="mini discreto">SELECT, UPDATE, DELETE, INSERT, CREATE</span></div></article>' +
        '<article class="lab-editor"><div class="ide-barra"><span>▣ Python · pandas</span><span class="mini">Pyodide em Web Worker</span></div><textarea id="labPy" spellcheck="false">' + esc(PY_PADRAO) + '</textarea><div class="ide-actions"><button type="button" class="btn btn-tinta" data-lab="py">▶ Executar Python</button><span class="mini discreto">pandas disponível · sem acesso à rede</span></div></article></div>' +
        '<section class="lab-result"><div class="lab-section-head"><div><p class="olho">Console e visualização</p><h3>Resultado da execução</h3></div><span class="mini discreto" id="labRunState">Aguardando execução</span></div><div id="labResultado" class="lab-result-body"><div class="ide-empty">Execute uma consulta SQL ou um script Python para ver aqui os resultados em tabela.</div></div><div class="linha-btns" id="labAplicarWrap" hidden><button type="button" class="btn" data-lab="aplicar">Aplicar resultado Python ao conjunto de dados</button></div></section></section>' +
        '<p class="mini discreto lab-aviso">Este laboratório executa SQLite e Python/pandas no seu navegador. Ele não se conecta a um workspace Databricks nem executa Spark distribuído; PySpark real exige um cluster ou SQL Warehouse conectado.</p></div>';
    },
    ligar(root) {
      const sqlEl = $("#labSql", root), pyEl = $("#labPy", root), result = $("#labResultado", root), state = $("#labRunState", root);
      const sqlCM = criarEditorIDE(sqlEl, "text/x-sql", { height: 300 });
      const pyCM = criarEditorIDE(pyEl, "python", { height: 360 });
      editores = { sqlCM, pyCM };
      const get = (cm, el) => cm ? cm.getValue() : el.value;
      const setState = (t, erro = false) => { state.textContent = t; state.classList.toggle("erro", erro); };
      const runSQL = async () => {
        const db = await obterDb(linhas), sql = get(sqlCM, sqlEl);
        const res = consultaTabela(db, sql);
        const ehConsulta = /^\s*(select|with|pragma|explain)\b/i.test(sql);
        const vis = ehConsulta ? res : consultaTabela(db, "SELECT * FROM dirty_data ORDER BY id");
        mostrarTabela(result, vis);
        linhas = consultaTabela(db, "SELECT * FROM dirty_data ORDER BY id").values.map((r) => r.map((x) => x == null ? null : String(x)));
        $("#labTabelaCaixa", root).innerHTML = tabelaHtml(); $("#labTotal", root).textContent = linhas.length;
        $("#labAplicarWrap", root).hidden = true;
        setState(ehConsulta ? 'Consulta concluída' : (res.changes + ' linha(s) alterada(s) · tabela sincronizada'));
      };
      root.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-lab]"); if (!b) return;
        const acao = b.dataset.lab;
        if (acao === "novo" || acao === "reset") { linhas = acao === "novo" ? gerar() : clone(originalLinhas); if (acao === "novo") originalLinhas = clone(linhas); fecharDb(); pythonResultado = null; $("#labTabelaCaixa", root).innerHTML = tabelaHtml(); $("#labTotal", root).textContent = linhas.length; $("#labDiag", root).innerHTML = ""; result.innerHTML = '<div class="ide-empty">Novo conjunto de dados carregado. Execute uma consulta para começar.</div>'; $("#labAplicarWrap", root).hidden = true; setState("Banco original restaurado"); return; }
        if (acao === "validar") { mostrarDiagnostico(root, linhas); return; }
        b.disabled = true; b.setAttribute("aria-busy", "true");
        try {
          if (acao === "sql") { setState("Executando SQL…"); await runSQL(); }
          if (acao === "py") {
            setState("Carregando Python/pandas e executando…"); result.innerHTML = '<div class="ide-console">Preparando ambiente Python…</div>';
            const code = get(pyCM, pyEl);
            const r = await python.executar(code, { linhas, pandas: true, limite: 12000, tempo: 15000, aoEstado: setState });
            if (!r.ok) { result.innerHTML = '<div class="ide-console erro">' + esc(r.saida) + '</div>'; setState("Python encontrou um erro", true); }
            else {
              pythonResultado = r.tabela;
              result.innerHTML = '<div class="ide-console ok">' + esc(r.saida || "Execução concluída sem mensagens no console.") + '</div>';
              if (r.tabela) { mostrarTabela(result, r.tabela); $("#labAplicarWrap", root).hidden = false; setState("Python executado · DataFrame detectado"); }
              else setState("Python executado · nenhum DataFrame chamado df foi encontrado");
            }
          }
          if (acao === "aplicar") {
            if (!pythonResultado) throw new Error("Execute um script que produza um DataFrame chamado df antes de aplicar.");
            const cols = pythonResultado.columns || [], values = pythonResultado.data || [];
            if (!cols.length) throw new Error("O DataFrame não possui colunas.");
            const normalized = values.map((r) => COLS.map((c) => { const i = cols.indexOf(c); return i < 0 ? null : r[i] == null ? null : String(r[i]); }));
            linhas = normalized; fecharDb(); $("#labTabelaCaixa", root).innerHTML = tabelaHtml(); $("#labTotal", root).textContent = linhas.length; mostrarDiagnostico(root, linhas); $("#labAplicarWrap", root).hidden = true; setState("Resultado Python aplicado ao conjunto de dados");
          }
        } catch (err) { result.innerHTML = '<div class="ide-console erro">' + esc(err.message) + '</div>'; setState("Falha na execução", true); }
        finally { b.disabled = false; b.removeAttribute("aria-busy"); }
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
          '<div class="grade-2"><label class="campo"><span>Código inicial</span><textarea id="edQStarter" rows="6" class="mono">' + esc(q.starter || "") + '</textarea></label><label class="campo"><span>Solução de referência (usada na correção)</span><textarea id="edQSol" rows="6" class="mono">' + esc(q.solution || "") + "</textarea></label></div>" +
          '<label class="campo"><span>Testes objetivos Python (opcional)</span><textarea id="edQTests" rows="5" class="mono">' + esc(q.tests || "") + '</textarea><small>Use assert para verificar o resultado. Os testes são executados no navegador após o código do aluno.</small></label>' + expl;
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
      nova = { mode: "code", p: esc(p), task: $("#edQTask").value, language, starter: $("#edQStarter").value, solution: sol, tests: $("#edQTests")?.value || q.tests || "", e, lv: "Prática de código · " + language };
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
          return { mode: "code", p: q.p, task: String(q.task || ""), language: q.language, starter: String(q.starter || ""), solution: String(q.solution), tests: String(q.tests || ""), e: String(q.e || ""), lv: "Prática de código · " + q.language };
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
        case "nova-pratica": return a && mudarConteudo(() => { a.q.push({ mode: "code", p: "Nova prática de código", task: "", language: "Python", starter: "", solution: "print('ok')", tests: "", e: "", lv: "Prática de código · Python" }); E.qi = a.q.length - 1; }, "Prática criada. Edite abaixo.");
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
  S.nivel = "unico";
  armazem.gravar(K.nivel, "unico");
  const modos = armazem.ler(K.modos, []); S.modos = Array.isArray(modos) ? modos.filter((m) => isObj(m) && typeof m.id === "string" && conteudoValido(m.modules)).slice(0, LIMITE_MODOS) : [];
  const temas = armazem.ler(K.temasSalvos, []); S.temasSalvos = Array.isArray(temas) ? temas.filter((t) => isObj(t) && typeof t.name === "string" && isObj(t.settings)).slice(0, LIMITE_TEMAS) : [];
  S.modoAtivo = armazem.bruto(K.modoAtivo) || "";

  efeitos.iniciar();
  aplicarAjustes(); desenharTema(); desenharPerfil();
  const nivelUI = $("#nivel"); if (nivelUI) nivelUI.hidden = true;
  $("#temaBtn").onclick = alternarTema;
  $("#perfilBtn").onclick = abrirPerfil;
  $("#logsBtn").onclick = abrirLogs;
  $("#alternarModo").onclick = alternarModo;
  $$("[data-abrir-aulas]").forEach((b) => b.onclick = abrirGavetaAulas);
  $$("[data-abrir-ia]").forEach((b) => b.onclick = () => menuPop(b, itensIA()));

  App.ia?.iniciar?.();
  addEventListener("hashchange", render);
  render();
  if (trilhaRecriada) aviso("A trilha foi recriada com 4 módulos, 12 aulas, cards e novas questões. O progresso da trilha anterior foi reiniciado; temas, configurações e backups foram preservados.");
}

Object.assign(App, {
  $, $$, esc, md, clone, isObj, slug, clamp, strip, baixar, lerArquivo, carregarScript, aviso, dialogo, armazem, K, S, ICONE, LETRAS,
  aulas, acharAula, indiceModulo, conteudoValido, questaoValida, salvarConteudo, htmlSeguro, ehCodigo,
  instrucaoNivel, nivelAtual, normalizarAjustes, aplicarAjustes, salvarAjustes, aplicarPaleta, aplicarDesenho, desenharTema,
  PALETAS, DESENHOS, FUNDOS, CURSORES, LUZES, FONTES, CAMADAS, render, desenharIndice, normalizarMapa, limpar,
  aulaAtual: () => acharAula(S.rota),
  executarPython: (codigo, opcoes) => python.executar(codigo, opcoes),
  idAulaUnico(titulo) { const base = slug(titulo) || "aula"; let id = base, n = 2; while (acharAula(id)) id = base + "-" + n++; return id; },
  testes: { estatisticas, normalizarAjustes, conteudoValido, layoutMapa, quebrar, faixaCalor, matrizSkills, normalizarProgresso, normalizarStats, textoSeguro }
});
document.addEventListener("DOMContentLoaded", iniciar);
})();
