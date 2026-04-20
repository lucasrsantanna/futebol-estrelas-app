// ==============================================
// restrictions.js — Restrições entre jogadores
// ==============================================

window.abrirModalRestricoes = function() {
    selectedPlayersForRestriction = [];
    document.getElementById('restricoesModal').style.display = 'flex';
    exibirJogadoresParaRestricao();
    exibirRestricoes();
};

window.fecharModalRestricoes = function() {
    document.getElementById('restricoesModal').style.display = 'none';
    selectedPlayersForRestriction = [];
};

function exibirJogadoresParaRestricao() {
    const container = document.getElementById('playerSelector');
    const lista = Object.values(jogadores).sort((a, b) => a.nome.localeCompare(b.nome));

    if (!lista.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#666;">Nenhum jogador cadastrado</div>';
        return;
    }

    container.innerHTML = lista.map(j => `
        <div class="player-selector-item" onclick="togglePlayerSelection('${j.id}')">
            <input type="checkbox" id="check_${j.id}" onclick="event.stopPropagation();togglePlayerSelection('${j.id}')">
            <label for="check_${j.id}">${formatarNomeComTipo(j)}</label>
        </div>
    `).join('');
}

window.togglePlayerSelection = function(id) {
    const idx      = selectedPlayersForRestriction.indexOf(id);
    const checkbox = document.getElementById(`check_${id}`);
    const item     = checkbox.closest('.player-selector-item');

    if (idx > -1) {
        selectedPlayersForRestriction.splice(idx, 1);
        checkbox.checked = false;
        item.classList.remove('selected');
    } else {
        selectedPlayersForRestriction.push(id);
        checkbox.checked = true;
        item.classList.add('selected');
    }

    document.getElementById('btnCriarRestricao').disabled = selectedPlayersForRestriction.length < 2;
};

window.criarRestricao = function() {
    if (selectedPlayersForRestriction.length < 2) {
        alert('Selecione pelo menos 2 jogadores!'); return;
    }

    const jaExiste = Object.values(restricoes).find(r =>
        r.jogadores.length === selectedPlayersForRestriction.length &&
        selectedPlayersForRestriction.every(id => r.jogadores.includes(id))
    );
    if (jaExiste) { alert('Já existe uma restrição com esses jogadores!'); return; }

    const nova = { id: Date.now().toString(), jogadores: [...selectedPlayersForRestriction], criadaEm: new Date().toISOString() };
    salvarRestricaoDB(nova);

    selectedPlayersForRestriction = [];
    exibirJogadoresParaRestricao();
    exibirRestricoes();

    alert(`Restrição criada: ${nova.jogadores.map(id => jogadores[id]?.nome).join(' e ')} não podem ficar no mesmo time!`);
};

function exibirRestricoes() {
    const container = document.getElementById('listaRestricoes');
    const lista = Object.values(restricoes);

    if (!lista.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#666;font-style:italic;">Nenhuma restrição criada ainda</div>';
        return;
    }

    container.innerHTML = lista.map(r => {
        const nomes = r.jogadores.map(id => jogadores[id] ? formatarNomeComTipo(jogadores[id]) : 'Jogador removido').join(' • ');
        return `
            <div class="restriction-item">
                <button class="delete-restriction" onclick="removerRestricao('${r.id}')" title="Remover restrição">✕</button>
                <div class="restriction-players">${nomes}</div>
                <div class="restriction-note">Não podem ficar no mesmo time</div>
            </div>
        `;
    }).join('');
}

window.removerRestricao = function(id) {
    const r = restricoes[id];
    if (!r) return;
    const nomes = r.jogadores.map(jId => jogadores[jId]?.nome || 'Jogador removido').join(' e ');
    if (confirm(`Remover restrição entre ${nomes}?`)) removerRestricaoDB(id);
};
