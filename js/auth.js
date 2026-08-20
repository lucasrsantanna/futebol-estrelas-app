// ==============================================
// auth.js — Autenticação Firebase
// ==============================================

// ---------- Inicialização ----------

function initAuth() {
    setupFirebaseApp();

    auth.onAuthStateChanged(async (user) => {
        if (!user) {
            mostrarTelaLogin();
            return;
        }

        usuarioAtual = user;
        await _salvarOuAtualizarUsuario(user);
        await verificarConviteNaURL();

        const grupos = await _carregarGruposDoUsuario(user.uid);

        if (grupos.length === 0) {
            mostrarTelaBemVindo();
            return;
        }

        const ultimoGrupoId = localStorage.getItem('ultimoGrupoId');
        const grupoId = grupos.find(g => g.id === ultimoGrupoId)
            ? ultimoGrupoId
            : grupos[0].id;

        await entrarNoGrupo(grupoId);
    });
}

async function entrarNoGrupo(grupoId) {
    if (grupoAtualId) desligarListeners(grupoAtualId);

    grupoAtualId = grupoId;
    localStorage.setItem('ultimoGrupoId', grupoId);

    const snapshot = await database.ref(`grupos/${grupoId}`).get();
    const grupo = snapshot.val();
    grupoAtualNome = grupo?.nome || '';

    const membroSnap = await database.ref(`grupos/${grupoId}/membros/${usuarioAtual.uid}`).get();
    papelNoGrupo = membroSnap.val()?.role || 'membro';

    await resolverVinculoJogador(grupoId);
}

// ---------- Helpers privados ----------

async function _salvarOuAtualizarUsuario(user) {
    await database.ref(`usuarios/${user.uid}`).set({
        nome: user.displayName || user.email || user.phoneNumber || 'Usuário',
        fotoUrl: user.photoURL || null,
        criadoEm: new Date().toISOString()
    });
}

async function _carregarGruposDoUsuario(uid) {
    // Firebase RTDB não suporta filtro por chave aninhada — carregamos todos e filtramos no cliente.
    const todosGrupos = (await database.ref('grupos').get()).val() || {};
    return Object.entries(todosGrupos)
        .filter(([, g]) => g.membros && g.membros[uid])
        .map(([id, g]) => ({ id, nome: g.nome }));
}

// ---------- Controle de telas ----------

function mostrarTelaLogin() {
    document.getElementById('loadingScreen').style.display  = 'none';
    document.getElementById('telaLogin').style.display      = 'flex';
    document.getElementById('telaBemVindo').style.display   = 'none';
    document.getElementById('telaAutoclaim').style.display  = 'none';
    document.getElementById('mainApp').style.display        = 'none';
}

function mostrarTelaBemVindo() {
    document.getElementById('loadingScreen').style.display  = 'none';
    document.getElementById('telaLogin').style.display      = 'none';
    document.getElementById('telaBemVindo').style.display   = 'flex';
    document.getElementById('telaAutoclaim').style.display  = 'none';
    document.getElementById('mainApp').style.display        = 'none';
}

function mostrarApp() {
    document.getElementById('loadingScreen').style.display  = 'none';
    document.getElementById('telaLogin').style.display      = 'none';
    document.getElementById('telaBemVindo').style.display   = 'none';
    document.getElementById('telaAutoclaim').style.display  = 'none';
    document.getElementById('mainApp').style.display        = 'block';
    hideLoading();

    const el = document.getElementById('sidebarUsuario');
    if (el && usuarioAtual) {
        el.textContent = usuarioAtual.displayName || usuarioAtual.email || 'Usuário';
    }
    atualizarMenuPorPapel();
}

// ---------- Login ----------

window.loginComGoogle = async function() {
    _limparErroLogin();
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
    } catch (err) {
        _mostrarErroLogin('Não foi possível entrar com Google. Tente novamente.');
        console.error(err);
    }
};

window.loginComEmail = async function() {
    _limparErroLogin();
    const email = document.getElementById('loginEmail').value.trim();
    const senha  = document.getElementById('loginSenha').value;

    if (!email || !senha) {
        _mostrarErroLogin('Preencha e-mail e senha.');
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, senha);
    } catch (err) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            _mostrarErroLogin('E-mail ou senha incorretos.');
        } else if (err.code === 'auth/invalid-email') {
            _mostrarErroLogin('E-mail inválido.');
        } else {
            _mostrarErroLogin('Erro ao entrar. Tente novamente.');
        }
        console.error(err);
    }
};

window.cadastrarComEmail = async function() {
    _limparErroLogin();
    const email = document.getElementById('loginEmail').value.trim();
    const senha  = document.getElementById('loginSenha').value;

    if (!email || !senha) {
        _mostrarErroLogin('Preencha e-mail e senha.');
        return;
    }
    if (senha.length < 6) {
        _mostrarErroLogin('Senha precisa ter ao menos 6 caracteres.');
        return;
    }

    try {
        await auth.createUserWithEmailAndPassword(email, senha);
    } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
            _mostrarErroLogin('E-mail já cadastrado. Faça login.');
        } else {
            _mostrarErroLogin('Erro ao cadastrar. Tente novamente.');
        }
        console.error(err);
    }
};

window.logout = async function() {
    desligarListeners(grupoAtualId);
    grupoAtualId   = null;
    grupoAtualNome = null;
    papelNoGrupo   = null;
    usuarioAtual   = null;
    jogadores      = {};
    sessoes        = {};
    restricoes     = {};
    historicoTimes = {};
    await auth.signOut();
};

// ---------- Alternância entre métodos de login ----------

window.mostrarLoginEmail = function() {
    document.getElementById('loginOpcoes').style.display       = 'none';
    document.getElementById('loginEmailForm').style.display    = 'block';
};

window.voltarLoginOpcoes = function() {
    document.getElementById('loginOpcoes').style.display       = 'flex';
    document.getElementById('loginEmailForm').style.display    = 'none';
    _limparErroLogin();
};

function _mostrarErroLogin(msg) {
    const el = document.getElementById('loginErro');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function _limparErroLogin() {
    const el = document.getElementById('loginErro');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
}
