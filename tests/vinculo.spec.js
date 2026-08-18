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
