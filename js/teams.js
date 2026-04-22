// ==============================================
// teams.js — Algoritmo de separação de times
// ==============================================

const NOMES_EQUIPES = ['🔵 Time A', '🔴 Time B', '🟢 Time C', '🟡 Time D'];

const MAX_TENTATIVAS_BALANCEAMENTO = 30;

function encontrarMelhorDistribuicao(todos, numTimes) {
    let melhor = null;
    let menorDiff = Infinity;

    for (let i = 0; i < MAX_TENTATIVAS_BALANCEAMENTO; i++) {
        const resultado = distribuirComRestricoes(todos, numTimes);
        if (!resultado.sucesso) continue;

        const medias = resultado.times.map(t =>
            t.reduce((s, j) => s + j.estrelas, 0) / t.length
        );
        const diff = Math.max(...medias) - Math.min(...medias);

        if (diff < menorDiff) {
            menorDiff = diff;
            melhor = resultado;
        }

        if (diff === 0) break;
    }

    return melhor ?? {
        sucesso: false,
        mensagem: 'Não foi possível criar uma distribuição que respeite todas as restrições. Considere revisá-las.'
    };
}

function renderizarTimes(times, genericosAdicionados = 0) {
    const container = document.getElementById('teamsContainer');
    const n = times.length;
    container.className = `teams-container ${n === 2 ? 'two-teams' : n === 3 ? 'three-teams' : 'four-teams'}`;
    container.style.display = 'grid';

    const stats = times.map(t => ({
        total:       t.reduce((s, j) => s + j.estrelas, 0),
        media:       parseFloat(t.length ? (t.reduce((s, j) => s + j.estrelas, 0) / t.length).toFixed(1) : 0),
        jogadores:   t.length,
        mensalistas: t.filter(j => !j.isGenerico && (j.tipo || 'mensalista') === 'mensalista').length,
        avulsos:     t.filter(j => !j.isGenerico && j.tipo === 'avulso').length,
        genericos:   t.filter(j => j.isGenerico).length
    }));

    const banner = swapModoAtivo
        ? `<div class="swap-banner">
               <span>🔄 Selecione um jogador do outro time para trocar</span>
               <button onclick="cancelarSwap()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#6a1b9a;">✕</button>
           </div>`
        : '';

    container.innerHTML = banner + times.map((time, timeIdx) =>
        `<div class="team team-${timeIdx}">
            <h3>${NOMES_EQUIPES[timeIdx]}</h3>
            <div class="team-stats">
                <strong>Total: ${stats[timeIdx].total} ⭐</strong><br>
                <strong>Média: ${stats[timeIdx].media}</strong><br>
                <strong>Jogadores: ${stats[timeIdx].jogadores}</strong><br>
                <strong>Mensalistas: ${stats[timeIdx].mensalistas} | Avulsos: ${stats[timeIdx].avulsos}</strong>
                ${stats[timeIdx].genericos > 0 ? `<br><strong>Genéricos: ${stats[timeIdx].genericos}</strong>` : ''}
            </div>
            ${time.map((j, jogadorIdx) => {
                const selecionado = swapJogadorSelecionado &&
                    swapJogadorSelecionado.timeIdx === timeIdx &&
                    swapJogadorSelecionado.jogadorIdx === jogadorIdx;
                return `<div class="team-player${selecionado ? ' swap-selected' : ''}"
                             style="${j.isGenerico ? 'opacity:.7;font-style:italic;' : ''}"
                             data-time-idx="${timeIdx}"
                             data-jogador-idx="${jogadorIdx}"
                             onclick="handleSwapTap(${timeIdx}, ${jogadorIdx})">
                    <div class="team-player-name">${j.isGenerico ? j.nome + ' 👤' : formatarNomeComTipo(j)}</div>
                    <div class="team-player-stars">${criarEstrelas(j.estrelas)}</div>
                </div>`;
            }).join('')}
        </div>`
    ).join('');

    const medias = stats.map(s => s.media);
    const diff   = Math.max(...medias) - Math.min(...medias);
    const qualidade = diff <= 0.5 ? 'Excelente' : diff <= 1.0 ? 'Muito Bom' : diff <= 1.5 ? 'Bom' : diff <= 2.0 ? 'Regular' : 'Pode melhorar';
    const emoji  = diff <= 1.0 ? '🟢' : diff <= 2.0 ? '🟡' : '🔴';

    const balanceInfo = document.getElementById('balanceInfo');
    balanceInfo.innerHTML = `
        <h3>📊 Análise da Distribuição</h3>
        <p><strong>Times formados:</strong> ${n} times</p>
        ${genericosAdicionados > 0 ? `<p><strong>Genéricos adicionados:</strong> ${genericosAdicionados}</p>` : ''}
        <p><strong>Média geral:</strong> ${(medias.reduce((s, m) => s + m, 0) / medias.length).toFixed(1)} estrelas</p>
        <p><strong>Maior diferença:</strong> ${diff.toFixed(1)} estrelas</p>
        <p><strong>Qualidade:</strong> ${qualidade}</p>
        <p style="font-size:13px;margin-top:10px;color:#666;">${emoji} ${qualidade === 'Excelente' || qualidade === 'Muito Bom' ? 'Times muito bem balanceados!' : qualidade === 'Bom' ? 'Times bem balanceados' : 'Considere redistribuir alguns jogadores'}</p>
        ${Object.keys(restricoes).length > 0 ? '<p style="font-size:12px;margin-top:10px;color:#9c27b0;">🚫 Restrições entre jogadores foram respeitadas</p>' : ''}
        ${genericosAdicionados > 0 ? `<p style="font-size:12px;margin-top:15px;padding:10px;background:#fff3cd;border-radius:8px;color:#856404;"><strong>💡 Dica:</strong> Os jogadores genéricos podem ser substituídos por qualquer pessoa disponível no dia.</p>` : ''}
    `;
    balanceInfo.style.display = 'block';
    balanceInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });

    atualizarBotaoConfirmar();
}

// ---------- Entrada principal ----------

window.separarTimes = function() {
    if (jogadoresPresentes.length < 2) {
        alert('Marque pelo menos 2 jogadores para formar os times!');
        return;
    }

    const presentes = jogadoresPresentes.map(id => jogadores[id]).filter(j => j);
    let numTimes;
    const sel = document.getElementById('teamCount').value;
    if (sel === 'auto') {
        numTimes = presentes.length <= 8 ? 2 : presentes.length <= 12 ? 3 : 4;
    } else {
        numTimes = parseInt(sel);
    }

    const necessarios = numTimes * 5;
    const genericos   = Math.max(0, necessarios - presentes.length);
    const todos = [...presentes];
    for (let i = 0; i < genericos; i++) {
        todos.push({ id: `generico_${i}`, nome: `Jogador Extra ${i + 1}`, estrelas: 5, tipo: 'mensalista', isGenerico: true });
    }

    const resultado = encontrarMelhorDistribuicao(todos, numTimes);
    if (!resultado.sucesso) { alert(resultado.mensagem); return; }

    timesFormados = resultado.times;
    genericosAdicionados = genericos;
    renderizarTimes(timesFormados, genericosAdicionados);
    document.getElementById('confirmarTimesContainer').style.display = 'block';
};

// ---------- Algoritmo com restrições ----------

function distribuirComRestricoes(todos, numTimes, tentativa = 1) {
    if (tentativa > 10) {
        return { sucesso: false, mensagem: 'Não foi possível criar uma distribuição que respeite todas as restrições. Considere revisá-las.' };
    }

    const t10    = embaralharArray(todos.filter(j => j.estrelas === 10));
    const t9     = embaralharArray(todos.filter(j => j.estrelas === 9));
    const t8     = embaralharArray(todos.filter(j => j.estrelas === 8));
    const outros = embaralharArray(todos.filter(j => j.estrelas < 8));
    const times  = Array.from({ length: numTimes }, () => []);

    for (const j of t10) {
        const t = encontrarTimeSemRestricao(j, times);
        if (t === -1) return distribuirComRestricoes(todos, numTimes, tentativa + 1);
        times[t].push(j);
    }

    for (const j of [...t9, ...t8]) {
        const t = encontrarTimeSemRestricao(j, times);
        if (t === -1) return distribuirComRestricoes(todos, numTimes, tentativa + 1);
        times[t].push(j);
    }

    for (const j of outros) {
        const t = encontrarTimeSemRestricao(j, times);
        if (t === -1) return distribuirComRestricoes(todos, numTimes, tentativa + 1);
        times[t].push(j);
    }

    return { sucesso: true, times };
}

function encontrarTimeSemRestricao(jogador, times) {
    if (jogador.isGenerico) {
        return times.reduce((menor, _, i) => times[i].length < times[menor].length ? i : menor, 0);
    }

    const disponiveis = times
        .map((time, i) => ({ i, tamanho: time.length }))
        .filter(({ i }) => times[i].every(j => j.isGenerico || !temRestricao(jogador.id, j.id)));

    if (!disponiveis.length) return -1;
    disponiveis.sort((a, b) => a.tamanho - b.tamanho);
    return disponiveis[0].i;
}

function temRestricao(id1, id2) {
    return Object.values(restricoes).some(r => r.jogadores.includes(id1) && r.jogadores.includes(id2));
}

// ---------- Modal de aprovação ----------

function mostrarModalAprovacao(times) {
    document.getElementById('teamsPreview').innerHTML = times.map((time, i) => {
        const total = time.reduce((s, j) => s + j.estrelas, 0);
        const media = time.length ? (total / time.length).toFixed(1) : 0;
        return `
            <div class="preview-team time-${i}">
                <h4>
                    <span>${NOMES_EQUIPES[i]}</span>
                    <span class="preview-team-media">${time.length}j • ${media}★</span>
                </h4>
                <div class="preview-players">
                    ${time.map(j => `
                        <div class="preview-player-item">
                            <span class="preview-player-name ${j.isGenerico ? 'generico' : ''}">
                                ${j.isGenerico ? j.nome : formatarNomeComTipo(j)}
                            </span>
                            <span class="preview-player-stars">${j.estrelas}★</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('aprovacaoModal').style.display = 'flex';
}

window.confirmarDistribuicao = function() {
    if (!ultimaDistribuicao) return;
    document.getElementById('aprovacaoModal').style.display = 'none';
    exibirTimes(ultimaDistribuicao.times, ultimaDistribuicao.genericosNecessarios);

    // Salvar no histórico
    salvarHistoricoTimes({
        id: Date.now().toString(),
        data: new Date().toISOString(),
        times: ultimaDistribuicao.times.map(time =>
            time.map(j => ({ id: j.id, nome: j.nome, estrelas: j.estrelas, tipo: j.tipo, isGenerico: j.isGenerico || false }))
        ),
        totalJogadores: jogadoresPresentes.length,
        genericosAdicionados: ultimaDistribuicao.genericosNecessarios
    });

    mostrarModalFinanceiro();
};

window.refazerDistribuicao = function() {
    document.getElementById('aprovacaoModal').style.display = 'none';
    ultimaDistribuicao = null;
    separarTimes();
};

window.cancelarAprovacao = function() {
    document.getElementById('aprovacaoModal').style.display = 'none';
    ultimaDistribuicao = null;
};

// ---------- Exibição dos times na tela ----------

function exibirTimes(times, genericosAdicionados = 0) {
    const container = document.getElementById('teamsContainer');
    const n = times.length;
    container.className = `teams-container ${n === 2 ? 'two-teams' : n === 3 ? 'three-teams' : 'four-teams'}`;
    container.style.display = 'grid';

    const stats = times.map(t => ({
        total:        t.reduce((s, j) => s + j.estrelas, 0),
        media:        parseFloat(t.length ? (t.reduce((s, j) => s + j.estrelas, 0) / t.length).toFixed(1) : 0),
        jogadores:    t.length,
        mensalistas:  t.filter(j => !j.isGenerico && (j.tipo || 'mensalista') === 'mensalista').length,
        avulsos:      t.filter(j => !j.isGenerico && j.tipo === 'avulso').length,
        genericos:    t.filter(j => j.isGenerico).length
    }));

    container.innerHTML = times.map((time, i) => `
        <div class="team team-${i}">
            <h3>${NOMES_EQUIPES[i]}</h3>
            <div class="team-stats">
                <strong>Total: ${stats[i].total} ⭐</strong><br>
                <strong>Média: ${stats[i].media}</strong><br>
                <strong>Jogadores: ${stats[i].jogadores}</strong><br>
                <strong>Mensalistas: ${stats[i].mensalistas} | Avulsos: ${stats[i].avulsos}</strong>
                ${stats[i].genericos > 0 ? `<br><strong>Genéricos: ${stats[i].genericos}</strong>` : ''}
            </div>
            ${time.map(j => `
                <div class="team-player" style="${j.isGenerico ? 'opacity:.7;font-style:italic;' : ''}">
                    <div class="team-player-name">${j.isGenerico ? j.nome + ' 👤' : formatarNomeComTipo(j)}</div>
                    <div class="team-player-stars">${criarEstrelas(j.estrelas)}</div>
                </div>
            `).join('')}
        </div>
    `).join('');

    const medias = stats.map(s => s.media);
    const diff   = Math.max(...medias) - Math.min(...medias);
    const qtds   = stats.map(s => s.jogadores);
    const qualidade = diff <= 0.5 ? 'Excelente' : diff <= 1.0 ? 'Muito Bom' : diff <= 1.5 ? 'Bom' : diff <= 2.0 ? 'Regular' : 'Pode melhorar';
    const emoji  = diff <= 1.0 ? '🟢' : diff <= 2.0 ? '🟡' : '🔴';

    const balanceInfo = document.getElementById('balanceInfo');
    balanceInfo.innerHTML = `
        <h3>📊 Análise da Distribuição</h3>
        <p><strong>Times formados:</strong> ${n} times</p>
        ${genericosAdicionados > 0 ? `<p><strong>Genéricos adicionados:</strong> ${genericosAdicionados}</p>` : ''}
        <p><strong>Média geral:</strong> ${(medias.reduce((s, m) => s + m, 0) / medias.length).toFixed(1)} estrelas</p>
        <p><strong>Maior diferença:</strong> ${diff.toFixed(1)} estrelas</p>
        <p><strong>Qualidade:</strong> ${qualidade}</p>
        <p style="font-size:13px;margin-top:10px;color:#666;">${emoji} ${qualidade === 'Excelente' || qualidade === 'Muito Bom' ? 'Times muito bem balanceados!' : qualidade === 'Bom' ? 'Times bem balanceados' : 'Considere redistribuir alguns jogadores'}</p>
        ${Object.keys(restricoes).length > 0 ? '<p style="font-size:12px;margin-top:10px;color:#9c27b0;">🚫 Restrições entre jogadores foram respeitadas</p>' : ''}
        ${genericosAdicionados > 0 ? `<p style="font-size:12px;margin-top:15px;padding:10px;background:#fff3cd;border-radius:8px;color:#856404;"><strong>💡 Dica:</strong> Os jogadores genéricos podem ser substituídos por qualquer pessoa disponível no dia.</p>` : ''}
    `;
    balanceInfo.style.display = 'block';
    balanceInfo.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Swap manual ----------

function atualizarBotaoConfirmar() {
    const btn = document.getElementById('btnConfirmarTimes');
    if (btn) btn.disabled = swapModoAtivo;
}

window.cancelarSwap = function() {
    if (!timesFormados) return;
    swapJogadorSelecionado = null;
    swapModoAtivo = false;
    renderizarTimes(timesFormados, genericosAdicionados);
};

window.handleSwapTap = function(timeIdx, jogadorIdx) {
    const sel = swapJogadorSelecionado;

    if (sel === null) {
        swapJogadorSelecionado = { timeIdx, jogadorIdx };
        swapModoAtivo = true;
    } else if (timeIdx === sel.timeIdx && jogadorIdx === sel.jogadorIdx) {
        swapJogadorSelecionado = null;
        swapModoAtivo = false;
    } else if (timeIdx === sel.timeIdx) {
        swapJogadorSelecionado = { timeIdx, jogadorIdx };
    } else {
        const tmp = timesFormados[sel.timeIdx][sel.jogadorIdx];
        timesFormados[sel.timeIdx][sel.jogadorIdx] = timesFormados[timeIdx][jogadorIdx];
        timesFormados[timeIdx][jogadorIdx] = tmp;
        swapJogadorSelecionado = null;
        swapModoAtivo = false;
    }

    renderizarTimes(timesFormados, genericosAdicionados);
    // atualizarBotaoConfirmar() já é chamado dentro de renderizarTimes
};
