// ==============================================
// players.js — Cadastro, edição e exibição de jogadores
// ==============================================

// ---------- Cadastro ----------

window.cadastrarJogador = function() {
    const nome = document.getElementById('nomeJogador').value.trim();
    const estrelas = parseInt(document.getElementById('estrelas').value);
    const tipo = document.getElementById('tipoJogador').value;
    const btn = document.getElementById('btnCadastrar');

    if (!nome) { alert('Por favor, digite o nome do jogador!'); return; }

    if (Object.values(jogadores).find(j => j.nome.toLowerCase() === nome.toLowerCase())) {
        alert('Jogador já cadastrado!'); return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Cadastrando...';

    salvarJogador({ id: Date.now().toString(), nome, estrelas, tipo, criadoEm: new Date().toISOString() });

    document.getElementById('nomeJogador').value = '';
    document.getElementById('estrelas').value = '1';
    document.getElementById('tipoJogador').value = 'mensalista';

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '➕ Cadastrar Jogador';
        alert(`Jogador ${nome} cadastrado com sucesso!`);
    }, 1000);
};

// ---------- Cadastro Rápido (FAB) ----------

window.abrirCadastroRapido = function() {
    document.getElementById('quickAddModal').style.display = 'flex';
    document.getElementById('quickNome').value = '';
    document.getElementById('quickEstrelas').value = '5';
    document.getElementById('quickTipo').value = 'mensalista';
    document.getElementById('quickJaSelecionar').checked = true;
    setTimeout(() => document.getElementById('quickNome').focus(), 100);
};

window.fecharCadastroRapido = function() {
    document.getElementById('quickAddModal').style.display = 'none';
};

window.cadastrarRapido = function() {
    const nome = document.getElementById('quickNome').value.trim();
    const estrelas = parseInt(document.getElementById('quickEstrelas').value);
    const tipo = document.getElementById('quickTipo').value;
    const jaSelecionar = document.getElementById('quickJaSelecionar').checked;
    const btn = document.getElementById('btnQuickAdd');

    if (!nome) { alert('Por favor, digite o nome do jogador!'); return; }
    if (Object.values(jogadores).find(j => j.nome.toLowerCase() === nome.toLowerCase())) {
        alert('Jogador já cadastrado!'); return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Cadastrando...';

    const novo = { id: Date.now().toString(), nome, estrelas, tipo, criadoEm: new Date().toISOString() };
    salvarJogador(novo);

    if (jaSelecionar) {
        jogadoresPresentes.push(novo.id);
        salvarSelecao();
    }

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '➕ Cadastrar';
        fecharCadastroRapido();
        limparPesquisa();
        alert(`${nome} cadastrado com sucesso!${jaSelecionar ? ' E já marcado como presente!' : ''}`);
    }, 800);
};

// ---------- Edição ----------

window.editarJogador = function(id, event) {
    if (event) event.stopPropagation();
    jogadorEditando = jogadores[id];
    if (!jogadorEditando) return;
    document.getElementById('editNome').value = jogadorEditando.nome;
    document.getElementById('editEstrelas').value = jogadorEditando.estrelas;
    document.getElementById('editTipoJogador').value = jogadorEditando.tipo || 'mensalista';
    document.getElementById('editModal').style.display = 'flex';
};

window.salvarEdicao = function() {
    if (!jogadorEditando) return;
    const btn = document.getElementById('btnSalvar');
    btn.disabled = true;
    btn.textContent = '⏳ Salvando...';

    salvarJogador({
        ...jogadorEditando,
        estrelas: parseInt(document.getElementById('editEstrelas').value),
        tipo: document.getElementById('editTipoJogador').value,
        atualizadoEm: new Date().toISOString()
    });

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '💾 Salvar';
        fecharModal();
        alert(`${jogadorEditando.nome} atualizado com sucesso!`);
    }, 1000);
};

window.removerJogador = function() {
    if (!jogadorEditando) return;
    if (!confirm(`Tem certeza que deseja remover ${jogadorEditando.nome}?`)) return;

    const btn = document.getElementById('btnRemover');
    btn.disabled = true;
    btn.textContent = '⏳ Removendo...';

    jogadoresPresentes = jogadoresPresentes.filter(id => id !== jogadorEditando.id);

    // Limpar restrições do jogador removido
    Object.values(restricoes).forEach(r => {
        if (r.jogadores.includes(jogadorEditando.id)) removerRestricaoDB(r.id);
    });

    removerJogadorDB(jogadorEditando.id);

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '🗑️ Remover';
        fecharModal();
        alert(`${jogadorEditando.nome} foi removido!`);
    }, 1000);
};

window.fecharModal = function() {
    document.getElementById('editModal').style.display = 'none';
    jogadorEditando = null;
};

// ---------- Exibição — lista gerenciar ----------

function exibirJogadores() {
    const container = document.getElementById('listaJogadores');
    if (Object.keys(jogadores).length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="emoji">😅</span>Nenhum jogador cadastrado ainda.<br>Vá para "Cadastrar Jogador" para adicionar jogadores.</div>`;
        return;
    }
    const order = document.getElementById('sortOrderJogadores').value;
    container.innerHTML = ordenarJogadores(jogadores, order).map(j => `
        <div class="list-item">
            <div class="item-content">
                <div class="player-info">
                    <div class="player-name">${formatarNomeComTipo(j)}</div>
                    <div class="player-stars">
                        <span class="stars">${criarEstrelas(j.estrelas)}</span>
                        <span class="star-count">${j.estrelas} ${j.estrelas === 1 ? 'estrela' : 'estrelas'}</span>
                    </div>
                </div>
                <button class="edit-btn" onclick="editarJogador('${j.id}', event)">✏️</button>
            </div>
        </div>
    `).join('');
}

window.atualizarOrdenacaoJogadores = function() { exibirJogadores(); };

// ---------- Exibição — presença / separar times ----------

function exibirJogadoresPresentes() {
    const container = document.getElementById('jogadoresPresentes');

    if (Object.keys(jogadores).length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="emoji">😅</span>Nenhum jogador cadastrado ainda.<br>Cadastre jogadores primeiro para poder separá-los em times.</div>`;
        return;
    }

    const order = document.getElementById('sortOrder').value;
    const termo = (document.getElementById('searchJogador')?.value || '').trim().toLowerCase();
    let lista = ordenarJogadores(jogadores, order);

    if (termo) lista = lista.filter(j => j.nome.toLowerCase().includes(termo));

    if (!lista.length && termo) {
        container.innerHTML = `<div class="no-results"><span class="emoji">🔍</span>Nenhum jogador encontrado com "${termo}"</div>`;
        atualizarContador();
        return;
    }

    const mensalistas = lista.filter(j => (j.tipo || 'mensalista') === 'mensalista');
    const avulsos     = lista.filter(j => j.tipo === 'avulso');

    const renderItem = (j, mostrarCheckbox = true) => {
        const pendencia  = calcularPendenciaJogador(j.id);
        const presente   = jogadoresPresentes.includes(j.id);
        return `
            <div class="list-item ${presente ? 'checked' : ''} ${pendencia > 0 ? 'has-pendencia' : ''}"
                 onclick="togglePresenca('${j.id}')">
                <div class="item-content">
                    ${mostrarCheckbox ? `
                    <div class="checkbox-wrapper">
                        <input type="checkbox" ${presente ? 'checked' : ''}
                            onchange="event.stopPropagation(); togglePresenca('${j.id}')"
                            onclick="event.stopPropagation()">
                    </div>` : ''}
                    <div class="player-info">
                        <div class="player-name">
                            ${j.nome}
                            ${pendencia > 0 ? `<span class="pendencia-badge">R$${pendencia.toFixed(0)}</span>` : ''}
                        </div>
                        <div class="player-stars">
                            <span class="stars">${criarEstrelas(j.estrelas)}</span>
                            <span class="star-count">${j.estrelas} ${j.estrelas === 1 ? 'estrela' : 'estrelas'}</span>
                        </div>
                    </div>
                    <button class="edit-btn" onclick="editarJogador('${j.id}', event)">✏️</button>
                </div>
            </div>
        `;
    };

    const secao = (titulo, headerClass, itens, labelTotal) => {
        const presentes = itens.filter(j => jogadoresPresentes.includes(j.id)).length;
        return `
            <div class="players-section">
                <div class="section-header ${headerClass}">
                    <span>${titulo}</span>
                    <span>${presentes}/${itens.length}</span>
                </div>
                <div class="players-container">
                    ${itens.map(j => renderItem(j)).join('')}
                </div>
            </div>
        `;
    };

    let html = '';
    if (mensalistas.length) html += secao('👥 Mensalistas', 'mensalistas-header', mensalistas);
    if (avulsos.length)     html += secao('💰 Avulsos', 'avulsos-header', avulsos);

    if (!html) {
        html = `<div class="empty-state"><span class="emoji">😅</span>Nenhum jogador cadastrado ainda.</div>`;
    }

    container.innerHTML = html;
    atualizarContador();
}

window.atualizarOrdenacao = function() { exibirJogadoresPresentes(); };

// ---------- Pesquisa ----------

window.filtrarJogadores = function() {
    const input = document.getElementById('searchJogador');
    document.getElementById('clearSearchBtn').style.display = input.value.trim() ? 'flex' : 'none';
    exibirJogadoresPresentes();
};

window.limparPesquisa = function() {
    document.getElementById('searchJogador').value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    exibirJogadoresPresentes();
};

// ---------- Presença ----------

window.togglePresenca = function(id) {
    const idx = jogadoresPresentes.indexOf(id);
    if (idx > -1) {
        jogadoresPresentes.splice(idx, 1);
    } else {
        jogadoresPresentes.push(id);
        if (navigator.vibrate) navigator.vibrate(30);
    }
    salvarSelecao();
    exibirJogadoresPresentes();
};

window.marcarTodosMensalistas = function() {
    Object.values(jogadores)
        .filter(j => (j.tipo || 'mensalista') === 'mensalista')
        .forEach(j => { if (!jogadoresPresentes.includes(j.id)) jogadoresPresentes.push(j.id); });
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    salvarSelecao();
    exibirJogadoresPresentes();
};

window.marcarTodosAvulsos = function() {
    Object.values(jogadores)
        .filter(j => j.tipo === 'avulso')
        .forEach(j => { if (!jogadoresPresentes.includes(j.id)) jogadoresPresentes.push(j.id); });
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    salvarSelecao();
    exibirJogadoresPresentes();
};

window.limparTodosCheckbox = function() {
    jogadoresPresentes = [];
    localStorage.removeItem('jogadoresPresentesSelecionados');
    if (navigator.vibrate) navigator.vibrate(50);
    document.getElementById('teamsContainer').style.display = 'none';
    document.getElementById('balanceInfo').style.display = 'none';
    ultimaDistribuicao = null;
    timesFormados = null;
    exibirJogadoresPresentes();
};

function atualizarContador() {
    document.getElementById('totalSelecionados').textContent = `${jogadoresPresentes.length} selecionados`;
}
