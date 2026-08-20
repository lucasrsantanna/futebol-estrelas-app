// ==============================================
// migration.js — Migração one-shot de dados
// Executar via console: migrarDadosParaGrupo('ID_DO_GRUPO')
// ==============================================

const FIREBASE_CONFIG_PRODUCAO = {
    apiKey: "AIzaSyAHTD1vEIh8ehAFR2M4APiE8Ky9HEAuPU",
    authDomain: "futebol-estrelas.firebaseapp.com",
    databaseURL: "https://futebol-estrelas-default-rtdb.firebaseio.com",
    projectId: "futebol-estrelas",
    storageBucket: "futebol-estrelas.firebasestorage.app",
    messagingSenderId: "96538381574",
    appId: "1:96538381574:web:dee50b846e46a898aeaecf"
};

function _comUserIdNulo(dadosJogadores) {
    const resultado = {};
    for (const [id, jogador] of Object.entries(dadosJogadores)) {
        resultado[id] = { userId: null, ...jogador };
    }
    return resultado;
}

window.migrarDadosParaGrupo = async function(grupoId) {
    if (!grupoId) { console.error('Informe o grupoId'); return; }
    if (!usuarioAtual) { console.error('Faça login antes de migrar'); return; }

    console.log('Iniciando migração para grupo:', grupoId);

    const appProd = firebase.initializeApp(FIREBASE_CONFIG_PRODUCAO, 'producao');
    const dbProd  = firebase.database(appProd);

    const entidades = ['jogadores', 'sessoes', 'restricoes', 'historicoTimes'];

    for (const entidade of entidades) {
        const snap = await dbProd.ref(entidade).get();
        const dados = snap.val();

        if (!dados) {
            console.log(`${entidade}: nenhum dado encontrado.`);
            continue;
        }

        const destSnap = await database.ref(`grupos/${grupoId}/${entidade}`).get();
        if (destSnap.exists()) {
            console.log(`${entidade}: já migrado, pulando.`);
            continue;
        }

        const dadosParaGravar = entidade === 'jogadores' ? _comUserIdNulo(dados) : dados;
        await database.ref(`grupos/${grupoId}/${entidade}`).set(dadosParaGravar);
        console.log(`${entidade}: ${Object.keys(dadosParaGravar).length} registros migrados.`);
    }

    console.log('Migração concluída!');
    firebase.app('producao').delete();
};
