# Importação de Lista do WhatsApp — Design Spec

## Objetivo

Permitir colar a lista de presença enviada no WhatsApp e automaticamente marcar jogadores como presentes, com detecção de duplicatas e cadastro inline de jogadores novos. Nenhuma alteração no Firebase ocorre antes da confirmação final.

---

## Contexto do Projeto

- Vanilla JS, sem build step, sem ES6 modules — variáveis globais, padrão `window.X`
- Firebase Realtime Database com 72+ jogadores cadastrados em produção — sem alterações de schema
- Mobile-first (320px–768px), touch
- Estado global em `js/state.js`; funções CRUD em `js/firebase.js`
- Funções expostas ao HTML via `window.X = function() {...}`
- Scripts carregados na ordem: `state.js → firebase.js → utils.js → players.js → import.js → teams.js → finance.js → history.js → restrictions.js → ui.js → app.js`

---

## Fluxo Geral

1. Usuário toca **"📋 Importar Lista"** no header da tela de presença
2. Modal abre — usuário cola o texto do WhatsApp no textarea
3. Toca **"Processar"** → parser + algoritmo de match rodam localmente (sem Firebase). Se `Object.values(jogadores).length === 0`, exibir mensagem inline "Aguarde o carregamento dos jogadores antes de importar." e interromper.
4. Tela de revisão (acordeão) substitui o textarea no mesmo modal:
   - **Confirmados** — colapsados, pré-selecionados
   - **Quem é esse?** — aberto, casos ambíguos ou com match parcial
   - **Novos** — aberto, nomes sem nenhum match
5. Usuário resolve ambíguos e decide sobre novos
6. Toca **"✅ Confirmar X como presentes"** → chama `salvarJogador()` para novos + adiciona IDs diretamente a `jogadoresPresentes` (sem chamar `togglePresenca()` individualmente para evitar N re-renders) + fecha modal

---

## Parser

### Seções reconhecidas

| Seção no texto | Tipo atribuído |
|---|---|
| `Mensalistas` | `mensalista` |
| `Avulsos` | `avulso` |

### Seções ignoradas

`Goleiros`, `DM (não vai)`, `Lista de espera` — e qualquer outra seção não listada acima.

### Detecção de cabeçalho de seção

Uma linha é reconhecida como cabeçalho de seção quando, após remover marcadores de negrito do WhatsApp (`*...*`) e dois-pontos finais, o texto resultante em lowercase contém exatamente uma das palavras-chave: `mensalistas` ou `avulsos`.

Exemplos aceitos: `Mensalistas`, `*Mensalistas*`, `Avulsos:`, `*Avulsos:*`

Implementação:
```javascript
function extrairCabecalho(linha) {
    return linha.replace(/\*/g, '').replace(/:$/, '').trim().toLowerCase();
}
// extrairCabecalho('*Mensalistas:*') === 'mensalistas' → seção reconhecida
```

### Formato de linha aceito

```
1- Nome
1-Nome
1 - Nome
```

Regex: `/^\d+\s*-\s*(.+)/`

### Normalização de nome

1. Trim e colapsar espaços múltiplos
2. Capitalizar primeira letra de cada palavra

Função `normalizarNome(str)` em `utils.js` — usada para exibição e salvamento:

```javascript
function normalizarNome(str) {
    return str.trim().replace(/\s+/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase());
}
```

Para comparação usar `normalizarParaMatch(str)` — retorna string sem acentos e lowercase (ver seção Arquivos Modificados).

---

## Algoritmo de Match

Para cada nome extraído do WhatsApp, buscar em `Object.values(jogadores)` usando 4 níveis em ordem de prioridade:

### Nível 1 — Confirmado (match exato ou acento)

```
normalizarParaMatch(nomeWhatsApp) === normalizarParaMatch(jogador.nome)
```

Resultado: ✅ pré-selecionado, sem interação necessária.

### Nível 2 — Confirmado (contém)

```
normalizarParaMatch(jogador.nome).includes(normalizarParaMatch(nomeWhatsApp))
|| normalizarParaMatch(nomeWhatsApp).includes(normalizarParaMatch(jogador.nome))
```

Aplicar somente quando `Math.min(a.length, b.length) >= 4` (sendo `a` e `b` os dois nomes normalizados), para evitar falsos positivos com nomes curtos.

Exemplos: `Diogo` → `Diogo (rennan)` / `Nandão` → `Nandao`

Resultado: ✅ pré-selecionado, sem interação necessária.

### Nível 3 — Possível (token parcial / prefixo)

Tokenizar **ambos** os nomes (split por espaço). Para cada par de tokens (um de cada nome), verificar se um é prefixo do outro. Ambos os tokens no par devem ter ≥ 3 caracteres para evitar falsos positivos.

Exemplo: `Daniel` → `Dan Nego` — token `"dan"` (de `nomeWhatsApp` normalizado) é prefixo de `"daniel"` (nome do banco normalizado) → match.

Resultado: ⚠️ aparece em "Quem é esse?", pré-selecionado como sugestão mais provável.

### Nível 4 — Possível (Levenshtein)

```
calcularLevenshtein(normalizarParaMatch(nomeWhatsApp), normalizarParaMatch(jogador.nome)) <= 3
```

Somente quando **ambos** os nomes tiverem ≥ 5 caracteres (evitar falsos positivos em nomes curtos).

Resultado: ⚠️ aparece em "Quem é esse?" como opção secundária.

### Múltiplos matches (qualquer nível)

Se um nome do WhatsApp tiver mais de um match no mesmo nível, todos aparecem como opções — o primeiro da lista pré-selecionado.

Exemplo: `Felipe` → `Felipe Jota`, `Felipe Moreira`, `Gu Felipe`

### Sem match

Resultado: ❓ aparece em "Novos".

---

## UI

### Header da tela de presença

- **Remove** botão "Marcar todos avulsos"
- **Adiciona** botão `<button onclick="abrirImportModal()">📋 Importar Lista</button>`

### Modal — Passo 1: Colar texto

```html
<div id="importModal" class="edit-modal">
  <div class="edit-modal-content">
    <h3>📋 Importar Lista do WhatsApp</h3>
    <textarea id="importTextarea" placeholder="Cole aqui a lista..."></textarea>
    <button onclick="processarListaWhatsApp()">Processar →</button>
    <button onclick="fecharImportModal()">Cancelar</button>
  </div>
</div>
```

### Modal — Passo 2: Revisão (acordeão)

O conteúdo do modal é substituído pelo render da revisão. Até três seções:

#### Seção Confirmados (colapsada por padrão)

- Cabeçalho: "✅ Confirmados (N)" com seta de expansão
- Expandida mostra: nome de cada jogador + nome no banco + checkbox pré-marcado
- Tap no cabeçalho expande/colapsa

#### Seção "Quem é esse?" (aberta)

Só aparece se houver casos ambíguos ou possíveis.

Para cada nome com múltiplos matches ou match parcial:
```
"Felipe" — qual deles?
[ Felipe Jota (avulso) ]  ← pré-selecionado (borda laranja)
[ Felipe Moreira (avulso) ]
[ Gu Felipe (avulso) ]
[ Não é nenhum desses → Cadastrar novo ]
```

Tap em uma opção seleciona e deseleciona as outras (comportamento radio). Tap no selecionado deseleciona todos (nenhum marcado = ignorar esse nome).

#### Seção "Novos" (aberta)

Só aparece se houver nomes sem match.

Para cada nome sem match:
```
[Nome editável] [M / A toggle] [− 5 +] [Ignorar]
```

- Nome: input pré-preenchido com o nome normalizado (`normalizarNome`), editável
- Tipo: toggle mensalista/avulso, pré-definido pela seção do WhatsApp
- Estrelas: valor padrão 5, botões − e + (range 1–10), altura mínima 44px para touch
- "Ignorar": descarta o item (não cadastra, não marca presença)

#### Estado com apenas Confirmados

Quando todas as seções "Quem é esse?" e "Novos" estiverem ausentes (todos os nomes tiveram match automático), exibir linha de resumo antes do botão: **"N jogadores identificados automaticamente"** — o modal não deve parecer vazio.

#### Botão de confirmação (fixo na base)

```
✅ Confirmar X como presentes
```

Contador `X` atualiza em tempo real conforme o usuário altera seleções. Habilitado sempre que X ≥ 1.

---

## Confirmação Final (`window.confirmarImportacao`)

Execução em ordem:

```javascript
const baseTs = Date.now();
const novos = /* array de jogadores novos marcados para cadastrar */;
novos.forEach((j, index) => {
    const id = (baseTs + index).toString();
    salvarJogador({ id, nome: j.nome, estrelas: j.estrelas, tipo: j.tipo, criadoEm: new Date().toISOString() });
    if (!jogadoresPresentes.includes(id)) jogadoresPresentes.push(id);
});

/* Para cada jogador existente selecionado (matches confirmados/escolhidos): */
idsExistentes.forEach(id => {
    if (!jogadoresPresentes.includes(id)) jogadoresPresentes.push(id);
});

salvarSelecao();
exibirJogadoresPresentes();
fecharImportModal();
```

Usar `(baseTs + index).toString()` — não `Date.now().toString()` dentro do loop — para garantir IDs únicos quando múltiplos novos jogadores são salvos no mesmo milissegundo.

---

## Arquivos Modificados

### `js/utils.js` — adicionar ao final

Estas três funções não existem em `utils.js` — adicioná-las sem substituir nada existente.

> **Nota para implementação:** A regex de `normalizarParaMatch` remove diacríticos do Unicode (faixa U+0300–U+036F). Se os caracteres literais da regex forem corrompidos no copy-paste, use a forma explícita equivalente: `/[̀-ͯ]/g`

```javascript
function normalizarNome(str) {
    return str.trim().replace(/\s+/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase());
}

function normalizarParaMatch(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
              .toLowerCase().trim().replace(/\s+/g, ' ');
}

function calcularLevenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
    );
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
}
```

### `js/import.js` — criar (novo)

Responsabilidades:
- `window.abrirImportModal()` — exibe `#importModal`, limpa textarea
- `window.fecharImportModal()` — oculta `#importModal`
- `window.processarListaWhatsApp()` — lê textarea, valida `jogadores` carregado, chama parser, chama matcher, renderiza revisão
- `window.confirmarImportacao()` — executa salvamento e marcação de presença conforme pseudocódigo acima
- `parsearListaWhatsApp(texto)` → `[{ nome, tipo }]` — função privada
- `encontrarMatch(nomeWhatsApp)` → `{ nivel, matches[] }` — função privada
- `renderizarRevisao(resultados)` → injeta HTML de revisão no modal — função privada

### `index.html`

- Adicionar `<div id="importModal" class="edit-modal">` antes de `#sessaoModal`
- Atualizar header da seção de presença: remover botão "Marcar todos avulsos", adicionar "📋 Importar Lista"
- Adicionar `<script src="js/import.js"></script>` após `players.js`

### `style.css`

- `.import-accordion-section` — container de cada seção do acordeão
- `.import-accordion-header` — cabeçalho tocável com seta
- `.import-match-option` — card de opção de match (borda laranja quando selecionado)
- `.import-new-player` — card de novo jogador com controles inline
- `.import-stars-control` — container dos botões − N +

### `js/app.js`

- Adicionar `{ id: 'importModal', fn: fecharImportModal }` ao array `modais` do click-outside
- Adicionar `fecharImportModal()` ao handler de Escape após `fecharCadastroRapido()`

---

## Restrições

- Não alterar schema do Firebase — `salvarJogador()` já existe em `firebase.js`
- Não usar `alert()` para erros — usar feedback inline no modal
- Textarea vazia ao processar: mostrar mensagem inline "Cole a lista antes de processar"
- Lista colada sem nenhuma linha numerada reconhecida: mostrar mensagem inline "Nenhum jogador encontrado. Verifique se o formato está correto."
- Nenhuma escrita no Firebase antes de `confirmarImportacao()` ser chamada
