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
