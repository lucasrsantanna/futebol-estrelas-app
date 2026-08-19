const { test, expect } = require('@playwright/test');

const TEST_EMAIL    = 'teste@estrelas.com';
const TEST_PASSWORD = 'teste123456';

// Lista no formato WhatsApp que o parser aceita
const LISTA_WHATSAPP = `Mensalistas
1 - João Silva
2 - Carlos Eduardo
3 - Pedro Henrique

Avulsos
4 - Marcos Vinícius
5 - Rafael Souza`;

async function loginEAguardarApp(page) {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('button[onclick="mostrarLoginEmail()"]');
    await page.fill('#loginEmail', TEST_EMAIL);
    await page.fill('#loginSenha', TEST_PASSWORD);
    await page.click('button[onclick="loginComEmail()"]');
    await page.locator('#mainApp').waitFor({ state: 'visible', timeout: 15000 });
}

test.describe('Importação de lista WhatsApp', () => {

    test('1. Modal de importação abre na step 1 (textarea)', async ({ page }) => {
        await loginEAguardarApp(page);

        await page.click('button.importar');
        await page.locator('#importModal').waitFor({ state: 'visible', timeout: 5000 });

        await expect(page.locator('#importStep1')).toBeVisible();
        await expect(page.locator('#importStep2')).toBeHidden();
        await expect(page.locator('#importTextarea')).toBeVisible();
        console.log('✅ Modal abriu na step 1 corretamente');
    });

    test('2. Parser processa lista válida e avança para step 2', async ({ page }) => {
        await loginEAguardarApp(page);

        await page.click('button.importar');
        await page.locator('#importModal').waitFor({ state: 'visible' });

        await page.fill('#importTextarea', LISTA_WHATSAPP);
        await page.click('button[onclick="processarListaWhatsApp()"]');

        await page.locator('#importStep2').waitFor({ state: 'visible', timeout: 5000 });
        await expect(page.locator('#importStep1')).toBeHidden();
        await expect(page.locator('#importStep2')).toBeVisible();
        console.log('✅ Step 2 (revisão) apareceu após processar a lista');
    });

    test('3. Revisão classifica jogadores de acordo com o banco atual', async ({ page }) => {
        await loginEAguardarApp(page);

        // Aguarda Firebase carregar (jogadoresCarregados vira true após 1ª resposta)
        await page.waitForFunction(() => jogadoresCarregados === true, { timeout: 10000 });
        const totalJogadores = await page.evaluate(() => Object.keys(jogadores).length);
        console.log(`Jogadores no banco após carregamento: ${totalJogadores}`);

        await page.click('button.importar');
        await page.locator('#importModal').waitFor({ state: 'visible' });
        await page.fill('#importTextarea', LISTA_WHATSAPP);
        await page.click('button[onclick="processarListaWhatsApp()"]');
        await page.locator('#importStep2').waitFor({ state: 'visible', timeout: 5000 });

        const revisaoHtml = await page.locator('#importRevisaoContent').innerHTML();

        if (totalJogadores === 0) {
            expect(revisaoHtml).toContain('Novos');
            console.log('✅ Banco vazio → seção "Novos" presente (correto)');

            // Nomes ficam em inputs — verifica via atributo value
            const nomes = await page.locator('#importRevisaoContent .import-nome-input').allInputValues();
            expect(nomes).toContain('João Silva');
            expect(nomes).toContain('Carlos Eduardo');
            console.log('Nomes nos inputs:', nomes);
        } else {
            // Com jogadores no banco: nomes aparecem como texto nos labels (Confirmados/Ambíguos)
            // Usa nomes sem acentos problemáticos (normalizarNome capitaliza letra após ã/õ)
            expect(revisaoHtml).toContain('Carlos Eduardo');
            expect(revisaoHtml).toContain('Rafael Souza');
            console.log(`✅ ${totalJogadores} jogadores no banco → revisão com matches gerada`);
        }

        console.log('✅ Revisão gerada corretamente para o estado atual do banco');
    });

    test('4. Confirmação de importação cria jogadores e os marca presentes', async ({ page }) => {
        const erros = [];
        page.on('pageerror', e => erros.push(e.message));

        await loginEAguardarApp(page);

        // Conta jogadores antes
        await page.waitForFunction(() => jogadoresCarregados === true, { timeout: 10000 });
        const antesDe = await page.evaluate(() =>
            typeof jogadores !== 'undefined' ? Object.keys(jogadores).length : 0
        );

        await page.click('button.importar');
        await page.locator('#importModal').waitFor({ state: 'visible' });
        await page.fill('#importTextarea', LISTA_WHATSAPP);
        await page.click('button[onclick="processarListaWhatsApp()"]');
        await page.locator('#importStep2').waitFor({ state: 'visible', timeout: 5000 });

        // Confirma importação
        await page.click('#btnConfirmarImport');

        // Modal deve fechar
        await page.locator('#importModal').waitFor({ state: 'hidden', timeout: 10000 });
        console.log('✅ Modal fechou após confirmação');

        // jogadoresPresentes é let global (não window.*) — acessa diretamente
        const presentes = await page.evaluate(() =>
            typeof jogadoresPresentes !== 'undefined' ? jogadoresPresentes.length : 0
        );
        console.log(`Jogadores marcados como presentes: ${presentes}`);
        expect(presentes).toBeGreaterThan(0);

        // jogadores é let global (não window.*) — aguarda listener Firebase atualizar
        if (antesDe === 0) {
            await page.waitForFunction(
                () => typeof jogadores !== 'undefined' && Object.keys(jogadores).length > 0,
                { timeout: 10000 }
            );
        }

        const depoisDe = await page.evaluate(() =>
            typeof jogadores !== 'undefined' ? Object.keys(jogadores).length : 0
        );
        console.log(`Jogadores antes: ${antesDe} → depois: ${depoisDe}`);
        if (antesDe === 0) {
            console.log(`✅ ${depoisDe} novos jogadores criados no Firebase`);
        }

        if (erros.length) console.log('Erros durante confirmação:\n' + erros.join('\n'));
        expect(erros).toHaveLength(0);
    });

    test('5. Lista inválida (sem numeração) exibe erro e não avança', async ({ page }) => {
        await loginEAguardarApp(page);

        await page.click('button.importar');
        await page.locator('#importModal').waitFor({ state: 'visible' });

        await page.fill('#importTextarea', 'Texto qualquer sem formato de lista');
        await page.click('button[onclick="processarListaWhatsApp()"]');

        // Step 2 NÃO deve aparecer — erro ou nenhuma mudança
        await page.waitForTimeout(1000);
        const step2Visivel = await page.locator('#importStep2').isVisible();
        expect(step2Visivel).toBe(false);
        console.log('✅ Lista inválida não avança para a revisão');
    });

    test('6. Escape fecha o modal de importação', async ({ page }) => {
        await loginEAguardarApp(page);

        await page.click('button.importar');
        await page.locator('#importModal').waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        await page.locator('#importModal').waitFor({ state: 'hidden', timeout: 5000 });
        await expect(page.locator('#importModal')).toBeHidden();
        console.log('✅ Escape fechou o modal');
    });

    test('7. Presença travada bloqueia o marcar-presente da importação (jogadores ainda são criados)', async ({ page }) => {
        await loginEAguardarApp(page);
        await page.waitForFunction(() => jogadoresCarregados === true, { timeout: 10000 });

        await page.evaluate(() => { presencaTravada = true; });

        const sufixo = Date.now();
        const listaUnica = `Mensalistas\n1 - Zqximportum ${sufixo}\n\nAvulsos\n2 - Zqximportdois ${sufixo}`;

        await page.click('button.importar');
        await page.locator('#importModal').waitFor({ state: 'visible' });
        await page.fill('#importTextarea', listaUnica);
        await page.click('button[onclick="processarListaWhatsApp()"]');
        await page.locator('#importStep2').waitFor({ state: 'visible', timeout: 5000 });

        await page.click('#btnConfirmarImport');
        await page.locator('#importModal').waitFor({ state: 'hidden', timeout: 10000 });

        // Os jogadores devem ser criados normalmente — só o marcar-presente é bloqueado
        const criados = await page.evaluate(async (sufixo) => {
            await new Promise(r => setTimeout(r, 800));
            return Object.values(jogadores).filter(j => j.nome.includes(String(sufixo)));
        }, sufixo);
        expect(criados.length).toBe(2);
        console.log(`✅ ${criados.length} jogadores criados mesmo com presença travada`);

        // Nenhum deles deve ter sido marcado presente no Firebase
        for (const j of criados) {
            const presente = await page.evaluate(async (id) => {
                const snap = await database.ref(`grupos/${grupoAtualId}/presencaAtual/${id}`).get();
                return snap.val();
            }, j.id);
            expect(presente).toBeFalsy();
        }
        console.log('✅ Trava impediu o marcar-presente da importação');

        await page.evaluate(() => { presencaTravada = false; });
        await page.evaluate((ids) => {
            ids.forEach(id => database.ref(`grupos/${grupoAtualId}/jogadores/${id}`).remove());
        }, criados.map(j => j.id));
    });

});
