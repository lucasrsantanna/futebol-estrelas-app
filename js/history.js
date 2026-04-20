// ==============================================
// history.js — Histórico de Times
// ==============================================

const CORES_EQUIPES = ['#2196F3', '#FF5722', '#4CAF50', '#FF9800'];
const NOMES_BADGE   = ['A', 'B', 'C', 'D'];

function exibirHistorico() {
    const container = document.getElementById('listaHistorico');
    const lista = Object.values(historicoTimes).sort((a, b) => new Date(b.data) - new Date(a.data));

    if (!lista.length) {
        container.innerHTML = `<div class="empty-state"><span class="emoji">📜</span>Nenhum histórico de times ainda.<br>Separe times para criar registros no histórico.</div>`;
        return;
    }

    container.innerHTML = lista.map(r => {
        const data = new Date(r.data).toLocaleDateString('pt-BR');
        const resumo = r.times.map((time, i) => {
            const media = time.length ? (time.reduce((s, j) => s + j.estrelas, 0) / time.length).toFixed(1) : 0;
            return `
                <span style="display:inline-flex;align-items:center;gap:4px;background:white;border:2px solid ${CORES_EQUIPES[i]};color:${CORES_EQUIPES[i]};padding:6px 10px;border-radius:20px;font-size:11px;font-weight:600;margin:3px;">
                    ${NOMES_BADGE[i]}: ${time.length}j • ${media}★
                </span>
            `;
        }).join('');

        return `
            <div style="background:white;border-radius:16px;margin-bottom:16px;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,0.08);border:1px solid #e8e8e8;">
                <div onclick="abrirHistoricoView('${r.id}')" style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:16px;cursor:pointer;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                        <div>
                            <div style="font-weight:700;font-size:17px;margin-bottom:4px;">${data}</div>
                            <div style="font-size:12px;opacity:0.9;">${r.totalJogadores} jogadores • ${r.times.length} times</div>
                        </div>
                        <div style="display:flex;gap:8px;">
                            <button onclick="event.stopPropagation();abrirHistoricoView('${r.id}')" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:10px 14px;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600;">👁️ Ver</button>
                            <button onclick="confirmarExclusaoHistorico('${r.id}',event)" style="background:rgba(244,67,54,0.8);border:none;color:white;padding:10px;border-radius:8px;font-size:13px;cursor:pointer;min-width:40px;">🗑️</button>
                        </div>
                    </div>
                </div>
                <div style="padding:12px 16px;background:#f8f9fa;display:flex;flex-wrap:wrap;gap:4px;">${resumo}</div>
            </div>
        `;
    }).join('');
}

window.abrirHistoricoView = function(id) {
    const r = historicoTimes[id];
    if (!r) return;
    const data = new Date(r.data).toLocaleDateString('pt-BR');
    const nomes = ['🔵 Time A', '🔴 Time B', '🟢 Time C', '🟡 Time D'];

    let html = `<p style="text-align:center;color:#666;font-size:13px;margin-bottom:15px;">${r.totalJogadores} jogadores em ${r.times.length} times</p>`;

    r.times.forEach((time, i) => {
        const total = time.reduce((s, j) => s + j.estrelas, 0);
        const media = time.length ? (total / time.length).toFixed(1) : 0;
        html += `
            <div style="border-left:4px solid ${CORES_EQUIPES[i]};background:#f8f9fa;border-radius:10px;padding:14px;margin-bottom:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="font-size:16px;color:${CORES_EQUIPES[i]};margin:0;">${nomes[i]}</h4>
                    <span style="background:#e3f2fd;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:600;color:#1976D2;">${time.length}j • ${media}★</span>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;">
                    ${time.map(j => `
                        <div style="display:flex;justify-content:space-between;align-items:center;background:white;padding:10px 12px;border-radius:8px;">
                            <span style="font-weight:500;font-size:14px;${j.isGenerico ? 'font-style:italic;color:#888;' : 'color:#333;'}">${j.nome}</span>
                            <span style="font-size:12px;color:#666;">${j.estrelas}★</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    document.getElementById('historicoViewTitle').textContent = `📜 Times de ${data}`;
    document.getElementById('historicoViewContent').innerHTML = html;
    document.getElementById('historicoViewModal').style.display = 'flex';
};

window.fecharHistoricoView = function() {
    document.getElementById('historicoViewModal').style.display = 'none';
};

window.confirmarExclusaoHistorico = function(id, event) {
    if (event) event.stopPropagation();
    const r = historicoTimes[id];
    if (!r) return;
    historicoParaExcluir = id;
    document.getElementById('deleteMessage').innerHTML = `
        Excluir o histórico do dia <strong>${new Date(r.data).toLocaleDateString('pt-BR')}</strong>?<br><br>
        Serão removidos permanentemente os dados de ${r.totalJogadores} jogadores em ${r.times.length} times.
    `;
    document.getElementById('confirmDeleteModal').style.display = 'flex';
};
