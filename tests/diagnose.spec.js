/**
 * Diagnóstico completo — roda com --headed para você ver o browser ao vivo.
 * Uso: npm run diagnose
 *
 * Não faz assertions — só reporta tudo que encontra.
 */
const { test } = require('@playwright/test');

test('diagnóstico completo do app', async ({ page }) => {
    const logs = { errors: [], warnings: [], infos: [], network404: [], networkFail: [] };

    page.on('console', msg => {
        const txt = `[${msg.type()}] ${msg.text()}`;
        if (msg.type() === 'error') logs.errors.push(txt);
        else if (msg.type() === 'warning') logs.warnings.push(txt);
        else logs.infos.push(txt);
    });

    page.on('pageerror', err => logs.errors.push(`[pageerror] ${err.message}`));

    page.on('response', res => {
        if (res.status() === 404) logs.network404.push(`404 ${res.url()}`);
    });

    page.on('requestfailed', req =>
        logs.networkFail.push(`FAIL ${req.url()} — ${req.failure()?.errorText}`)
    );

    console.log('\n🔍 Abrindo app em http://localhost:5500...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Estado das telas
    const telaLogin    = await page.locator('#telaLogin').isVisible();
    const telaBemVindo = await page.locator('#telaBemVindo').isVisible();
    const mainApp      = await page.locator('#mainApp').isVisible();

    console.log('\n📱 Estado das telas:');
    console.log(`   #telaLogin:    ${telaLogin    ? '✅ visível' : '❌ oculta'}`);
    console.log(`   #telaBemVindo: ${telaBemVindo ? '✅ visível' : '❌ oculta'}`);
    console.log(`   #mainApp:      ${mainApp      ? '✅ visível' : '❌ oculta'}`);

    // Firebase
    const fbStatus = await page.evaluate(() => ({
        sdk:      typeof window.firebase !== 'undefined',
        auth:     typeof window.firebase?.auth !== 'undefined',
        database: typeof window.firebase?.database !== 'undefined',
    }));
    console.log('\n🔥 Firebase:');
    console.log(`   SDK:      ${fbStatus.sdk      ? '✅' : '❌'}`);
    console.log(`   Auth:     ${fbStatus.auth      ? '✅' : '❌'}`);
    console.log(`   Database: ${fbStatus.database  ? '✅' : '❌'}`);

    // Funções globais
    const fns = [
        'initAuth', 'loginComGoogle', 'loginComEmail', 'loginComTelefone',
        'logout', 'criarGrupo', 'entrarPorLinkConvite', 'gerarLinkConvite',
        'migrarDadosParaGrupo', 'separarTimes', 'confirmarTimes',
        'abrirImportModal', 'confirmarImportacao', 'verificarConviteNaURL',
    ];
    const ausentes = await page.evaluate(lista =>
        lista.filter(fn => typeof window[fn] === 'undefined')
    , fns);

    console.log('\n🔧 Funções globais:');
    if (ausentes.length === 0) console.log('   ✅ todas presentes');
    else ausentes.forEach(fn => console.log(`   ❌ window.${fn} não encontrada`));

    // Console
    console.log(`\n🚨 Erros (${logs.errors.length}):`);
    if (logs.errors.length === 0) console.log('   ✅ nenhum');
    else logs.errors.forEach(e => console.log(`   ${e}`));

    console.log(`\n⚠️  Warnings (${logs.warnings.length}):`);
    if (logs.warnings.length === 0) console.log('   ✅ nenhum');
    else logs.warnings.forEach(w => console.log(`   ${w}`));

    console.log(`\n🌐 Recursos não encontrados (404):`);
    if (logs.network404.length === 0) console.log('   ✅ nenhum');
    else logs.network404.forEach(r => console.log(`   ${r}`));

    console.log('\n✅ Diagnóstico concluído.\n');
});
