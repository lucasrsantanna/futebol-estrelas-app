# Swap Manual + Algoritmo Multi-Tentativa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar algoritmo multi-tentativa (30 runs, menor discrepância de médias) e swap manual tap-tap de jogadores entre times com re-render state-driven em tempo real.

**Architecture:** `timesFormados` (global em `state.js`) passa a ser a fonte única de verdade. O DOM é sempre derivado do estado via `renderizarTimes()`. O fluxo novo bypassa o `aprovacaoModal` existente — os times são exibidos diretamente na tela com um botão "Confirmar Times".

**Tech Stack:** Vanilla JS (sem build step, sem framework), Firebase Realtime Database, HTML/CSS mobile-first. Sem test runner — verificações via DevTools console + visual no browser.

---

## File Map

| Arquivo | Tipo | O que muda |
|---------|------|-----------|
| `js/state.js` | Modify `:21` | +4 variáveis de estado para swap |
| `js/teams.js` | Modify `:5-36` + Append | Algoritmo multi-tentativa, `renderizarTimes`, funções de swap/confirmar/redistribuir |
| `style.css` | Modify `:147` + Insert `:155` | `.team-player` com interatividade, `.swap-selected`, `.swap-banner` |
| `index.html` | Insert `:113` | `#confirmarTimesContainer` com botões Confirmar e Redistribuir |

**Arquivos que NÃO mudam:** `js/finance.js`, `js/firebase.js`, `js/history.js`, `js/restrictions.js`, `js/ui.js`, `js/app.js`, `js/utils.js`, `js/players.js`.

---

## Task 1: Foundations — state.js + CSS + HTML

Estabelecer a base de estado e estrutura visual antes de qualquer lógica. Após esta task, a página carrega sem erros e as novas variáveis existem no escopo global.

**Files:**
- Modify: `js/state.js:21`
- Modify: `style.css:147`
- Modify: `index.html:111`

- [ ] **Step 1: Verificar estado atual**

  Abrir o app no Live Server. No DevTools Console confirmar que `typeof timesFormados === 'object'` e `typeof swapModoAtivo === 'undefined'` (a nova variável ainda não existe).

- [ ] **Step 2: Adicionar variáveis de estado em `state.js`**

  Acrescentar as 4 linhas abaixo **ao final de `js/state.js`** (após a linha 20):

  ```javascript
  let swapJogadorSelecionado = null;
  let swapModoAtivo = false;
  let genericosAdicionados = 0;
  let confirmacaoEmAndamento = false;
  ```

- [ ] **Step 3: Atualizar `.team-player` no CSS**

  Na linha 147 de `style.css`, acrescentar `cursor: pointer; user-select: none; transition: background 0.15s, border 0.15s;` dentro da regra existente.

  Resultado esperado:
  ```css
  .team-player { background: white; margin: 8px 0; padding: 12px 14px; border-radius: 10px; border-left: 4px solid; text-align: left; min-height: 50px; display: flex; flex-direction: column; justify-content: center; cursor: pointer; user-select: none; transition: background 0.15s, border 0.15s; }
  ```

- [ ] **Step 4: Adicionar regras de swap ao CSS**

  Inserir após a linha 154 de `style.css` (após as 4 regras de `.team-3`):

  ```css
  .team-player.swap-selected { border: 2px solid #9C27B0; background: rgba(156, 39, 176, 0.08); border-radius: 8px; }
  .swap-banner { background: #f3e5f5; border: 1px solid #9C27B0; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #6a1b9a; }
  ```

- [ ] **Step 5: Adicionar `#confirmarTimesContainer` no HTML**

  Em `index.html`, inserir imediatamente após a linha 111 (`<div class="teams-container" id="teamsContainer" ...>`). A linha 113 é o FAB button — o novo bloco vai entre eles:

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

- [ ] **Step 6: Verificar no browser**

  Recarregar o app no Live Server. No DevTools Console verificar:
  ```javascript
  swapModoAtivo      // deve retornar: false
  genericosAdicionados // deve retornar: 0
  document.getElementById('confirmarTimesContainer') // deve retornar: o elemento (não null)
  ```
  Não deve haver nenhum erro no Console.

- [ ] **Step 7: Commit**

  ```bash
  git add js/state.js style.css index.html
  git commit -m "feat: foundations para swap — estado, CSS e HTML"
  ```

---

## Task 2: Algoritmo multi-tentativa

Adicionar `encontrarMelhorDistribuicao` e atualizar `window.separarTimes`. Inclui um stub de `renderizarTimes` para evitar erros — a implementação completa vem na Task 3.

**Files:**
- Modify: `js/teams.js:5` (inserir após NOMES_EQUIPES)
- Modify: `js/teams.js:9-36` (substituir window.separarTimes completo)

- [ ] **Step 1: Verificar o algoritmo atual**

  No Console do browser, com pelo menos 6 jogadores presentes, executar:
  ```javascript
  separarTimes()
  ```
  Confirmar que abre o `aprovacaoModal` (comportamento antigo). Fechar o modal.

- [ ] **Step 2: Adicionar constante e `encontrarMelhorDistribuicao` em `teams.js`**

  Inserir após a linha 5 (`const NOMES_EQUIPES = ...`) em `js/teams.js`:

  ```javascript
  const MAX_TENTATIVAS_BALANCEAMENTO = 30;

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

- [ ] **Step 3: Adicionar stub de `renderizarTimes` em `teams.js`**

  Inserir temporariamente após a função `encontrarMelhorDistribuicao` (antes de `window.separarTimes`). Este stub será substituído na Task 3:

  ```javascript
  function renderizarTimes(times, _genericosAdicionados) {
      console.log('[renderizarTimes stub] times:', times.length, 'times,',
          times.map(t => (t.reduce((s,j)=>s+j.estrelas,0)/t.length).toFixed(2)).join(' / '), 'médias');
  }
  ```

- [ ] **Step 4: Substituir `window.separarTimes` em `teams.js`**

  Substituir o corpo completo de `window.separarTimes` (linhas 9–36 do arquivo original, que agora têm offset diferente pela inserção acima) pela versão nova:

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

- [ ] **Step 5: Verificar no browser**

  Recarregar o app. Selecionar jogadores e clicar em "Separar Times". Verificar no Console:
  - A mensagem do stub aparece, ex: `[renderizarTimes stub] times: 3 times, 6.20 / 6.20 / 6.20 médias`
  - O `aprovacaoModal` **não** abre mais
  - O botão "Confirmar Times" aparece na tela (mesmo que os times não estejam renderizados ainda)
  - Nenhum erro no Console

- [ ] **Step 6: Commit**

  ```bash
  git add js/teams.js
  git commit -m "feat: algoritmo multi-tentativa com MAX_TENTATIVAS_BALANCEAMENTO=30"
  ```

---

## Task 3: `renderizarTimes` — implementação completa

Substituir o stub pelo render completo: banner de swap, cards de jogadores, layout de grid, `balanceInfo`.

**Files:**
- Modify: `js/teams.js` — substituir o stub `renderizarTimes`

**Referência:** A função `exibirTimes` (em `teams.js`, mantida no código mas fora do fluxo) contém o cálculo de stats e o HTML de `balanceInfo` — usar como referência direta para as partes de stats.

- [ ] **Step 1: Substituir o stub `renderizarTimes`**

  Localizar a função stub (inserida na Task 2) e substituí-la pela implementação completa:

  ```javascript
  function renderizarTimes(times, genericosAdicionados = 0) {
      const container = document.getElementById('teamsContainer');
      const n = times.length;
      container.className = `teams-container ${n === 2 ? 'two-teams' : n === 3 ? 'three-teams' : 'four-teams'}`;
      container.style.display = 'grid';

      const stats = times.map(t => ({
          total:       t.reduce((s, j) => s + j.estrelas, 0),
          media:       parseFloat(t.length ? (t.reduce((s, j) => s + j.estrelas, 0) / t.length).toFixed(1) : 0),
          jogadores:   t.length,
          mensalistas: t.filter(j => !j.isGenerico && (j.tipo || 'mensalista') === 'mensalista').length,
          avulsos:     t.filter(j => !j.isGenerico && j.tipo === 'avulso').length,
          genericos:   t.filter(j => j.isGenerico).length
      }));

      const banner = swapModoAtivo
          ? `<div class="swap-banner">
                 <span>🔄 Selecione um jogador do outro time para trocar</span>
                 <button onclick="cancelarSwap()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#6a1b9a;">✕</button>
             </div>`
          : '';

      container.innerHTML = banner + times.map((time, timeIdx) =>
          `<div class="team team-${timeIdx}">
              <h3>${NOMES_EQUIPES[timeIdx]}</h3>
              <div class="team-stats">
                  <strong>Total: ${stats[timeIdx].total} ⭐</strong><br>
                  <strong>Média: ${stats[timeIdx].media}</strong><br>
                  <strong>Jogadores: ${stats[timeIdx].jogadores}</strong><br>
                  <strong>Mensalistas: ${stats[timeIdx].mensalistas} | Avulsos: ${stats[timeIdx].avulsos}</strong>
                  ${stats[timeIdx].genericos > 0 ? `<br><strong>Genéricos: ${stats[timeIdx].genericos}</strong>` : ''}
              </div>
              ${time.map((j, jogadorIdx) => {
                  const selecionado = swapJogadorSelecionado &&
                      swapJogadorSelecionado.timeIdx === timeIdx &&
                      swapJogadorSelecionado.jogadorIdx === jogadorIdx;
                  return `<div class="team-player${selecionado ? ' swap-selected' : ''}"
                               style="${j.isGenerico ? 'opacity:.7;font-style:italic;' : ''}"
                               data-time-idx="${timeIdx}"
                               data-jogador-idx="${jogadorIdx}"
                               onclick="handleSwapTap(${timeIdx}, ${jogadorIdx})">
                      <div class="team-player-name">${j.isGenerico ? j.nome + ' 👤' : formatarNomeComTipo(j)}</div>
                      <div class="team-player-stars">${criarEstrelas(j.estrelas)}</div>
                  </div>`;
              }).join('')}
          </div>`
      ).join('');

      const medias = stats.map(s => s.media);
      const diff   = Math.max(...medias) - Math.min(...medias);
      const qualidade = diff <= 0.5 ? 'Excelente' : diff <= 1.0 ? 'Muito Bom' : diff <= 1.5 ? 'Bom' : diff <= 2.0 ? 'Regular' : 'Pode melhorar';
      const emoji  = diff <= 1.0 ? '🟢' : diff <= 2.0 ? '🟡' : '🔴';

      const balanceInfo = document.getElementById('balanceInfo');
      balanceInfo.innerHTML = `
          <h3>📊 Análise da Distribuição</h3>
          <p><strong>Times formados:</strong> ${n} times</p>
          ${genericosAdicionados > 0 ? `<p><strong>Genéricos adicionados:</strong> ${genericosAdicionados}</p>` : ''}
          <p><strong>Média geral:</strong> ${(medias.reduce((s, m) => s + m, 0) / medias.length).toFixed(1)} estrelas</p>
          <p><strong>Maior diferença:</strong> ${diff.toFixed(1)} estrelas</p>
          <p><strong>Qualidade:</strong> ${qualidade}</p>
          <p style="font-size:13px;margin-top:10px;color:#666;">${emoji} ${qualidade === 'Excelente' || qualidade === 'Muito Bom' ? 'Times muito bem balanceados!' : qualidade === 'Bom' ? 'Times bem balanceados' : 'Considere redistribuir alguns jogadores'}</p>
          ${Object.keys(restricoes).length > 0 ? '<p style="font-size:12px;margin-top:10px;color:#9c27b0;">🚫 Restrições entre jogadores foram respeitadas</p>' : ''}
          ${genericosAdicionados > 0 ? `<p style="font-size:12px;margin-top:15px;padding:10px;background:#fff3cd;border-radius:8px;color:#856404;"><strong>💡 Dica:</strong> Os jogadores genéricos podem ser substituídos por qualquer pessoa disponível no dia.</p>` : ''}
      `;
      balanceInfo.style.display = 'block';
      balanceInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });

      atualizarBotaoConfirmar();
  }
  ```

- [ ] **Step 2: Verificar no browser**

  Recarregar. Selecionar jogadores e clicar em "Separar Times". Verificar:
  - Times aparecem na tela com cards de jogadores (sem o `aprovacaoModal`)
  - `#balanceInfo` mostra as stats corretas
  - Botões "Confirmar Times" e "Redistribuir" aparecem abaixo dos times
  - No Console: nenhum erro

- [ ] **Step 3: Verificar layout em diferentes quantidades de times**

  Testar com 2 times, 3 times e 4 times no seletor. Verificar que o grid aplica as classes `two-teams`, `three-teams`, `four-teams` corretamente. No Console:
  ```javascript
  document.getElementById('teamsContainer').className
  // deve incluir 'two-teams' / 'three-teams' / 'four-teams' conforme selecionado
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add js/teams.js
  git commit -m "feat: renderizarTimes substitui exibirTimes no fluxo novo"
  ```

---

## Task 4: Swap — handleSwapTap, cancelarSwap, atualizarBotaoConfirmar

Adicionar as funções de interação com toque. Após esta task, o swap completo funciona visualmente.

**Files:**
- Modify: `js/teams.js` — append ao final do arquivo

- [ ] **Step 1: Adicionar `atualizarBotaoConfirmar`, `window.cancelarSwap`, `window.handleSwapTap` ao final de `teams.js`**

  ```javascript
  // ---------- Swap manual ----------

  function atualizarBotaoConfirmar() {
      const btn = document.getElementById('btnConfirmarTimes');
      if (btn) btn.disabled = swapModoAtivo;
  }

  window.cancelarSwap = function() {
      swapJogadorSelecionado = null;
      swapModoAtivo = false;
      renderizarTimes(timesFormados, genericosAdicionados);
      atualizarBotaoConfirmar();
  };

  window.handleSwapTap = function(timeIdx, jogadorIdx) {
      const sel = swapJogadorSelecionado;

      if (sel === null) {
          swapJogadorSelecionado = { timeIdx, jogadorIdx };
          swapModoAtivo = true;
      } else if (timeIdx === sel.timeIdx && jogadorIdx === sel.jogadorIdx) {
          swapJogadorSelecionado = null;
          swapModoAtivo = false;
      } else if (timeIdx === sel.timeIdx) {
          swapJogadorSelecionado = { timeIdx, jogadorIdx };
      } else {
          const tmp = timesFormados[sel.timeIdx][sel.jogadorIdx];
          timesFormados[sel.timeIdx][sel.jogadorIdx] = timesFormados[timeIdx][jogadorIdx];
          timesFormados[timeIdx][jogadorIdx] = tmp;
          swapJogadorSelecionado = null;
          swapModoAtivo = false;
      }

      renderizarTimes(timesFormados, genericosAdicionados);
      // atualizarBotaoConfirmar() já é chamado dentro de renderizarTimes
  };
  ```

- [ ] **Step 2: Verificar seleção de jogador**

  Recarregar. Gerar times. Tocar/clicar em um jogador. Verificar:
  - Card do jogador recebe borda roxa e fundo levemente roxo (classe `swap-selected`)
  - Banner "🔄 Selecione um jogador do outro time para trocar" aparece acima dos times
  - Botão "Confirmar Times" fica `disabled` (visualmente acinzentado)
  - No Console: `swapModoAtivo === true`, `swapJogadorSelecionado !== null`

- [ ] **Step 3: Verificar deselect (mesmo jogador)**

  Tocar/clicar no mesmo jogador selecionado. Verificar:
  - O highlight roxo some
  - O banner desaparece
  - Botão "Confirmar Times" volta a ficar habilitado
  - No Console: `swapModoAtivo === false`, `swapJogadorSelecionado === null`

- [ ] **Step 4: Verificar migração de seleção (mesmo time)**

  Selecionar jogador A. Depois tocar em jogador B do mesmo time. Verificar:
  - O highlight move do jogador A para o jogador B
  - Os jogadores não trocam de posição

- [ ] **Step 5: Verificar swap (times diferentes)**

  Selecionar jogador A do Time 1. Tocar em jogador B do Time 2. Verificar:
  - Os dois jogadores trocam de time na tela
  - As médias na `balanceInfo` são recalculadas
  - O banner e o highlight desaparecem
  - Botão "Confirmar Times" volta a ficar habilitado
  - No Console: `swapModoAtivo === false`

- [ ] **Step 6: Verificar botão ✕ do banner (cancelarSwap)**

  Selecionar um jogador. Clicar no ✕ do banner. Verificar:
  - O banner desaparece
  - O highlight some
  - Botão "Confirmar Times" volta a ficar habilitado

- [ ] **Step 7: Commit**

  ```bash
  git add js/teams.js
  git commit -m "feat: swap manual tap-tap com highlight e banner de instrução"
  ```

---

## Task 5: confirmarTimes + redistribuirTimes — fluxo completo

Conectar os botões ao Firebase e ao modal financeiro.

**Files:**
- Modify: `js/teams.js` — append ao final do arquivo

- [ ] **Step 1: Adicionar `window.confirmarTimes` e `window.redistribuirTimes` ao final de `teams.js`**

  ```javascript
  // ---------- Confirmar / Redistribuir ----------

  window.confirmarTimes = function() {
      if (!timesFormados || confirmacaoEmAndamento) return;

      // Guard contra double-tap: flag dedicada porque mostrarModalFinanceiro() (finance.js linha 9)
      // restaura timesFormados = ultimaDistribuicao.times, tornando o guard timesFormados===null ineficaz.
      confirmacaoEmAndamento = true;
      const timesParaSalvar = timesFormados;
      const genericosParaSalvar = genericosAdicionados;

      // Compatibilidade com mostrarModalFinanceiro() que lê ultimaDistribuicao
      ultimaDistribuicao = { times: timesParaSalvar, genericosNecessarios: genericosParaSalvar };

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

- [ ] **Step 2: Verificar fluxo de confirmação**

  Gerar times. Fazer um swap opcional. Clicar em "Confirmar Times". Verificar:
  - Modal financeiro abre normalmente (mostra jogadores presentes com valores corretos)
  - O botão "Confirmar Times" desaparece da tela

- [ ] **Step 3: Verificar salvamento no Firebase**

  Após confirmar e fechar o modal financeiro, ir para "Histórico de Times". Verificar:
  - O registro aparece no histórico com os times corretos (incluindo swaps realizados)
  - Jogadores trocados aparecem nos times corretos (não nas posições originais do algoritmo)

- [ ] **Step 4: Verificar proteção contra double-tap**

  No Console, executar duas vezes rapidamente:
  ```javascript
  confirmarTimes(); confirmarTimes();
  ```
  Verificar que apenas **um** registro aparece no histórico (não dois).

- [ ] **Step 5: Verificar redistribuição**

  Gerar times. Fazer um swap. Clicar em "Redistribuir". Verificar:
  - A tela limpa (times sumem)
  - Novos times são gerados e exibidos imediatamente
  - O swap anterior não persiste nos novos times
  - No Console: `swapModoAtivo === false`, `swapJogadorSelecionado === null`

- [ ] **Step 6: Verificar que o fluxo antigo ainda não quebra**

  Confirmar que `refazerDistribuicao()` e `cancelarAprovacao()` ainda existem como funções no escopo (mesmo que o modal não apareça mais no fluxo normal). No Console:
  ```javascript
  typeof refazerDistribuicao  // deve retornar 'function'
  typeof cancelarAprovacao    // deve retornar 'function'
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add js/teams.js
  git commit -m "feat: confirmarTimes e redistribuirTimes — fluxo completo com Firebase"
  ```

---

## Checklist final de verificação

Antes de considerar a feature completa, verificar:

- [ ] Gerar times com 2, 3 e 4 times — layout correto em mobile (320px)
- [ ] Fazer múltiplos swaps em sequência — médias recalculam corretamente a cada swap
- [ ] Confirmar: histórico no Firebase tem os times com swaps aplicados
- [ ] Redistribuir mid-swap (com jogador selecionado): banner e highlight somem, novos times aparecem limpos
- [ ] Confirmar sem ter feito nenhum swap: funciona normalmente
- [ ] DevTools Console: nenhum erro em qualquer um dos fluxos acima

- [ ] **Commit final (se houver ajustes)**

  ```bash
  git add -A
  git commit -m "fix: ajustes finais swap e algoritmo multi-tentativa"
  ```
