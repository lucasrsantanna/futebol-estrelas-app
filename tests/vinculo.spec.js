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
