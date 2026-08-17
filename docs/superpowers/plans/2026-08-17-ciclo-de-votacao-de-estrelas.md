# Ciclo de Votação de Estrelas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substitui a edição manual de estrelas por um ciclo de votação entre mensalistas — abertura pelo admin, cédula anônima 1–10, fechamento por prazo/participação total/manual, agregação por média aparada (remove maior e menor voto) e aprovação do admin antes de aplicar o resultado.

**Architecture:** Novo `js/votacao.js` concentra ciclo, cédula, agregação e aprovação. Uma nova seção "Votação de Estrelas" (visível a todos) hospeda a cédula; a aprovação de resultados entra como uma segunda subseção dentro da tela "Gestão do Grupo" já criada no plano anterior. Depende diretamente do plano `2026-08-17-vinculo-conta-jogador-e-migracao`: usa `criarJogadorVinculado`, o campo `jogadores/{id}/userId`, e a seção `#gestao`.

**Tech Stack:** Vanilla JS (sem build step, sem módulos), Firebase Realtime Database, Playwright contra o Firebase homolog (`futebol-estrelas-homolog`) via Live Server em `http://localhost:5500`.

## Global Constraints

- **Pré-requisito:** plano `docs/superpowers/plans/2026-08-17-vinculo-conta-jogador-e-migracao.md` precisa estar implementado primeiro (`criarJogadorVinculado`, `jogadores/{id}/userId`, seção `#gestao`, `atualizarMenuPorPapel`, `#listaVinculos` já existem).
- Vanilla JS, sem build step, sem frameworks (`CLAUDE.md`)
- Firebase Realtime Database: só adições de campos, nunca altera estrutura existente (`CLAUDE.md`)
- Escala de estrelas é 1–10 em toda a votação — mesma escala já usada no resto do app; sem remapeamento (spec `2026-08-17`)
- Estrela nunca é editada manualmente pelo admin — só aprovação/rejeição do resultado calculado (spec `2026-08-17`)
- Só mensalistas votam; mensalistas e avulsos podem ser avaliados (spec `2026-08-17`)
- Quórum mínimo de 5 votos recebidos pra um jogador entrar na agregação do ciclo (spec `2026-08-17`)
- Agregação: remove a nota mais alta e a mais baixa recebidas (uma ocorrência de cada), tira a média do que sobra, arredonda pro inteiro mais próximo (estrelas sempre são número inteiro no resto do app)
- IDs gerados com `Date.now().toString()` (`CLAUDE.md`)
- Funções chamadas de `onclick` no HTML devem estar em `window.X` (`CLAUDE.md`)
- Ordem de scripts: este plano insere `votacao.js` entre `vinculo.js` e `migration.js`
- Sem `alert()` nos fluxos novos — feedback inline (spec `2026-08-17`)
- Testar no Live Server (`http://localhost:5500`) antes de qualquer commit
- Todo teste que grava dados de teste no Firebase homolog deve limpar o que criou ao final

---

## Task 1: Abertura de ciclo + scaffold da tela "Votação de Estrelas"

**Files:**
- Create: `js/votacao.js`
- Modify: `index.html` (novo item de sidebar, nova `<div id="votacao">`, `<script src="js/votacao.js">`)
- Modify: `js/ui.js` (`showSection` chama `exibirVotacao()`)
- Test: `tests/votacao.spec.js` (novo arquivo)

**Interfaces:**
- Consumes: `papelNoGrupo`, `grupoAtualId`, `usuarioAtual`, `database` — todos já existentes
- Produces:
  - `async function _buscarCicloAtivo(grupoId): Promise<object|null>` — ciclo com `status: 'aberto'`, ou `null`
  - `window.abrirCicloVotacao(): Promise<void>` — admin only
  - `window.enviarCedula(): Promise<void>` — **stub nesta task**, implementado na Task 2
  - `window.encerrarCicloVotacaoManualmente(): Promise<void>` — **stub nesta task**, implementado na Task 3
  - `async function exibirVotacao(): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/votacao.spec.js`:

```js
const { test, expect } = require('@playwright/test');

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

async function abrirSecao(page, nome) {
    await page.evaluate(() => document.querySelector('button.menu-btn').click());
    await page.waitForTimeout(400);
    await page.evaluate((n) => document.querySelector(`button[onclick="showSection('${n}')"]`).click(), nome);
    await page.waitForSelector(`#${nome}.active`, { timeout: 10000 });
}

test.describe('Ciclo de votação — abertura', () => {
    test.beforeEach(async ({ page }) => {
        await fazerLogin(page);
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });
    });

    test('admin abre ciclo de votação', async ({ page }) => {
        await page.evaluate(async () => {
            const snap = await database.ref(`grupos/${grupoAtualId}/ciclosVotacao`).get();
            const ciclos = snap.val() || {};
            for (const [id, c] of Object.entries(ciclos)) {
                if (c.status === 'aberto') await database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${id}`).remove();
            }
        });

        await abrirSecao(page, 'votacao');
        await expect(page.locator('#votacaoSemCiclo')).toBeVisible();

        await page.click('button[onclick="abrirCicloVotacao()"]');
        await page.waitForTimeout(600);

        const cicloAtivo = await page.evaluate(() => _buscarCicloAtivo(grupoAtualId));
        expect(cicloAtivo).toBeTruthy();
        expect(cicloAtivo.status).toBe('aberto');

        await page.evaluate((id) => database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${id}`).remove(), cicloAtivo.id);
    });

    test('não permite abrir dois ciclos ao mesmo tempo', async ({ page }) => {
        const id = await page.evaluate(async () => {
            const id = 'teste_ciclo_' + Date.now();
            await database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${id}`).set({
                id, abertoPor: usuarioAtual.uid, abertoEm: new Date().toISOString(),
                prazo: null, status: 'aberto', fechadoEm: null, motivoFechamento: null
            });
            return id;
        });

        await abrirSecao(page, 'votacao');
        await page.evaluate(() => abrirCicloVotacao());
        await expect(page.locator('#votacaoErro')).toBeVisible();
        await expect(page.locator('#votacaoErro')).toContainText('já existe');

        await page.evaluate((id) => database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${id}`).remove(), id);
    });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx playwright test tests/votacao.spec.js`
Expected: FAIL — `#votacao` não existe no DOM

- [ ] **Step 3: Adicionar sidebar + seção em `index.html`**

No `sidebar-menu`, entre `cadastro` e `menuGestao`:

```html
                <button class="menu-item" onclick="showSection('votacao')">
                    <span class="menu-icon">🗳️</span><span>Votação de Estrelas</span>
                </button>
```

Antes de `</div><!-- /main-content -->`, depois da seção `cadastro` e antes de `gestao`:

```html
            <!-- VOTAÇÃO DE ESTRELAS -->
            <div id="votacao" class="content-section">
                <h2>🗳️ Votação de Estrelas</h2>
                <p id="votacaoErro" style="display:none;color:#c62828;font-size:13px;margin-bottom:10px;"></p>

                <div id="votacaoAdminAbrir" style="display:none;">
                    <div class="form-group">
                        <label for="votacaoPrazo">Prazo (opcional):</label>
                        <input type="date" id="votacaoPrazo">
                    </div>
                    <button class="btn btn-full" onclick="abrirCicloVotacao()">Abrir Ciclo de Votação</button>
                </div>

                <div id="votacaoSemCiclo" style="display:none;color:#666;text-align:center;padding:20px;">
                    Nenhum ciclo de votação aberto no momento.
                </div>

                <div id="votacaoAdminEncerrar" style="display:none;margin-bottom:15px;">
                    <button class="btn btn-full" onclick="encerrarCicloVotacaoManualmente()" style="background:#c62828;">Encerrar Votação</button>
                </div>

                <div id="votacaoCedula" style="display:none;">
                    <p id="votacaoSemJogador" style="display:none;color:#666;text-align:center;padding:10px;">Você precisa ser mensalista vinculado a um jogador pra votar.</p>
                    <p style="color:#666;margin-bottom:12px;">Dê uma nota de 1 a 10 pra quem você conhece. Não precisa avaliar todo mundo.</p>
                    <div id="votacaoListaCedula"></div>
                    <button class="btn btn-full" id="btnEnviarVotos" onclick="enviarCedula()" style="margin-top:15px;">Enviar Votos</button>
                </div>
            </div>
```

E, junto dos outros scripts:

```html
    <script src="js/vinculo.js"></script>
    <script src="js/votacao.js"></script>
    <script src="js/migration.js"></script>
```

- [ ] **Step 4: Criar `js/votacao.js`**

```js
// ==============================================
// votacao.js — Ciclo de votação de estrelas
// ==============================================

// ---------- Ciclo ativo ----------

async function _buscarCicloAtivo(grupoId) {
    const snap = await database.ref(`grupos/${grupoId}/ciclosVotacao`)
        .orderByChild('status').equalTo('aberto').get();
    const val = snap.val();
    if (!val) return null;
    const [id, ciclo] = Object.entries(val)[0];
    return { id, ...ciclo };
}

async function _buscarCicloAguardandoAprovacao(grupoId) {
    const snap = await database.ref(`grupos/${grupoId}/ciclosVotacao`)
        .orderByChild('status').equalTo('aguardandoAprovacao').get();
    const val = snap.val();
    if (!val) return null;
    const [id, ciclo] = Object.entries(val)[0];
    return { id, ...ciclo };
}

window.abrirCicloVotacao = async function() {
    if (papelNoGrupo !== 'admin') return;

    const existente = await _buscarCicloAtivo(grupoAtualId);
    if (existente) { _exibirErroVotacao('Já existe um ciclo de votação aberto.'); return; }

    const prazoInput = document.getElementById('votacaoPrazo').value;
    const prazo = prazoInput ? new Date(prazoInput).toISOString() : null;

    const id = Date.now().toString();
    await database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${id}`).set({
        id,
        abertoPor: usuarioAtual.uid,
        abertoEm: new Date().toISOString(),
        prazo,
        status: 'aberto',
        fechadoEm: null,
        motivoFechamento: null
    });

    exibirVotacao();
};

function _exibirErroVotacao(msg) {
    const el = document.getElementById('votacaoErro');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
}

// ---------- Renderização da seção ----------

async function exibirVotacao() {
    document.getElementById('votacaoErro').style.display = 'none';

    const cicloAtivo = await _buscarCicloAtivo(grupoAtualId);

    document.getElementById('votacaoAdminAbrir').style.display    = (papelNoGrupo === 'admin' && !cicloAtivo) ? 'block' : 'none';
    document.getElementById('votacaoSemCiclo').style.display      = (!cicloAtivo) ? 'block' : 'none';
    document.getElementById('votacaoCedula').style.display        = cicloAtivo ? 'block' : 'none';
    document.getElementById('votacaoAdminEncerrar').style.display = (papelNoGrupo === 'admin' && cicloAtivo) ? 'block' : 'none';

    if (cicloAtivo) {
        document.getElementById('votacaoCedula').dataset.cicloId = cicloAtivo.id;
    }
}

// ---------- Stubs — implementados nas próximas tasks deste plano ----------

window.enviarCedula = async function() {
    console.warn('enviarCedula ainda não implementado');
};

window.encerrarCicloVotacaoManualmente = async function() {
    console.warn('encerrarCicloVotacaoManualmente ainda não implementado');
};
```

- [ ] **Step 5: Chamar `exibirVotacao()` em `showSection` (`js/ui.js`)**

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
    else if (sectionName === 'votacao')    exibirVotacao();
};
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npx playwright test tests/votacao.spec.js`
Expected: PASS — 2 testes passaram

- [ ] **Step 7: Rodar a suíte completa**

Run: `npx playwright test`
Expected: nenhuma regressão

- [ ] **Step 8: Commit**

```bash
git add js/votacao.js index.html js/ui.js tests/votacao.spec.js
git commit -m "feat: abertura de ciclo de votacao de estrelas e scaffold da tela"
```

---

## Task 2: Cédula de votação

**Files:**
- Modify: `js/votacao.js` (substitui o stub `enviarCedula`; adiciona `_meuJogador`, `renderizarCedula`)
- Modify: `index.html:votacaoCedula` (nenhuma mudança estrutural — já preparado na Task 1)
- Test: `tests/votacao.spec.js`

**Interfaces:**
- Consumes: `criarJogadorVinculado` (do plano anterior), `jogadores` (global sincronizado)
- Produces:
  - `async function _meuJogador(): Promise<object|null>` — jogador do grupo atual vinculado a `usuarioAtual.uid`
  - `async function renderizarCedula(cicloId: string): Promise<void>`
  - `window.enviarCedula(): Promise<void>` — grava `votos/{meuJogadorId}/{avaliadoId}` e `submissoes/{meuJogadorId}: true`

- [ ] **Step 1: Escrever o teste que falha**

```js
test.describe('Ciclo de votação — cédula', () => {
    test.beforeEach(async ({ page }) => {
        await fazerLogin(page);
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });
    });

    test('mensalista vê cédula sem si mesmo e envia votos', async ({ page }) => {
        const grupoId = `teste_cedula_${Date.now()}`;
        const cicloId = 'ciclo1';

        const meuId = await page.evaluate(async ({ grupoId, cicloId }) => {
            await database.ref(`grupos/${grupoId}/membros/${usuarioAtual.uid}`).set({ role: 'admin', entradaEm: new Date().toISOString() });
            const meu = await criarJogadorVinculado(grupoId, usuarioAtual.uid, 'Eu Mesmo Teste');
            await database.ref(`grupos/${grupoId}/jogadores/colega1`).set({
                id: 'colega1', nome: 'Colega Teste', estrelas: 6, tipo: 'mensalista',
                userId: 'uid-fake-colega', criadoEm: new Date().toISOString()
            });
            await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}`).set({
                id: cicloId, abertoPor: usuarioAtual.uid, abertoEm: new Date().toISOString(),
                prazo: null, status: 'aberto', fechadoEm: null, motivoFechamento: null
            });
            grupoAtualId = grupoId;
            papelNoGrupo = 'admin';
            await inicializarListeners(grupoId);
            return meu.id;
        }, { grupoId, cicloId });

        await page.waitForTimeout(700); // aguarda listener sincronizar jogadores

        await abrirSecao(page, 'votacao');
        await page.waitForTimeout(500);

        await expect(page.locator('#votacaoListaCedula')).toContainText('Colega Teste');
        await expect(page.locator('#votacaoListaCedula')).not.toContainText('Eu Mesmo Teste');

        await page.selectOption('#voto_colega1', '8');
        await page.click('#btnEnviarVotos');
        await page.waitForTimeout(600);

        const dados = await page.evaluate(async ({ grupoId, cicloId }) => {
            const snap = await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}`).get();
            return snap.val();
        }, { grupoId, cicloId });

        expect(dados.votos[meuId].colega1.nota).toBe(8);
        expect(dados.submissoes[meuId]).toBe(true);

        await page.evaluate((id) => database.ref(`grupos/${id}`).remove(), grupoId);
    });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx playwright test tests/votacao.spec.js -g "cédula"`
Expected: FAIL — `#votacaoListaCedula` vazio, `#voto_colega1` não existe

- [ ] **Step 3: Implementar em `js/votacao.js`**

Adicionar `_meuJogador` e `renderizarCedula`, e substituir o stub de `enviarCedula`:

```js
async function _meuJogador() {
    return Object.values(jogadores).find(j => j.userId === usuarioAtual.uid) || null;
}

async function renderizarCedula(cicloId) {
    const meu = await _meuJogador();
    const container = document.getElementById('votacaoListaCedula');
    const aviso = document.getElementById('votacaoSemJogador');
    const btnEnviar = document.getElementById('btnEnviarVotos');

    if (!meu || meu.tipo !== 'mensalista') {
        container.innerHTML = '';
        aviso.style.display = 'block';
        btnEnviar.style.display = 'none';
        return;
    }
    aviso.style.display = 'none';
    btnEnviar.style.display = 'block';

    const votosSnap = await database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${cicloId}/votos/${meu.id}`).get();
    const meusVotos = votosSnap.val() || {};

    const opcoes = (selecionado) => Array.from({ length: 10 }, (_, i) => i + 1)
        .map(n => `<option value="${n}" ${selecionado === n ? 'selected' : ''}>${n}</option>`).join('');

    container.innerHTML = Object.values(jogadores)
        .filter(j => j.id !== meu.id)
        .map(j => `
            <div class="list-item">
                <div class="item-content">
                    <div class="player-info">
                        <div class="player-name">${j.nome} ${j.tipo === 'avulso' ? '(Avulso)' : ''}</div>
                    </div>
                    <select id="voto_${j.id}" style="max-width:90px;">
                        <option value="">—</option>
                        ${opcoes(meusVotos[j.id]?.nota)}
                    </select>
                </div>
            </div>
        `).join('');
}

window.enviarCedula = async function() {
    const cicloId = document.getElementById('votacaoCedula').dataset.cicloId;
    const meu = await _meuJogador();
    if (!meu || !cicloId) return;

    const selects = document.querySelectorAll('#votacaoListaCedula select');
    const updates = {};
    selects.forEach(sel => {
        const jogadorId = sel.id.replace('voto_', '');
        if (sel.value) {
            updates[`votos/${meu.id}/${jogadorId}`] = { nota: parseInt(sel.value), criadoEm: new Date().toISOString() };
        }
    });
    updates[`submissoes/${meu.id}`] = true;

    await database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${cicloId}`).update(updates);
    exibirVotacao();
};
```

- [ ] **Step 4: Chamar `renderizarCedula` a partir de `exibirVotacao`**

Em `exibirVotacao`, no bloco `if (cicloAtivo) { ... }`:

```js
    if (cicloAtivo) {
        document.getElementById('votacaoCedula').dataset.cicloId = cicloAtivo.id;
        await renderizarCedula(cicloAtivo.id);
    }
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx playwright test tests/votacao.spec.js -g "cédula"`
Expected: PASS

- [ ] **Step 6: Rodar a suíte completa**

Run: `npx playwright test`
Expected: nenhuma regressão

- [ ] **Step 7: Commit**

```bash
git add js/votacao.js tests/votacao.spec.js
git commit -m "feat: cedula de votacao de estrelas para mensalistas"
```

---

## Task 3: Fechamento do ciclo e agregação (média aparada)

**Files:**
- Modify: `js/votacao.js` (substitui o stub `encerrarCicloVotacaoManualmente`; adiciona `_verificarFechamentoAutomatico`, `_fecharCiclo`, `_calcularAgregacao`)
- Test: `tests/votacao.spec.js`

**Interfaces:**
- Produces:
  - `window.encerrarCicloVotacaoManualmente(): Promise<void>` — admin only
  - `async function _verificarFechamentoAutomatico(grupoId, ciclo): Promise<void>` — fecha se prazo atingido ou todos os mensalistas votaram
  - `async function _fecharCiclo(grupoId, cicloId, motivo): Promise<void>` — muda status pra `'aguardandoAprovacao'`, dispara agregação
  - `async function _calcularAgregacao(grupoId, cicloId): Promise<void>` — grava `resultados/{jogadorId}` pra quem bateu quórum de 5 votos

- [ ] **Step 1: Escrever os testes que falham**

```js
test.describe('Ciclo de votação — fechamento e agregação', () => {
    test.beforeEach(async ({ page }) => {
        await fazerLogin(page);
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });
    });

    test('agregação remove maior e menor voto e tira média do resto', async ({ page }) => {
        const grupoId = `teste_agregacao_${Date.now()}`;
        const cicloId = 'ciclo1';

        await page.evaluate(async ({ grupoId, cicloId }) => {
            await database.ref(`grupos/${grupoId}/jogadores/alvo`).set({
                id: 'alvo', nome: 'Alvo Teste', estrelas: 3, tipo: 'mensalista', userId: null, criadoEm: new Date().toISOString()
            });
            await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}`).set({
                id: cicloId, abertoPor: 'x', abertoEm: new Date().toISOString(),
                prazo: null, status: 'aberto', fechadoEm: null, motivoFechamento: null
            });
            const notas = [10, 1, 5, 5, 5, 5, 5]; // remove 10 e 1 → média de [5,5,5,5,5] = 5
            const votos = {};
            notas.forEach((nota, i) => { votos[`votante${i}`] = { alvo: { nota, criadoEm: new Date().toISOString() } }; });
            await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}/votos`).set(votos);

            await window._calcularAgregacao(grupoId, cicloId);
        }, { grupoId, cicloId });

        const resultado = await page.evaluate(async ({ grupoId, cicloId }) => {
            const snap = await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}/resultados/alvo`).get();
            return snap.val();
        }, { grupoId, cicloId });

        expect(resultado.estrelaProposta).toBe(5);
        expect(resultado.qtdVotos).toBe(7);
        expect(resultado.aprovado).toBeNull();

        await page.evaluate((id) => database.ref(`grupos/${id}`).remove(), grupoId);
    });

    test('jogador com menos de 5 votos não entra na agregação', async ({ page }) => {
        const grupoId = `teste_agregacao_quorum_${Date.now()}`;
        const cicloId = 'ciclo1';

        await page.evaluate(async ({ grupoId, cicloId }) => {
            await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}`).set({
                id: cicloId, abertoPor: 'x', abertoEm: new Date().toISOString(),
                prazo: null, status: 'aberto', fechadoEm: null, motivoFechamento: null
            });
            const votos = {
                votante1: { alvo: { nota: 7, criadoEm: new Date().toISOString() } },
                votante2: { alvo: { nota: 8, criadoEm: new Date().toISOString() } },
            };
            await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}/votos`).set(votos);
            await window._calcularAgregacao(grupoId, cicloId);
        }, { grupoId, cicloId });

        const resultado = await page.evaluate(async ({ grupoId, cicloId }) => {
            const snap = await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}/resultados/alvo`).get();
            return snap.val();
        }, { grupoId, cicloId });

        expect(resultado).toBeNull();

        await page.evaluate((id) => database.ref(`grupos/${id}`).remove(), grupoId);
    });

    test('admin encerra ciclo manualmente e status vira aguardandoAprovacao', async ({ page }) => {
        const grupoId = `teste_encerrar_${Date.now()}`;
        const cicloId = await page.evaluate(async (grupoId) => {
            await database.ref(`grupos/${grupoId}/membros/${usuarioAtual.uid}`).set({ role: 'admin', entradaEm: new Date().toISOString() });
            const id = Date.now().toString();
            await database.ref(`grupos/${grupoId}/ciclosVotacao/${id}`).set({
                id, abertoPor: usuarioAtual.uid, abertoEm: new Date().toISOString(),
                prazo: null, status: 'aberto', fechadoEm: null, motivoFechamento: null
            });
            grupoAtualId = grupoId;
            papelNoGrupo = 'admin';
            return id;
        }, grupoId);

        await page.evaluate(() => encerrarCicloVotacaoManualmente());
        await page.waitForTimeout(600);

        const ciclo = await page.evaluate(async ({ grupoId, cicloId }) => {
            const snap = await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}`).get();
            return snap.val();
        }, { grupoId, cicloId });

        expect(ciclo.status).toBe('aguardandoAprovacao');
        expect(ciclo.motivoFechamento).toBe('manual');

        await page.evaluate((id) => database.ref(`grupos/${id}`).remove(), grupoId);
    });
});
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx playwright test tests/votacao.spec.js -g "fechamento e agregação"`
Expected: FAIL — `window._calcularAgregacao is not a function`; `encerrarCicloVotacaoManualmente` só loga aviso, status continua `'aberto'`

- [ ] **Step 3: Implementar em `js/votacao.js`**

Substituir o stub de `encerrarCicloVotacaoManualmente` e adicionar as funções de fechamento/agregação:

```js
window.encerrarCicloVotacaoManualmente = async function() {
    if (papelNoGrupo !== 'admin') return;
    const cicloAtivo = await _buscarCicloAtivo(grupoAtualId);
    if (!cicloAtivo) return;
    await _fecharCiclo(grupoAtualId, cicloAtivo.id, 'manual');
    exibirVotacao();
};

async function _verificarFechamentoAutomatico(grupoId, ciclo) {
    if (!ciclo) return;

    if (ciclo.prazo && new Date(ciclo.prazo) <= new Date()) {
        await _fecharCiclo(grupoId, ciclo.id, 'prazo');
        return;
    }

    const jogadoresSnap = await database.ref(`grupos/${grupoId}/jogadores`).get();
    const todosJogadores = Object.values(jogadoresSnap.val() || {});
    const mensalistas = todosJogadores.filter(j => (j.tipo || 'mensalista') === 'mensalista');

    const submissoesSnap = await database.ref(`grupos/${grupoId}/ciclosVotacao/${ciclo.id}/submissoes`).get();
    const submissoes = submissoesSnap.val() || {};
    const qtdSubmeteram = mensalistas.filter(j => submissoes[j.id]).length;

    if (mensalistas.length > 0 && qtdSubmeteram >= mensalistas.length) {
        await _fecharCiclo(grupoId, ciclo.id, 'todosVotaram');
    }
}

async function _fecharCiclo(grupoId, cicloId, motivo) {
    await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}`).update({
        status: 'aguardandoAprovacao',
        fechadoEm: new Date().toISOString(),
        motivoFechamento: motivo
    });
    await _calcularAgregacao(grupoId, cicloId);
}

async function _calcularAgregacao(grupoId, cicloId) {
    const votosSnap = await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}/votos`).get();
    const votos = votosSnap.val() || {};

    const notasPorAvaliado = {};
    for (const votante of Object.values(votos)) {
        for (const [avaliadoId, voto] of Object.entries(votante)) {
            if (!notasPorAvaliado[avaliadoId]) notasPorAvaliado[avaliadoId] = [];
            notasPorAvaliado[avaliadoId].push(voto.nota);
        }
    }

    const jogadoresSnap = await database.ref(`grupos/${grupoId}/jogadores`).get();
    const todosJogadores = jogadoresSnap.val() || {};

    const updates = {};
    for (const [jogadorId, notas] of Object.entries(notasPorAvaliado)) {
        if (notas.length < 5) continue;

        const ordenadas = [...notas].sort((a, b) => a - b);
        const aparadas = ordenadas.slice(1, -1);
        const media = aparadas.reduce((s, n) => s + n, 0) / aparadas.length;

        updates[`resultados/${jogadorId}`] = {
            estrelaAtual: todosJogadores[jogadorId]?.estrelas ?? null,
            estrelaProposta: Math.round(media),
            qtdVotos: notas.length,
            aprovado: null,
            decididoEm: null
        };
    }

    if (Object.keys(updates).length > 0) {
        await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}`).update(updates);
    }
}
```

- [ ] **Step 4: Chamar a checagem passiva a partir de `exibirVotacao`**

```js
async function exibirVotacao() {
    document.getElementById('votacaoErro').style.display = 'none';

    let cicloAtivo = await _buscarCicloAtivo(grupoAtualId);
    if (cicloAtivo) {
        await _verificarFechamentoAutomatico(grupoAtualId, cicloAtivo);
        cicloAtivo = await _buscarCicloAtivo(grupoAtualId); // relê — pode ter fechado agora
    }

    document.getElementById('votacaoAdminAbrir').style.display    = (papelNoGrupo === 'admin' && !cicloAtivo) ? 'block' : 'none';
    document.getElementById('votacaoSemCiclo').style.display      = (!cicloAtivo) ? 'block' : 'none';
    document.getElementById('votacaoCedula').style.display        = cicloAtivo ? 'block' : 'none';
    document.getElementById('votacaoAdminEncerrar').style.display = (papelNoGrupo === 'admin' && cicloAtivo) ? 'block' : 'none';

    if (cicloAtivo) {
        document.getElementById('votacaoCedula').dataset.cicloId = cicloAtivo.id;
        await renderizarCedula(cicloAtivo.id);
    }
}
```

- [ ] **Step 5: Rodar e confirmar que passam**

Run: `npx playwright test tests/votacao.spec.js -g "fechamento e agregação"`
Expected: PASS — 3 testes passaram

- [ ] **Step 6: Rodar a suíte completa**

Run: `npx playwright test`
Expected: nenhuma regressão

- [ ] **Step 7: Commit**

```bash
git add js/votacao.js tests/votacao.spec.js
git commit -m "feat: fechamento de ciclo (manual/prazo/todos votaram) e agregacao por media aparada"
```

---

## Task 4: Aprovação de resultados na Gestão do Grupo

**Files:**
- Modify: `index.html:gestao` (nova subseção "Aprovação de Resultados")
- Modify: `js/votacao.js` (adiciona `exibirResultadosPendentes`, `aprovarResultado`, `rejeitarResultado`, `aprovarTodosResultados`, `_decidirResultado`, `_fecharCicloSeTudoDecidido`)
- Modify: `js/ui.js:showSection` (seção `gestao` também chama `exibirResultadosPendentes()`)
- Test: `tests/votacao.spec.js`

**Interfaces:**
- Consumes: `_buscarCicloAguardandoAprovacao` (Task 1), `jogadores` (global)
- Produces:
  - `async function exibirResultadosPendentes(): Promise<void>`
  - `window.aprovarResultado(jogadorId: string): Promise<void>`
  - `window.rejeitarResultado(jogadorId: string): Promise<void>`
  - `window.aprovarTodosResultados(): Promise<void>`

- [ ] **Step 1: Escrever o teste que falha**

```js
test.describe('Aprovação de resultados', () => {
    test.beforeEach(async ({ page }) => {
        await fazerLogin(page);
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });
    });

    test('aprovar resultado individual atualiza estrelas e fecha o ciclo quando tudo decidido', async ({ page }) => {
        const grupoId = `teste_aprovacao_${Date.now()}`;
        const cicloId = 'ciclo1';

        await page.evaluate(async ({ grupoId, cicloId }) => {
            await database.ref(`grupos/${grupoId}/membros/${usuarioAtual.uid}`).set({ role: 'admin', entradaEm: new Date().toISOString() });
            await database.ref(`grupos/${grupoId}/jogadores/alvo`).set({
                id: 'alvo', nome: 'Alvo Aprovação', estrelas: 3, tipo: 'mensalista', userId: null, criadoEm: new Date().toISOString()
            });
            await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}`).set({
                id: cicloId, abertoPor: usuarioAtual.uid, abertoEm: new Date().toISOString(),
                prazo: null, status: 'aguardandoAprovacao', fechadoEm: new Date().toISOString(), motivoFechamento: 'manual',
                resultados: { alvo: { estrelaAtual: 3, estrelaProposta: 7, qtdVotos: 5, aprovado: null, decididoEm: null } }
            });
            grupoAtualId = grupoId;
            papelNoGrupo = 'admin';
            await inicializarListeners(grupoId);
        }, { grupoId, cicloId });

        await page.waitForTimeout(700);

        await abrirSecao(page, 'gestao');
        await page.waitForTimeout(400);

        await expect(page.locator('#listaResultadosPendentes')).toContainText('Alvo Aprovação');

        await page.click("button[onclick=\"aprovarResultado('alvo')\"]");
        await page.waitForTimeout(600);

        const [estrelas, statusCiclo] = await page.evaluate(async ({ grupoId, cicloId }) => {
            const jSnap = await database.ref(`grupos/${grupoId}/jogadores/alvo/estrelas`).get();
            const cSnap = await database.ref(`grupos/${grupoId}/ciclosVotacao/${cicloId}/status`).get();
            return [jSnap.val(), cSnap.val()];
        }, { grupoId, cicloId });

        expect(estrelas).toBe(7);
        expect(statusCiclo).toBe('encerrado');

        await page.evaluate((id) => database.ref(`grupos/${id}`).remove(), grupoId);
    });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx playwright test tests/votacao.spec.js -g "Aprovação de resultados"`
Expected: FAIL — `#listaResultadosPendentes` não existe, `aprovarResultado` não definido

- [ ] **Step 3: Adicionar a subseção em `index.html`**

Dentro de `<div id="gestao" class="content-section">`, depois do bloco "Vínculos de Jogadores":

```html
                <div class="form-group">
                    <label>Aprovação de Resultados — Votação de Estrelas</label>
                    <div id="listaResultadosPendentes"></div>
                    <button class="btn btn-full" id="btnAprovarTodos" onclick="aprovarTodosResultados()" style="display:none;">Aprovar Tudo</button>
                </div>
```

- [ ] **Step 4: Implementar em `js/votacao.js`**

```js
async function exibirResultadosPendentes() {
    const container = document.getElementById('listaResultadosPendentes');
    const btnTodos = document.getElementById('btnAprovarTodos');

    const ciclo = await _buscarCicloAguardandoAprovacao(grupoAtualId);
    if (!ciclo || !ciclo.resultados) {
        container.innerHTML = '<p style="color:#666;font-size:13px;">Nenhum resultado aguardando aprovação.</p>';
        btnTodos.style.display = 'none';
        return;
    }

    const pendentes = Object.entries(ciclo.resultados).filter(([, r]) => r.aprovado === null);
    if (pendentes.length === 0) {
        container.innerHTML = '<p style="color:#666;font-size:13px;">Nenhum resultado aguardando aprovação.</p>';
        btnTodos.style.display = 'none';
        return;
    }

    container.dataset.cicloId = ciclo.id;
    btnTodos.style.display = 'block';

    container.innerHTML = pendentes.map(([jogadorId, r]) => `
        <div class="list-item">
            <div class="item-content">
                <div class="player-info">
                    <div class="player-name">${jogadores[jogadorId]?.nome || jogadorId}</div>
                    <div class="player-stars">
                        <span class="star-count">${r.estrelaAtual} → ${r.estrelaProposta} estrelas (${r.qtdVotos} votos)</span>
                    </div>
                </div>
                <button class="edit-btn" onclick="aprovarResultado('${jogadorId}')">✅</button>
                <button class="edit-btn" onclick="rejeitarResultado('${jogadorId}')" style="background:linear-gradient(135deg,#e57373,#c62828);">❌</button>
            </div>
        </div>
    `).join('');
}

window.aprovarResultado = async function(jogadorId) {
    const cicloId = document.getElementById('listaResultadosPendentes').dataset.cicloId;
    await _decidirResultado(cicloId, jogadorId, true);
    exibirResultadosPendentes();
};

window.rejeitarResultado = async function(jogadorId) {
    const cicloId = document.getElementById('listaResultadosPendentes').dataset.cicloId;
    await _decidirResultado(cicloId, jogadorId, false);
    exibirResultadosPendentes();
};

window.aprovarTodosResultados = async function() {
    const cicloId = document.getElementById('listaResultadosPendentes').dataset.cicloId;
    const snap = await database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${cicloId}/resultados`).get();
    const resultados = snap.val() || {};
    const pendentes = Object.entries(resultados).filter(([, r]) => r.aprovado === null);
    for (const [jogadorId] of pendentes) {
        await _decidirResultado(cicloId, jogadorId, true);
    }
    exibirResultadosPendentes();
};

async function _decidirResultado(cicloId, jogadorId, aprovado) {
    const resultadoSnap = await database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${cicloId}/resultados/${jogadorId}`).get();
    const resultado = resultadoSnap.val();
    if (!resultado) return;

    await database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${cicloId}/resultados/${jogadorId}`).update({
        aprovado, decididoEm: new Date().toISOString()
    });

    if (aprovado) {
        await database.ref(`grupos/${grupoAtualId}/jogadores/${jogadorId}/estrelas`).set(resultado.estrelaProposta);
    }

    await _fecharCicloSeTudoDecidido(cicloId);
}

async function _fecharCicloSeTudoDecidido(cicloId) {
    const snap = await database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${cicloId}/resultados`).get();
    const resultados = snap.val() || {};
    const aindaPendente = Object.values(resultados).some(r => r.aprovado === null);
    if (!aindaPendente) {
        await database.ref(`grupos/${grupoAtualId}/ciclosVotacao/${cicloId}/status`).set('encerrado');
    }
}
```

- [ ] **Step 5: Chamar `exibirResultadosPendentes()` junto com a seção `gestao` (`js/ui.js`)**

```js
    else if (sectionName === 'gestao') { exibirVinculosJogadores(); exibirResultadosPendentes(); }
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npx playwright test tests/votacao.spec.js -g "Aprovação de resultados"`
Expected: PASS

- [ ] **Step 7: Rodar a suíte completa**

Run: `npx playwright test`
Expected: nenhuma regressão

- [ ] **Step 8: Commit**

```bash
git add index.html js/votacao.js js/ui.js tests/votacao.spec.js
git commit -m "feat: aprovacao de resultados da votacao de estrelas na Gestao do Grupo"
```

---

## Nota de escopo

Este plano completa a spec `docs/superpowers/specs/2026-08-17-votacao-estrelas-design.md`. A "Nota de escopo" do plano anterior sobre o RBAC completo da spec `2026-04-24` continua valendo — ver `CLAUDE.md`, seção "⚠️ PENDÊNCIA CRÍTICA".
