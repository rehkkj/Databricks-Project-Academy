# Databricks Academy

🌎 **Idioma / Language:** [🇧🇷 Português](#-português) | [🇺🇸 English](#-english)

---

## 🇧🇷 Português

**Databricks Academy** é uma apostila interativa e plataforma de estudos focada no ecossistema **Databricks**, construída inteiramente em HTML, CSS e JavaScript puro (sem dependências de build).

O projeto combina aulas estruturadas (Lakehouse, Delta Lake, PySpark, Spark SQL, Auto Loader, Unity Catalog e Workflows) com exercícios práticos corrigidos em tempo real, laboratório de dados e um tutor de IA integrado (*Datrics*) com suporte a múltiplos provedores gratuitos via BYOK (*Bring Your Own Key*).

🔗 **Demo / Acesso:** [https://rehkkj.github.io/Databricks-Project-Academy/](https://rehkkj.github.io/Databricks-Project-Academy/)

### Principais Recursos

* **Página Inicial & Navegação:** Apresenta os principais recursos da plataforma com atalhos diretos para a trilha de estudos, Radar de Skills, IDE de limpeza de dados com SQL/SQLite e Python/pandas, resultados em grade e aplicação das transformações, Datrics, modo *Ensine o Estagiário*, mapas mentais e Editor.
* **Trilha de Estudos & Prática:** 4 módulos e 12 aulas aprofundadas contendo cards de estudo, questões de múltipla escolha e desafios de código com execução em Python isolado no navegador (via Pyodide / Web Worker).
* **Tutor de IA (Datrics):** Chat flutuante contextualizado com um único estilo adaptativo de explicação, sem seletor de nível, diagnóstico de erros, geração de questões e *fallback* automático entre múltiplos provedores (Gemini, OpenRouter, Groq, Cloudflare Workers AI, NVIDIA NIM, Cohere, Z.AI, SambaNova Cloud e Mistral Studio).
* **Mapas Mentais com Pesquisa Web:** Criador de mapas mentais interativos exportáveis em SVG/PNG. Consulta a web antes de cada criação ou alteração para fundamentar afirmações factuais, salvando e exibindo os links e trechos na seção *"Fontes consultadas na web"*.
* **Ferramentas de Estudo:** Matriz e Radar de *Skills* com mapa de calor por aula, laboratório de limpeza de dados sujos, dinâmica *Ensine o Estagiário* e sistema de marcação para trechos e questões.
* **Personalização & Editor Visual:** Editor integrado para gerenciar aulas, identidade visual (temas claro/escuro, paletas de cores e tipografia) e backup local/criptografado das configurações e chaves de API.

### Atualizações Recentes (Changelog)

#### 20/11/2026 — Nova Trilha e Melhorias no Datrics
* **Reestruturação da Trilha:** A trilha padrão foi recriada em **4 módulos e 12 aulas** (totalizando 36 questões e 24 cards de estudo) seguindo o formato estruturado do Datrics. Na primeira abertura desta versão, o progresso antigo é migrado/substituído uma única vez, preservando temas, configurações, chaves de API e backups.
* **Geração de Módulos e Questões:** Múltipla escolha definida como padrão para evitar falhas de validação em exercícios de código automáticos. Reconhecimento de Python/Pandas/NumPy/Matplotlib/Jupyter como domínio próprio (sem forçar contexto Databricks) e parser/validação mais flexíveis, garantindo o salvamento da aula mesmo se a API falhar na geração de questões.
* **Mapas Mentais Verificados:** Inclusão de pesquisa web obrigatória antes da geração/edição de mapas mentais, compartilhando o contexto com os provedores de *fallback* e bloqueando a criação caso nenhuma fonte confiável seja recuperada.
* **Interface:** Área de toque ampliada e melhor alinhamento no botão de fechar do Datrics em telas estreitas, além de avisos recomendando backup antes de edições estruturais no Editor.

---

## 🇺🇸 English

**Databricks Academy** is an interactive study guide and learning platform focused on the **Databricks** ecosystem, built entirely with vanilla HTML, CSS, and JavaScript (zero build steps required).

It pairs structured lessons (Lakehouse, Delta Lake, PySpark, Spark SQL, Auto Loader, Unity Catalog, and Workflows) with instant-feedback exercises, a data cleaning lab, and an integrated AI tutor (*Datrics*) supporting multiple free-tier providers via BYOK (*Bring Your Own Key*).

🔗 **Live Demo:** [https://rehkkj.github.io/Databricks-Project-Academy/](https://rehkkj.github.io/Databricks-Project-Academy/)

### Key Features

* **Home Dashboard & Navigation:** Showcases core platform capabilities with direct shortcuts to the learning path, Skill Radar, SQL & Python data cleaning lab, Datrics, *Teach the Intern* mode, mind maps, and the built-in Editor.
* **Learning Path & Hands-on Practice:** 4 modules and 12 in-depth lessons featuring study cards, multiple-choice questions, and coding challenges executed safely in the browser using an isolated Python environment (Pyodide via Web Worker).
* **AI Tutor (Datrics):** Context-aware floating assistant with unified adaptive explanation style (no visible level selector), error diagnostics, custom question generation, and automatic fallback across multiple providers (Gemini, OpenRouter, Groq, Cloudflare Workers AI, NVIDIA NIM, Cohere, Z.AI, SambaNova Cloud, and Mistral Studio).
* **Web-Grounded Mind Maps:** Interactive mind map generator exportable to SVG/PNG. Queries the web prior to every creation or edit to ground factual claims, saving and displaying source links and snippets under *"Web Sources Consulted"*.
* **Study Tools:** Skill Radar and lesson heatmaps, a dirty-data cleaning laboratory, *Teach the Intern* active-recall mode, and bookmarking for code snippets and exercises.
* **Customization & Built-in Editor:** Live content and visual identity editor (light/dark modes, color palettes, typography) with encrypted local backup support for API keys, custom lessons, and progress.

### Recent Updates (Changelog)

#### 2026-11-20 — New Curriculum & Datrics Improvements
* **Curriculum Overhaul:** Recreated the default learning path into **4 modules and 12 lessons** (36 questions and 24 study cards total) matching Datrics' structured format. On first launch of this version, legacy progress and bookmarks are reset once while preserving saved themes, settings, API keys, and backups.
* **Module & Question Generation:** Set multiple-choice as the default format to prevent validation failures in auto-generated coding tasks. Added native domain recognition for Python/Pandas/NumPy/Matplotlib/Jupyter (without forcing Databricks context), broadened JSON parser/validation rules, and ensured lessons save safely with a warning even if question generation fails after retries.
* **Fact-Checked Mind Maps:** Enforced mandatory web search prior to generating or updating mind maps, sharing retrieved context across fallback providers and halting generation if no verifiable sources can be retrieved.
* **UI & UX Refinements:** Enlarged touch target and fixed header alignment for the Datrics close button on narrow screens, and added backup recommendations before major changes in the Editor.

## Adicionar questões a um módulo existente

No chat do Datrics, pedidos como `adicione 2 questões no módulo Delta Lake` ou `crie 3 questões no módulo 2` são direcionados ao módulo indicado. As questões são anexadas à aula atualmente aberta dentro desse módulo; se nenhuma aula desse módulo estiver aberta, são anexadas à primeira aula. Se o módulo ainda não tiver aulas, o sistema cria uma aula chamada **Questões adicionais** dentro do próprio módulo. O sistema não cria o módulo genérico **Questões geradas por IA** quando um módulo de destino foi identificado. Se o nome/número do módulo não puder ser identificado com segurança, o conteúdo não é alterado e o Datrics pede que o usuário esclareça o destino.


## IDE prática de SQL e Python

A página **Dados → Limpeza de dados** oferece uma missão prática com banco SQLite persistente durante a sessão, editor com realce de sintaxe e numeração de linhas, execução de SQL (SELECT/UPDATE/DELETE/INSERT), execução de Python/pandas em Web Worker isolado, visualização tabular dos resultados e aplicação explícita do DataFrame ao conjunto de dados. A apostila também inclui um desafio de Python com testes objetivos executáveis, além da avaliação opcional por IA.

**Limite técnico importante:** o navegador executa SQLite e Python/pandas localmente; isso não é um cluster Apache Spark/Databricks real. PySpark distribuído exige conexão com um workspace e compute/SQL Warehouse. O editor usa CodeMirror por CDN e mantém fallback em textarea se a CDN estiver indisponível.
