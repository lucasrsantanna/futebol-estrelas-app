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
    _finalizarEntradaNoGrupo(grupoId);
}
