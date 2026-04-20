// ==============================================
// finance.js — Controle financeiro
// ==============================================

// ---------- Modal de Sessão ----------

function mostrarModalFinanceiro() {
    if (!ultimaDistribuicao) return;
    timesFormados = ultimaDistribuicao.times;

    document.getElementById('dataSessao').value  = new Date().toISOString().split('T')[0];
    document.getElementById('valorDiaria').value = '15.00';

    const presentes   = jogadoresPresentes.map(id => jogadores[id]).filter(j => j);
    const mensalistas = presentes.filter(j => (j.tipo || 'mensalista') === 'mensalista');
    const avulsos     = presentes.filter(j => j.tipo === 'avulso');
    const valorAtual  = () => parseFloat(document.getElementById('valorDiaria').value || 15);

    document.getElementById('todosPresentes').innerHTML = `
        <div style="margin-bottom:15px;">
            <h4 style="color:#4CAF50;margin-bottom:8px;font-size:14px;">👥 Mensalistas (${mensalistas.length})</h4>
            ${mensalistas.length
                ? mensalistas.map(j => `<div style="padding:4px 8px;background:#e8f5e8;border-radius:4px;margin-bottom:3px;font-size:13px;">${j.nome} (${j.estrelas}★)</div>`).join('')
                : '<p style="color:#666;font-size:12px;font-style:italic;">Nenhum mensalista presente</p>'
            }
        </div>
        <div>
            <h4 style="color:#ff9800;margin-bottom:8px;font-size:14px;" id="tituloAvulsos">
                💰 Avulsos (${avulsos.length}) - Cobrança: R$ ${(valorAtual() * avulsos.length).toFixed(2)}
            </h4>
            ${avulsos.length
                ? avulsos.map(j => `<div style="padding:4px 8px;background:#fff3e0;border-radius:4px;margin-bottom:3px;font-size:13px;">${j.nome} (${j.estrelas}★) - R$ <span class="valor-individual">${valorAtual().toFixed(2)}</span></div>`).join('')
                : '<p style="color:#666;font-size:12px;font-style:italic;">Nenhum avulso presente</p>'
            }
        </div>
    `;

    document.getElementById('sessaoModal').style.display = 'flex';
}

// Listener para valor da diária (precisa estar no DOM → colocado em app.js)
function atualizarValoresDiaria(valor) {
    document.querySelectorAll('.valor-individual').forEach(el => { el.textContent = valor; });
    const avulsos = jogadoresPresentes.filter(id => jogadores[id]?.tipo === 'avulso');
    const titulo = document.getElementById('tituloAvulsos');
    if (titulo) titulo.innerHTML = `💰 Avulsos (${avulsos.length}) - Cobrança: R$ ${(parseFloat(valor) * avulsos.length).toFixed(2)}`;
}

window.fecharSessaoModal    = function() { document.getElementById('sessaoModal').style.display = 'none'; timesFormados = null; };
window.pularRegistroSessao  = function() { fecharSessaoModal(); };

window.salvarSessao = function() {
    const data  = document.getElementById('dataSessao').value;
    const valor = parseFloat(document.getElementById('valorDiaria').value);
    if (!data || !valor || valor <= 0) { alert('Por favor, preencha todos os campos corretamente!'); return; }

    const presentes   = jogadoresPresentes.map(id => jogadores[id]).filter(j => j);
    const avulsos     = presentes.filter(j => j.tipo === 'avulso');
    const mensalistas = presentes.filter(j => (j.tipo || 'mensalista') === 'mensalista');

    const sessao = { id: Date.now().toString(), data, valorDiaria: valor, todosPresentes: jogadoresPresentes, times: timesFormados, pagamentos: {} };
    avulsos.forEach(j     => { sessao.pagamentos[j.id] = 'pendente'; });
    mensalistas.forEach(j => { sessao.pagamentos[j.id] = 'mensalista'; });

    salvarSessaoDB(sessao);
    fecharSessaoModal();
    alert(`Sessão registrada!\n\nTotal: ${presentes.length} jogadores\n- Mensalistas: ${mensalistas.length}\n- Avulsos: ${avulsos.length}\n\nA arrecadar: R$ ${(valor * avulsos.length).toFixed(2)}`);
};

// ---------- Abas financeiras ----------

window.mostrarAbaFinanceiro = function(aba) {
    ['Sessoes', 'Pendencias', 'Pagamentos'].forEach(id => {
        document.getElementById(`tab${id}`).style.background = '#666';
        document.getElementById(`tab${id}`).style.borderBottom = 'none';
        document.getElementById(`abaFinanceiro${id}`).style.display = 'none';
    });
    const map = { sessoes: 'Sessoes', pendencias: 'Pendencias', pagamentos: 'Pagamentos' };
    const key = map[aba];
    document.getElementById(`tab${key}`).style.background = '#4CAF50';
    document.getElementById(`tab${key}`).style.borderBottom = '3px solid #4CAF50';
    document.getElementById(`abaFinanceiro${key}`).style.display = 'block';
    if (aba === 'sessoes') exibirSessoes();
    else if (aba === 'pendencias') exibirPendencias();
    else exibirControlePagamentos();
};

// ---------- Sessões ----------

function exibirSessoes() {
    const container = document.getElementById('listaSessoes');
    const lista = Object.values(sessoes).sort((a, b) => new Date(b.data) - new Date(a.data));

    if (!lista.length) {
        container.innerHTML = `<div class="empty-state"><span class="emoji">📋</span>Nenhuma sessão registrada ainda.<br>Separe times para registrar sessões automaticamente.</div>`;
        return;
    }

    container.innerHTML = lista.map(sessao => {
        const presentes   = sessao.todosPresentes.map(id => jogadores[id]).filter(j => j);
        const mensalistas = presentes.filter(j => (j.tipo || 'mensalista') === 'mensalista');
        const avulsos     = presentes.filter(j => j.tipo === 'avulso');
        const total       = sessao.valorDiaria * avulsos.length;
        return `
            <div class="sessao-item">
                <div class="sessao-header">
                    <div class="sessao-data">${new Date(sessao.data).toLocaleDateString('pt-BR')}</div>
                    <div class="sessao-valor">
                        R$ ${total.toFixed(2)}
                        <button class="delete-session-btn" onclick="confirmarExclusaoSessao('${sessao.id}')" title="Excluir sessão">🗑️</button>
                    </div>
                </div>
                <div style="font-size:14px;color:#666;margin-bottom:8px;">
                    <strong>Total:</strong> ${presentes.length} (${mensalistas.length} mensalistas + ${avulsos.length} avulsos)
                </div>
                <div class="sessao-avulsos"><strong>Avulsos:</strong> ${avulsos.length ? avulsos.map(j => j.nome).join(', ') : 'Nenhum'}</div>
                <div class="sessao-avulsos"><strong>Mensalistas:</strong> ${mensalistas.length ? mensalistas.map(j => j.nome).join(', ') : 'Nenhum'}</div>
                <div style="font-size:12px;color:#888;margin-top:8px;">Valor individual: R$ ${sessao.valorDiaria.toFixed(2)}</div>
            </div>
        `;
    }).join('');
}

// ---------- Pendências ----------

function exibirPendencias() {
    const container = document.getElementById('resumoPendencias');
    const pendencias = {};

    Object.values(sessoes).forEach(sessao => {
        Object.keys(sessao.pagamentos).forEach(jId => {
            if (sessao.pagamentos[jId] === 'pendente') {
                const j = jogadores[jId];
                if (j?.tipo === 'avulso') {
                    if (!pendencias[jId]) pendencias[jId] = { nome: j.nome, total: 0, jogos: 0 };
                    pendencias[jId].total += sessao.valorDiaria;
                    pendencias[jId].jogos++;
                }
            }
        });
    });

    const arr = Object.values(pendencias);
    if (!arr.length) {
        container.innerHTML = `<div class="empty-state"><span class="emoji">✅</span>Todos os pagamentos estão em dia!</div>`;
        return;
    }

    const totalGeral = arr.reduce((s, p) => s + p.total, 0);
    container.innerHTML = `
        <div style="background:#fff3cd;padding:15px;border-radius:8px;margin-bottom:15px;text-align:center;">
            <strong>Total a receber: R$ ${totalGeral.toFixed(2)}</strong>
        </div>
        ${arr.map(p => `
            <div class="pendencia-item">
                <div>
                    <div class="pendencia-nome">${p.nome}</div>
                    <div style="font-size:12px;color:#666;">${p.jogos} ${p.jogos === 1 ? 'jogo' : 'jogos'}</div>
                </div>
                <div class="pendencia-valor">R$ ${p.total.toFixed(2)}</div>
            </div>
        `).join('')}
    `;
}

// ---------- Controle de Pagamentos ----------

function exibirControlePagamentos() {
    const container = document.getElementById('controlePagamentos');
    const lista = Object.values(sessoes).sort((a, b) => new Date(b.data) - new Date(a.data));

    if (!lista.length) {
        container.innerHTML = `<div class="empty-state"><span class="emoji">📋</span>Nenhuma sessão para controlar.</div>`;
        return;
    }

    container.innerHTML = lista.map(sessao => {
        const avulsos = sessao.todosPresentes.map(id => jogadores[id]).filter(j => j?.tipo === 'avulso');

        if (!avulsos.length) return `
            <div class="pagamento-item" style="opacity:0.7;">
                <div class="pagamento-header">
                    <strong>📅 ${new Date(sessao.data).toLocaleDateString('pt-BR')}</strong>
                    <span class="pagamento-valor-info">Apenas mensalistas</span>
                </div>
                <div style="font-size:13px;color:#888;font-style:italic;text-align:center;padding:10px 0;">Nenhum avulso presente</div>
            </div>
        `;

        const pagos = avulsos.filter(j => sessao.pagamentos[j.id] === 'pago').length;
        return `
            <div class="pagamento-item">
                <div class="pagamento-header">
                    <strong>📅 ${new Date(sessao.data).toLocaleDateString('pt-BR')}</strong>
                    <span class="pagamento-valor-info">R$ ${sessao.valorDiaria.toFixed(2)} • ${pagos}/${avulsos.length} pagos</span>
                </div>
                ${avulsos.map(j => {
                    const pago = sessao.pagamentos[j.id] === 'pago';
                    return `
                        <div class="pagamento-jogador-item">
                            <div class="pagamento-jogador-info">
                                <span class="pagamento-jogador-nome">${j.nome}</span>
                                <span class="pagamento-jogador-valor">R$ ${sessao.valorDiaria.toFixed(2)}</span>
                            </div>
                            <div class="toggle-label">
                                <span class="toggle-status ${pago ? 'pago' : 'pendente'}">${pago ? '✅ Pago' : '❌ Pendente'}</span>
                                <label class="toggle-switch">
                                    <input type="checkbox" ${pago ? 'checked' : ''} onchange="marcarPagamento('${sessao.id}', '${j.id}', this.checked ? 'pago' : 'pendente')">
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
}

// ---------- Exclusão de sessão ----------

window.confirmarExclusaoSessao = function(id) {
    const sessao = sessoes[id];
    if (!sessao) return;
    sessaoParaExcluir = id;

    const presentes = sessao.todosPresentes.map(jId => jogadores[jId]).filter(j => j);
    const avulsos   = presentes.filter(j => j.tipo === 'avulso');
    document.getElementById('deleteMessage').innerHTML = `
        Excluir sessão do dia <strong>${new Date(sessao.data).toLocaleDateString('pt-BR')}</strong>?<br><br>
        Serão removidos:<br>
        • ${presentes.length} jogadores registrados<br>
        • R$ ${(sessao.valorDiaria * avulsos.length).toFixed(2)} do controle financeiro<br>
        • Todo o histórico de pagamentos<br><br>
        <strong>Esta ação não pode ser desfeita!</strong>
    `;
    document.getElementById('confirmDeleteModal').style.display = 'flex';
};
