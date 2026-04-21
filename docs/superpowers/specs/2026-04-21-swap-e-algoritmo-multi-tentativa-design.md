# Design: Swap Manual de Jogadores + Algoritmo Multi-Tentativa

**Data:** 2026-04-21  
**Status:** Aprovado  
**Arquivo alvo principal:** `js/teams.js`  
**Arquivos secundários:** `js/state.js`, `style.css`, `index.html`

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

---

## Fluxo completo

```
separarTimes()
  → encontrarMelhorDistribuicao()     ← 30 tentativas, seleciona menor diff
  → timesFormados = melhorResultado   ← grava no estado
  → renderizarTimes()                 ← re-render completo com stats
  → exibe #confirmarTimesContainer

tap em jogador (handleSwapTap)
  → sem seleção → seleciona, swapModoAtivo = true, re-render
  → mesmo jogador → deseleciona, swapModoAtivo = false, re-render
  → mesmo time → migra seleção, re-render
  → time diferente → swap em timesFormados, limpa seleção, re-render

confirmarTimes()
  → salva timesFormados no Firebase (histórico + sessão financeira)
  → abre modal financeiro
  → esconde #confirmarTimesContainer, limpa estado de swap

redistribuirTimes()
  → limpa teamsContainer e balanceInfo da tela
  → limpa timesFormados e swapJogadorSelecionado
  → chama separarTimes() novamente
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
```

### `renderizarTimes(times)` — substitui `exibirTimes()`

- Recebe `timesFormados` como argumento.
- Calcula stats (total, média, contagens) diretamente do array — nunca do DOM.
- Cada card de jogador recebe `data-time-idx` e `data-jogador-idx` e `onclick="handleSwapTap(timeIdx, jogadorIdx)"`.
- Card com `swapJogadorSelecionado` matching recebe classe `swap-selected`.
- Quando `swapModoAtivo = true`, exibe banner de instrução acima dos times.
- Atualiza `balanceInfo` com stats recalculadas após cada swap.

### `handleSwapTap(timeIdx, jogadorIdx)` — lógica de seleção/swap

```
se swapJogadorSelecionado === null:
    swapJogadorSelecionado = { timeIdx, jogadorIdx }
    swapModoAtivo = true

senão se timeIdx === sel.timeIdx && jogadorIdx === sel.jogadorIdx:
    // mesmo jogador → cancela
    swapJogadorSelecionado = null
    swapModoAtivo = false

senão se timeIdx === sel.timeIdx:
    // mesmo time → migra seleção
    swapJogadorSelecionado = { timeIdx, jogadorIdx }

senão:
    // time diferente → executa swap
    [timesFormados[sel.timeIdx][sel.jogadorIdx], timesFormados[timeIdx][jogadorIdx]] =
    [timesFormados[timeIdx][jogadorIdx], timesFormados[sel.timeIdx][sel.jogadorIdx]]
    swapJogadorSelecionado = null
    swapModoAtivo = false

renderizarTimes(timesFormados)
atualizarBotaoConfirmar()
```

### `atualizarBotaoConfirmar()` — gerencia estado do botão

```javascript
function atualizarBotaoConfirmar() {
    const btn = document.getElementById('btnConfirmarTimes');
    if (btn) btn.disabled = swapModoAtivo;
}
```

O botão fica `disabled` (não apenas escondido) enquanto `swapModoAtivo = true` — evita confirmação acidental durante troca em andamento.

### `confirmarTimes()` — nova função global

1. Salva `timesFormados` no Firebase (histórico) — mesmo shape de `ultimaDistribuicao.times` atual.
2. Chama `mostrarModalFinanceiro()`.
3. Esconde `#confirmarTimesContainer`.
4. Limpa `swapJogadorSelecionado`, `swapModoAtivo = false`.

### `redistribuirTimes()` — nova função global

1. Limpa `#teamsContainer` e esconde `#balanceInfo` — usuário não vê times antigos durante recálculo.
2. Limpa `timesFormados = null`, `swapJogadorSelecionado = null`, `swapModoAtivo = false`.
3. Chama `separarTimes()`.

---

## HTML — `index.html`

Adicionar após `#balanceInfo` e `#teamsContainer`:

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

- Estrutura do Firebase não muda — `timesFormados` tem o mesmo shape que `ultimaDistribuicao.times` já salvo.
- `distribuirComRestricoes()` e `temRestricao()` não são modificadas.
- `exibirTimes()` pode ser mantida no código por ora (sem delete), mas não é chamada pelo fluxo novo.
- `confirmarDistribuicao()` e `mostrarModalAprovacao()` ficam no código mas fora do fluxo ativo.
- Fallback localStorage não é afetado (presença continua salva independentemente).
- Funciona em 320px–768px+ sem layout break.

---

## O que NÃO está no escopo

- Persistência dos swaps no localStorage entre sessões.
- Animação de transição no swap.
- Undo/redo de swaps.
- Validação de restrições ao executar um swap manual (restrições são respeitadas pelo algoritmo; swaps manuais são intencionalidade do usuário).
