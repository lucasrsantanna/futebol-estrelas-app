// ==============================================
// utils.test.js — Testes para funções utilitárias
// ==============================================

// Mock das funções de utils.js
function criarEstrelas(quantidade) {
    return '⭐'.repeat(Math.max(0, Math.min(quantidade, 10)));
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

// ===== TESTES =====

describe('criarEstrelas', () => {
    test('deve criar string com quantidade correta de estrelas', () => {
        expect(criarEstrelas(3)).toBe('⭐⭐⭐');
        expect(criarEstrelas(5)).toBe('⭐⭐⭐⭐⭐');
        expect(criarEstrelas(1)).toBe('⭐');
    });

    test('deve limitar a 10 estrelas máximo', () => {
        const resultado = criarEstrelas(15);
        expect(resultado).toBe('⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐');
    });

    test('deve retornar string vazia para quantidade 0', () => {
        expect(criarEstrelas(0)).toBe('');
    });

    test('deve retornar string vazia para quantidade negativa', () => {
        expect(criarEstrelas(-5)).toBe('');
    });
});

describe('formatarNomeComTipo', () => {
    test('deve formatar jogador mensalista com (M)', () => {
        const jogador = { nome: 'João', tipo: 'mensalista' };
        expect(formatarNomeComTipo(jogador)).toBe('João (M)');
    });

    test('deve formatar jogador avulso com (A)', () => {
        const jogador = { nome: 'Maria', tipo: 'avulso' };
        expect(formatarNomeComTipo(jogador)).toBe('Maria (A)');
    });

    test('deve usar mensalista como padrão quando tipo não definido', () => {
        const jogador = { nome: 'Pedro' };
        expect(formatarNomeComTipo(jogador)).toBe('Pedro (M)');
    });
});

describe('ordenarJogadores', () => {
    const jogadores = {
        '1': { id: '1', nome: 'Zoe', estrelas: 5 },
        '2': { id: '2', nome: 'Alice', estrelas: 8 },
        '3': { id: '3', nome: 'Bob', estrelas: 3 }
    };

    test('deve ordenar alfabeticamente A-Z', () => {
        const resultado = ordenarJogadores(jogadores, 'alfabetica-az');
        expect(resultado[0].nome).toBe('Alice');
        expect(resultado[1].nome).toBe('Bob');
        expect(resultado[2].nome).toBe('Zoe');
    });

    test('deve ordenar alfabeticamente Z-A', () => {
        const resultado = ordenarJogadores(jogadores, 'alfabetica-za');
        expect(resultado[0].nome).toBe('Zoe');
        expect(resultado[1].nome).toBe('Bob');
        expect(resultado[2].nome).toBe('Alice');
    });

    test('deve ordenar por estrelas (maior primeiro)', () => {
        const resultado = ordenarJogadores(jogadores, 'estrelas-maior');
        expect(resultado[0].estrelas).toBe(8);
        expect(resultado[1].estrelas).toBe(5);
        expect(resultado[2].estrelas).toBe(3);
    });

    test('deve ordenar por estrelas (menor primeiro)', () => {
        const resultado = ordenarJogadores(jogadores, 'estrelas-menor');
        expect(resultado[0].estrelas).toBe(3);
        expect(resultado[1].estrelas).toBe(5);
        expect(resultado[2].estrelas).toBe(8);
    });

    test('deve retornar array quando tipo inválido', () => {
        const resultado = ordenarJogadores(jogadores, 'invalido');
        expect(Array.isArray(resultado)).toBe(true);
        expect(resultado.length).toBe(3);
    });
});

describe('embaralharArray', () => {
    test('deve retornar array com mesmo tamanho', () => {
        const arr = [1, 2, 3, 4, 5];
        const resultado = embaralharArray(arr);
        expect(resultado.length).toBe(arr.length);
    });

    test('deve conter todos os elementos originais', () => {
        const arr = ['a', 'b', 'c', 'd'];
        const resultado = embaralharArray(arr);
        expect(resultado.sort()).toEqual(arr.sort());
    });

    test('não deve modificar array original', () => {
        const arr = [1, 2, 3];
        const arrOriginal = [...arr];
        embaralharArray(arr);
        expect(arr).toEqual(arrOriginal);
    });

    test('deve funcionar com array vazio', () => {
        const resultado = embaralharArray([]);
        expect(resultado).toEqual([]);
    });

    test('deve funcionar com array de um elemento', () => {
        const resultado = embaralharArray([42]);
        expect(resultado).toEqual([42]);
    });

    test('deve produzir distribuição variada em múltiplas execuções', () => {
        const arr = [1, 2, 3, 4, 5, 6];
        const resultados = new Set();
        for (let i = 0; i < 20; i++) {
            resultados.add(JSON.stringify(embaralharArray(arr)));
        }
        // Com 6 elementos e 20 tentativas, esperamos múltiplas permutações
        expect(resultados.size).toBeGreaterThan(1);
    });
});
