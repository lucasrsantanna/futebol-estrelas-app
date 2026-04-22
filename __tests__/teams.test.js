// ==============================================
// teams.test.js — Testes para algoritmo de times
// ==============================================

const MAX_TENTATIVAS_BALANCEAMENTO = 30;

// Mock dos dados globais
let restricoes = {};

// Mocks das funções auxiliares
function embaralharArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Implementação do algoritmo
function temRestricao(id1, id2) {
    return Object.values(restricoes).some(r => r.jogadores.includes(id1) && r.jogadores.includes(id2));
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

function distribuirComRestricoes(todos, numTimes, tentativa = 1) {
    if (tentativa > 10) {
        return { sucesso: false, mensagem: 'Não foi possível criar uma distribuição que respeite todas as restrições.' };
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
        mensagem: 'Não foi possível criar uma distribuição.'
    };
}

// ===== TESTES =====

describe('distribuirComRestricoes', () => {
    beforeEach(() => {
        restricoes = {};
    });

    test('deve distribuir 10 jogadores em 2 times de 5', () => {
        const jogadores = Array.from({ length: 10 }, (_, i) => ({
            id: `j${i}`,
            nome: `Jogador ${i}`,
            estrelas: 5,
            tipo: 'mensalista'
        }));

        const resultado = distribuirComRestricoes(jogadores, 2);

        expect(resultado.sucesso).toBe(true);
        expect(resultado.times.length).toBe(2);
        expect(resultado.times[0].length).toBe(5);
        expect(resultado.times[1].length).toBe(5);
    });

    test('deve distribuir 15 jogadores em 3 times de 5', () => {
        const jogadores = Array.from({ length: 15 }, (_, i) => ({
            id: `j${i}`,
            nome: `Jogador ${i}`,
            estrelas: 5,
            tipo: 'mensalista'
        }));

        const resultado = distribuirComRestricoes(jogadores, 3);

        expect(resultado.sucesso).toBe(true);
        expect(resultado.times.length).toBe(3);
        expect(resultado.times.every(t => t.length === 5)).toBe(true);
    });

    test('deve respeitar restrições entre jogadores', () => {
        const jogadores = [
            { id: 'j1', nome: 'João', estrelas: 8, tipo: 'mensalista' },
            { id: 'j2', nome: 'Maria', estrelas: 8, tipo: 'mensalista' },
            { id: 'j3', nome: 'Pedro', estrelas: 6, tipo: 'avulso' },
            { id: 'j4', nome: 'Ana', estrelas: 6, tipo: 'avulso' },
            { id: 'j5', nome: 'Carlos', estrelas: 5, tipo: 'mensalista' },
            { id: 'j6', nome: 'Sandra', estrelas: 5, tipo: 'mensalista' },
            { id: 'j7', nome: 'Lucas', estrelas: 4, tipo: 'avulso' },
            { id: 'j8', nome: 'Beatriz', estrelas: 4, tipo: 'avulso' },
            { id: 'j9', nome: 'Ricardo', estrelas: 3, tipo: 'mensalista' },
            { id: 'j10', nome: 'Juliana', estrelas: 3, tipo: 'mensalista' }
        ];

        // João e Maria não podem ficar juntos
        restricoes = {
            'r1': { id: 'r1', jogadores: ['j1', 'j2'] }
        };

        const resultado = distribuirComRestricoes(jogadores, 2);

        if (resultado.sucesso) {
            const times = resultado.times;
            // Verificar que j1 e j2 não estão no mesmo time
            const time1Tem1 = times[0].some(j => j.id === 'j1');
            const time1Tem2 = times[0].some(j => j.id === 'j2');
            const time2Tem1 = times[1].some(j => j.id === 'j1');
            const time2Tem2 = times[1].some(j => j.id === 'j2');

            const j1eJ2NoMesmoTime = (time1Tem1 && time1Tem2) || (time2Tem1 && time2Tem2);
            expect(j1eJ2NoMesmoTime).toBe(false);
        }
    });

    test('deve incluir genéricos corretamente', () => {
        const jogadores = [
            { id: 'j1', nome: 'João', estrelas: 8, tipo: 'mensalista' },
            { id: 'j2', nome: 'Maria', estrelas: 7, tipo: 'avulso' },
            { id: 'j3', nome: 'Pedro', estrelas: 6, tipo: 'mensalista' },
            { id: 'j4', nome: 'Ana', estrelas: 5, tipo: 'avulso' },
            { id: 'generico_0', nome: 'Jogador Extra', estrelas: 5, tipo: 'mensalista', isGenerico: true },
            { id: 'generico_1', nome: 'Jogador Extra', estrelas: 5, tipo: 'mensalista', isGenerico: true },
            { id: 'generico_2', nome: 'Jogador Extra', estrelas: 5, tipo: 'mensalista', isGenerico: true },
            { id: 'generico_3', nome: 'Jogador Extra', estrelas: 5, tipo: 'mensalista', isGenerico: true },
            { id: 'generico_4', nome: 'Jogador Extra', estrelas: 5, tipo: 'mensalista', isGenerico: true },
            { id: 'generico_5', nome: 'Jogador Extra', estrelas: 5, tipo: 'mensalista', isGenerico: true }
        ];

        const resultado = distribuirComRestricoes(jogadores, 2);

        expect(resultado.sucesso).toBe(true);
        expect(resultado.times.every(t => t.length === 5)).toBe(true);
    });
});

describe('encontrarMelhorDistribuicao', () => {
    beforeEach(() => {
        restricoes = {};
    });

    test('deve encontrar distribuição equilibrada', () => {
        const jogadores = [
            { id: 'j1', nome: 'João', estrelas: 10, tipo: 'mensalista' },
            { id: 'j2', nome: 'Maria', estrelas: 9, tipo: 'avulso' },
            { id: 'j3', nome: 'Pedro', estrelas: 8, tipo: 'mensalista' },
            { id: 'j4', nome: 'Ana', estrelas: 7, tipo: 'avulso' },
            { id: 'j5', nome: 'Carlos', estrelas: 6, tipo: 'mensalista' },
            { id: 'j6', nome: 'Sandra', estrelas: 5, tipo: 'avulso' },
            { id: 'j7', nome: 'Lucas', estrelas: 4, tipo: 'mensalista' },
            { id: 'j8', nome: 'Beatriz', estrelas: 3, tipo: 'avulso' },
            { id: 'j9', nome: 'Ricardo', estrelas: 2, tipo: 'mensalista' },
            { id: 'j10', nome: 'Juliana', estrelas: 1, tipo: 'avulso' }
        ];

        const resultado = encontrarMelhorDistribuicao(jogadores, 2);

        expect(resultado.sucesso).toBe(true);
        expect(resultado.times.length).toBe(2);
        expect(resultado.times[0].length).toBe(5);
        expect(resultado.times[1].length).toBe(5);

        // Verificar balanceamento
        const medias = resultado.times.map(t =>
            t.reduce((s, j) => s + j.estrelas, 0) / t.length
        );
        const diff = Math.max(...medias) - Math.min(...medias);
        expect(diff).toBeLessThan(3); // Diferença razoável
    });

    test('deve encontrar distribuição com 3 times', () => {
        const jogadores = Array.from({ length: 15 }, (_, i) => ({
            id: `j${i}`,
            nome: `Jogador ${i}`,
            estrelas: Math.floor(Math.random() * 10) + 1,
            tipo: i % 2 === 0 ? 'mensalista' : 'avulso'
        }));

        const resultado = encontrarMelhorDistribuicao(jogadores, 3);

        expect(resultado.sucesso).toBe(true);
        expect(resultado.times.length).toBe(3);
        expect(resultado.times.every(t => t.length === 5)).toBe(true);
    });
});

describe('temRestricao', () => {
    beforeEach(() => {
        restricoes = {};
    });

    test('deve retornar true quando existe restrição entre jogadores', () => {
        restricoes = {
            'r1': { id: 'r1', jogadores: ['j1', 'j2'] }
        };

        expect(temRestricao('j1', 'j2')).toBe(true);
        expect(temRestricao('j2', 'j1')).toBe(true);
    });

    test('deve retornar false quando não existe restrição', () => {
        restricoes = {
            'r1': { id: 'r1', jogadores: ['j1', 'j2'] }
        };

        expect(temRestricao('j1', 'j3')).toBe(false);
        expect(temRestricao('j3', 'j4')).toBe(false);
    });

    test('deve retornar false quando não há restrições', () => {
        expect(temRestricao('j1', 'j2')).toBe(false);
    });

    test('deve funcionar com múltiplas restrições', () => {
        restricoes = {
            'r1': { id: 'r1', jogadores: ['j1', 'j2'] },
            'r2': { id: 'r2', jogadores: ['j3', 'j4'] },
            'r3': { id: 'r3', jogadores: ['j5', 'j6'] }
        };

        expect(temRestricao('j1', 'j2')).toBe(true);
        expect(temRestricao('j3', 'j4')).toBe(true);
        expect(temRestricao('j5', 'j6')).toBe(true);
        expect(temRestricao('j1', 'j4')).toBe(false);
    });
});

describe('encontrarTimeSemRestricao', () => {
    beforeEach(() => {
        restricoes = {};
    });

    test('deve adicionar genérico ao time mais vazio', () => {
        const times = [
            [{ id: 'j1', nome: 'João', estrelas: 8 }],
            [{ id: 'j2', nome: 'Maria', estrelas: 7 }, { id: 'j3', nome: 'Pedro', estrelas: 6 }]
        ];
        const generico = { id: 'gen1', nome: 'Extra', estrelas: 5, isGenerico: true };

        const timeIdx = encontrarTimeSemRestricao(generico, times);

        expect(timeIdx).toBe(0);
    });

    test('deve retornar -1 quando não há time disponível devido a restrições', () => {
        restricoes = {
            'r1': { id: 'r1', jogadores: ['j1', 'j2'] },
            'r2': { id: 'r2', jogadores: ['j1', 'j3'] }
        };

        const jogador = { id: 'j1', nome: 'João', estrelas: 8 };
        const times = [
            [{ id: 'j2', nome: 'Maria', estrelas: 7 }],
            [{ id: 'j3', nome: 'Pedro', estrelas: 6 }]
        ];

        const timeIdx = encontrarTimeSemRestricao(jogador, times);

        expect(timeIdx).toBe(-1);
    });

    test('deve escolher time que não viola restrições', () => {
        restricoes = {
            'r1': { id: 'r1', jogadores: ['j1', 'j2'] }
        };

        const jogador = { id: 'j1', nome: 'João', estrelas: 8 };
        const times = [
            [{ id: 'j2', nome: 'Maria', estrelas: 7 }],
            [{ id: 'j3', nome: 'Pedro', estrelas: 6 }]
        ];

        const timeIdx = encontrarTimeSemRestricao(jogador, times);

        expect(timeIdx).toBe(1);
    });
});
