# Design: Swap Manual de Jogadores + Algoritmo Multi-Tentativa

**Data:** 2026-04-21  
**Status:** Aprovado  
**Arquivo alvo principal:** `js/teams.js`  
**Arquivos secundários:** `js/state.js`, `js/finance.js`, `style.css`, `index.html`

---

## Contexto

O app é um gerenciador de peladas de futebol mobile-first em Vanilla JS + Firebase Realtime Database. Os times são formados por um algoritmo que embaralha jogadores por faixa de estrelas respeitando restrições (pares de jogadores que não podem ficar no mesmo time). Atualmente o algoritmo faz até 10 retentativas aleatórias e exibe o primeiro resultado válido.

Duas melhorias foram solicitadas:

1. **Swap manual:** após a distribuição, o usuário pode trocar jogadores entre times via toque duplo (tap-tap) antes de confirmar.
2. **Algoritmo multi-tentativa:** o algoritmo roda 30 vezes internamente e apresenta automaticamente a distribuição com menor discrepância de médias.

---

## Decisões de design

- **Abordagem state-driven:** `timesFormados` (já existe em `state.js`) passa a ser a fonte única de verdade. O DOM é sempre reflexo do estado — nunca lido de volta.
- **Tela principal em vez de modal:** os times são exibidos diretamente na página (não no `aprovacaoModal` existente), dando mais espaço para interação em mobile.
- **Mecânica tap-tap:** primeiro toque seleciona, segundo toque em time diferente executa o swap. Não usa drag-and-drop para evitar conflito com scroll da página.
- **Cor de seleção:** `#9C27B0` (roxo) — distinto de todas as cores de time (azul, vermelho, verde, laranja/amarelo).
- **Persistência de swap entre navegação:** o estado de swap (seleção ativa, banner) persiste se o usuário navegar para outra seção e voltar. O DOM não é re-renderizado na navegação — estado e DOM permanecem em sync.

---

## Fluxo completo

```
separarTimes()
  → encontrarMelhorDistribuicao()           ← 30 tentativas, seleciona menor diff
  → timesFormados = resultado.times         ← grava no estado
  → genericosAdicionados = genericos        ← grava no estado (novo)
  → renderizarTimes(timesFormados, genericosAdicionados)
  → #confirmarTimesContainer.display = block

tap em jogador (window.handleSwapTap)
  → sem seleção → seleciona, swapModoAtivo = true, re-render
  → mesmo jogador → deseleciona, swapModoAtivo = false, re-render
  → mesmo time → migra seleção, re-render
  → time diferente → swap em timesFormados, limpa seleção, re-render
  → atualizarBotaoConfirmar()

window.confirmarTimes()
  → ultimaDistribuicao = { times: timesFormados, genericosNecessarios: genericosAdicionados }
  → salva timesFormados no Firebase (histórico)
  → chama mostrarModalFinanceiro()  ← funciona porque ultimaDistribuicao está setado
  → #confirmarTimesContainer.display = none
  → swapJogadorSelecionado = null, swapModoAtivo = false

window.redistribuirTimes()
  → #teamsContainer.innerHTML = '', display = none
  → #balanceInfo.style.display = none
  → #confirmarTimesContainer.display = none
  → timesFormados = null, genericosAdicionados = 0
  → swapJogadorSelecionado = null, swapModoAtivo = false
  → separarTimes()
```

---

## Feature 1 — Algoritmo multi-tentativa

### Constante

```javascript
const MAX_TENTATIVAS_BALANCEAMENTO = 30;
```

### Nova função em `teams.js`

```javascript
function encontrarMelhorDistribuicao(todos, numTimes) {
    let melhor = null;
    let menorDiff = Infinity;

    for (let i = 0; i < MAX_TENTATIVAS_BALANCEAMENTO; i++) {
        const resultado = distribuirComRestricoes(todos, numTimes);
        if (!resultado.sucesso) continue;

        const medias = resultado.times.map(t =>
            t.reduce((s, j) => s + j.estrelas, 0) / t.length
        );
        const diff = Math.max(...medias) - Math.min(...medias);

        if (diff < menorDiff) {
            menorDiff = diff;
            melhor = resultado;
        }

        if (diff === 0) break;
    }

    return melhor ?? {
        sucesso: false,
        mensagem: 'Não foi possível criar uma distribuição que respeite todas as restrições. Considere revisá-las.'
    };
}
```

**Critério de seleção:** menor diferença entre a maior e menor média dos times.  
**Curtocircuito:** para imediatamente se `diff === 0` (times perfeitamente iguais).  
**Camadas independentes:** as 30 tentativas externas são sobre balanceamento; as 10 retentativas internas de `distribuirComRestricoes` são sobre restrições — não se alteram.  
**`distribuirComRestricoes()` não é modificada.**

---

## Feature 2 — Swap manual

### Novas variáveis em `state.js`

```javascript
let swapJogadorSelecionado = null; // { timeIdx, jogadorIdx } ou null
let swapModoAtivo = false;
let genericosAdicionados = 0;      // preservado para renderizarTimes após redistribuição
let confirmacaoEmAndamento = false; // guard contra double-tap em confirmarTimes
```

### `window.separarTimes` — corpo atualizado (em `teams.js`)

Substituir o corpo completo da função existente. As mudanças são: usar `encontrarMelhorDistribuicao` em vez de `distribuirComRestricoes`, gravar no estado `timesFormados` e `genericosAdicionados`, e chamar `renderizarTimes` em vez de `mostrarModalAprovacao`.

```javascript
window.separarTimes = function() {
    if (jogadoresPresentes.length < 2) {
        alert('Marque pelo menos 2 jogadores para formar os times!');
        return;
    }

    const presentes = jogadoresPresentes.map(id => jogadores[id]).filter(j => j);
    let numTimes;
    const sel = document.getElementById('teamCount').value;
    if (sel === 'auto') {
        numTimes = presentes.length <= 8 ? 2 : presentes.length <= 12 ? 3 : 4;
    } else {
        numTimes = parseInt(sel);
    }

    const necessarios = numTimes * 5;
    const genericos   = Math.max(0, necessarios - presentes.length);
    const todos = [...presentes];
    for (let i = 0; i < genericos; i++) {
        todos.push({ id: `generico_${i}`, nome: `Jogador Extra ${i + 1}`, estrelas: 5, tipo: 'mensalista', isGenerico: true });
    }

    const resultado = encontrarMelhorDistribuicao(todos, numTimes);
    if (!resultado.sucesso) { alert(resultado.mensagem); return; }

    timesFormados = resultado.times;
    genericosAdicionados = genericos;
    renderizarTimes(timesFormados, genericosAdicionados);
    document.getElementById('confirmarTimesContainer').style.display = 'block';
};
```

### `renderizarTimes(times, genericosAdicionados = 0)` — nova função em `teams.js`

Assinatura: `function renderizarTimes(times, genericosAdicionados = 0)`

O parâmetro `genericosAdicionados` **shadeia intencionalmente** a variável global de mesmo nome em `state.js`. Dentro da função, sempre usar o parâmetro — nunca a global.

Responsabilidades:
- Calcula stats (total, média, contagens de mensalistas/avulsos/genéricos) diretamente do array `times` — nunca do DOM.
- Monta `#teamsContainer.innerHTML` completo: se `swapModoAtivo === true`, o banner vai no topo do innerHTML, seguido das divs de time (ver HTML do banner e do card abaixo). O banner é parte do innerHTML de `#teamsContainer` — não é inserido via `insertAdjacentHTML` nem em outro elemento.
- Define `container.className = 'teams-container ' + (n === 2 ? 'two-teams' : n === 3 ? 'three-teams' : 'four-teams')` e `container.style.display = 'grid'` para aplicar o layout correto.
- Atualiza `#balanceInfo` com stats recalculadas (diff de médias, qualidade, genéricos etc.) e exibe com `style.display = 'block'`.
- Chama `atualizarBotaoConfirmar()` ao final — garante que o estado `disabled` do botão reflete `swapModoAtivo` após qualquer re-render.

`renderizarTimes` **não** mostra nem esconde `#confirmarTimesContainer` — esse controle é responsabilidade de `separarTimes`, `confirmarTimes` e `redistribuirTimes`.

#### HTML do banner (inserido antes de `#teamsContainer` quando `swapModoAtivo === true`)

```html
<div class="swap-banner">
    <span>🔄 Selecione um jogador do outro time para trocar</span>
    <button onclick="cancelarSwap()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#6a1b9a;">✕</button>
</div>
```

`cancelarSwap` deve ser exposta como `window.cancelarSwap` (ver definição abaixo).

#### HTML de um card de jogador (gerado dentro do loop de times)

```javascript
// Dentro do map de times (timeIdx = índice do time, jogadorIdx = índice do jogador no time)
const selecionado = swapJogadorSelecionado &&
    swapJogadorSelecionado.timeIdx === timeIdx &&
    swapJogadorSelecionado.jogadorIdx === jogadorIdx;

// HTML do card:
`<div class="team-player ${selecionado ? 'swap-selected' : ''}"
      data-time-idx="${timeIdx}"
      data-jogador-idx="${jogadorIdx}"
      onclick="handleSwapTap(${timeIdx}, ${jogadorIdx})">
    <div class="team-player-name">${j.isGenerico ? j.nome + ' 👤' : formatarNomeComTipo(j)}</div>
    <div class="team-player-stars">${criarEstrelas(j.estrelas)}</div>
</div>`
```

Os valores `${timeIdx}` e `${jogadorIdx}` são interpolados como literais numéricos no momento do render, não como referências de variável — o template literal é avaliado imediatamente dentro do loop.

### `window.handleSwapTap(timeIdx, jogadorIdx)` — em `teams.js`

Deve ser exposta como `window.handleSwapTap` pois é chamada via `onclick` no HTML gerado por `renderizarTimes`.

```javascript
window.handleSwapTap = function(timeIdx, jogadorIdx) {
    const sel = swapJogadorSelecionado;

    if (sel === null) {
        swapJogadorSelecionado = { timeIdx, jogadorIdx };
        swapModoAtivo = true;
    } else if (timeIdx === sel.timeIdx && jogadorIdx === sel.jogadorIdx) {
        // mesmo jogador → cancela
        swapJogadorSelecionado = null;
        swapModoAtivo = false;
    } else if (timeIdx === sel.timeIdx) {
        // mesmo time → migra seleção
        swapJogadorSelecionado = { timeIdx, jogadorIdx };
    } else {
        // time diferente → executa swap
        const tmp = timesFormados[sel.timeIdx][sel.jogadorIdx];
        timesFormados[sel.timeIdx][sel.jogadorIdx] = timesFormados[timeIdx][jogadorIdx];
        timesFormados[timeIdx][jogadorIdx] = tmp;
        swapJogadorSelecionado = null;
        swapModoAtivo = false;
    }

    renderizarTimes(timesFormados, genericosAdicionados);
    // atualizarBotaoConfirmar() é chamado dentro de renderizarTimes
};
```

### `window.cancelarSwap()` — nova função global em `teams.js`

Deve ser exposta como `window.cancelarSwap` pois é chamada via `onclick` no banner gerado por `renderizarTimes`.

```javascript
window.cancelarSwap = function() {
    swapJogadorSelecionado = null;
    swapModoAtivo = false;
    renderizarTimes(timesFormados, genericosAdicionados);
    atualizarBotaoConfirmar();
};
```

### `atualizarBotaoConfirmar()` — função interna em `teams.js`

```javascript
function atualizarBotaoConfirmar() {
    const btn = document.getElementById('btnConfirmarTimes');
    if (btn) btn.disabled = swapModoAtivo;
}
```

O botão fica `disabled` (não escondido) enquanto `swapModoAtivo = true` — evita confirmação acidental durante troca em andamento.

### `window.confirmarTimes()` — nova função global em `teams.js`

Deve ser exposta como `window.confirmarTimes` pois é chamada via `onclick` no HTML estático.

```javascript
window.confirmarTimes = function() {
    if (!timesFormados || confirmacaoEmAndamento) return;

    // Guard contra double-tap: flag dedicada porque mostrarModalFinanceiro() (finance.js linha 9)
    // restaura timesFormados = ultimaDistribuicao.times, tornando o guard timesFormados===null ineficaz.
    confirmacaoEmAndamento = true;
    const timesParaSalvar = timesFormados;
    const genericosParaSalvar = genericosAdicionados;

    // Compatibilidade com mostrarModalFinanceiro() que lê ultimaDistribuicao
    ultimaDistribuicao = { times: timesParaSalvar, genericosNecessarios: genericosParaSalvar };

    // Salvar no histórico Firebase (mesmo shape atual)
    salvarHistoricoTimes({
        id: Date.now().toString(),
        data: new Date().toISOString(),
        times: timesParaSalvar.map(time =>
            time.map(j => ({ id: j.id, nome: j.nome, estrelas: j.estrelas, tipo: j.tipo, isGenerico: j.isGenerico || false }))
        ),
        totalJogadores: jogadoresPresentes.length,
        genericosAdicionados: genericosParaSalvar
    });

    document.getElementById('confirmarTimesContainer').style.display = 'none';
    swapJogadorSelecionado = null;
    swapModoAtivo = false;
    confirmacaoEmAndamento = false;

    mostrarModalFinanceiro();
};
```

### `window.redistribuirTimes()` — nova função global em `teams.js`

Deve ser exposta como `window.redistribuirTimes` pois é chamada via `onclick` no HTML estático.

```javascript
window.redistribuirTimes = function() {
    const tc = document.getElementById('teamsContainer');
    tc.innerHTML = '';
    tc.style.display = 'none';
    document.getElementById('balanceInfo').style.display = 'none';
    document.getElementById('confirmarTimesContainer').style.display = 'none';

    timesFormados = null;
    genericosAdicionados = 0;
    swapJogadorSelecionado = null;
    swapModoAtivo = false;
    confirmacaoEmAndamento = false;

    separarTimes();
};
```

---

## HTML — `index.html`

Adicionar imediatamente após `#teamsContainer` (que já existe):

```html
<div id="confirmarTimesContainer" style="display:none; margin-top:20px;">
    <button class="btn btn-full" id="btnConfirmarTimes" onclick="confirmarTimes()">
        ✅ Confirmar Times
    </button>
    <button class="btn btn-full" onclick="redistribuirTimes()" style="background:#666; margin-top:8px;">
        🔄 Redistribuir
    </button>
</div>
```

O `aprovacaoModal` existente permanece no HTML sem alteração — apenas sai do fluxo ativo.

> **Nota sobre `onclick` e `window`:** Atributos `onclick` no HTML estático (`confirmarTimes()`, `redistribuirTimes()`) resolvem nomes no escopo global (`window`) implicitamente — o browser busca `window.confirmarTimes`. Isso é equivalente a `window.confirmarTimes()` e é a razão pela qual as funções devem ser expostas em `window` no JS.

---

## CSS — `style.css`

Três regras novas:

```css
.team-player {
    /* acrescentar às regras existentes: */
    cursor: pointer;
    user-select: none;
    transition: background 0.15s, border 0.15s;
}

.team-player.swap-selected {
    border: 2px solid #9C27B0;
    background: rgba(156, 39, 176, 0.08);
    border-radius: 8px;
}

.swap-banner {
    background: #f3e5f5;
    border: 1px solid #9C27B0;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: #6a1b9a;
}
```

---

## Compatibilidade e restrições

- `finance.js` **não é modificado.** `mostrarModalFinanceiro()` continua lendo `ultimaDistribuicao` — `confirmarTimes()` o popula antes de chamar a função.
- Estrutura do Firebase não muda — shape de `timesFormados` é idêntico ao de `ultimaDistribuicao.times` atual.
- `distribuirComRestricoes()` e `temRestricao()` não são modificadas.
- `exibirTimes()` mantida no código mas não é chamada pelo fluxo novo.
- `confirmarDistribuicao()` e `mostrarModalAprovacao()` mantidas no código mas fora do fluxo ativo.
- Fallback localStorage não é afetado (presença continua salva independentemente).
- Funciona em 320px–768px+ sem layout break.

---

## O que NÃO está no escopo

- Persistência dos swaps no localStorage entre sessões.
- Animação de transição no swap.
- Undo/redo de swaps.
- Validação de restrições ao executar um swap manual (restrições são respeitadas pelo algoritmo; swaps manuais são intencionalidade do usuário).
- Auto-cancelamento do estado de swap ao navegar entre seções (o estado persiste e o banner continua visível ao retornar — comportamento aceitável para v1).
