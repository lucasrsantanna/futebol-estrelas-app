# Separador de Times — Estrutura Modularizada

## Estrutura de arquivos

```
separador-times/
├── index.html          ← HTML puro, sem CSS e sem JS inline
├── style.css           ← Todo o CSS extraído do monolítico original
├── README.md           ← Este arquivo
└── js/
    ├── state.js        ← Variáveis globais de estado
    ├── firebase.js     ← Configuração Firebase + CRUD (jogadores, sessões, restrições, histórico)
    ├── utils.js        ← Funções utilitárias puras (ordenar, embaralhar, estrelas, etc.)
    ├── players.js      ← Cadastro, edição, exibição e presença de jogadores
    ├── teams.js        ← Algoritmo de separação de times com restrições
    ├── finance.js      ← Controle financeiro (sessões, pendências, pagamentos)
    ├── history.js      ← Histórico de times
    ├── restrictions.js ← Configuração de restrições entre jogadores
    ├── ui.js           ← Navegação, sidebar, sync status, atualização de UI
    └── app.js          ← Bootstrap, event listeners globais (carregado por último)
```

## Como usar

### Opção 1 — Abrir direto no navegador
1. Copie a pasta `separador-times/` para qualquer lugar
2. Abra `index.html` no navegador
3. Funciona com o Firebase de produção configurado no `firebase.js`

### Opção 2 — VS Code com Live Server (recomendado para desenvolvimento)
1. Abra a pasta `separador-times/` no VS Code
2. Instale a extensão "Live Server"
3. Clique em "Go Live" no canto inferior direito
4. Edite qualquer arquivo e o navegador atualiza automaticamente

### Opção 3 — Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## Como adicionar novas funcionalidades

- **Nova funcionalidade de jogadores** → edite `js/players.js`
- **Mudança no algoritmo de times** → edite `js/teams.js`
- **Novo relatório financeiro** → edite `js/finance.js`
- **Novo estilo visual** → edite `style.css`
- **Nova seção no menu** → adicione em `index.html` + crie função em `js/ui.js`

## Regra de ouro

Cada arquivo JS pode ler variáveis de `state.js` e chamar funções de outros arquivos
(pois todos são carregados no escopo global do `window`).
A **ordem dos `<script>` no index.html importa**:
`state.js` → `firebase.js` → `utils.js` → módulos → `app.js`

## Produção

O arquivo original (`producao-backup.html`) **não deve ser alterado**.
Qualquer mudança deve ser feita nesta estrutura modularizada, testada localmente,
e só depois implantada no servidor de produção.
