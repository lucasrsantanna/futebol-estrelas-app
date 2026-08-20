// ==============================================
// ui.js — Navegação, sidebar e estado da interface
// ==============================================

// ---------- Sidebar ----------

window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('show');
};

window.closeSidebar = function() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
};

// ---------- Seções ----------

window.showSection = function(sectionName) {
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(el => el.classList.remove('active'));

    event.target.closest('.menu-item').classList.add('active');
    document.getElementById(sectionName).classList.add('active');
    closeSidebar();

    if (sectionName === 'jogadores')  exibirJogadores();
    else if (sectionName === 'separar')    exibirJogadoresPresentes();
    else if (sectionName === 'financeiro') mostrarAbaFinanceiro('sessoes');
    else if (sectionName === 'historico')  exibirHistorico();
};

// ---------- Sync status ----------

function updateSyncStatus(status) {
    const el = document.getElementById('sidebarSyncStatus');
    el.innerHTML = status === 'synced' ? '🟢 Sincronizado' : status === 'syncing' ? '🟡 Sincronizando...' : '🔴 Offline';
}

// ---------- Loading ----------

function hideLoading() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    updateUI();
}

// ---------- Atualização geral de UI ----------

function updateUI() {
    const section = document.querySelector('.content-section.active')?.id;
    if (section === 'jogadores')  exibirJogadores();
    else if (section === 'separar')    exibirJogadoresPresentes();
    else if (section === 'financeiro') updateFinanceiroUI();

    const el = document.getElementById('totalJogadores');
    if (el) el.textContent = Object.keys(jogadores).length;
}

function updateFinanceiroUI() {
    const section = document.querySelector('.content-section.active')?.id;
    if (section !== 'financeiro') return;
    const aba = document.querySelector('.aba-financeiro[style*="block"], .aba-financeiro:not([style*="none"])');
    if (!aba) return;
    if (aba.id === 'abaFinanceiroSessoes')   exibirSessoes();
    else if (aba.id === 'abaFinanceiroPendencias')  exibirPendencias();
    else if (aba.id === 'abaFinanceiroPagamentos')  exibirControlePagamentos();
}

// ---------- Modal de confirmação de exclusão ----------

window.confirmarExclusao = function() {
    if (historicoParaExcluir) {
        excluirHistoricoTimesDB(historicoParaExcluir);
        historicoParaExcluir = null;
        document.getElementById('confirmDeleteModal').style.display = 'none';
        alert('Histórico excluído com sucesso!');
        return;
    }
    if (sessaoParaExcluir) {
        excluirSessaoDB(sessaoParaExcluir);
        sessaoParaExcluir = null;
        document.getElementById('confirmDeleteModal').style.display = 'none';
        alert('Sessão excluída com sucesso!');
    }
};

window.cancelarExclusao = function() {
    document.getElementById('confirmDeleteModal').style.display = 'none';
    sessaoParaExcluir    = null;
    historicoParaExcluir = null;
};
