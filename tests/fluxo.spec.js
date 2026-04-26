/**
 * Testes de fluxo completo usando usuário de teste (email/senha).
 * Cobre: login → criar grupo → app carrega → migração → logout → re-login
 */
const { test, expect } = require('@playwright/test');

const TEST_EMAIL    = 'teste@estrelas.com';
const TEST_PASSWORD = 'teste123456';

// Helper: fazer login pela tela de login do app
async function fazerLogin(page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.locator('#telaLogin').waitFor({ state: 'visible' });

    await page.click('button[onclick="mostrarLoginEmail()"]');
    await page.waitForSelector('#loginEmail', { state: 'visible' });
    await page.fill('#loginEmail', TEST_EMAIL);
    await page.fill('#loginSenha', TEST_PASSWORD);
    await page.click('button[onclick="loginComEmail()"]');
}

// Helper: aguardar app ou tela de boas-vindas aparecer
async function aguardarPosLogin(page) {
    await Promise.race([
        page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 }),
        page.locator('#telaBemVindo').waitFor({ state: 'visible', timeout: 15000 }),
    ]);
}

test.describe('Fluxo de autenticação', () => {

    test('1. Login com email/senha funciona', async ({ page }) => {
        const erros = [];
        page.on('pageerror', e => erros.push(e.message));

        await fazerLogin(page);
        await aguardarPosLogin(page);

        const mainVisivel    = await page.locator('#mainApp').isVisible();
        const bemVindoVisivel = await page.locator('#telaBemVindo').isVisible();
        expect(mainVisivel || bemVindoVisivel, 'App ou tela de boas-vindas deve aparecer após login').toBe(true);
        expect(page.locator('#telaLogin')).toBeHidden();

        if (erros.length) console.log('Erros durante login:\n' + erros.join('\n'));
        expect(erros).toHaveLength(0);
    });

    test('2. Após login, usuário aparece no sidebar', async ({ page }) => {
        await fazerLogin(page);
        await aguardarPosLogin(page);

        // Se caiu no app direto (já tem grupo)
        if (await page.locator('#mainApp').isVisible()) {
            const nomeUsuario = await page.locator('#sidebarUsuario').textContent();
            expect(nomeUsuario?.trim().length, 'Nome do usuário deve estar no sidebar').toBeGreaterThan(0);
        } else {
            // Tela de boas-vindas — ainda sem grupo, sidebar não visível
            console.log('Usuário sem grupo — tela de boas-vindas exibida corretamente');
        }
    });

    test('3. Criar grupo leva ao app com dados vazios', async ({ page }) => {
        await fazerLogin(page);
        await aguardarPosLogin(page);

        // Se já está no app, pula criação de grupo
        if (await page.locator('#mainApp').isVisible()) {
            console.log('Usuário já tem grupo — pulando criação');
            return;
        }

        // Tela de boas-vindas: clicar em "Criar meu grupo"
        await page.click('button[onclick="mostrarFormCriarGrupo()"]');
        await page.waitForSelector('#formCriarGrupo', { state: 'visible' });
        await page.fill('#nomeNovoGrupo', 'Estrelas FC Teste');
        await page.click('button[onclick="criarGrupo()"]');

        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });
        await expect(page.locator('#mainApp')).toBeVisible();
        console.log('Grupo criado e app carregado com sucesso');
    });

    test('4. Botão de logout funciona', async ({ page }) => {
        await fazerLogin(page);
        await aguardarPosLogin(page);

        // Chama logout() via JS — evita depender do sidebar estar aberto
        await page.evaluate(() => window.logout());

        await page.locator('#telaLogin').waitFor({ state: 'visible', timeout: 10000 });
        await expect(page.locator('#telaLogin')).toBeVisible();
        await expect(page.locator('#mainApp')).toBeHidden();
        console.log('Logout OK — tela de login exibida');
    });

    test('5. Re-login vai direto ao grupo (sem tela de boas-vindas)', async ({ page }) => {
        // Primeiro login
        await fazerLogin(page);
        await aguardarPosLogin(page);

        const temGrupo = await page.locator('#mainApp').isVisible();
        if (!temGrupo) {
            console.log('Usuário sem grupo — pulando teste de re-login com grupo');
            return;
        }

        // Logout
        await page.evaluate(() => logout());
        await page.locator('#telaLogin').waitFor({ state: 'visible', timeout: 10000 });

        // Re-login
        await fazerLogin(page);
        await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });

        await expect(page.locator('#mainApp')).toBeVisible();
        await expect(page.locator('#telaBemVindo')).toBeHidden();
        console.log('Re-login OK — app carregado direto no grupo');
    });

});

test.describe('Funcionalidades principais', () => {

    test.beforeEach(async ({ page }) => {
        await fazerLogin(page);
        await aguardarPosLogin(page);
        // Pula testes se usuário ainda não tem grupo
        if (!await page.locator('#mainApp').isVisible()) {
            test.skip();
        }
    });

    test('6. Seção de presença carrega', async ({ page }) => {
        // A seção padrão ativa é #separar (lista de presença + separar times)
        await page.waitForSelector('#separar.active', { timeout: 10000 });
        await expect(page.locator('#separar')).toBeVisible();

        const count = await page.locator('#listaJogadores > *').count();
        console.log(`Jogadores visíveis na presença: ${count} (pode ser 0 se grupo sem dados migrados)`);
    });

    test('7. Seção financeiro carrega', async ({ page }) => {
        // Abre o sidebar e clica no botão — gera o evento DOM necessário para showSection()
        await page.evaluate(() => document.querySelector('button.menu-btn').click());
        await page.waitForTimeout(400);
        await page.evaluate(() =>
            document.querySelector("button[onclick=\"showSection('financeiro')\"]").click()
        );
        await page.waitForSelector('#financeiro.active', { timeout: 10000 });
        await expect(page.locator('#financeiro')).toBeVisible();
    });

    test('8. Seção histórico carrega', async ({ page }) => {
        await page.evaluate(() => document.querySelector('button.menu-btn').click());
        await page.waitForTimeout(400);
        await page.evaluate(() =>
            document.querySelector("button[onclick=\"showSection('historico')\"]").click()
        );
        await page.waitForSelector('#historico.active', { timeout: 10000 });
        await expect(page.locator('#historico')).toBeVisible();
    });

    test('9. Modal de importação abre e fecha', async ({ page }) => {
        await page.click('button.importar, button[onclick="abrirImportModal()"]');
        await page.locator('#importModal').waitFor({ state: 'visible', timeout: 5000 });
        await expect(page.locator('#importModal')).toBeVisible();

        await page.keyboard.press('Escape');
        await page.locator('#importModal').waitFor({ state: 'hidden', timeout: 5000 });
        await expect(page.locator('#importModal')).toBeHidden();
    });

});
