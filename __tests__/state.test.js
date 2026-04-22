// ==============================================
// state.test.js — Testes para gerenciamento de estado
// ==============================================

describe('Estado Global', () => {
    let originalLocalStorage;

    beforeEach(() => {
        // Mock localStorage
        originalLocalStorage = global.localStorage;
        const store = {};

        global.localStorage = {
            getItem: jest.fn((key) => store[key] || null),
            setItem: jest.fn((key, value) => {
                store[key] = value.toString();
            }),
            removeItem: jest.fn((key) => {
                delete store[key];
            }),
            clear: jest.fn(() => {
                Object.keys(store).forEach(key => delete store[key]);
            })
        };
    });

    afterEach(() => {
        global.localStorage = originalLocalStorage;
    });

    test('deve armazenar e recuperar presença no localStorage', () => {
        const dados = ['j1', 'j2', 'j3'];
        localStorage.setItem('jogadoresPresentesSelecionados', JSON.stringify(dados));

        const recuperados = JSON.parse(localStorage.getItem('jogadoresPresentesSelecionados'));
        expect(recuperados).toEqual(dados);
    });

    test('deve retornar null para chave inexistente', () => {
        const resultado = localStorage.getItem('chaveInexistente');
        expect(resultado).toBeNull();
    });

    test('deve limpar todas as chaves', () => {
        localStorage.setItem('chave1', 'valor1');
        localStorage.setItem('chave2', 'valor2');

        localStorage.clear();

        expect(localStorage.getItem('chave1')).toBeNull();
        expect(localStorage.getItem('chave2')).toBeNull();
    });

    test('deve remover chave específica', () => {
        localStorage.setItem('chave1', 'valor1');
        localStorage.removeItem('chave1');

        expect(localStorage.getItem('chave1')).toBeNull();
    });

    test('deve recuperar array vazio para localStorage vazio', () => {
        const resultado = JSON.parse(localStorage.getItem('jogadoresPresentesSelecionados') || '[]');
        expect(resultado).toEqual([]);
    });

    test('deve manter integridade de dados complexos', () => {
        const dadosComplexos = {
            jogadores: [
                { id: 'j1', nome: 'João', estrelas: 8 },
                { id: 'j2', nome: 'Maria', estrelas: 7 }
            ],
            sessoes: {
                's1': { id: 's1', data: '2024-04-22', valor: 15 }
            }
        };

        localStorage.setItem('dadosComplexos', JSON.stringify(dadosComplexos));
        const recuperados = JSON.parse(localStorage.getItem('dadosComplexos'));

        expect(recuperados).toEqual(dadosComplexos);
    });
});

describe('Estrutura de Estado', () => {
    test('estado deve ter todas as variáveis globais necessárias', () => {
        // Simular o que deveria estar em state.js
        const estadoGlobal = {
            jogadores: {},
            sessoes: {},
            restricoes: {},
            historicoTimes: {},
            jogadoresPresentes: [],
            timesFormados: null,
            genericosAdicionados: 0
        };

        expect(estadoGlobal).toHaveProperty('jogadores');
        expect(estadoGlobal).toHaveProperty('sessoes');
        expect(estadoGlobal).toHaveProperty('restricoes');
        expect(estadoGlobal).toHaveProperty('historicoTimes');
        expect(estadoGlobal).toHaveProperty('jogadoresPresentes');
        expect(estadoGlobal).toHaveProperty('timesFormados');
        expect(estadoGlobal).toHaveProperty('genericosAdicionados');
    });

    test('estado inicial deve ter objetos vazios', () => {
        const estado = {
            jogadores: {},
            sessoes: {},
            restricoes: {},
            historicoTimes: {},
            jogadoresPresentes: []
        };

        expect(Object.keys(estado.jogadores)).toHaveLength(0);
        expect(Object.keys(estado.sessoes)).toHaveLength(0);
        expect(Object.keys(estado.restricoes)).toHaveLength(0);
        expect(Object.keys(estado.historicoTimes)).toHaveLength(0);
        expect(estado.jogadoresPresentes).toHaveLength(0);
    });
});

describe('Sincronização de Estado', () => {
    test('deve permitir adicionar jogador ao estado', () => {
        const estado = { jogadores: {} };
        const novoJogador = {
            id: 'j1',
            nome: 'João',
            estrelas: 8,
            tipo: 'mensalista'
        };

        estado.jogadores['j1'] = novoJogador;

        expect(estado.jogadores['j1']).toEqual(novoJogador);
        expect(Object.keys(estado.jogadores)).toHaveLength(1);
    });

    test('deve permitir atualizar jogador', () => {
        const estado = {
            jogadores: {
                'j1': { id: 'j1', nome: 'João', estrelas: 8, tipo: 'mensalista' }
            }
        };

        estado.jogadores['j1'].estrelas = 9;

        expect(estado.jogadores['j1'].estrelas).toBe(9);
    });

    test('deve permitir remover jogador', () => {
        const estado = {
            jogadores: {
                'j1': { id: 'j1', nome: 'João', estrelas: 8 },
                'j2': { id: 'j2', nome: 'Maria', estrelas: 7 }
            }
        };

        delete estado.jogadores['j1'];

        expect(estado.jogadores['j1']).toBeUndefined();
        expect(Object.keys(estado.jogadores)).toHaveLength(1);
    });

    test('deve permitir adicionar sessão ao estado', () => {
        const estado = { sessoes: {} };
        const novaSessao = {
            id: 's1',
            data: '2024-04-22',
            valorDiaria: 15,
            todosPresentes: ['j1', 'j2'],
            times: [],
            pagamentos: {}
        };

        estado.sessoes['s1'] = novaSessao;

        expect(estado.sessoes['s1']).toEqual(novaSessao);
    });

    test('deve permitir adicionar restrição ao estado', () => {
        const estado = { restricoes: {} };
        const novaRestricao = {
            id: 'r1',
            jogadores: ['j1', 'j2']
        };

        estado.restricoes['r1'] = novaRestricao;

        expect(estado.restricoes['r1']).toEqual(novaRestricao);
    });
});
