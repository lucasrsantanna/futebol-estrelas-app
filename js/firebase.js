// ==============================================
// firebase.js — Conexão com Firebase e CRUD
// ==============================================

const firebaseConfig = {
    apiKey: "AIzaSyCK57enPKXxEoSMEkAyDS0eGl9sJ-va1kI",
    authDomain: "futebol-estrelas-homolog.firebaseapp.com",
    databaseURL: "https://futebol-estrelas-homolog-default-rtdb.firebaseio.com",
    projectId: "futebol-estrelas-homolog",
    storageBucket: "futebol-estrelas-homolog.firebasestorage.app",
    messagingSenderId: "129208784668",
    appId: "1:129208784668:web:6b1bd036ef678119418cd9"
};

// ---------- Setup inicial (sem listeners) ----------

function setupFirebaseApp() {
    try {
        app      = firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        auth     = firebase.auth();
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
    }
}

// ---------- Listeners do grupo ativo ----------

function inicializarListeners(grupoId) {
    carregarSelecaoSalva();

    database.ref(`grupos/${grupoId}/jogadores`).on('value', (snapshot) => {
        jogadores = snapshot.val() || {};
        jogadoresCarregados = true;
        updateUI();
        updateSyncStatus('synced');
    });

    database.ref(`grupos/${grupoId}/sessoes`).on('value', (snapshot) => {
        sessoes = snapshot.val() || {};
        updateFinanceiroUI();
    });

    database.ref(`grupos/${grupoId}/restricoes`).on('value', (snapshot) => {
        restricoes = snapshot.val() || {};
    });

    database.ref(`grupos/${grupoId}/historicoTimes`).on('value', (snapshot) => {
        historicoTimes = snapshot.val() || {};
        const currentSection = document.querySelector('.content-section.active')?.id;
        if (currentSection === 'historico') exibirHistorico();
    });

    database.ref('.info/connected').on('value', (snapshot) => {
        isOnline = snapshot.val() === true;
        updateSyncStatus(isOnline ? 'synced' : 'offline');
    });
}

function desligarListeners(grupoId) {
    if (!database || !grupoId) return;
    database.ref(`grupos/${grupoId}/jogadores`).off();
    database.ref(`grupos/${grupoId}/sessoes`).off();
    database.ref(`grupos/${grupoId}/restricoes`).off();
    database.ref(`grupos/${grupoId}/historicoTimes`).off();
}

// ---------- Jogadores ----------

function salvarJogador(jogador) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/jogadores/${jogador.id}`).set(jogador);
    } else {
        const local = JSON.parse(localStorage.getItem('jogadoresFutebol') || '{}');
        local[jogador.id] = jogador;
        localStorage.setItem('jogadoresFutebol', JSON.stringify(local));
        jogadores = local;
        updateUI();
    }
}

function removerJogadorDB(id) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/jogadores/${id}`).remove();
    } else {
        const local = JSON.parse(localStorage.getItem('jogadoresFutebol') || '{}');
        delete local[id];
        localStorage.setItem('jogadoresFutebol', JSON.stringify(local));
        jogadores = local;
        updateUI();
    }
}

// ---------- Sessões ----------

function salvarSessaoDB(sessao) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/sessoes/${sessao.id}`).set(sessao);
    } else {
        const local = JSON.parse(localStorage.getItem('sessoesFutebol') || '{}');
        local[sessao.id] = sessao;
        localStorage.setItem('sessoesFutebol', JSON.stringify(local));
        sessoes = local;
        updateFinanceiroUI();
    }
}

function excluirSessaoDB(id) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/sessoes/${id}`).remove();
    } else {
        const local = JSON.parse(localStorage.getItem('sessoesFutebol') || '{}');
        delete local[id];
        localStorage.setItem('sessoesFutebol', JSON.stringify(local));
        sessoes = local;
        updateFinanceiroUI();
    }
}

// ---------- Restrições ----------

function salvarRestricaoDB(restricao) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/restricoes/${restricao.id}`).set(restricao);
    } else {
        const local = JSON.parse(localStorage.getItem('restricoesFutebol') || '{}');
        local[restricao.id] = restricao;
        localStorage.setItem('restricoesFutebol', JSON.stringify(local));
        restricoes = local;
    }
}

function removerRestricaoDB(id) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/restricoes/${id}`).remove();
    } else {
        const local = JSON.parse(localStorage.getItem('restricoesFutebol') || '{}');
        delete local[id];
        localStorage.setItem('restricoesFutebol', JSON.stringify(local));
        restricoes = local;
        exibirRestricoes();
    }
}

// ---------- Histórico ----------

function salvarHistoricoTimes(registro) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/historicoTimes/${registro.id}`).set(registro);
    } else {
        const local = JSON.parse(localStorage.getItem('historicoTimesFutebol') || '{}');
        local[registro.id] = registro;
        localStorage.setItem('historicoTimesFutebol', JSON.stringify(local));
        historicoTimes = local;
    }
}

function excluirHistoricoTimesDB(id) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/historicoTimes/${id}`).remove();
    } else {
        const local = JSON.parse(localStorage.getItem('historicoTimesFutebol') || '{}');
        delete local[id];
        localStorage.setItem('historicoTimesFutebol', JSON.stringify(local));
        historicoTimes = local;
        exibirHistorico();
    }
}

// ---------- Pagamentos ----------

window.marcarPagamento = function(sessaoId, jogadorId, status) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/sessoes/${sessaoId}/pagamentos/${jogadorId}`).set(status);
    } else {
        const local = JSON.parse(localStorage.getItem('sessoesFutebol') || '{}');
        if (local[sessaoId]) {
            local[sessaoId].pagamentos[jogadorId] = status;
            localStorage.setItem('sessoesFutebol', JSON.stringify(local));
            sessoes = local;
            updateFinanceiroUI();
        }
    }
};
