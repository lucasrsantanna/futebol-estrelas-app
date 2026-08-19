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

async function _carregarMembrosComNomes(grupoId) {
    const membrosSnap = await database.ref(`grupos/${grupoId}/membros`).get();
    const membros = membrosSnap.val() || {};
    const uids = Object.keys(membros);
    const nomes = await Promise.all(uids.map(uid => database.ref(`usuarios/${uid}`).get()));
    return uids.map((uid, i) => ({
        uid,
        role: membros[uid].role,
        nome: nomes[i].val()?.nome || uid
    }));
}

async function exibirVinculosJogadores() {
    const container = document.getElementById('listaVinculos');
    const membros = await _carregarMembrosComNomes(grupoAtualId);

    container.innerHTML = Object.values(jogadores).map(j => `
        <div class="list-item">
            <div class="item-content">
                <div class="player-info">
                    <div class="player-name">${j.nome}</div>
                    <div class="player-stars">
                        <span class="star-count">${j.userId ? 'Vinculado a: ' + (membros.find(m => m.uid === j.userId)?.nome || j.userId) : 'Não vinculado'}</span>
                    </div>
                </div>
                <select onchange="corrigirVinculoJogador('${j.id}', this.value)" style="max-width:140px;">
                    <option value="">— nenhum —</option>
                    ${membros.map(m => `<option value="${m.uid}" ${j.userId === m.uid ? 'selected' : ''}>${m.nome}</option>`).join('')}
                </select>
            </div>
        </div>
    `).join('');
}

window.corrigirVinculoJogador = async function(jogadorId, novoUserId) {
    await database.ref(`grupos/${grupoAtualId}/jogadores/${jogadorId}/userId`).set(novoUserId || null);
    exibirVinculosJogadores();
};

function exibirCorrecaoPresenca() {
    const container = document.getElementById('listaCorrecaoPresenca');
    container.innerHTML = Object.values(jogadores).map(j => {
        const presente = jogadoresPresentes.includes(j.id);
        return `
            <div class="list-item ${presente ? 'checked' : ''}" onclick="corrigirPresencaManual('${j.id}', ${!presente})">
                <div class="item-content">
                    <div class="player-info">
                        <div class="player-name">${j.nome}</div>
                        <div class="player-stars"><span class="star-count">${presente ? 'Presente' : 'Ausente'}</span></div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.corrigirPresencaManual = function(jogadorId, presente) {
    if (papelNoGrupo !== 'admin' || !database || !grupoAtualId) return;
    if (presente) {
        database.ref(`grupos/${grupoAtualId}/presencaAtual/${jogadorId}`).set(true);
    } else {
        database.ref(`grupos/${grupoAtualId}/presencaAtual/${jogadorId}`).remove();
    }
};
