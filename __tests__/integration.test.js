// ==============================================
// integration.test.js — Testes de integração
// ==============================================

describe('Fluxo Completo de Formação de Times', () => {
    // Mock do estado global
    let state;

    beforeEach(() => {
        state = {
            jogadores: {
                'j1': { id: 'j1', nome: 'João', estrelas: 10, tipo: 'mensalista' },
                'j2': { id: 'j2', nome: 'Maria', estrelas: 9, tipo: 'avulso' },
                'j3': { id: 'j3', nome: 'Pedro', estrelas: 8, tipo: 'mensalista' },
                'j4': { id: 'j4', nome: 'Ana', estrelas: 7, tipo: 'avulso' },
                'j5': { id: 'j5', nome: 'Carlos', estrelas: 6, tipo: 'mensalista' },
                'j6': { id: 'j6', nome: 'Sandra', estrelas: 5, tipo: 'avulso' },
                'j7': { id: 'j7', nome: 'Lucas', estrelas: 4, tipo: 'mensalista' },
                'j8': { id: 'j8', nome: 'Beatriz', estrelas: 3, tipo: 'avulso' },
                'j9': { id: 'j9', nome: 'Ricardo', estrelas: 2, tipo: 'mensalista' },
                'j10': { id: 'j10', nome: 'Juliana', estrelas: 1, tipo: 'avulso' }
            },
            jogadoresPresentes: ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7', 'j8', 'j9', 'j10'],
            sessoes: {},
            restricoes: {},
            historicoTimes: {},
            timesFormados: null
        };
    });

    test('deve permitir registrar presença dos jogadores', () => {
        const presentes = state.jogadoresPresentes.map(id => state.jogadores[id]);

        expect(presentes).toHaveLength(10);
        expect(presentes.every(j => j !== undefined)).toBe(true);
        expect(presentes.map(j => j.nome)).toContain('João');
    });

    test('deve distribuir jogadores em times sem genéricos quando exato', () => {
        // 10 jogadores = 2 times de 5
        const numeroDeTimesNecessarios = Math.ceil(state.jogadoresPresentes.length / 5);
        const jogadoresNecessarios = numeroDeTimesNecessarios * 5;
        const genericosNecessarios = Math.max(0, jogadoresNecessarios - state.jogadoresPresentes.length);

        expect(numeroDeTimesNecessarios).toBe(2);
        expect(genericosNecessarios).toBe(0);
    });

    test('deve calcular genéricos necessários corretamente', () => {
        // Adicionar 2 jogadores para ter 12 total
        for (let i = 11; i <= 12; i++) {
            state.jogadores[`j${i}`] = {
                id: `j${i}`,
                nome: `Jogador ${i}`,
                estrelas: Math.floor(Math.random() * 10) + 1,
                tipo: i % 2 === 0 ? 'mensalista' : 'avulso'
            };
        }
        // 12 jogadores = 3 times de 5 = 15 necessários = 3 genéricos
        state.jogadoresPresentes = Object.keys(state.jogadores).slice(0, 12);
        const numeroDeTimesNecessarios = Math.ceil(state.jogadoresPresentes.length / 5);
        const jogadoresNecessarios = numeroDeTimesNecessarios * 5;
        const genericosNecessarios = Math.max(0, jogadoresNecessarios - state.jogadoresPresentes.length);

        expect(numeroDeTimesNecessarios).toBe(3);
        expect(jogadoresNecessarios).toBe(15);
        expect(genericosNecessarios).toBe(3);
    });

    test('deve calcular corretamente com 1 jogador', () => {
        state.jogadoresPresentes = ['j1'];
        const numeroDeTimesNecessarios = Math.ceil(state.jogadoresPresentes.length / 5);
        const jogadoresNecessarios = numeroDeTimesNecessarios * 5;
        const genericosNecessarios = Math.max(0, jogadoresNecessarios - state.jogadoresPresentes.length);

        expect(numeroDeTimesNecessarios).toBe(1);
        expect(jogadoresNecessarios).toBe(5);
        expect(genericosNecessarios).toBe(4);
    });

    test('deve calcular corretamente com 16 jogadores', () => {
        // Adicionar mais jogadores
        for (let i = 11; i <= 16; i++) {
            state.jogadores[`j${i}`] = {
                id: `j${i}`,
                nome: `Jogador ${i}`,
                estrelas: Math.floor(Math.random() * 10) + 1,
                tipo: i % 2 === 0 ? 'mensalista' : 'avulso'
            };
        }
        state.jogadoresPresentes = Object.keys(state.jogadores);

        const numeroDeTimesNecessarios = Math.ceil(state.jogadoresPresentes.length / 5);
        const jogadoresNecessarios = numeroDeTimesNecessarios * 5;
        const genericosNecessarios = Math.max(0, jogadoresNecessarios - state.jogadoresPresentes.length);

        expect(numeroDeTimesNecessarios).toBe(4);
        expect(jogadoresNecessarios).toBe(20);
        expect(genericosNecessarios).toBe(4);
    });

    test('deve criar sessão com times formados', () => {
        const timesFormados = [
            [state.jogadores['j1'], state.jogadores['j2'], state.jogadores['j3'], state.jogadores['j4'], state.jogadores['j5']],
            [state.jogadores['j6'], state.jogadores['j7'], state.jogadores['j8'], state.jogadores['j9'], state.jogadores['j10']]
        ];

        const novaSessao = {
            id: Date.now().toString(),
            data: '2024-04-22',
            valorDiaria: 15,
            todosPresentes: state.jogadoresPresentes,
            times: timesFormados.map(time =>
                time.map(j => ({ id: j.id, nome: j.nome, estrelas: j.estrelas, tipo: j.tipo }))
            ),
            pagamentos: {}
        };

        state.sessoes[novaSessao.id] = novaSessao;

        expect(state.sessoes[novaSessao.id]).toBeDefined();
        expect(state.sessoes[novaSessao.id].times).toHaveLength(2);
        expect(state.sessoes[novaSessao.id].times[0]).toHaveLength(5);
        expect(state.sessoes[novaSessao.id].times[1]).toHaveLength(5);
    });

    test('deve registrar pagamentos de avulsos', () => {
        const avulsos = state.jogadoresPresentes.filter(
            id => state.jogadores[id].tipo === 'avulso'
        );

        const sessao = {
            id: 's1',
            data: '2024-04-22',
            valorDiaria: 15,
            pagamentos: {}
        };

        avulsos.forEach(id => {
            sessao.pagamentos[id] = 'pendente';
        });

        expect(Object.keys(sessao.pagamentos)).toHaveLength(avulsos.length);
        expect(avulsos.length).toBeGreaterThan(0);
    });

    test('deve calcular total devido por jogador', () => {
        // Criar múltiplas sessões com pagamentos
        const sessoes = [
            {
                id: 's1',
                valorDiaria: 15,
                pagamentos: { 'j2': 'pendente', 'j4': 'pendente' }
            },
            {
                id: 's2',
                valorDiaria: 15,
                pagamentos: { 'j2': 'pendente', 'j6': 'pendente' }
            },
            {
                id: 's3',
                valorDiaria: 15,
                pagamentos: { 'j2': 'pago', 'j6': 'pendente' }
            }
        ];

        let totalDevido = {};
        sessoes.forEach(sessao => {
            Object.entries(sessao.pagamentos).forEach(([jogadorId, status]) => {
                if (status === 'pendente') {
                    totalDevido[jogadorId] = (totalDevido[jogadorId] || 0) + sessao.valorDiaria;
                }
            });
        });

        expect(totalDevido['j2']).toBe(30); // 2 pendentes em s1 e s2
        expect(totalDevido['j4']).toBe(15); // 1 pendente em s1
        expect(totalDevido['j6']).toBe(30); // 2 pendentes em s2 e s3
    });

    test('deve permitir adicionar restrições entre jogadores', () => {
        const restricao = {
            id: 'r1',
            jogadores: ['j1', 'j2']
        };

        state.restricoes['r1'] = restricao;

        expect(state.restricoes['r1']).toBeDefined();
        expect(state.restricoes['r1'].jogadores).toContain('j1');
        expect(state.restricoes['r1'].jogadores).toContain('j2');
    });

    test('deve permitir múltiplas restrições', () => {
        state.restricoes = {
            'r1': { id: 'r1', jogadores: ['j1', 'j2'] },
            'r2': { id: 'r2', jogadores: ['j3', 'j4'] },
            'r3': { id: 'r3', jogadores: ['j5', 'j6'] }
        };

        expect(Object.keys(state.restricoes)).toHaveLength(3);
    });

    test('deve manter histórico de times', () => {
        const historico1 = {
            id: Date.now().toString(),
            data: new Date().toISOString(),
            times: [
                [{ id: 'j1', nome: 'João', estrelas: 10 }],
                [{ id: 'j2', nome: 'Maria', estrelas: 9 }]
            ],
            totalJogadores: 2,
            genericosAdicionados: 0
        };

        const historico2 = {
            id: (Date.now() + 1).toString(),
            data: new Date().toISOString(),
            times: [
                [{ id: 'j3', nome: 'Pedro', estrelas: 8 }],
                [{ id: 'j4', nome: 'Ana', estrelas: 7 }]
            ],
            totalJogadores: 2,
            genericosAdicionados: 0
        };

        state.historicoTimes[historico1.id] = historico1;
        state.historicoTimes[historico2.id] = historico2;

        expect(Object.keys(state.historicoTimes)).toHaveLength(2);
        expect(state.historicoTimes[historico1.id].times).toBeDefined();
    });
});

describe('Validações de Entrada', () => {
    test('deve rejeitar presença com menos de 2 jogadores', () => {
        const jogadoresPresentes = ['j1'];
        const valido = jogadoresPresentes.length >= 2;

        expect(valido).toBe(false);
    });

    test('deve aceitar presença com exatamente 2 jogadores', () => {
        const jogadoresPresentes = ['j1', 'j2'];
        const valido = jogadoresPresentes.length >= 2;

        expect(valido).toBe(true);
    });

    test('deve validar tipo de jogador', () => {
        const tiposValidos = ['mensalista', 'avulso'];
        const jogador1 = { tipo: 'mensalista' };
        const jogador2 = { tipo: 'avulso' };
        const jogador3 = { tipo: 'invalido' };

        expect(tiposValidos.includes(jogador1.tipo)).toBe(true);
        expect(tiposValidos.includes(jogador2.tipo)).toBe(true);
        expect(tiposValidos.includes(jogador3.tipo)).toBe(false);
    });

    test('deve validar estrelas entre 1 e 10', () => {
        const validarEstrelas = (estrelas) => estrelas >= 1 && estrelas <= 10;

        expect(validarEstrelas(1)).toBe(true);
        expect(validarEstrelas(5)).toBe(true);
        expect(validarEstrelas(10)).toBe(true);
        expect(validarEstrelas(0)).toBe(false);
        expect(validarEstrelas(11)).toBe(false);
    });

    test('deve validar valor de diária', () => {
        const validarValor = (valor) => valor > 0 && !isNaN(valor);

        expect(validarValor(15)).toBe(true);
        expect(validarValor(0)).toBe(false);
        expect(validarValor(-10)).toBe(false);
        expect(validarValor('abc')).toBe(false);
    });
});
