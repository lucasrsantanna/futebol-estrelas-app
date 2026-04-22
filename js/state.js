// ==============================================
// state.js — Estado global da aplicação
// Todas as variáveis compartilhadas entre módulos
// ==============================================

let app, database;

let jogadores         = {};
let sessoes           = {};
let restricoes        = {};
let historicoTimes    = {};

let jogadoresPresentes           = [];
let jogadorEditando              = null;
let timesFormados                = null;
let ultimaDistribuicao           = null;
let selectedPlayersForRestriction = [];
let sessaoParaExcluir            = null;
let historicoParaExcluir         = null;
let isOnline                     = navigator.onLine;

let swapJogadorSelecionado = null;
let swapModoAtivo = false;
let genericosAdicionados = 0;
let confirmacaoEmAndamento = false;
