# Databricks Academy

## 🇧🇷 Português

**Databricks Academy** é uma apostila interativa e plataforma de estudos focada no ecossistema **Databricks**, construída inteiramente em HTML, CSS e JavaScript puro (sem dependências de build).

O projeto combina aulas estruturadas (Lakehouse, Delta Lake, PySpark, Spark SQL, Auto Loader, Unity Catalog e Workflows) com exercícios práticos corrigidos em tempo real, laboratório de dados e um tutor de IA integrado (*Datrics*) com suporte a múltiplos provedores gratuitos via BYOK (*Bring Your Own Key*).

🔗 **Demo / Acesso:** [https://rehkkj.github.io/Databricks-Project-Academy/](https://rehkkj.github.io/Databricks-Project-Academy/)

### Principais recursos
- **Aulas & Prática:** Questões de múltipla escolha e desafios de código com execução em Python isolado no navegador (via Pyodide / Web Worker).
- **Tutor de IA (Datrics):** Chat flutuante contextualizado, ajuste de profundidade das explicações (*ELI5*, *Pleno*, *Arquiteto*), diagnóstico de erros, geração de questões e suporte a múltiplos provedores (Gemini, OpenRouter, Groq, Cloudflare Workers AI, NVIDIA NIM, Cohere, Z.AI, SambaNova Cloud and Mistral Studio).
- **Ferramentas de Estudo:** Mapa mental interativo exportável em SVG/PNG, matriz de *skills* com mapa de calor por aula, laboratório de limpeza de dados sujos e sistema de trechos/questões marcadas.
- **Personalização & Editor:** Editor visual integrado para gerenciar aulas, temas (claro/escuro), paletas, tipografia e backup local/criptografado das configurações[cite: 2].

### Como executar
Por ser uma aplicação estática pura, basta abrir o arquivo `index.html` diretamente no navegador ou hospedar a pasta em qualquer servidor estático (como GitHub Pages ou Live Server)[cite: 2].

---

## 🇺🇸 English

**Databricks Academy** is an interactive study guide and learning platform focused on the **Databricks** ecosystem, built entirely with vanilla HTML, CSS, and JavaScript (zero build steps required).

It pairs concise lessons (Lakehouse, Delta Lake, PySpark, Spark SQL, Auto Loader, Unity Catalog, and Workflows) with instant-feedback exercises, a data cleaning lab, and an integrated AI tutor (*Datrics*) supporting multiple free-tier providers via BYOK (*Bring Your Own Key*).

🔗 **Live Demo:** [https://rehkkj.github.io/Databricks-Project-Academy/](https://rehkkj.github.io/Databricks-Project-Academy/)

### Key Features
- **Lessons & Hands-on Practice:** Multiple-choice questions and coding challenges executed safely in the browser using an isolated Python environment (Pyodide via Web Worker).
- **AI Tutor (Datrics):** Context-aware floating assistant with adjustable explanation depth (*ELI5*, *Mid-level*, *Architect*), error diagnostics, custom question generation, and automatic fallback across multiple providers (Gemini, OpenRouter, Groq, Cloudflare Workers AI, NVIDIA NIM, Cohere, Z.AI, SambaNova Cloud and Mistral Studio).
- **Study Tools:** Interactive mind maps exportable to SVG/PNG, skill radar and lesson heatmaps, a dirty-data laboratory, and bookmarking for snippets and exercises.
- **Customization & Built-in Editor:** Live content and theme editor (light/dark modes, color palettes, typography) with encrypted backup support for API keys and local progress[cite: 2].

### Getting Started
Since this is a pure static web app, simply open `index.html` in any modern browser or serve the folder via any static host (such as GitHub Pages or VS Code Live Server)[cite: 2].

## Correção do Datrics — geração de módulos

- Geração de questões de módulos usa múltipla escolha como formato padrão, evitando alternância automática para exercícios de código que podia falhar na validação.
- Reconhecimento de Python/Pandas/NumPy/Matplotlib/Jupyter como domínio Python.
- Prompts e texto de aula adaptados ao assunto, sem forçar contexto Databricks em módulos de Python.
- Parser de questões aceita respostas em arrays e objetos com chaves comuns (`questions`, `questoes`, `items`, `exercises` etc.).
- Validação aceita índice numérico da alternativa correta e campos equivalentes em respostas de exercícios de código.
- Se a API não produzir questões válidas após novas tentativas, a aula e o módulo ainda são salvos, com aviso, em vez de abortar toda a criação.


## Atualização da trilha (20/11/2026)

- A trilha padrão foi recriada em 4 módulos e 12 aulas.
- Cada aula inclui conteúdo aprofundado, 3 questões e 2 cards de estudo (36 questões e 24 cards no total).
- O conteúdo segue o formato estruturado usado pelo Datrics e a renderização padrão da apostila.
- Na primeira abertura desta versão, a trilha antiga e seu progresso/estatísticas/marcações são substituídos uma única vez. Temas, configurações, chaves de API e backups salvos são preservados.
- O botão de fechar do Datrics agora tem área de toque ampliada e permanece alinhado ao cabeçalho em telas estreitas.
