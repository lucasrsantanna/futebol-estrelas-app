// ==============================================
// state.js — Estado global da aplicação
// Todas as variáveis compartilhadas entre módulos
// ==============================================

let app, database, auth;

// Dados do grupo ativo
let jogadores         = {};
let sessoes           = {};
let restricoes        = {};
let historicoTimes    = {};
let jogadoresCarregados = false; // true após primeira resposta do Firebase (mesmo se vazio)

// Sessão do usuário
let usuarioAtual      = null;   // Firebase Auth User object
let grupoAtualId      = null;   // ID do grupo ativo no Firebase
let grupoAtualNome    = null;   // Nome exibido no header
let papelNoGrupo      = null;   // 'admin' | 'membro' | null

// Estado da UI
let jogadoresPresentes            = [];
let jogadorEditando               = null;
let timesFormados                 = null;
let ultimaDistribuicao            = null;
let selectedPlayersForRestriction = [];
let sessaoParaExcluir             = null;
let historicoParaExcluir          = null;
let isOnline                      = navigator.onLine;

let swapJogadorSelecionado = null;
let swapModoAtivo          = false;
let genericosAdicionados   = 0;
let confirmacaoEmAndamento = false;
