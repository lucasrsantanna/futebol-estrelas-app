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

function mostrarTelaAutoclaim(grupoId, orfaos) {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('telaLogin').style.display     = 'none';
    document.getElementById('telaBemVindo').style.display  = 'none';
    document.getElementById('mainApp').style.display       = 'none';

    const tela = document.getElementById('telaAutoclaim');
    tela.style.display = 'flex';
    tela.dataset.grupoId = grupoId;

    document.getElementById('autoclaimLista').innerHTML = orfaos.map(j => `
        <div class="list-item" onclick="vincularJogadorExistente('${j.id}')">
            <div class="item-content">
                <div class="player-info">
                    <div class="player-name">${j.nome} ${j.tipo === 'avulso' ? '(Avulso)' : '(Mensalista)'}</div>
                    <div class="player-stars"><span class="star-count">${j.estrelas} estrelas</span></div>
                </div>
            </div>
        </div>
    `).join('');
}

window.vincularJogadorExistente = async function(jogadorId) {
    const grupoId = document.getElementById('telaAutoclaim').dataset.grupoId;
    await database.ref(`grupos/${grupoId}/jogadores/${jogadorId}/userId`).set(usuarioAtual.uid);
    document.getElementById('telaAutoclaim').style.display = 'none';
    _finalizarEntradaNoGrupo(grupoId);
};

window.criarComoNovoJogador = async function() {
    const grupoId = document.getElementById('telaAutoclaim').dataset.grupoId;
    await criarJogadorVinculado(grupoId, usuarioAtual.uid, usuarioAtual.displayName || usuarioAtual.email || 'Jogador');
    document.getElementById('telaAutoclaim').style.display = 'none';
    _finalizarEntradaNoGrupo(grupoId);
};

window.pularAutoclaim = function() {
    const grupoId = document.getElementById('telaAutoclaim').dataset.grupoId;
    document.getElementById('telaAutoclaim').style.display = 'none';
    _finalizarEntradaNoGrupo(grupoId);
};
