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
        // RTDB não persiste campos com valor `null` em .set() — o "sem userId" real
        // do órfão é a chave ausente (undefined), não `null`. `toBeFalsy()` cobre
        // ambos e é consistente com `!j.userId` usado em resolverVinculoJogador.
        expect(jogadoresDoGrupo['orfao1'].userId).toBeFalsy();

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
        // Ver comentário equivalente no teste "Sou novo" acima sobre RTDB e `null`.
        expect(jogadoresDoGrupo['orfao1'].userId).toBeFalsy();

        await page.evaluate((id) => database.ref(`grupos/${id}`).remove(), grupoId);
    });
});

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

test.describe('Gestão do Grupo — correção manual de vínculo', () => {
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
});

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

        // quickJaSelecionar vem marcado por padrão — cadastrarRapido deve gravar
        // a presença em grupos/{id}/presencaAtual (via Firebase), não só no array
        // local em memória, senão o próximo disparo do listener de presencaAtual
        // (por qualquer outro motivo) sobrescreve jogadoresPresentes e perde essa
        // marcação silenciosamente.
        const presenteNoFirebase = await page.evaluate(async (id) => {
            const snap = await database.ref(`grupos/${grupoAtualId}/presencaAtual/${id}`).get();
            return snap.val();
        }, jogador.id);
        expect(presenteNoFirebase).toBe(true);

        await page.evaluate((id) => database.ref(`grupos/${grupoAtualId}/presencaAtual/${id}`).remove(), jogador.id);
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

        // Escopado a #jogadores: o mesmo jogador também renderiza um botão idêntico
        // (mesmo onclick) na seção #separar, que fica no DOM oculta via display:none
        // em vez de removida — sem o escopo, page.click resolve para essa cópia oculta.
        await page.click(`#jogadores button[onclick="editarJogador('${jogadorId}', event)"]`);
        await page.locator('#editModal').waitFor({ state: 'visible' });
        await expect(page.locator('#editEstrelas')).toHaveCount(0);

        await page.evaluate((id) => database.ref(`grupos/${grupoAtualId}/jogadores/${id}`).remove(), jogadorId);
    });
});

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
