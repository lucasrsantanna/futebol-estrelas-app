// ==============================================
// import.js — Importação de lista do WhatsApp
// ==============================================

let _importResultados = [];
let _accordionState = { confirmados: false, ambiguos: true, novos: true };

// ---- Public API ----

window.abrirImportModal = function() {
    document.getElementById('importTextarea').value = '';
    document.getElementById('importError').style.display = 'none';
    document.getElementById('importStep1').style.display = 'block';
    document.getElementById('importStep2').style.display = 'none';
    _importResultados = [];
    _accordionState = { confirmados: false, ambiguos: true, novos: true };
    document.getElementById('importModal').style.display = 'flex';
};

window.fecharImportModal = function() {
    document.getElementById('importModal').style.display = 'none';
    _importResultados = [];
};

window.processarListaWhatsApp = function() {
    const texto = document.getElementById('importTextarea').value;
    const errEl = document.getElementById('importError');

    if (!texto.trim()) {
        errEl.textContent = 'Cole a lista antes de processar.';
        errEl.style.display = 'block';
        return;
    }

    if (!jogadoresCarregados) {
        errEl.textContent = 'Aguarde o carregamento dos jogadores antes de importar.';
        errEl.style.display = 'block';
        return;
    }

    const itens = _parsearListaWhatsApp(texto);

    if (itens.length === 0) {
        errEl.textContent = 'Nenhum jogador encontrado. Verifique se o formato está correto.';
        errEl.style.display = 'block';
        return;
    }

    errEl.style.display = 'none';

    _importResultados = itens.map(item => {
        const { nivel, matches } = _encontrarMatch(item.nome);
        const categoria = _categorizarResultado(nivel, matches.length);
        const result = {
            nomeWhatsApp: item.nome,
            tipoWhatsApp: item.tipo,
            nivel,
            matches,
            categoria,
            selecionadoId: null,
            incluir: true,
            nomeEditavel: item.nome,
            tipoEditavel: item.tipo,
            estrelas: 5,
            ignorar: false
        };
        if (categoria === 'confirmado') {
            result.selecionadoId = matches[0].id;
        } else if (categoria === 'ambiguo' && matches.length > 0) {
            result.selecionadoId = matches[0].id;
        }
        return result;
    });

    document.getElementById('importStep1').style.display = 'none';
    document.getElementById('importStep2').style.display = 'block';
    _renderizarRevisao();
};

window.confirmarImportacao = function() {
    const baseTs = Date.now();
    let novoIdx = 0;
    const idsParaMarcar = [];

    _importResultados.forEach(r => {
        const ehNovoAmbiguo = r.categoria === 'ambiguo' && r.selecionadoId === 'novo';
        const ehNovoLiteral = r.categoria === 'novo' && !r.ignorar;

        if (ehNovoAmbiguo || ehNovoLiteral) {
            const id = (baseTs + novoIdx++).toString();
            const nome = normalizarNome(r.nomeEditavel || r.nomeWhatsApp);
            const tipo = r.tipoEditavel || r.tipoWhatsApp;
            salvarJogador({ id, nome, estrelas: r.estrelas, tipo, criadoEm: new Date().toISOString() });
            idsParaMarcar.push(id);
        } else if (r.categoria === 'confirmado' && r.incluir && r.selecionadoId) {
            idsParaMarcar.push(r.selecionadoId);
        } else if (r.categoria === 'ambiguo' && r.selecionadoId && r.selecionadoId !== 'novo') {
            idsParaMarcar.push(r.selecionadoId);
        }
    });

    marcarVariosPresencaDB(idsParaMarcar);
    fecharImportModal();
};

// ---- Private helpers ----

function _categorizarResultado(nivel, matchCount) {
    if (nivel === 0) return 'novo';
    if ((nivel === 1 || nivel === 2) && matchCount === 1) return 'confirmado';
    return 'ambiguo';
}

function _parsearListaWhatsApp(texto) {
    const INCLUIR = ['mensalistas', 'avulsos'];
    let secaoAtual = null;
    const resultado = [];

    for (const linha of texto.split('\n')) {
        const trimmed = linha.trim();
        if (!trimmed) continue;

        const numerado = trimmed.match(/^\d+\s*-\s*(.+)/);
        if (numerado) {
            if (secaoAtual) resultado.push({ nome: normalizarNome(numerado[1]), tipo: secaoAtual });
        } else {
            const cab = trimmed.replace(/\*/g, '').replace(/:$/, '').trim().toLowerCase();
            if (cab === 'mensalistas') secaoAtual = 'mensalista';
            else if (cab === 'avulsos') secaoAtual = 'avulso';
            else secaoAtual = null;
        }
    }
    return resultado;
}

function _encontrarMatch(nomeWhatsApp) {
    const nomeN = normalizarParaMatch(nomeWhatsApp);
    const lista = Object.values(jogadores);

    const m1 = lista.filter(j => normalizarParaMatch(j.nome) === nomeN);
    if (m1.length) return { nivel: 1, matches: m1 };

    const m2 = lista.filter(j => {
        const jN = normalizarParaMatch(j.nome);
        return Math.min(nomeN.length, jN.length) >= 4 && (jN.includes(nomeN) || nomeN.includes(jN));
    });
    if (m2.length) return { nivel: 2, matches: m2 };

    const tW = nomeN.split(' ');
    const m3 = lista.filter(j => {
        const tJ = normalizarParaMatch(j.nome).split(' ');
        return tW.some(tw => tJ.some(tj =>
            tw.length >= 3 && tj.length >= 3 && (tw.startsWith(tj) || tj.startsWith(tw))
        ));
    });
    if (m3.length) return { nivel: 3, matches: m3 };

    const m4 = lista.filter(j => {
        const jN = normalizarParaMatch(j.nome);
        return nomeN.length >= 5 && jN.length >= 5 && calcularLevenshtein(nomeN, jN) <= 3;
    });
    if (m4.length) return { nivel: 4, matches: m4 };

    return { nivel: 0, matches: [] };
}

function _contarSelecionados() {
    return _importResultados.reduce((acc, r) => {
        if (r.categoria === 'confirmado' && r.incluir) return acc + 1;
        if (r.categoria === 'ambiguo' && r.selecionadoId) return acc + 1;
        if (r.categoria === 'novo' && !r.ignorar) return acc + 1;
        return acc;
    }, 0);
}

function _atualizarContador() {
    const x = _contarSelecionados();
    const btn = document.getElementById('btnConfirmarImport');
    if (!btn) return;
    btn.textContent = `✅ Confirmar ${x} como presentes`;
    btn.disabled = x === 0;
}

function _renderizarRevisao() {
    const confirmados = _importResultados.filter(r => r.categoria === 'confirmado');
    const ambiguos   = _importResultados.filter(r => r.categoria === 'ambiguo');
    const novos      = _importResultados.filter(r => r.categoria === 'novo');

    let html = '';

    // --- Confirmados ---
    if (confirmados.length > 0) {
        const open = _accordionState.confirmados;
        html += `<div class="import-accordion-section${open ? ' open' : ''}">
            <div class="import-accordion-header" onclick="window._importToggleAccordion(this,'confirmados')">
                ✅ Confirmados (${confirmados.length}) <span class="import-accordion-arrow">▸</span>
            </div>
            <div class="import-accordion-body">`;
        confirmados.forEach(r => {
            const idx = _importResultados.indexOf(r);
            const j = r.matches[0];
            html += `<label class="import-match-option import-confirmado-item">
                <input type="checkbox" ${r.incluir ? 'checked' : ''} onchange="window._importToggleConfirmado(${idx},this.checked)">
                <span>${r.nomeWhatsApp}</span>
                <span class="import-match-label">→ ${j.nome} (${j.tipo === 'mensalista' ? 'M' : 'A'})</span>
            </label>`;
        });
        html += '</div></div>';
    }

    // --- Quem é esse? ---
    if (ambiguos.length > 0) {
        const open = _accordionState.ambiguos;
        html += `<div class="import-accordion-section${open ? ' open' : ''}">
            <div class="import-accordion-header" onclick="window._importToggleAccordion(this,'ambiguos')">
                ⚠️ Quem é esse? (${ambiguos.length}) <span class="import-accordion-arrow">▸</span>
            </div>
            <div class="import-accordion-body">`;
        ambiguos.forEach(r => {
            const idx = _importResultados.indexOf(r);
            html += `<div class="import-ambiguo-group">
                <div class="import-ambiguo-label">"${r.nomeWhatsApp}" — qual deles?</div>`;
            r.matches.forEach(j => {
                const sel = r.selecionadoId === j.id;
                html += `<div class="import-match-option${sel ? ' selected' : ''}" onclick="window._importSelecionarAmbiguo(${idx},'${j.id}')">
                    ${j.nome} (${j.tipo === 'mensalista' ? 'mensalista' : 'avulso'})
                </div>`;
            });
            const selNovo = r.selecionadoId === 'novo';
            html += `<div class="import-match-option${selNovo ? ' selected' : ''}" onclick="window._importSelecionarAmbiguo(${idx},'novo')">
                Não é nenhum desses → Cadastrar novo
            </div>`;
            if (selNovo) {
                html += `<div class="import-novo-inline">
                    <span style="font-size:13px;">Tipo:</span>
                    <button class="import-tipo-toggle" onclick="window._importToggleTipoAmbiguo(${idx})">${r.tipoEditavel === 'mensalista' ? 'M' : 'A'}</button>
                    <span style="font-size:13px;margin-left:8px;">Estrelas:</span>
                    <span class="import-stars-control">
                        <button onclick="window._importStarsAmbiguo(${idx},-1)">−</button>
                        <span id="import-stars-ambiguo-${idx}">${r.estrelas}</span>
                        <button onclick="window._importStarsAmbiguo(${idx},1)">+</button>
                    </span>
                </div>`;
            }
            html += '</div>';
        });
        html += '</div></div>';
    }

    // --- Novos ---
    if (novos.length > 0) {
        const open = _accordionState.novos;
        html += `<div class="import-accordion-section${open ? ' open' : ''}">
            <div class="import-accordion-header" onclick="window._importToggleAccordion(this,'novos')">
                ❓ Novos (${novos.length}) <span class="import-accordion-arrow">▸</span>
            </div>
            <div class="import-accordion-body">`;
        novos.forEach(r => {
            const idx = _importResultados.indexOf(r);
            if (r.ignorar) {
                html += `<div class="import-new-player import-ignorado">
                    <span>${r.nomeEditavel}</span>
                    <button class="import-ignorar-btn import-desfazer-btn" onclick="window._importToggleIgnorar(${idx})">Desfazer</button>
                </div>`;
            } else {
                html += `<div class="import-new-player">
                    <input type="text" class="import-nome-input" value="${_escaparAtributo(r.nomeEditavel)}" oninput="window._importNomeNovo(${idx},this.value)">
                    <button class="import-tipo-toggle" onclick="window._importToggleTipoNovo(${idx})">${r.tipoEditavel === 'mensalista' ? 'M' : 'A'}</button>
                    <span class="import-stars-control">
                        <button onclick="window._importStarsNovo(${idx},-1)">−</button>
                        <span id="import-stars-novo-${idx}">${r.estrelas}</span>
                        <button onclick="window._importStarsNovo(${idx},1)">+</button>
                    </span>
                    <button class="import-ignorar-btn" onclick="window._importToggleIgnorar(${idx})">Ignorar</button>
                </div>`;
            }
        });
        html += '</div></div>';
    }

    if (ambiguos.length === 0 && novos.length === 0 && confirmados.length > 0) {
        html += `<p style="text-align:center;color:#666;margin-bottom:12px;">${confirmados.length} jogadores identificados automaticamente</p>`;
    }

    document.getElementById('importRevisaoContent').innerHTML = html;
    _atualizarContador();
}

function _escaparAtributo(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---- Interactive handlers ----

window._importToggleAccordion = function(headerEl, key) {
    _accordionState[key] = !_accordionState[key];
    headerEl.parentElement.classList.toggle('open');
};

window._importToggleConfirmado = function(idx, checked) {
    _importResultados[idx].incluir = checked;
    _atualizarContador();
};

window._importSelecionarAmbiguo = function(idx, jogadorId) {
    const r = _importResultados[idx];
    r.selecionadoId = r.selecionadoId === jogadorId ? null : jogadorId;
    _renderizarRevisao();
};

window._importToggleTipoNovo = function(idx) {
    const r = _importResultados[idx];
    r.tipoEditavel = r.tipoEditavel === 'mensalista' ? 'avulso' : 'mensalista';
    _renderizarRevisao();
};

window._importStarsNovo = function(idx, delta) {
    const r = _importResultados[idx];
    r.estrelas = Math.max(1, Math.min(10, r.estrelas + delta));
    const el = document.getElementById(`import-stars-novo-${idx}`);
    if (el) el.textContent = r.estrelas;
};

window._importToggleIgnorar = function(idx) {
    _importResultados[idx].ignorar = !_importResultados[idx].ignorar;
    _renderizarRevisao();
};

window._importNomeNovo = function(idx, value) {
    _importResultados[idx].nomeEditavel = value;
};

window._importToggleTipoAmbiguo = function(idx) {
    const r = _importResultados[idx];
    r.tipoEditavel = r.tipoEditavel === 'mensalista' ? 'avulso' : 'mensalista';
    _renderizarRevisao();
};

window._importStarsAmbiguo = function(idx, delta) {
    const r = _importResultados[idx];
    r.estrelas = Math.max(1, Math.min(10, r.estrelas + delta));
    const el = document.getElementById(`import-stars-ambiguo-${idx}`);
    if (el) el.textContent = r.estrelas;
};

window._importVoltarStep1 = function() {
    _accordionState = { confirmados: false, ambiguos: true, novos: true };
    document.getElementById('importStep2').style.display = 'none';
    document.getElementById('importStep1').style.display = 'block';
};
