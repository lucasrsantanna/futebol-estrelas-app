// ==============================================
// utils.js — Funções utilitárias puras
// ==============================================

function criarEstrelas(quantidade) {
    return '⭐'.repeat(Math.min(quantidade, 10));
}

function formatarNomeComTipo(jogador) {
    const tipo = jogador.tipo || 'mensalista';
    return `${jogador.nome} ${tipo === 'mensalista' ? '(M)' : '(A)'}`;
}

function ordenarJogadores(lista, tipoOrdem) {
    const arr = Object.values(lista);
    switch (tipoOrdem) {
        case 'alfabetica-az':    return arr.sort((a, b) => a.nome.localeCompare(b.nome));
        case 'alfabetica-za':    return arr.sort((a, b) => b.nome.localeCompare(a.nome));
        case 'estrelas-maior':   return arr.sort((a, b) => b.estrelas - a.estrelas);
        case 'estrelas-menor':   return arr.sort((a, b) => a.estrelas - b.estrelas);
        default:                 return arr;
    }
}

function embaralharArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function calcularPendenciaJogador(jogadorId) {
    let total = 0;
    Object.values(sessoes).forEach(sessao => {
        if (sessao.pagamentos && sessao.pagamentos[jogadorId] === 'pendente') {
            total += sessao.valorDiaria || 0;
        }
    });
    return total;
}

// Seleção persistida no localStorage
function carregarSelecaoSalva() {
    try {
        jogadoresPresentes = JSON.parse(localStorage.getItem('jogadoresPresentesSelecionados') || '[]');
    } catch (e) {
        jogadoresPresentes = [];
    }
}

function salvarSelecao() {
    localStorage.setItem('jogadoresPresentesSelecionados', JSON.stringify(jogadoresPresentes));
}

function normalizarNome(str) {
    return str.trim().replace(/\s+/g, ' ')
              .replace(/\b\w/g, c => c.toUpperCase());
}

function normalizarParaMatch(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '')
              .toLowerCase().trim().replace(/\s+/g, ' ');
}

function calcularLevenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
    );
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
                : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
}
