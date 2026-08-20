// ==============================================
// firebase.js — Conexão com Firebase e CRUD
// ==============================================

const firebaseConfig = {
    apiKey: "AIzaSyAHTD1vEIh8ehAFR2M4APiE8Ky9HEAuPU",
    authDomain: "futebol-estrelas.firebaseapp.com",
    databaseURL: "https://futebol-estrelas-default-rtdb.firebaseio.com",
    projectId: "futebol-estrelas",
    storageBucket: "futebol-estrelas.firebasestorage.app",
    messagingSenderId: "96538381574",
    appId: "1:96538381574:web:dee50b846e46a898aeaecf",
    measurementId: "G-B16XPZN9R8"
};

// ---------- Inicialização ----------

function initFirebase() {
    carregarSelecaoSalva();

    try {
        app = firebase.initializeApp(firebaseConfig);
        database = firebase.database();

        database.ref('jogadores').on('value', (snapshot) => {
            jogadores = snapshot.val() || {};
            updateUI();
            updateSyncStatus('synced');
        });

        database.ref('sessoes').on('value', (snapshot) => {
            sessoes = snapshot.val() || {};
            updateFinanceiroUI();
        });

        database.ref('restricoes').on('value', (snapshot) => {
            restricoes = snapshot.val() || {};
        });

        database.ref('historicoTimes').on('value', (snapshot) => {
            historicoTimes = snapshot.val() || {};
            const currentSection = document.querySelector('.content-section.active')?.id;
            if (currentSection === 'historico') exibirHistorico();
        });

        database.ref('.info/connected').on('value', (snapshot) => {
            isOnline = snapshot.val() === true;
            updateSyncStatus(isOnline ? 'synced' : 'offline');
        });

        hideLoading();
    } catch (error) {
        console.error('Erro ao conectar com Firebase:', error);
        showFirebaseError();
    }
}

function showFirebaseError() {
    document.getElementById('loadingScreen').innerHTML = `
        <div style="text-align: center; padding: 40px 20px;">
            <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
            <h2>Configuração Necessária</h2>
            <p style="margin: 20px 0; line-height: 1.6;">
                Para usar o modo compartilhado, é necessário configurar o Firebase.<br><br>
                <strong>Como configurar:</strong><br>
                1. Acesse <a href="https://console.firebase.google.com" target="_blank" style="color: #4CAF50;">Firebase Console</a><br>
                2. Crie um novo projeto<br>
                3. Configure o Realtime Database<br>
                4. Substitua as configurações no código
            </p>
            <button onclick="useLocalMode()" style="background: #4CAF50; color: white; padding: 15px 30px; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; margin-top: 20px;">
                📱 Usar Modo Local (sem compartilhamento)
            </button>
        </div>
    `;
}

window.useLocalMode = function() {
    jogadores      = JSON.parse(localStorage.getItem('jogadoresFutebol')   || '{}');
    sessoes        = JSON.parse(localStorage.getItem('sessoesFutebol')      || '{}');
    restricoes     = JSON.parse(localStorage.getItem('restricoesFutebol')   || '{}');
    historicoTimes = JSON.parse(localStorage.getItem('historicoTimesFutebol') || '{}');
    carregarSelecaoSalva();
    hideLoading();
    updateSyncStatus('offline');

    const banner = document.querySelector('.info-banner');
    if (banner) {
        banner.innerHTML = `<h4>📱 Modo Local</h4><p>Dados salvos apenas neste dispositivo. Configure o Firebase para compartilhar!</p>`;
        banner.style.background = 'linear-gradient(135deg, #fff3e0, #ffe0b2)';
        banner.style.borderColor = '#FF9800';
    }
};

// ---------- Jogadores ----------

function salvarJogador(jogador) {
    if (database) {
        updateSyncStatus('syncing');
        database.ref('jogadores/' + jogador.id).set(jogador);
    } else {
        const local = JSON.parse(localStorage.getItem('jogadoresFutebol') || '{}');
        local[jogador.id] = jogador;
        localStorage.setItem('jogadoresFutebol', JSON.stringify(local));
        jogadores = local;
        updateUI();
    }
}

function removerJogadorDB(id) {
    if (database) {
        updateSyncStatus('syncing');
        database.ref('jogadores/' + id).remove();
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
    if (database) {
        updateSyncStatus('syncing');
        database.ref('sessoes/' + sessao.id).set(sessao);
    } else {
        const local = JSON.parse(localStorage.getItem('sessoesFutebol') || '{}');
        local[sessao.id] = sessao;
        localStorage.setItem('sessoesFutebol', JSON.stringify(local));
        sessoes = local;
        updateFinanceiroUI();
    }
}

function excluirSessaoDB(id) {
    if (database) {
        updateSyncStatus('syncing');
        database.ref('sessoes/' + id).remove();
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
    if (database) {
        updateSyncStatus('syncing');
        database.ref('restricoes/' + restricao.id).set(restricao);
    } else {
        const local = JSON.parse(localStorage.getItem('restricoesFutebol') || '{}');
        local[restricao.id] = restricao;
        localStorage.setItem('restricoesFutebol', JSON.stringify(local));
        restricoes = local;
    }
}

function removerRestricaoDB(id) {
    if (database) {
        updateSyncStatus('syncing');
        database.ref('restricoes/' + id).remove();
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
    if (database) {
        updateSyncStatus('syncing');
        database.ref('historicoTimes/' + registro.id).set(registro);
    } else {
        const local = JSON.parse(localStorage.getItem('historicoTimesFutebol') || '{}');
        local[registro.id] = registro;
        localStorage.setItem('historicoTimesFutebol', JSON.stringify(local));
        historicoTimes = local;
    }
}

function excluirHistoricoTimesDB(id) {
    if (database) {
        updateSyncStatus('syncing');
        database.ref('historicoTimes/' + id).remove();
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
    if (database) {
        updateSyncStatus('syncing');
        database.ref(`sessoes/${sessaoId}/pagamentos/${jogadorId}`).set(status);
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
