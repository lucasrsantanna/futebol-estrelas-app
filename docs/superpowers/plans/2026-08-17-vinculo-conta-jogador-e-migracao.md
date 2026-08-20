# Vínculo Conta-Jogador e Migração — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every jogador in a grupo gets linked to a real account (`userId`), either automatically on entry or via a one-shot "autoclaim" screen for the legacy migrated roster — laying the foundation the star-voting system (next plan) needs to know who's who. Along the way, close three small pre-existing gaps the design surfaced: manual star editing still exists in the UI, presence can be un-marked by anyone, and SMS login is still live despite being dropped from the design.

**Architecture:** New `js/vinculo.js` module owns the account↔jogador linking decision (auto-create vs. show autoclaim vs. already linked) and is called from the existing `entrarNoGrupo()` in `auth.js` — every existing entry path (`criarGrupo`, `entrarPorLinkConvite`, `verificarConviteNaURL`) already funnels through `entrarNoGrupo()`, so no changes are needed there. A new admin-only "Gestão do Grupo" screen is scaffolded to host manual vínculo correction now, and will host the voting-cycle admin controls in the next plan.

**Tech Stack:** Vanilla JS (no build step, no modules — global scope), Firebase Realtime Database + Auth, Playwright for e2e tests against the homolog Firebase project (`futebol-estrelas-homolog`) via a running Live Server at `http://localhost:5500`.

## Global Constraints

- Vanilla JS, sem build step, sem frameworks (`CLAUDE.md`)
- Firebase Realtime Database: só adições de campos com default compatível, nunca altera estrutura existente (`CLAUDE.md`, spec `2026-08-17`)
- Mobile-first (320px–768px+), touch, safe-area iOS (`CLAUDE.md`)
- IDs gerados com `Date.now().toString()` (`CLAUDE.md`)
- Funções chamadas de `onclick` no HTML devem estar em `window.X` (`CLAUDE.md`)
- Ordem de scripts atual: `state → firebase → auth → utils → players → import → teams → finance → history → restrictions → grupos → migration → ui → app`. Este plano insere `vinculo.js` entre `grupos.js` e `migration.js`.
- Sem `alert()` nos fluxos novos desta spec — feedback inline (spec `2026-08-17`, seção Restrições). Fluxos antigos continuam usando `alert()` (`CLAUDE.md` — não reformatar código não tocado por este plano).
- Testar no Live Server antes de qualquer commit — `npx live-server` (ou extensão VS Code) servindo a raiz do projeto em `http://localhost:5500`, que é o `baseURL` do Playwright (`playwright.config.js`).
- Todo teste que grava dados de teste no Firebase homolog deve limpar o que criou ao final (`database.ref(...).remove()`), para não poluir o ambiente compartilhado.

---

## Task 1: `migration.js` — jogadores migrados nascem com `userId: null`

**Files:**
- Modify: `js/migration.js:16-48`
- Test: `tests/vinculo.spec.js` (novo arquivo)

**Interfaces:**
- Produces: `window._comUserIdNulo(dadosJogadores: object): object` — função pura, adiciona `userId: null` a cada jogador que ainda não tiver esse campo. Usada só internamente por `migrarDadosParaGrupo`, mas exposta em `window` (comportamento padrão de function declarations neste projeto — sem módulos ES6, toda declaração de função no escopo top-level já vira propriedade de `window`) para ser testável via `page.evaluate`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/vinculo.spec.js`:

```js
const { test, expect } = require('@playwright/test');

test.describe('Migração — vínculo de conta', () => {

    test('_comUserIdNulo adiciona userId: null a cada jogador', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const resultado = await page.evaluate(() => {
            const entrada = {
                '111': { id: '111', nome: 'Ana', estrelas: 7, tipo: 'mensalista', criadoEm: '2024-01-01T00:00:00.000Z' },
                '222': { id: '222', nome: 'Bia', estrelas: 5, tipo: 'avulso', criadoEm: '2024-01-02T00:00:00.000Z' },
            };
            return window._comUserIdNulo(entrada);
        });

        expect(resultado['111'].userId).toBeNull();
        expect(resultado['111'].nome).toBe('Ana');
        expect(resultado['111'].estrelas).toBe(7);
        expect(resultado['222'].userId).toBeNull();
        expect(resultado['222'].tipo).toBe('avulso');
    });

});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Com o Live Server rodando em `http://localhost:5500`:

Run: `npx playwright test tests/vinculo.spec.js`
Expected: FAIL — `window._comUserIdNulo is not a function`

- [ ] **Step 3: Implementar em `migration.js`**

Adicionar a função pura antes de `window.migrarDadosParaGrupo` e usá-la no loop de migração:

```js
function _comUserIdNulo(dadosJogadores) {
    const resultado = {};
    for (const [id, jogador] of Object.entries(dadosJogadores)) {
        resultado[id] = { userId: null, ...jogador };
    }
    return resultado;
}
```

Dentro do loop `for (const entidade of entidades) { ... }`, trocar:

```js
        await database.ref(`grupos/${grupoId}/${entidade}`).set(dados);
        console.log(`${entidade}: ${Object.keys(dados).length} registros migrados.`);
```

por:

```js
        const dadosParaGravar = entidade === 'jogadores' ? _comUserIdNulo(dados) : dados;
        await database.ref(`grupos/${grupoId}/${entidade}`).set(dadosParaGravar);
        console.log(`${entidade}: ${Object.keys(dadosParaGravar).length} registros migrados.`);
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx playwright test tests/vinculo.spec.js`
Expected: PASS — 1 teste passou

- [ ] **Step 5: Commit**

```bash
git add js/migration.js tests/vinculo.spec.js
git commit -m "feat: jogadores migrados nascem com userId: null"
```

---

## Task 2: `js/vinculo.js` — criação automática de jogador vinculado

**Files:**
- Create: `js/vinculo.js`
- Modify: `js/auth.js:36-51` (`entrarNoGrupo`)
- Modify: `index.html:459-460` (adiciona `<script src="js/vinculo.js">` entre `grupos.js` e `migration.js`)
- Test: `tests/vinculo.spec.js`

**Interfaces:**
- Consumes: `usuarioAtual` (Firebase Auth User, de `state.js`), `database` (de `firebase.js`), `mostrarApp()` e `inicializarListeners(grupoId)` (de `auth.js`/`firebase.js`)
- Produces:
  - `async function criarJogadorVinculado(grupoId: string, userId: string, nome: string): Promise<object>` — grava e retorna o jogador criado (`{ id, nome, estrelas: 5, tipo: 'mensalista', userId, criadoEm }`)
  - `async function resolverVinculoJogador(grupoId: string): Promise<void>` — decide entre: já vinculado (não faz nada além de finalizar entrada), sem órfãos (cria automático), com órfãos (mostra autoclaim — stub nesta task, implementado na Task 3)
  - `function _finalizarEntradaNoGrupo(grupoId: string): void` — chama `mostrarApp()` + `inicializarListeners(grupoId)`. Usada por `resolverVinculoJogador` e, na Task 3, pelas três ações da tela de autoclaim.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `tests/vinculo.spec.js`:

```js
const TEST_EMAIL    = 'teste@estrelas.com';
const TEST_PASSWORD = 'teste123456';

async function fazerLogin(page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#loadingScreen').waitFor({ state: 'hidden', timeout: 10000 });
    await page.locator('#telaLogin').waitFor({ state: 'visible' });
    await page.click('button[onclick="mostrarLoginEmail()"]');
    await page.waitForSelector('#loginEmail', { state: 'visible' });
    await page.fill('#loginEmail', TEST_EMAIL);
    await page.fill('#loginSenha', TEST_PASSWORD);
    await page.click('button[onclick="loginComEmail()"]');
}

test.describe('resolverVinculoJogador', () => {

    test('sem órfãos no grupo, cria jogador automaticamente vinculado', async ({ page }) => {
        await fazerLogin(page);
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });

        const grupoTesteId = `teste_vinculo_${Date.now()}`;

        const resultado = await page.evaluate(async (grupoId) => {
            await database.ref(`grupos/${grupoId}/membros/${usuarioAtual.uid}`).set({
                role: 'admin', entradaEm: new Date().toISOString()
            });
            await window.resolverVinculoJogador(grupoId);
            const snap = await database.ref(`grupos/${grupoId}/jogadores`).get();
            const jogadoresDoGrupo = snap.val() || {};
            return { jogador: Object.values(jogadoresDoGrupo)[0], uid: usuarioAtual.uid };
        }, grupoTesteId);

        expect(resultado.jogador).toBeTruthy();
        expect(resultado.jogador.estrelas).toBe(5);
        expect(resultado.jogador.tipo).toBe('mensalista');
        expect(resultado.jogador.userId).toBe(resultado.uid);

        await page.evaluate((grupoId) => database.ref(`grupos/${grupoId}`).remove(), grupoTesteId);
    });

});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx playwright test tests/vinculo.spec.js -g "resolverVinculoJogador"`
Expected: FAIL — `window.resolverVinculoJogador is not a function`

- [ ] **Step 3: Criar `js/vinculo.js`**

```js
// ==============================================
// vinculo.js — Vínculo entre conta e jogador
// ==============================================

async function criarJogadorVinculado(grupoId, userId, nome) {
    const id = Date.now().toString();
    const jogador = {
        id, nome, estrelas: 5, tipo: 'mensalista', userId,
        criadoEm: new Date().toISOString()
    };
    await database.ref(`grupos/${grupoId}/jogadores/${id}`).set(jogador);
    return jogador;
}

async function resolverVinculoJogador(grupoId) {
    const snap = await database.ref(`grupos/${grupoId}/jogadores`).get();
    const todos = snap.val() || {};

    const jaTemJogador = Object.values(todos).some(j => j.userId === usuarioAtual.uid);
    if (jaTemJogador) { _finalizarEntradaNoGrupo(grupoId); return; }

    const orfaos = Object.entries(todos)
        .filter(([, j]) => !j.userId)
        .map(([id, j]) => ({ ...j, id }));

    if (orfaos.length === 0) {
        await criarJogadorVinculado(grupoId, usuarioAtual.uid, usuarioAtual.displayName || usuarioAtual.email || 'Jogador');
        _finalizarEntradaNoGrupo(grupoId);
        return;
    }

    mostrarTelaAutoclaim(grupoId, orfaos);
}

function _finalizarEntradaNoGrupo(grupoId) {
    mostrarApp();
    inicializarListeners(grupoId);
}

// Stub — implementado na Task 3 deste plano.
function mostrarTelaAutoclaim(grupoId, orfaos) {
    console.warn('mostrarTelaAutoclaim ainda não implementado', grupoId, orfaos);
}
```

- [ ] **Step 4: Atualizar `entrarNoGrupo` em `js/auth.js`**

Trocar o final da função (as duas últimas linhas antes do `}`):

```js
    mostrarApp();
    inicializarListeners(grupoId);
}
```

por:

```js
    await resolverVinculoJogador(grupoId);
}
```

- [ ] **Step 5: Adicionar o script em `index.html`**

Em `index.html`, entre `<script src="js/grupos.js"></script>` e `<script src="js/migration.js"></script>`:

```html
    <script src="js/grupos.js"></script>
    <script src="js/vinculo.js"></script>
    <script src="js/migration.js"></script>
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx playwright test tests/vinculo.spec.js -g "resolverVinculoJogador"`
Expected: PASS

- [ ] **Step 7: Rodar a suíte completa pra checar que nada quebrou**

Run: `npx playwright test`
Expected: todos os testes existentes continuam passando (nenhuma regressão em login/criar grupo/etc.)

- [ ] **Step 8: Commit**

```bash
git add js/vinculo.js js/auth.js index.html tests/vinculo.spec.js
git commit -m "feat: cria jogador automaticamente vinculado ao entrar num grupo sem orfaos"
```

---

## Task 3: Tela de autoclaim — "É você?"

**Files:**
- Modify: `js/vinculo.js` (substitui o stub `mostrarTelaAutoclaim` por implementação real; adiciona as 3 ações)
- Modify: `index.html` (nova tela `#telaAutoclaim`; hide dela nas outras funções `mostrarTelaLogin`/`mostrarTelaBemVindo`/`mostrarApp` em `js/auth.js`)
- Test: `tests/vinculo.spec.js`

**Interfaces:**
- Consumes: `criarJogadorVinculado`, `_finalizarEntradaNoGrupo` (Task 2), `database`, `usuarioAtual`
- Produces:
  - `function mostrarTelaAutoclaim(grupoId: string, orfaos: Array<object>): void`
  - `window.vincularJogadorExistente(jogadorId: string): Promise<void>`
  - `window.criarComoNovoJogador(): Promise<void>`
  - `window.pularAutoclaim(): void`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar a `tests/vinculo.spec.js`:

```js
async function _seedGrupoComOrfao(page, grupoId, nomeOrfao) {
    await page.evaluate(async ({ grupoId, nomeOrfao }) => {
        await database.ref(`grupos/${grupoId}/membros/${usuarioAtual.uid}`).set({
            role: 'admin', entradaEm: new Date().toISOString()
        });
        await database.ref(`grupos/${grupoId}/jogadores/orfao1`).set({
            id: 'orfao1', nome: nomeOrfao, estrelas: 8, tipo: 'mensalista',
            userId: null, criadoEm: new Date().toISOString()
        });
    }, { grupoId, nomeOrfao });
}

test.describe('Tela de autoclaim', () => {
    test.beforeEach(async ({ page }) => {
        await fazerLogin(page);
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });
    });

    test('mostra órfãos e "Esse sou eu" vincula o userId', async ({ page }) => {
        const grupoId = `teste_autoclaim_${Date.now()}`;
        await _seedGrupoComOrfao(page, grupoId, 'Jogador Órfão Teste');

        await page.evaluate((id) => window.resolverVinculoJogador(id), grupoId);
        await page.locator('#telaAutoclaim').waitFor({ state: 'visible', timeout: 5000 });
        await expect(page.locator('#autoclaimLista')).toContainText('Jogador Órfão Teste');

        await page.click('#autoclaimLista .list-item');
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 10000 });

        const userId = await page.evaluate(async (id) => {
            const snap = await database.ref(`grupos/${id}/jogadores/orfao1/userId`).get();
            return snap.val();
        }, grupoId);
        expect(userId).toBeTruthy();

        await page.evaluate((id) => database.ref(`grupos/${id}`).remove(), grupoId);
    });

    test('"Sou novo" cria jogador separado, sem tocar no órfão', async ({ page }) => {
        const grupoId = `teste_autoclaim_novo_${Date.now()}`;
        await _seedGrupoComOrfao(page, grupoId, 'Jogador Órfão 2');

        await page.evaluate((id) => window.resolverVinculoJogador(id), grupoId);
        await page.locator('#telaAutoclaim').waitFor({ state: 'visible', timeout: 5000 });

        await page.click('button[onclick="criarComoNovoJogador()"]');
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 10000 });

        const jogadoresDoGrupo = await page.evaluate(async (id) => {
            const snap = await database.ref(`grupos/${id}/jogadores`).get();
            return snap.val();
        }, grupoId);
        expect(Object.keys(jogadoresDoGrupo)).toHaveLength(2);
        expect(jogadoresDoGrupo['orfao1'].userId).toBeNull();

        await page.evaluate((id) => database.ref(`grupos/${id}`).remove(), grupoId);
    });

    test('"Agora não" entra no app sem vincular nada', async ({ page }) => {
        const grupoId = `teste_autoclaim_skip_${Date.now()}`;
        await _seedGrupoComOrfao(page, grupoId, 'Jogador Órfão 3');

        await page.evaluate((id) => window.resolverVinculoJogador(id), grupoId);
        await page.locator('#telaAutoclaim').waitFor({ state: 'visible', timeout: 5000 });

        await page.click('button[onclick="pularAutoclaim()"]');
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 10000 });

        const jogadoresDoGrupo = await page.evaluate(async (id) => {
            const snap = await database.ref(`grupos/${id}/jogadores`).get();
            return snap.val();
        }, grupoId);
        expect(Object.keys(jogadoresDoGrupo)).toHaveLength(1);
        expect(jogadoresDoGrupo['orfao1'].userId).toBeNull();

        await page.evaluate((id) => database.ref(`grupos/${id}`).remove(), grupoId);
    });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx playwright test tests/vinculo.spec.js -g "Tela de autoclaim"`
Expected: FAIL — `#telaAutoclaim` nunca fica visível (timeout), porque a tela ainda não existe no HTML e o stub só faz `console.warn`

- [ ] **Step 3: Adicionar a tela em `index.html`**

Logo depois do fechamento de `<div id="telaBemVindo">...</div>` (antes de `<div class="sync-status" ...>`):

```html
    <!-- TELA AUTOCLAIM (vincular jogador existente) -->
    <div id="telaAutoclaim" style="display: none;">
        <div class="login-container">
            <div class="login-logo">🤔</div>
            <h1 class="login-titulo">É você?</h1>
            <p class="login-subtitulo">Esse grupo tem jogadores sem conta vinculada. Você é um deles?</p>

            <div id="autoclaimLista" style="width:100%;max-height:280px;overflow-y:auto;"></div>

            <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; margin-top: 12px;">
                <button class="btn btn-full" onclick="criarComoNovoJogador()" style="background: #666;">Sou novo, não estou nessa lista</button>
                <button class="login-voltar-btn" onclick="pularAutoclaim()">Agora não</button>
            </div>
        </div>
    </div>
```

- [ ] **Step 4: Implementar em `js/vinculo.js`**

Substituir o stub do final do arquivo por:

```js
function mostrarTelaAutoclaim(grupoId, orfaos) {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('telaLogin').style.display     = 'none';
    document.getElementById('telaBemVindo').style.display  = 'none';
    document.getElementById('mainApp').style.display       = 'none';

    const tela = document.getElementById('telaAutoclaim');
    tela.style.display = 'flex';
    tela.dataset.grupoId = grupoId;

    document.getElementById('autoclaimLista').innerHTML = orfaos.map(j => `
        <div class="list-item" onclick="vincularJogadorExistente('${j.id}')">
            <div class="item-content">
                <div class="player-info">
                    <div class="player-name">${j.nome} ${j.tipo === 'avulso' ? '(Avulso)' : '(Mensalista)'}</div>
                    <div class="player-stars"><span class="star-count">${j.estrelas} estrelas</span></div>
                </div>
            </div>
        </div>
    `).join('');
}

window.vincularJogadorExistente = async function(jogadorId) {
    const grupoId = document.getElementById('telaAutoclaim').dataset.grupoId;
    await database.ref(`grupos/${grupoId}/jogadores/${jogadorId}/userId`).set(usuarioAtual.uid);
    document.getElementById('telaAutoclaim').style.display = 'none';
    _finalizarEntradaNoGrupo(grupoId);
};

window.criarComoNovoJogador = async function() {
    const grupoId = document.getElementById('telaAutoclaim').dataset.grupoId;
    await criarJogadorVinculado(grupoId, usuarioAtual.uid, usuarioAtual.displayName || usuarioAtual.email || 'Jogador');
    document.getElementById('telaAutoclaim').style.display = 'none';
    _finalizarEntradaNoGrupo(grupoId);
};

window.pularAutoclaim = function() {
    const grupoId = document.getElementById('telaAutoclaim').dataset.grupoId;
    document.getElementById('telaAutoclaim').style.display = 'none';
    _finalizarEntradaNoGrupo(grupoId);
};
```

- [ ] **Step 5: Esconder `#telaAutoclaim` nas outras transições de tela**

Em `js/auth.js`, adicionar a linha de hide de `telaAutoclaim` em `mostrarTelaLogin`, `mostrarTelaBemVindo` e `mostrarApp` (mesmo padrão já usado pras outras telas nessas três funções):

```js
function mostrarTelaLogin() {
    document.getElementById('loadingScreen').style.display  = 'none';
    document.getElementById('telaLogin').style.display      = 'flex';
    document.getElementById('telaBemVindo').style.display   = 'none';
    document.getElementById('telaAutoclaim').style.display  = 'none';
    document.getElementById('mainApp').style.display        = 'none';
}

function mostrarTelaBemVindo() {
    document.getElementById('loadingScreen').style.display  = 'none';
    document.getElementById('telaLogin').style.display      = 'none';
    document.getElementById('telaBemVindo').style.display   = 'flex';
    document.getElementById('telaAutoclaim').style.display  = 'none';
    document.getElementById('mainApp').style.display        = 'none';
}

function mostrarApp() {
    document.getElementById('loadingScreen').style.display  = 'none';
    document.getElementById('telaLogin').style.display      = 'none';
    document.getElementById('telaBemVindo').style.display   = 'none';
    document.getElementById('telaAutoclaim').style.display  = 'none';
    document.getElementById('mainApp').style.display        = 'block';
    hideLoading();

    const el = document.getElementById('sidebarUsuario');
    if (el && usuarioAtual) {
        el.textContent = usuarioAtual.displayName || usuarioAtual.email || 'Usuário';
    }
}
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npx playwright test tests/vinculo.spec.js -g "Tela de autoclaim"`
Expected: PASS — 3 testes passaram

- [ ] **Step 7: Rodar a suíte completa**

Run: `npx playwright test`
Expected: nenhuma regressão

- [ ] **Step 8: Commit**

```bash
git add js/vinculo.js js/auth.js index.html tests/vinculo.spec.js
git commit -m "feat: tela de autoclaim para vincular conta a jogador orfao"
```

---

## Task 4: Sidebar "Gestão do Grupo" (admin-only)

**Files:**
- Modify: `index.html` (novo item de sidebar `#menuGestao`, nova `<div id="gestao" class="content-section">`)
- Modify: `js/ui.js` (nova função `atualizarMenuPorPapel`, integra em `showSection`)
- Modify: `js/auth.js:87-98` (`mostrarApp` chama `atualizarMenuPorPapel()`)
- Test: `tests/vinculo.spec.js`

**Interfaces:**
- Consumes: `papelNoGrupo` (de `state.js`, já atribuído em `entrarNoGrupo`)
- Produces: `function atualizarMenuPorPapel(): void` — mostra/esconde `#menuGestao` conforme `papelNoGrupo`

- [ ] **Step 1: Escrever o teste que falha**

```js
test.describe('Gestão do Grupo — visibilidade por papel', () => {
    test.beforeEach(async ({ page }) => {
        await fazerLogin(page);
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });
    });

    test('visível para admin, escondido para membro', async ({ page }) => {
        // A conta de teste é admin do próprio grupo (criou ele em fluxo.spec.js)
        await expect(page.locator('#menuGestao')).toBeVisible();

        await page.evaluate(() => { papelNoGrupo = 'membro'; atualizarMenuPorPapel(); });
        await expect(page.locator('#menuGestao')).toBeHidden();

        await page.evaluate(() => { papelNoGrupo = 'admin'; atualizarMenuPorPapel(); });
        await expect(page.locator('#menuGestao')).toBeVisible();
    });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx playwright test tests/vinculo.spec.js -g "Gestão do Grupo"`
Expected: FAIL — `#menuGestao` não existe no DOM

- [ ] **Step 3: Adicionar o item de sidebar e a seção em `index.html`**

No `sidebar-menu`, depois do botão de `cadastro`:

```html
                <button class="menu-item" onclick="showSection('cadastro')">
                    <span class="menu-icon">➕</span><span>Cadastrar Jogador</span>
                </button>
                <button class="menu-item" id="menuGestao" onclick="showSection('gestao')" style="display:none;">
                    <span class="menu-icon">⚙️</span><span>Gestão do Grupo</span>
                </button>
```

Depois da `<!-- CADASTRO -->` `content-section` (antes de `</div><!-- /main-content -->`):

```html
            <!-- GESTÃO DO GRUPO (admin) -->
            <div id="gestao" class="content-section">
                <h2>⚙️ Gestão do Grupo</h2>

                <div class="form-group">
                    <label>Vínculos de Jogadores</label>
                    <p style="color:#666;font-size:13px;margin-bottom:10px;">Corrija manualmente qual conta está vinculada a cada jogador — use se alguém reivindicou o jogador errado na tela de "É você?".</p>
                    <div id="listaVinculos"></div>
                </div>
            </div>
```

- [ ] **Step 4: Implementar `atualizarMenuPorPapel` em `js/ui.js`**

Adicionar ao final do arquivo:

```js
// ---------- Menu por papel ----------

function atualizarMenuPorPapel() {
    const el = document.getElementById('menuGestao');
    if (el) el.style.display = papelNoGrupo === 'admin' ? 'flex' : 'none';
}
```

- [ ] **Step 5: Chamar `atualizarMenuPorPapel()` em `mostrarApp` (`js/auth.js`)**

Adicionar a chamada logo após a linha que define `sidebarUsuario`:

```js
function mostrarApp() {
    document.getElementById('loadingScreen').style.display  = 'none';
    document.getElementById('telaLogin').style.display      = 'none';
    document.getElementById('telaBemVindo').style.display   = 'none';
    document.getElementById('telaAutoclaim').style.display  = 'none';
    document.getElementById('mainApp').style.display        = 'block';
    hideLoading();

    const el = document.getElementById('sidebarUsuario');
    if (el && usuarioAtual) {
        el.textContent = usuarioAtual.displayName || usuarioAtual.email || 'Usuário';
    }
    atualizarMenuPorPapel();
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx playwright test tests/vinculo.spec.js -g "Gestão do Grupo"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add index.html js/ui.js js/auth.js tests/vinculo.spec.js
git commit -m "feat: adiciona tela Gestao do Grupo, visivel so para admin"
```

---

## Task 5: Gestão → correção manual de vínculo

**Files:**
- Modify: `js/vinculo.js` (adiciona `_carregarMembrosComNomes`, `exibirVinculosJogadores`, `window.corrigirVinculoJogador`)
- Modify: `js/ui.js:19-31` (`showSection` chama `exibirVinculosJogadores()` para a seção `gestao`)
- Test: `tests/vinculo.spec.js`

**Interfaces:**
- Consumes: `jogadores` (global, de `state.js`, já sincronizado por `inicializarListeners`), `grupoAtualId`, `database`
- Produces:
  - `async function _carregarMembrosComNomes(grupoId: string): Promise<Array<{uid, nome, role}>>`
  - `async function exibirVinculosJogadores(): void` — popula `#listaVinculos`
  - `window.corrigirVinculoJogador(jogadorId: string, novoUserId: string): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha**

```js
test('Gestão → Vínculos de Jogadores renderiza sem erro e permite corrigir', async ({ page }) => {
    await fazerLogin(page);
    await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });

    const jogadorId = await page.evaluate(async () => {
        const j = await criarJogadorVinculado(grupoAtualId, 'uid-fake-vinculo-' + Date.now(), 'Vínculo Teste');
        return j.id;
    });

    await page.evaluate(() => document.querySelector('button.menu-btn').click());
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector("button[onclick=\"showSection('gestao')\"]").click());
    await page.waitForSelector('#gestao.active', { timeout: 10000 });

    await expect(page.locator('#listaVinculos')).toContainText('Vínculo Teste');

    await page.evaluate((id) => window.corrigirVinculoJogador(id, ''), jogadorId);
    const userIdDepois = await page.evaluate(async (id) => {
        const snap = await database.ref(`grupos/${grupoAtualId}/jogadores/${id}/userId`).get();
        return snap.val();
    }, jogadorId);
    expect(userIdDepois).toBeNull();

    await page.evaluate((id) => database.ref(`grupos/${grupoAtualId}/jogadores/${id}`).remove(), jogadorId);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx playwright test tests/vinculo.spec.js -g "Vínculos de Jogadores"`
Expected: FAIL — `#listaVinculos` fica vazio, `window.corrigirVinculoJogador is not a function`

- [ ] **Step 3: Implementar em `js/vinculo.js`**

Adicionar ao final do arquivo:

```js
async function _carregarMembrosComNomes(grupoId) {
    const membrosSnap = await database.ref(`grupos/${grupoId}/membros`).get();
    const membros = membrosSnap.val() || {};
    const uids = Object.keys(membros);
    const nomes = await Promise.all(uids.map(uid => database.ref(`usuarios/${uid}`).get()));
    return uids.map((uid, i) => ({
        uid,
        role: membros[uid].role,
        nome: nomes[i].val()?.nome || uid
    }));
}

async function exibirVinculosJogadores() {
    const container = document.getElementById('listaVinculos');
    const membros = await _carregarMembrosComNomes(grupoAtualId);

    container.innerHTML = Object.values(jogadores).map(j => `
        <div class="list-item">
            <div class="item-content">
                <div class="player-info">
                    <div class="player-name">${j.nome}</div>
                    <div class="player-stars">
                        <span class="star-count">${j.userId ? 'Vinculado a: ' + (membros.find(m => m.uid === j.userId)?.nome || j.userId) : 'Não vinculado'}</span>
                    </div>
                </div>
                <select onchange="corrigirVinculoJogador('${j.id}', this.value)" style="max-width:140px;">
                    <option value="">— nenhum —</option>
                    ${membros.map(m => `<option value="${m.uid}" ${j.userId === m.uid ? 'selected' : ''}>${m.nome}</option>`).join('')}
                </select>
            </div>
        </div>
    `).join('');
}

window.corrigirVinculoJogador = async function(jogadorId, novoUserId) {
    await database.ref(`grupos/${grupoAtualId}/jogadores/${jogadorId}/userId`).set(novoUserId || null);
    exibirVinculosJogadores();
};
```

- [ ] **Step 4: Chamar `exibirVinculosJogadores()` ao abrir a seção (`js/ui.js`)**

Em `showSection`, adicionar mais um `else if`:

```js
window.showSection = function(sectionName) {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));

    event.target.closest('.menu-item').classList.add('active');
    document.getElementById(sectionName).classList.add('active');
    closeSidebar();

    if (sectionName === 'jogadores')  exibirJogadores();
    else if (sectionName === 'separar')    exibirJogadoresPresentes();
    else if (sectionName === 'financeiro') mostrarAbaFinanceiro('sessoes');
    else if (sectionName === 'historico')  exibirHistorico();
    else if (sectionName === 'gestao')     exibirVinculosJogadores();
};
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx playwright test tests/vinculo.spec.js -g "Vínculos de Jogadores"`
Expected: PASS

- [ ] **Step 6: Rodar a suíte completa**

Run: `npx playwright test`
Expected: nenhuma regressão

- [ ] **Step 7: Commit**

```bash
git add js/vinculo.js js/ui.js tests/vinculo.spec.js
git commit -m "feat: correcao manual de vinculo conta-jogador na Gestao do Grupo"
```

---

## Task 6: Remove edição manual de estrela (cadastro e edição)

**Files:**
- Modify: `index.html` (remove `#estrelas` de `#cadastro`, `#quickEstrelas` de `#quickAddModal`, `#editEstrelas` de `#editModal`)
- Modify: `js/players.js` (`cadastrarJogador`, `cadastrarRapido`, `abrirCadastroRapido`, `editarJogador`, `salvarEdicao`)
- Test: `tests/vinculo.spec.js`

**Interfaces:**
- Nenhuma nova função pública — só remove código existente. `jogadores/{id}/estrelas` continua existindo no modelo de dados (agora fixo em `5` na criação, nunca mais editável manualmente).

- [ ] **Step 1: Escrever os testes que falham**

```js
test.describe('Estrela não é mais editável manualmente', () => {
    test.beforeEach(async ({ page }) => {
        await fazerLogin(page);
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });
    });

    test('cadastro rápido (FAB) cria jogador com estrelas: 5, sem campo de estrela', async ({ page }) => {
        await page.click('button.fab-button');
        await page.locator('#quickAddModal').waitFor({ state: 'visible' });
        await expect(page.locator('#quickEstrelas')).toHaveCount(0);

        const nome = `Jogador Teste ${Date.now()}`;
        await page.fill('#quickNome', nome);
        await page.click('button[onclick="cadastrarRapido()"]');
        await page.waitForTimeout(1200);

        const jogador = await page.evaluate((nomeBuscado) =>
            Object.values(jogadores).find(j => j.nome === nomeBuscado)
        , nome);

        expect(jogador).toBeTruthy();
        expect(jogador.estrelas).toBe(5);

        await page.evaluate((id) => database.ref(`grupos/${grupoAtualId}/jogadores/${id}`).remove(), jogador.id);
    });

    test('editar jogador não mostra mais campo de estrela', async ({ page }) => {
        const nome = `Editar Teste ${Date.now()}`;
        const jogadorId = await page.evaluate(async (nome) => {
            const j = await criarJogadorVinculado(grupoAtualId, 'uid-fake-editar-' + Date.now(), nome);
            return j.id;
        }, nome);

        await page.evaluate(() => document.querySelector('button.menu-btn').click());
        await page.waitForTimeout(400);
        await page.evaluate(() => document.querySelector("button[onclick=\"showSection('jogadores')\"]").click());
        await page.waitForSelector('#jogadores.active');

        await page.click(`button[onclick="editarJogador('${jogadorId}', event)"]`);
        await page.locator('#editModal').waitFor({ state: 'visible' });
        await expect(page.locator('#editEstrelas')).toHaveCount(0);

        await page.evaluate((id) => database.ref(`grupos/${grupoAtualId}/jogadores/${id}`).remove(), jogadorId);
    });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx playwright test tests/vinculo.spec.js -g "não é mais editável"`
Expected: FAIL — `#quickEstrelas` e `#editEstrelas` ainda existem (0 esperado, mas encontrados)

- [ ] **Step 3: Remover os campos de `index.html`**

Remover de `#quickAddModal` o bloco:
```html
                    <div class="form-group">
                        <label for="quickEstrelas">Nível de Habilidade:</label>
                        <select id="quickEstrelas">...</select>
                    </div>
```

Remover de `#cadastro` o bloco:
```html
                <div class="form-group">
                    <label for="estrelas">Nível de Habilidade:</label>
                    <select id="estrelas">...</select>
                </div>
```

Remover de `#editModal` o bloco:
```html
                <div class="form-group">
                    <label for="editEstrelas">Nível de Habilidade:</label>
                    <select id="editEstrelas">...</select>
                </div>
```

- [ ] **Step 4: Atualizar `js/players.js`**

`cadastrarJogador`:

```js
window.cadastrarJogador = function() {
    const nome = document.getElementById('nomeJogador').value.trim();
    const tipo = document.getElementById('tipoJogador').value;
    const btn = document.getElementById('btnCadastrar');

    if (!nome) { alert('Por favor, digite o nome do jogador!'); return; }

    if (Object.values(jogadores).find(j => j.nome.toLowerCase() === nome.toLowerCase())) {
        alert('Jogador já cadastrado!'); return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Cadastrando...';

    salvarJogador({ id: Date.now().toString(), nome, estrelas: 5, tipo, criadoEm: new Date().toISOString() });

    document.getElementById('nomeJogador').value = '';
    document.getElementById('tipoJogador').value = 'mensalista';

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '➕ Cadastrar Jogador';
        alert(`Jogador ${nome} cadastrado com sucesso!`);
    }, 1000);
};
```

`abrirCadastroRapido` e `cadastrarRapido`:

```js
window.abrirCadastroRapido = function() {
    document.getElementById('quickAddModal').style.display = 'flex';
    document.getElementById('quickNome').value = '';
    document.getElementById('quickTipo').value = 'mensalista';
    document.getElementById('quickJaSelecionar').checked = true;
    setTimeout(() => document.getElementById('quickNome').focus(), 100);
};

window.fecharCadastroRapido = function() {
    document.getElementById('quickAddModal').style.display = 'none';
};

window.cadastrarRapido = function() {
    const nome = document.getElementById('quickNome').value.trim();
    const tipo = document.getElementById('quickTipo').value;
    const jaSelecionar = document.getElementById('quickJaSelecionar').checked;
    const btn = document.getElementById('btnQuickAdd');

    if (!nome) { alert('Por favor, digite o nome do jogador!'); return; }
    if (Object.values(jogadores).find(j => j.nome.toLowerCase() === nome.toLowerCase())) {
        alert('Jogador já cadastrado!'); return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Cadastrando...';

    const novo = { id: Date.now().toString(), nome, estrelas: 5, tipo, criadoEm: new Date().toISOString() };
    salvarJogador(novo);

    if (jaSelecionar) {
        jogadoresPresentes.push(novo.id);
        salvarSelecao();
    }

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '➕ Cadastrar';
        fecharCadastroRapido();
        limparPesquisa();
        alert(`${nome} cadastrado com sucesso!${jaSelecionar ? ' E já marcado como presente!' : ''}`);
    }, 800);
};
```

`editarJogador` e `salvarEdicao`:

```js
window.editarJogador = function(id, event) {
    if (event) event.stopPropagation();
    jogadorEditando = jogadores[id];
    if (!jogadorEditando) return;
    document.getElementById('editNome').value = jogadorEditando.nome;
    document.getElementById('editTipoJogador').value = jogadorEditando.tipo || 'mensalista';
    document.getElementById('editModal').style.display = 'flex';
};

window.salvarEdicao = function() {
    if (!jogadorEditando) return;
    const btn = document.getElementById('btnSalvar');
    btn.disabled = true;
    btn.textContent = '⏳ Salvando...';

    salvarJogador({
        ...jogadorEditando,
        tipo: document.getElementById('editTipoJogador').value,
        atualizadoEm: new Date().toISOString()
    });

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '💾 Salvar';
        fecharModal();
        alert(`${jogadorEditando.nome} atualizado com sucesso!`);
    }, 1000);
};
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx playwright test tests/vinculo.spec.js -g "não é mais editável"`
Expected: PASS — 2 testes passaram

- [ ] **Step 6: Rodar a suíte completa**

Run: `npx playwright test`
Expected: nenhuma regressão (checar em especial `tests/import.spec.js`, que também cadastra jogadores)

- [ ] **Step 7: Commit**

```bash
git add index.html js/players.js tests/vinculo.spec.js
git commit -m "feat: remove edicao manual de estrela do cadastro e da edicao de jogador"
```

---

## Task 6.5: Sincroniza presença via Firebase (substitui localStorage)

> Inserida depois da revisão da Task 7 original — presença precisa ser compartilhada em
> tempo real entre dispositivos antes de qualquer regra de permissão por jogador fazer
> sentido (ver `docs/superpowers/specs/2026-04-24-autenticacao-e-multi-tenant-design.md`,
> seção 3, atualizada). Esta task só troca a fonte de dados; nenhuma regra de permissão
> nova ainda — continua todo mundo podendo marcar/desmarcar qualquer jogador, exatamente
> como hoje, só que sincronizado.

**Files:**
- Modify: `js/firebase.js` (`inicializarListeners`, `desligarListeners`; novas funções `marcarPresencaDB`, `marcarVariosPresencaDB`, `limparPresencaDB`)
- Modify: `js/players.js` (`togglePresenca`, `marcarTodosMensalistas`, `marcarTodosAvulsos`, `limparTodosCheckbox`)
- Test: `tests/vinculo.spec.js`

**Interfaces:**
- Produces:
  - `function marcarPresencaDB(jogadorId: string, presente: boolean): void`
  - `function marcarVariosPresencaDB(jogadorIds: string[]): void`
  - `function limparPresencaDB(): void`
- `jogadoresPresentes` (global, `state.js`) continua sendo a lista em memória que `teams.js`/`players.js` já consomem — só a fonte muda, de `localStorage` pra um listener Firebase.

**Modelo de dados novo:**
```
/grupos/{grupoId}/presencaAtual/{jogadorId}: true   (chave presente = presente; ausente = não presente)
```

- [ ] **Step 1: Escrever o teste que falha**

Adicionar a `tests/vinculo.spec.js`:

```js
test.describe('Presença sincronizada via Firebase', () => {
    test.beforeEach(async ({ page }) => {
        await fazerLogin(page);
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });
    });

    test('togglePresenca grava e remove em grupos/{id}/presencaAtual', async ({ page }) => {
        const jogadorId = await page.evaluate(async () => {
            const j = await criarJogadorVinculado(grupoAtualId, 'uid-fake-presenca-sync-' + Date.now(), 'Presença Sync Teste');
            return j.id;
        });

        await page.evaluate((id) => togglePresenca(id), jogadorId);
        await page.waitForTimeout(500);
        let val = await page.evaluate(async (id) => {
            const snap = await database.ref(`grupos/${grupoAtualId}/presencaAtual/${id}`).get();
            return snap.val();
        }, jogadorId);
        expect(val).toBe(true);

        await page.evaluate((id) => togglePresenca(id), jogadorId);
        await page.waitForTimeout(500);
        val = await page.evaluate(async (id) => {
            const snap = await database.ref(`grupos/${grupoAtualId}/presencaAtual/${id}`).get();
            return snap.val();
        }, jogadorId);
        expect(val).toBeFalsy(); // ausente ou null — RTDB não guarda chave com valor null

        await page.evaluate((id) => database.ref(`grupos/${grupoAtualId}/jogadores/${id}`).remove(), jogadorId);
    });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx playwright test tests/vinculo.spec.js -g "Presença sincronizada"`
Expected: FAIL — `presencaAtual/{id}` nunca é gravado (ainda grava só em `localStorage`)

- [ ] **Step 3: Adicionar as funções de gravação em `js/firebase.js`**

```js
function marcarPresencaDB(jogadorId, presente) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        if (presente) {
            database.ref(`grupos/${grupoAtualId}/presencaAtual/${jogadorId}`).set(true);
        } else {
            database.ref(`grupos/${grupoAtualId}/presencaAtual/${jogadorId}`).remove();
        }
    } else {
        if (presente) {
            if (!jogadoresPresentes.includes(jogadorId)) jogadoresPresentes.push(jogadorId);
        } else {
            jogadoresPresentes = jogadoresPresentes.filter(id => id !== jogadorId);
        }
        salvarSelecao();
        exibirJogadoresPresentes();
    }
}

function marcarVariosPresencaDB(jogadorIds) {
    if (!jogadorIds.length) return;
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        const updates = {};
        jogadorIds.forEach(id => { updates[id] = true; });
        database.ref(`grupos/${grupoAtualId}/presencaAtual`).update(updates);
    } else {
        jogadorIds.forEach(id => { if (!jogadoresPresentes.includes(id)) jogadoresPresentes.push(id); });
        salvarSelecao();
        exibirJogadoresPresentes();
    }
}

function limparPresencaDB() {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/presencaAtual`).remove();
    } else {
        jogadoresPresentes = [];
        localStorage.removeItem('jogadoresPresentesSelecionados');
        exibirJogadoresPresentes();
    }
}
```

- [ ] **Step 4: Adicionar o listener em `inicializarListeners` e o `.off()` em `desligarListeners` (`js/firebase.js`)**

Dentro de `inicializarListeners(grupoId)`, junto dos outros `database.ref(...).on('value', ...)`:

```js
    database.ref(`grupos/${grupoId}/presencaAtual`).on('value', (snapshot) => {
        jogadoresPresentes = Object.keys(snapshot.val() || {});
        exibirJogadoresPresentes();
    });
```

Dentro de `desligarListeners(grupoId)`, junto dos outros `.off()`:

```js
    database.ref(`grupos/${grupoId}/presencaAtual`).off();
```

- [ ] **Step 5: Trocar as gravações locais por chamadas às novas funções em `js/players.js`**

```js
window.togglePresenca = function(id) {
    const jaPresente = jogadoresPresentes.includes(id);
    marcarPresencaDB(id, !jaPresente);
    if (!jaPresente && navigator.vibrate) navigator.vibrate(30);
};

window.marcarTodosMensalistas = function() {
    const ids = Object.values(jogadores)
        .filter(j => (j.tipo || 'mensalista') === 'mensalista')
        .map(j => j.id)
        .filter(id => !jogadoresPresentes.includes(id));
    marcarVariosPresencaDB(ids);
    if (ids.length && navigator.vibrate) navigator.vibrate([30, 50, 30]);
};

window.marcarTodosAvulsos = function() {
    const ids = Object.values(jogadores)
        .filter(j => j.tipo === 'avulso')
        .map(j => j.id)
        .filter(id => !jogadoresPresentes.includes(id));
    marcarVariosPresencaDB(ids);
    if (ids.length && navigator.vibrate) navigator.vibrate([30, 50, 30]);
};

window.limparTodosCheckbox = function() {
    limparPresencaDB();
    if (navigator.vibrate) navigator.vibrate(50);
    document.getElementById('teamsContainer').style.display = 'none';
    document.getElementById('balanceInfo').style.display = 'none';
    ultimaDistribuicao = null;
    timesFormados = null;
};
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx playwright test tests/vinculo.spec.js -g "Presença sincronizada"`
Expected: PASS

- [ ] **Step 7: Rodar a suíte completa**

Run: `npx playwright test`
Expected: nenhuma regressão

- [ ] **Step 8: Commit**

```bash
git add js/firebase.js js/players.js tests/vinculo.spec.js
git commit -m "feat: sincroniza presenca via Firebase em vez de localStorage"
```

---

## Task 7: Presença — autocheckin com trava pós-confirmação

**Files:**
- Modify: `js/state.js` (nova variável `presencaTravada`)
- Modify: `js/firebase.js` (listener de `presencaTravada`; `limparPresencaDB` também reseta a trava)
- Modify: `js/teams.js` (`confirmarTimes` trava a presença)
- Modify: `js/players.js` (`togglePresenca` ganha o guard de papel/dono + trava; `marcarTodosMensalistas`/`marcarTodosAvulsos` viram admin-only; `limparTodosCheckbox` ganha guard de admin)
- Modify: `js/vinculo.js` (nova seção de correção manual de presença na Gestão)
- Modify: `index.html` (`id="btnLimparPresenca"`; nova subseção em `#gestao`)
- Modify: `js/ui.js` (`atualizarMenuPorPapel` esconde Limpar pra membro; `showSection` chama a nova função de correção)
- Test: `tests/vinculo.spec.js`

**Interfaces:**
- Consumes: `marcarPresencaDB`, `marcarVariosPresencaDB`, `limparPresencaDB` (Task 6.5)
- Produces:
  - `function exibirCorrecaoPresenca(): void`
  - `window.corrigirPresencaManual(jogadorId: string, presente: boolean): void` — admin-only, ignora `presencaTravada`

- [ ] **Step 1: Escrever os testes que falham**

```js
test.describe('Presença — autocheckin com trava pós-confirmação', () => {
    test.beforeEach(async ({ page }) => {
        await fazerLogin(page);
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });
    });

    test('membro só marca/desmarca o próprio jogador; admin marca qualquer um', async ({ page }) => {
        const { meuId, outroId } = await page.evaluate(async () => {
            const meu = await criarJogadorVinculado(grupoAtualId, usuarioAtual.uid, 'Eu Presença Teste');
            const outro = await criarJogadorVinculado(grupoAtualId, 'uid-fake-outro-' + Date.now(), 'Outro Presença Teste');
            return { meuId: meu.id, outroId: outro.id };
        });

        await page.evaluate(() => { papelNoGrupo = 'membro'; });

        await page.evaluate((id) => togglePresenca(id), outroId);
        let presente = await page.evaluate((id) => jogadoresPresentes.includes(id), outroId);
        expect(presente).toBe(false); // membro não conseguiu marcar o jogador de outra pessoa

        await page.evaluate((id) => togglePresenca(id), meuId);
        presente = await page.evaluate((id) => jogadoresPresentes.includes(id), meuId);
        expect(presente).toBe(true); // membro conseguiu marcar o próprio jogador

        await page.evaluate(() => { papelNoGrupo = 'admin'; });
        await page.evaluate((id) => togglePresenca(id), outroId);
        presente = await page.evaluate((id) => jogadoresPresentes.includes(id), outroId);
        expect(presente).toBe(true); // admin marca qualquer jogador

        await page.evaluate(({ meuId, outroId }) => {
            database.ref(`grupos/${grupoAtualId}/jogadores/${meuId}`).remove();
            database.ref(`grupos/${grupoAtualId}/jogadores/${outroId}`).remove();
            database.ref(`grupos/${grupoAtualId}/presencaAtual/${meuId}`).remove();
            database.ref(`grupos/${grupoAtualId}/presencaAtual/${outroId}`).remove();
        }, { meuId, outroId });
    });

    test('presença travada bloqueia todo mundo, exceto correção manual do admin', async ({ page }) => {
        const jogadorId = await page.evaluate(async () => {
            const j = await criarJogadorVinculado(grupoAtualId, usuarioAtual.uid, 'Trava Presença Teste');
            return j.id;
        });

        await page.evaluate(() => { papelNoGrupo = 'admin'; presencaTravada = true; });

        await page.evaluate((id) => togglePresenca(id), jogadorId);
        let presente = await page.evaluate((id) => jogadoresPresentes.includes(id), jogadorId);
        expect(presente).toBe(false); // trava bloqueia até o admin pelo fluxo normal

        await page.evaluate((id) => corrigirPresencaManual(id, true), jogadorId);
        await page.waitForTimeout(500);
        const val = await page.evaluate(async (id) => {
            const snap = await database.ref(`grupos/${grupoAtualId}/presencaAtual/${id}`).get();
            return snap.val();
        }, jogadorId);
        expect(val).toBe(true); // correção manual ignora a trava

        await page.evaluate(() => { presencaTravada = false; });
        await page.evaluate((id) => {
            database.ref(`grupos/${grupoAtualId}/jogadores/${id}`).remove();
            database.ref(`grupos/${grupoAtualId}/presencaAtual/${id}`).remove();
        }, jogadorId);
    });

    test('botão Limpar some para membro', async ({ page }) => {
        await expect(page.locator('#btnLimparPresenca')).toBeVisible();

        await page.evaluate(() => { papelNoGrupo = 'membro'; atualizarMenuPorPapel(); });
        await expect(page.locator('#btnLimparPresenca')).toBeHidden();

        await page.evaluate(() => { papelNoGrupo = 'admin'; atualizarMenuPorPapel(); });
    });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx playwright test tests/vinculo.spec.js -g "autocheckin com trava"`
Expected: FAIL — membro consegue marcar jogador de outra pessoa; `presencaTravada`/`corrigirPresencaManual` não existem; `#btnLimparPresenca` não existe

- [ ] **Step 3: Adicionar `presencaTravada` em `js/state.js`**

```js
let presencaTravada = false;
```

- [ ] **Step 4: Adicionar o `id` ao botão Limpar e a subseção de correção em `index.html`**

```html
                        <button class="quick-action-btn limpar" id="btnLimparPresenca" onclick="limparTodosCheckbox()">✕ Limpar</button>
```

Dentro de `<div id="gestao" class="content-section">`, depois do bloco "Aprovação..."/"Vínculos de Jogadores":

```html
                <div class="form-group">
                    <label>Correção Manual de Presença</label>
                    <p style="color:#666;font-size:13px;margin-bottom:10px;">Corrija a presença de um jogador mesmo com a rodada travada.</p>
                    <div id="listaCorrecaoPresenca"></div>
                </div>
```

- [ ] **Step 5: Adicionar o listener de `presencaTravada` e travar `confirmarTimes` (`js/firebase.js`, `js/teams.js`)**

Em `inicializarListeners(grupoId)`, junto do listener de `presencaAtual` já existente (Task 6.5) — trocar o listener de `presencaAtual` para também atualizar a Gestão quando ativa, e adicionar o de `presencaTravada`:

```js
    database.ref(`grupos/${grupoId}/presencaAtual`).on('value', (snapshot) => {
        jogadoresPresentes = Object.keys(snapshot.val() || {});
        exibirJogadoresPresentes();
        if (document.querySelector('.content-section.active')?.id === 'gestao') exibirCorrecaoPresenca();
    });

    database.ref(`grupos/${grupoId}/presencaTravada`).on('value', (snapshot) => {
        presencaTravada = snapshot.val() === true;
    });
```

Em `desligarListeners(grupoId)`:

```js
    database.ref(`grupos/${grupoId}/presencaTravada`).off();
```

Em `limparPresencaDB()` (`js/firebase.js`), adicionar o reset da trava junto da limpeza:

```js
function limparPresencaDB() {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/presencaAtual`).remove();
        database.ref(`grupos/${grupoAtualId}/presencaTravada`).set(false);
    } else {
        jogadoresPresentes = [];
        localStorage.removeItem('jogadoresPresentesSelecionados');
        exibirJogadoresPresentes();
    }
}
```

Em `js/teams.js`, dentro de `window.confirmarTimes`, logo após `confirmacaoEmAndamento = true;`:

```js
    if (database && grupoAtualId) database.ref(`grupos/${grupoAtualId}/presencaTravada`).set(true);
```

- [ ] **Step 6: Adicionar os guards em `js/players.js`**

```js
window.togglePresenca = function(id) {
    if (presencaTravada) return;
    if (papelNoGrupo !== 'admin') {
        const meuJogador = Object.values(jogadores).find(j => j.userId === usuarioAtual.uid);
        if (!meuJogador || meuJogador.id !== id) return;
    }
    const jaPresente = jogadoresPresentes.includes(id);
    marcarPresencaDB(id, !jaPresente);
    if (!jaPresente && navigator.vibrate) navigator.vibrate(30);
};

window.marcarTodosMensalistas = function() {
    if (papelNoGrupo !== 'admin' || presencaTravada) return;
    const ids = Object.values(jogadores)
        .filter(j => (j.tipo || 'mensalista') === 'mensalista')
        .map(j => j.id)
        .filter(id => !jogadoresPresentes.includes(id));
    marcarVariosPresencaDB(ids);
    if (ids.length && navigator.vibrate) navigator.vibrate([30, 50, 30]);
};

window.marcarTodosAvulsos = function() {
    if (papelNoGrupo !== 'admin' || presencaTravada) return;
    const ids = Object.values(jogadores)
        .filter(j => j.tipo === 'avulso')
        .map(j => j.id)
        .filter(id => !jogadoresPresentes.includes(id));
    marcarVariosPresencaDB(ids);
    if (ids.length && navigator.vibrate) navigator.vibrate([30, 50, 30]);
};

window.limparTodosCheckbox = function() {
    if (papelNoGrupo !== 'admin') return;
    limparPresencaDB();
    if (navigator.vibrate) navigator.vibrate(50);
    document.getElementById('teamsContainer').style.display = 'none';
    document.getElementById('balanceInfo').style.display = 'none';
    ultimaDistribuicao = null;
    timesFormados = null;
};
```

- [ ] **Step 7: Adicionar a correção manual em `js/vinculo.js`**

```js
function exibirCorrecaoPresenca() {
    const container = document.getElementById('listaCorrecaoPresenca');
    container.innerHTML = Object.values(jogadores).map(j => {
        const presente = jogadoresPresentes.includes(j.id);
        return `
            <div class="list-item ${presente ? 'checked' : ''}" onclick="corrigirPresencaManual('${j.id}', ${!presente})">
                <div class="item-content">
                    <div class="player-info">
                        <div class="player-name">${j.nome}</div>
                        <div class="player-stars"><span class="star-count">${presente ? 'Presente' : 'Ausente'}</span></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.corrigirPresencaManual = function(jogadorId, presente) {
    if (papelNoGrupo !== 'admin' || !database || !grupoAtualId) return;
    if (presente) {
        database.ref(`grupos/${grupoAtualId}/presencaAtual/${jogadorId}`).set(true);
    } else {
        database.ref(`grupos/${grupoAtualId}/presencaAtual/${jogadorId}`).remove();
    }
};
```

- [ ] **Step 8: Esconder o botão Limpar pra membro e chamar a correção ao abrir a Gestão (`js/ui.js`)**

```js
function atualizarMenuPorPapel() {
    const menuGestao = document.getElementById('menuGestao');
    if (menuGestao) menuGestao.style.display = papelNoGrupo === 'admin' ? 'flex' : 'none';

    const btnLimpar = document.getElementById('btnLimparPresenca');
    if (btnLimpar) btnLimpar.style.display = papelNoGrupo === 'admin' ? 'flex' : 'none';
}
```

Em `showSection`, o branch de `'gestao'` passa a chamar as duas funções:

```js
    else if (sectionName === 'gestao')     { exibirVinculosJogadores(); exibirCorrecaoPresenca(); }
```

- [ ] **Step 9: Rodar os testes e confirmar que passam**

Run: `npx playwright test tests/vinculo.spec.js -g "autocheckin com trava"`
Expected: PASS — 3 testes passaram

- [ ] **Step 10: Rodar a suíte completa**

Run: `npx playwright test`
Expected: nenhuma regressão

- [ ] **Step 11: Commit**

```bash
git add js/state.js js/firebase.js js/teams.js js/players.js js/vinculo.js index.html js/ui.js tests/vinculo.spec.js
git commit -m "feat: presenca autocheckin com trava pos-confirmacao e correcao manual"
```

---

## Task 8: Remove login por telefone/SMS

**Files:**
- Modify: `index.html` (remove botão "Entrar com Telefone" e `#loginTelefoneForm`)
- Modify: `js/auth.js` (remove `loginComTelefone`, `confirmarCodigoSMS`, `mostrarLoginTelefone`; simplifica `voltarLoginOpcoes`)
- Modify: `tests/load.spec.js:68` (remove `'loginComTelefone'` da lista de funções críticas)
- Test: `tests/vinculo.spec.js`

**Interfaces:**
- Remove `window.loginComTelefone`, `window.confirmarCodigoSMS`, `window.mostrarLoginTelefone` — nenhum código deve mais referenciar essas funções.

- [ ] **Step 1: Escrever o teste que falha**

```js
test('login não oferece mais opção de telefone/SMS', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#telaLogin').waitFor({ state: 'visible' });

    await expect(page.locator('button[onclick="mostrarLoginTelefone()"]')).toHaveCount(0);
    await expect(page.locator('#loginTelefoneForm')).toHaveCount(0);

    const existe = await page.evaluate(() => typeof window.loginComTelefone !== 'undefined');
    expect(existe).toBe(false);
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx playwright test tests/vinculo.spec.js -g "telefone/SMS"`
Expected: FAIL — botão e função ainda existem

- [ ] **Step 3: Remover de `index.html`**

Trocar:
```html
            <div id="loginOpcoes" style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <button class="btn btn-login-google" onclick="loginComGoogle()">
                    🔵 Entrar com Google
                </button>
                <button class="btn btn-login-outline" onclick="mostrarLoginEmail()">
                    ✉️ Entrar com E-mail
                </button>
                <button class="btn btn-login-outline" onclick="mostrarLoginTelefone()">
                    📱 Entrar com Telefone
                </button>
            </div>
```
por:
```html
            <div id="loginOpcoes" style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
                <button class="btn btn-login-google" onclick="loginComGoogle()">
                    🔵 Entrar com Google
                </button>
                <button class="btn btn-login-outline" onclick="mostrarLoginEmail()">
                    ✉️ Entrar com E-mail
                </button>
            </div>
```

Remover inteiramente o bloco:
```html
            <!-- Form de telefone -->
            <div id="loginTelefoneForm" style="display: none; width: 100%;">
                ...
            </div>
```

- [ ] **Step 4: Remover de `js/auth.js`**

Remover as funções `window.loginComTelefone`, `window.confirmarCodigoSMS` e `window.mostrarLoginTelefone` por inteiro.

Simplificar `voltarLoginOpcoes`:
```js
window.voltarLoginOpcoes = function() {
    document.getElementById('loginOpcoes').style.display       = 'flex';
    document.getElementById('loginEmailForm').style.display    = 'none';
    _limparErroLogin();
};
```

- [ ] **Step 5: Atualizar `tests/load.spec.js`**

Remover `'loginComTelefone'` do array `fns` no teste `'funções globais críticas existem no window'`.

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npx playwright test tests/vinculo.spec.js -g "telefone/SMS"`
Expected: PASS

Run: `npx playwright test tests/load.spec.js`
Expected: PASS

- [ ] **Step 7: Rodar a suíte completa**

Run: `npx playwright test`
Expected: nenhuma regressão

- [ ] **Step 8: Commit**

```bash
git add index.html js/auth.js tests/load.spec.js tests/vinculo.spec.js
git commit -m "feat: remove login por telefone/SMS, alinhando codigo a spec 2026-04-24"
```

---

## Nota de escopo

Este plano **não** implementa o RBAC completo da spec `2026-04-24` (cadastro, importação WhatsApp, financeiro, gestão de membros, etc. continuam acessíveis a qualquer membro autenticado) — só os pontos usados diretamente por este plano (Gestão do Grupo, desfazer presença). Essa pendência está registrada como crítica em `CLAUDE.md` e precisa virar seu próprio plano antes de qualquer lançamento real.

O próximo plano (ciclo de votação de estrelas) depende deste: usa `criarJogadorVinculado`, o campo `userId` em jogadores, e a tela "Gestão do Grupo" criada aqui.
