const { test, expect } = require('@playwright/test');

// Coleta todos os erros e warnings do console durante o carregamento
test('sem erros JS no carregamento', async ({ page }) => {
    const erros = [];
    const warnings = [];

    page.on('console', msg => {
        if (msg.type() === 'error') erros.push(msg.text());
        if (msg.type() === 'warning') warnings.push(msg.text());
    });

    page.on('pageerror', err => erros.push(err.message));

    page.on('requestfailed', req =>
        erros.push(`NETWORK FAIL: ${req.url()} — ${req.failure()?.errorText}`)
    );

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    if (erros.length) console.log('\nErros encontrados:\n' + erros.join('\n'));
    if (warnings.length) console.log('\nWarnings:\n' + warnings.join('\n'));

    expect(erros, `${erros.length} erro(s) no console:\n${erros.join('\n')}`).toHaveLength(0);
});

test('tela de login visível ao abrir (não o app)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#telaLogin')).toBeVisible();
    await expect(page.locator('#mainApp')).toBeHidden();
    await expect(page.locator('#telaBemVindo')).toBeHidden();
});

test('todos os scripts JS carregam sem 404', async ({ page }) => {
    const falhas = [];

    page.on('requestfailed', req => {
        if (req.url().includes('.js')) falhas.push(req.url());
    });

    page.on('response', res => {
        if (res.url().includes('.js') && res.status() === 404)
            falhas.push(`404: ${res.url()}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    expect(falhas, `Scripts não carregados:\n${falhas.join('\n')}`).toHaveLength(0);
});

test('Firebase SDK inicializado', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const firebaseOk = await page.evaluate(() => typeof window.firebase !== 'undefined');
    expect(firebaseOk).toBe(true);
});

test('funções globais críticas existem no window', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const fns = [
        'initAuth', 'loginComGoogle', 'loginComEmail', 'loginComTelefone',
        'logout', 'criarGrupo', 'entrarPorLinkConvite', 'gerarLinkConvite',
        'migrarDadosParaGrupo', 'separarTimes', 'confirmarTimes',
        'abrirImportModal', 'confirmarImportacao',
    ];

    const ausentes = await page.evaluate((lista) =>
        lista.filter(fn => typeof window[fn] === 'undefined')
    , fns);

    expect(ausentes, `Funções não encontradas no window: ${ausentes.join(', ')}`).toHaveLength(0);
});
