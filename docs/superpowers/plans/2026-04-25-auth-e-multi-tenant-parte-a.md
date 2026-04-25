# Auth e Multi-Tenant — Parte A: Fundação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar autenticação Firebase ao app e reestruturar todos os caminhos do banco de dados para o modelo multi-tenant `/grupos/{grupoId}/...`, mantendo todas as funcionalidades existentes intactas para o grupo "Estrelas FC".

**Architecture:** Firebase Auth controla o acesso ao app. O estado global recebe `usuarioAtual`, `grupoAtualId` e `papelNoGrupo`. Todos os `database.ref()` em `firebase.js` ganham o prefixo `/grupos/${grupoAtualId}/`. O bootstrap em `app.js` passa a ser condicional: verifica auth → verifica grupo → inicializa listeners.

**Tech Stack:** Firebase Auth (Google, Email/Password, SMS), Firebase Realtime Database (existente), Vanilla JS, HTML/CSS

---

## Pré-requisito Manual — Novo projeto Firebase de homologação

Antes de tocar em qualquer código, o administrador precisa criar o ambiente de homologação. Este passo não envolve código — é feito no console do Firebase.

- [ ] **Passo 1: Criar branch de homologação**

```bash
git checkout -b homologacao
```

- [ ] **Passo 2: Criar novo projeto Firebase**

Acesse https://console.firebase.google.com → "Adicionar projeto" → nome sugerido: `futebol-estrelas-homolog` → desativar Analytics → Criar.

- [ ] **Passo 3: Ativar Realtime Database**

No console do novo projeto: Build → Realtime Database → Criar banco de dados → Localização: `us-central1` → Iniciar no **modo de teste** (vamos adicionar regras depois).

- [ ] **Passo 4: Ativar Firebase Authentication**

Build → Authentication → Começar → Ativar os três provedores:
- **Google:** ativar, selecionar e-mail de suporte
- **E-mail/senha:** ativar
- **Telefone:** ativar

- [ ] **Passo 5: Obter as credenciais do novo projeto**

Configurações do projeto (ícone de engrenagem) → Seus apps → Adicionar app → Web → registrar app → copiar o objeto `firebaseConfig` exibido. Guardar para o Passo 6.

---

## Task 1: Atualizar index.html — adicionar SDK do Firebase Auth

**Arquivos:**
- Modificar: `index.html`

- [ ] **Passo 1: Adicionar script do Firebase Auth ao `<head>` de `index.html`**

Adicionar logo após a linha do `firebase-database-compat`:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/firebase/9.23.0/firebase-auth-compat.min.js"></script>
```

- [ ] **Passo 2: Adicionar script de `auth.js` e `grupos.js` na ordem de carregamento, ao final do `<body>`**

Substituir o bloco de scripts existente por:

```html
<!-- JS — ordem importa -->
<script src="js/state.js"></script>
<script src="js/firebase.js"></script>
<script src="js/auth.js"></script>
<script src="js/utils.js"></script>
<script src="js/players.js"></script>
<script src="js/import.js"></script>
<script src="js/teams.js"></script>
<script src="js/finance.js"></script>
<script src="js/history.js"></script>
<script src="js/restrictions.js"></script>
<script src="js/grupos.js"></script>
<script src="js/ui.js"></script>
<script src="js/app.js"></script>
```

- [ ] **Passo 3: Verificar no navegador**

Abrir o app no Live Server. O console não deve mostrar erros de "firebase-auth is not defined". O app ainda deve carregar normalmente (ainda não implementamos o guard de auth).

- [ ] **Passo 4: Commit**

```bash
git add index.html
git commit -m "chore: adiciona SDK Firebase Auth e ordem de scripts para multi-tenant"
```

---

## Task 2: Atualizar `js/state.js` — novos campos de estado

**Arquivos:**
- Modificar: `js/state.js`

- [ ] **Passo 1: Substituir o conteúdo de `js/state.js`**

```javascript
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
```

- [ ] **Passo 2: Verificar no navegador**

Abrir o app. O console não deve mostrar erros de variável não definida. O app ainda funciona normalmente.

- [ ] **Passo 3: Commit**

```bash
git add js/state.js
git commit -m "feat: adiciona usuarioAtual, grupoAtualId, papelNoGrupo ao estado global"
```

---

## Task 3: Atualizar `js/firebase.js` — caminhos multi-tenant

Esta é a mudança mais crítica. Todos os `database.ref('entidade')` passam a usar o prefixo `/grupos/${grupoAtualId}/`. A função `initFirebase()` é renomeada para `setupFirebaseApp()` e não inicializa listeners — eles são iniciados separadamente via `inicializarListeners(grupoId)`.

**Arquivos:**
- Modificar: `js/firebase.js`

- [ ] **Passo 1: Substituir o conteúdo completo de `js/firebase.js`**

```javascript
// ==============================================
// firebase.js — Conexão com Firebase e CRUD
// ==============================================

// ATENÇÃO: substituir pelos valores do projeto de homologação
const firebaseConfig = {
    apiKey: "COLE_AQUI_A_API_KEY_DO_PROJETO_HOMOLOG",
    authDomain: "COLE_AQUI.firebaseapp.com",
    databaseURL: "https://COLE_AQUI-default-rtdb.firebaseio.com",
    projectId: "COLE_AQUI",
    storageBucket: "COLE_AQUI.firebasestorage.app",
    messagingSenderId: "COLE_AQUI",
    appId: "COLE_AQUI"
};

// ---------- Setup inicial (sem listeners) ----------

function setupFirebaseApp() {
    try {
        app      = firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        auth     = firebase.auth();
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
    }
}

// ---------- Listeners do grupo ativo ----------

function inicializarListeners(grupoId) {
    carregarSelecaoSalva();

    database.ref(`grupos/${grupoId}/jogadores`).on('value', (snapshot) => {
        jogadores = snapshot.val() || {};
        updateUI();
        updateSyncStatus('synced');
    });

    database.ref(`grupos/${grupoId}/sessoes`).on('value', (snapshot) => {
        sessoes = snapshot.val() || {};
        updateFinanceiroUI();
    });

    database.ref(`grupos/${grupoId}/restricoes`).on('value', (snapshot) => {
        restricoes = snapshot.val() || {};
    });

    database.ref(`grupos/${grupoId}/historicoTimes`).on('value', (snapshot) => {
        historicoTimes = snapshot.val() || {};
        const currentSection = document.querySelector('.content-section.active')?.id;
        if (currentSection === 'historico') exibirHistorico();
    });

    database.ref('.info/connected').on('value', (snapshot) => {
        isOnline = snapshot.val() === true;
        updateSyncStatus(isOnline ? 'synced' : 'offline');
    });
}

function desligarListeners(grupoId) {
    if (!database || !grupoId) return;
    database.ref(`grupos/${grupoId}/jogadores`).off();
    database.ref(`grupos/${grupoId}/sessoes`).off();
    database.ref(`grupos/${grupoId}/restricoes`).off();
    database.ref(`grupos/${grupoId}/historicoTimes`).off();
}

// ---------- Jogadores ----------

function salvarJogador(jogador) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/jogadores/${jogador.id}`).set(jogador);
    } else {
        const local = JSON.parse(localStorage.getItem('jogadoresFutebol') || '{}');
        local[jogador.id] = jogador;
        localStorage.setItem('jogadoresFutebol', JSON.stringify(local));
        jogadores = local;
        updateUI();
    }
}

function removerJogadorDB(id) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/jogadores/${id}`).remove();
    } else {
        const local = JSON.parse(localStorage.getItem('jogadoresFutebol') || '{}');
        delete local[id];
        localStorage.setItem('jogadoresFutebol', JSON.stringify(local));
        jogadores = local;
        updateUI();
    }
}

// ---------- Sessões ----------

function salvarSessaoDB(sessao) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/sessoes/${sessao.id}`).set(sessao);
    } else {
        const local = JSON.parse(localStorage.getItem('sessoesFutebol') || '{}');
        local[sessao.id] = sessao;
        localStorage.setItem('sessoesFutebol', JSON.stringify(local));
        sessoes = local;
        updateFinanceiroUI();
    }
}

function excluirSessaoDB(id) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/sessoes/${id}`).remove();
    } else {
        const local = JSON.parse(localStorage.getItem('sessoesFutebol') || '{}');
        delete local[id];
        localStorage.setItem('sessoesFutebol', JSON.stringify(local));
        sessoes = local;
        updateFinanceiroUI();
    }
}

// ---------- Restrições ----------

function salvarRestricaoDB(restricao) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/restricoes/${restricao.id}`).set(restricao);
    } else {
        const local = JSON.parse(localStorage.getItem('restricoesFutebol') || '{}');
        local[restricao.id] = restricao;
        localStorage.setItem('restricoesFutebol', JSON.stringify(local));
        restricoes = local;
    }
}

function removerRestricaoDB(id) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/restricoes/${id}`).remove();
    } else {
        const local = JSON.parse(localStorage.getItem('restricoesFutebol') || '{}');
        delete local[id];
        localStorage.setItem('restricoesFutebol', JSON.stringify(local));
        restricoes = local;
        exibirRestricoes();
    }
}

// ---------- Histórico ----------

function salvarHistoricoTimes(registro) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/historicoTimes/${registro.id}`).set(registro);
    } else {
        const local = JSON.parse(localStorage.getItem('historicoTimesFutebol') || '{}');
        local[registro.id] = registro;
        localStorage.setItem('historicoTimesFutebol', JSON.stringify(local));
        historicoTimes = local;
    }
}

function excluirHistoricoTimesDB(id) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/historicoTimes/${id}`).remove();
    } else {
        const local = JSON.parse(localStorage.getItem('historicoTimesFutebol') || '{}');
        delete local[id];
        localStorage.setItem('historicoTimesFutebol', JSON.stringify(local));
        historicoTimes = local;
        exibirHistorico();
    }
}

// ---------- Pagamentos ----------

window.marcarPagamento = function(sessaoId, jogadorId, status) {
    if (database && grupoAtualId) {
        updateSyncStatus('syncing');
        database.ref(`grupos/${grupoAtualId}/sessoes/${sessaoId}/pagamentos/${jogadorId}`).set(status);
    } else {
        const local = JSON.parse(localStorage.getItem('sessoesFutebol') || '{}');
        if (local[sessaoId]) {
            local[sessaoId].pagamentos[jogadorId] = status;
            localStorage.setItem('sessoesFutebol', JSON.stringify(local));
            sessoes = local;
            updateFinanceiroUI();
        }
    }
};
```

- [ ] **Passo 2: Preencher o `firebaseConfig` com as credenciais do projeto de homologação**

Substituir todos os `"COLE_AQUI_..."` pelos valores reais obtidos no pré-requisito manual.

- [ ] **Passo 3: Commit**

```bash
git add js/firebase.js
git commit -m "feat: reestrutura firebase.js para caminhos multi-tenant /grupos/{grupoId}/"
```

---

## Task 4: Criar `js/auth.js` — módulo de autenticação

**Arquivos:**
- Criar: `js/auth.js`

- [ ] **Passo 1: Criar `js/auth.js` com o conteúdo abaixo**

```javascript
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

    mostrarApp();
    inicializarListeners(grupoId);
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
    // Aceitável enquanto o número de grupos for pequeno (< alguns milhares).
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
    document.getElementById('mainApp').style.display        = 'none';
}

function mostrarTelaBemVindo() {
    document.getElementById('loadingScreen').style.display  = 'none';
    document.getElementById('telaLogin').style.display      = 'none';
    document.getElementById('telaBemVindo').style.display   = 'flex';
    document.getElementById('mainApp').style.display        = 'none';
}

function mostrarApp() {
    document.getElementById('loadingScreen').style.display  = 'none';
    document.getElementById('telaLogin').style.display      = 'none';
    document.getElementById('telaBemVindo').style.display   = 'none';
    document.getElementById('mainApp').style.display        = 'block';
    hideLoading();
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
        if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
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

window.loginComTelefone = async function() {
    _limparErroLogin();
    const telefone = document.getElementById('loginTelefone').value.trim();
    if (!telefone) {
        _mostrarErroLogin('Digite o número de telefone.');
        return;
    }

    try {
        if (!window._recaptchaVerifier) {
            window._recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptchaContainer', {
                size: 'invisible'
            });
        }
        window._confirmacaoSMS = await auth.signInWithPhoneNumber(telefone, window._recaptchaVerifier);
        document.getElementById('loginTelefoneStep1').style.display = 'none';
        document.getElementById('loginTelefoneStep2').style.display = 'block';
    } catch (err) {
        _mostrarErroLogin('Erro ao enviar SMS. Verifique o número e tente novamente.');
        console.error(err);
    }
};

window.confirmarCodigoSMS = async function() {
    _limparErroLogin();
    const codigo = document.getElementById('loginSMSCodigo').value.trim();
    if (!codigo) {
        _mostrarErroLogin('Digite o código recebido por SMS.');
        return;
    }
    try {
        await window._confirmacaoSMS.confirm(codigo);
    } catch (err) {
        _mostrarErroLogin('Código inválido. Tente novamente.');
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
    document.getElementById('loginOpcoes').style.display      = 'none';
    document.getElementById('loginEmailForm').style.display   = 'block';
    document.getElementById('loginTelefoneForm').style.display = 'none';
};

window.mostrarLoginTelefone = function() {
    document.getElementById('loginOpcoes').style.display      = 'none';
    document.getElementById('loginEmailForm').style.display   = 'none';
    document.getElementById('loginTelefoneForm').style.display = 'block';
};

window.voltarLoginOpcoes = function() {
    document.getElementById('loginOpcoes').style.display      = 'flex';
    document.getElementById('loginEmailForm').style.display   = 'none';
    document.getElementById('loginTelefoneForm').style.display = 'none';
    document.getElementById('loginTelefoneStep1').style.display = 'block';
    document.getElementById('loginTelefoneStep2').style.display = 'none';
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
```

- [ ] **Passo 2: Commit**

```bash
git add js/auth.js
git commit -m "feat: cria auth.js com Firebase Auth (Google, email, SMS) e controle de telas"
```

---

## Task 5: Atualizar `js/app.js` — bootstrap condicional

**Arquivos:**
- Modificar: `js/app.js`

- [ ] **Passo 1: Substituir o listener `DOMContentLoaded` em `js/app.js`**

Substituir:

```javascript
document.addEventListener('DOMContentLoaded', function() {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registrado com sucesso:', registration.scope);
            })
            .catch(error => {
                console.log('Falha no registro do Service Worker:', error);
            });
    }

    initFirebase();

    // Listener para o campo de valor da diária
    document.getElementById('valorDiaria').addEventListener('input', function() {
        atualizarValoresDiaria(this.value);
    });
});
```

Por:

```javascript
document.addEventListener('DOMContentLoaded', function() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .catch(error => console.log('Falha no registro do Service Worker:', error));
    }

    initAuth();

    document.getElementById('valorDiaria')?.addEventListener('input', function() {
        atualizarValoresDiaria(this.value);
    });
});
```

- [ ] **Passo 2: Adicionar `fecharImportModal()` ao handler de Escape (já existe, verificar)**

Confirmar que o Escape handler chama `fecharImportModal()` — já deve estar presente do commit anterior.

- [ ] **Passo 3: Commit**

```bash
git add js/app.js
git commit -m "feat: bootstrap condicional — initAuth substitui initFirebase no DOMContentLoaded"
```

---

## Task 6: Criar tela de login em `index.html` e `style.css`

**Arquivos:**
- Modificar: `index.html`
- Modificar: `style.css`

- [ ] **Passo 1: Adicionar `<div id="telaLogin">` em `index.html`, logo após `<div class="loading" id="loadingScreen">`**

```html
<!-- TELA DE LOGIN -->
<div id="telaLogin" style="display: none;">
    <div class="login-container">
        <div class="login-logo">⚽</div>
        <h1 class="login-titulo">Separador de Times</h1>
        <p class="login-subtitulo">Entre para gerenciar sua pelada</p>

        <div id="loginErro" style="display: none;"></div>

        <!-- Opções principais -->
        <div id="loginOpcoes" style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
            <button class="btn btn-login-google" onclick="loginComGoogle()">
                🔵 Entrar com Google
            </button>
            <button class="btn btn-login-outline" onclick="mostrarLoginEmail()">
                ✉️ Entrar com E-mail
            </button>
            <button class="btn btn-login-outline" onclick="mostrarLoginTelefone()">
                📱 Entrar com Telefone
            </button>
        </div>

        <!-- Form de e-mail -->
        <div id="loginEmailForm" style="display: none; width: 100%;">
            <input type="email" id="loginEmail" placeholder="E-mail" class="login-input">
            <input type="password" id="loginSenha" placeholder="Senha (mín. 6 caracteres)" class="login-input">
            <div style="display: flex; gap: 10px; margin-top: 4px;">
                <button class="btn btn-full" onclick="loginComEmail()">Entrar</button>
                <button class="btn btn-full" onclick="cadastrarComEmail()" style="background: #666;">Cadastrar</button>
            </div>
            <button class="login-voltar-btn" onclick="voltarLoginOpcoes()">← Voltar</button>
        </div>

        <!-- Form de telefone -->
        <div id="loginTelefoneForm" style="display: none; width: 100%;">
            <div id="loginTelefoneStep1">
                <input type="tel" id="loginTelefone" placeholder="+55 11 99999-9999" class="login-input">
                <button class="btn btn-full" onclick="loginComTelefone()">Enviar SMS</button>
            </div>
            <div id="loginTelefoneStep2" style="display: none;">
                <p style="color: #666; font-size: 14px; margin-bottom: 10px;">Digite o código recebido por SMS:</p>
                <input type="text" id="loginSMSCodigo" placeholder="Código de 6 dígitos" class="login-input" maxlength="6">
                <button class="btn btn-full" onclick="confirmarCodigoSMS()">Confirmar</button>
            </div>
            <div id="recaptchaContainer"></div>
            <button class="login-voltar-btn" onclick="voltarLoginOpcoes()">← Voltar</button>
        </div>
    </div>
</div>
```

- [ ] **Passo 2: Adicionar CSS da tela de login ao final de `style.css` (antes dos `@media`)**

```css
/* Tela de Login */
#telaLogin { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; box-sizing: border-box; }
.login-container { background: white; border-radius: 20px; padding: 36px 28px; width: 100%; max-width: 380px; display: flex; flex-direction: column; align-items: center; gap: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }
.login-logo { font-size: 56px; line-height: 1; }
.login-titulo { font-size: 24px; font-weight: 700; color: #1a1a2e; margin: 0; text-align: center; }
.login-subtitulo { font-size: 14px; color: #666; margin: 0; text-align: center; }
.login-input { width: 100%; padding: 14px 16px; border: 1px solid #ddd; border-radius: 10px; font-size: 15px; box-sizing: border-box; margin-bottom: 10px; font-family: inherit; }
.login-input:focus { outline: none; border-color: #4CAF50; }
.btn-login-google { background: #4285F4; color: white; font-size: 15px; font-weight: 600; border-radius: 10px; width: 100%; }
.btn-login-outline { background: white; color: #333; border: 1px solid #ddd; font-size: 15px; border-radius: 10px; width: 100%; }
.btn-login-outline:active { background: #f5f5f5; }
.login-voltar-btn { background: none; border: none; color: #4CAF50; font-size: 14px; cursor: pointer; padding: 8px 0; margin-top: 8px; }
#loginErro { background: #ffebee; color: #c62828; padding: 10px 14px; border-radius: 8px; font-size: 13px; width: 100%; box-sizing: border-box; text-align: center; }
```

- [ ] **Passo 3: Verificar no navegador**

Abrir o app. A tela de login ainda não aparece (auth.js ainda não chama `mostrarTelaLogin()` pois o bootstrap não foi conectado). Inspecionar o elemento `#telaLogin` no DevTools e forçar `display: flex` para validar o visual.

- [ ] **Passo 4: Commit**

```bash
git add index.html style.css
git commit -m "feat: tela de login com Google, e-mail e telefone"
```

---

## Task 7: Criar tela de boas-vindas em `index.html`

**Arquivos:**
- Modificar: `index.html`
- Modificar: `style.css`

- [ ] **Passo 1: Adicionar `<div id="telaBemVindo">` em `index.html`, logo após `#telaLogin`**

```html
<!-- TELA BEM-VINDO (usuário sem grupo) -->
<div id="telaBemVindo" style="display: none;">
    <div class="login-container">
        <div class="login-logo">👋</div>
        <h1 class="login-titulo">Bem-vindo!</h1>
        <p class="login-subtitulo">Crie um grupo ou entre num existente para começar.</p>

        <div style="display: flex; flex-direction: column; gap: 12px; width: 100%;">
            <button class="btn btn-full" onclick="mostrarFormCriarGrupo()">⚽ Criar meu grupo</button>
            <button class="btn btn-full" onclick="mostrarFormEntrarGrupo()" style="background: #666;">🔗 Entrar num grupo</button>
        </div>

        <!-- Form criar grupo -->
        <div id="formCriarGrupo" style="display: none; width: 100%;">
            <h3 style="text-align:center; margin-bottom:14px;">Criar Grupo</h3>
            <input type="text" id="nomeNovoGrupo" placeholder="Nome do grupo (ex: Estrelas FC)" class="login-input">
            <label style="display:flex;align-items:center;gap:8px;font-size:14px;color:#666;margin-bottom:12px;">
                <input type="checkbox" id="grupoVisivel" checked style="width:auto;min-height:0;">
                Aparecer na busca pública
            </label>
            <button class="btn btn-full" id="btnCriarGrupo" onclick="criarGrupo()">Criar Grupo</button>
            <button class="login-voltar-btn" onclick="voltarBemVindo()">← Voltar</button>
        </div>

        <!-- Form entrar por link -->
        <div id="formEntrarGrupo" style="display: none; width: 100%;">
            <h3 style="text-align:center; margin-bottom:14px;">Entrar num Grupo</h3>
            <input type="text" id="linkConviteInput" placeholder="Cole o link de convite aqui" class="login-input">
            <button class="btn btn-full" id="btnEntrarConvite" onclick="entrarPorLinkConvite()">Entrar</button>
            <p id="bemVindoErro" style="display:none;color:#c62828;font-size:13px;text-align:center;"></p>
            <button class="login-voltar-btn" onclick="voltarBemVindo()">← Voltar</button>
        </div>

        <button class="login-voltar-btn" onclick="logout()" style="color:#999;">Sair da conta</button>
    </div>
</div>
```

- [ ] **Passo 2: Adicionar funções de navegação da tela de boas-vindas a `js/grupos.js` (será criado na Task 8)**

Registrar aqui apenas as funções que precisam existir: `mostrarFormCriarGrupo()`, `mostrarFormEntrarGrupo()`, `voltarBemVindo()` — serão implementadas na Task 8.

- [ ] **Passo 3: Commit**

```bash
git add index.html
git commit -m "feat: tela de boas-vindas para usuário sem grupo"
```

---

## Task 8: Criar `js/grupos.js` — criação de grupo e navegação

**Arquivos:**
- Criar: `js/grupos.js`

- [ ] **Passo 1: Criar `js/grupos.js`**

```javascript
// ==============================================
// grupos.js — Gestão de grupos e convites
// ==============================================

// ---------- Navegação da tela de boas-vindas ----------

window.mostrarFormCriarGrupo = function() {
    document.getElementById('formCriarGrupo').style.display  = 'block';
    document.getElementById('formEntrarGrupo').style.display = 'none';
};

window.mostrarFormEntrarGrupo = function() {
    document.getElementById('formCriarGrupo').style.display  = 'none';
    document.getElementById('formEntrarGrupo').style.display = 'block';
};

window.voltarBemVindo = function() {
    document.getElementById('formCriarGrupo').style.display  = 'none';
    document.getElementById('formEntrarGrupo').style.display = 'none';
    document.getElementById('bemVindoErro').style.display    = 'none';
};

// ---------- Criar grupo ----------

window.criarGrupo = async function() {
    const nome = document.getElementById('nomeNovoGrupo').value.trim();
    if (!nome) {
        alert('Digite um nome para o grupo.');
        return;
    }

    const btn = document.getElementById('btnCriarGrupo');
    btn.disabled = true;
    btn.textContent = 'Criando...';

    try {
        const grupoId = Date.now().toString();
        const uid = usuarioAtual.uid;

        await database.ref(`grupos/${grupoId}`).set({
            nome,
            criadoPor: uid,
            criadoEm: new Date().toISOString(),
            visivelNaBusca: document.getElementById('grupoVisivel').checked
        });

        await database.ref(`grupos/${grupoId}/membros/${uid}`).set({
            role: 'admin',
            entradaEm: new Date().toISOString()
        });

        await entrarNoGrupo(grupoId);
    } catch (err) {
        console.error(err);
        alert('Erro ao criar grupo. Tente novamente.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Criar Grupo';
    }
};

// ---------- Convites ----------

window.gerarLinkConvite = async function() {
    if (!grupoAtualId) return;

    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await database.ref(`convites/${token}`).set({
        grupoId: grupoAtualId,
        criadoPor: usuarioAtual.uid,
        criadoEm: new Date().toISOString(),
        expiresAt
    });

    const link = `${location.origin}${location.pathname}?convite=${token}`;
    if (navigator.share) {
        navigator.share({ title: `Convite — ${grupoAtualNome}`, url: link });
    } else {
        navigator.clipboard.writeText(link)
            .then(() => alert('Link copiado para a área de transferência!'))
            .catch(() => prompt('Copie o link abaixo:', link));
    }
};

window.revogarLinkConvite = async function() {
    if (!grupoAtualId) return;
    const snap = await database.ref('convites')
        .orderByChild('grupoId').equalTo(grupoAtualId).get();
    const convites = snap.val() || {};
    const remocoes = Object.keys(convites).map(k => database.ref(`convites/${k}`).remove());
    await Promise.all(remocoes);
    alert('Links anteriores revogados.');
};

window.entrarPorLinkConvite = async function() {
    const input = document.getElementById('linkConviteInput').value.trim();
    const erroEl = document.getElementById('bemVindoErro');
    erroEl.style.display = 'none';

    const token = _extrairTokenDoLink(input);
    if (!token) {
        erroEl.textContent = 'Link inválido. Verifique e tente novamente.';
        erroEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('btnEntrarConvite');
    btn.disabled = true;
    btn.textContent = 'Verificando...';

    try {
        const snap = await database.ref(`convites/${token}`).get();
        const convite = snap.val();

        if (!convite) {
            erroEl.textContent = 'Convite não encontrado.';
            erroEl.style.display = 'block';
            return;
        }

        if (new Date(convite.expiresAt) < new Date()) {
            erroEl.textContent = 'Este convite expirou. Peça um novo link ao administrador.';
            erroEl.style.display = 'block';
            return;
        }

        await database.ref(`grupos/${convite.grupoId}/membros/${usuarioAtual.uid}`).set({
            role: 'membro',
            entradaEm: new Date().toISOString()
        });

        await entrarNoGrupo(convite.grupoId);
    } catch (err) {
        console.error(err);
        erroEl.textContent = 'Erro ao processar convite. Tente novamente.';
        erroEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Entrar';
    }
};

function _extrairTokenDoLink(input) {
    try {
        const url = new URL(input);
        return url.searchParams.get('convite');
    } catch {
        return input.length > 5 ? input : null;
    }
}

// ---------- Verificar link de convite na URL ao carregar ----------

window.verificarConviteNaURL = async function() {
    const params = new URLSearchParams(location.search);
    const token = params.get('convite');
    if (!token || !usuarioAtual) return;

    history.replaceState({}, '', location.pathname);

    const snap = await database.ref(`convites/${token}`).get();
    const convite = snap.val();
    if (!convite || new Date(convite.expiresAt) < new Date()) return;

    await database.ref(`grupos/${convite.grupoId}/membros/${usuarioAtual.uid}`).set({
        role: 'membro',
        entradaEm: new Date().toISOString()
    });

    await entrarNoGrupo(convite.grupoId);
};
```

- [ ] **Passo 2: Chamar `verificarConviteNaURL()` em `js/auth.js` após autenticação**

Em `auth.js`, dentro de `auth.onAuthStateChanged`, após `await _salvarOuAtualizarUsuario(user)`, adicionar:

```javascript
await verificarConviteNaURL();
```

> Nota: `verificarConviteNaURL` é definida em `grupos.js`, que é carregado após `auth.js`. A chamada acontece dentro de `onAuthStateChanged`, que dispara de forma assíncrona após todos os scripts serem carregados — portanto a função já existe quando executada.

- [ ] **Passo 3: Commit**

```bash
git add js/grupos.js js/auth.js
git commit -m "feat: grupos.js — criar grupo, gerar/revogar/entrar por link de convite"
```

---

## Task 9: Script de migração — `js/migration.js`

Este script é executado uma única vez, manualmente, pelo administrador através do console do navegador.

**Arquivos:**
- Criar: `js/migration.js` (não incluído na ordem de carregamento do index.html — chamado manualmente)

- [ ] **Passo 1: Criar `js/migration.js`**

```javascript
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

window.migrarDadosParaGrupo = async function(grupoId) {
    if (!grupoId) { console.error('Informe o grupoId'); return; }
    if (!usuarioAtual) { console.error('Faça login antes de migrar'); return; }

    console.log('Iniciando migração para grupo:', grupoId);

    // Conectar ao banco de produção em paralelo
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

        // Verificar idempotência — não sobrescrever se já existir
        const destSnap = await database.ref(`grupos/${grupoId}/${entidade}`).get();
        if (destSnap.exists()) {
            console.log(`${entidade}: já migrado, pulando.`);
            continue;
        }

        await database.ref(`grupos/${grupoId}/${entidade}`).set(dados);
        console.log(`${entidade}: ${Object.keys(dados).length} registros migrados.`);
    }

    console.log('Migração concluída!');
    firebase.app('producao').delete();
};
```

- [ ] **Passo 2: Carregar temporariamente o script de migração**

Adicionar temporariamente ao final do `<body>` em `index.html` (remover após a migração):

```html
<script src="js/migration.js"></script>
```

- [ ] **Passo 3: Executar a migração**

1. Abrir o app de homologação no navegador e fazer login
2. Criar o grupo "Estrelas FC" pela tela de boas-vindas
3. Copiar o ID do grupo da URL do Firebase Console (ou do localStorage: `localStorage.getItem('ultimoGrupoId')`)
4. Abrir o console do navegador e executar:

```javascript
migrarDadosParaGrupo('ID_DO_GRUPO_AQUI')
```

5. Acompanhar os logs no console até ver "Migração concluída!"
6. Remover `<script src="js/migration.js"></script>` do `index.html`

- [ ] **Passo 4: Verificar**

Após a migração, recarregar o app. Os jogadores, sessões, restrições e histórico do Estrelas FC devem aparecer normalmente.

- [ ] **Passo 5: Commit**

```bash
git add js/migration.js
git commit -m "feat: script de migração one-shot do banco de produção para multi-tenant"
```

---

## Task 10: Adicionar botão de logout ao sidebar + verificação final

**Arquivos:**
- Modificar: `index.html`

- [ ] **Passo 1: Adicionar botão de logout no rodapé do sidebar em `index.html`**

Substituir o rodapé do sidebar:

```html
<div style="padding: 15px; border-top: 1px solid #e0e0e0; margin-top: auto;">
    <div id="sidebarSyncStatus" style="font-size: 12px; color: #666; display: flex; align-items: center; gap: 8px;">
        🟢 Sincronizado
    </div>
</div>
```

Por:

```html
<div style="padding: 15px; border-top: 1px solid #e0e0e0; margin-top: auto; display: flex; flex-direction: column; gap: 10px;">
    <div id="sidebarSyncStatus" style="font-size: 12px; color: #666; display: flex; align-items: center; gap: 8px;">
        🟢 Sincronizado
    </div>
    <div id="sidebarUsuario" style="font-size: 12px; color: #666;"></div>
    <button onclick="logout()" style="background: none; border: 1px solid #ddd; border-radius: 8px; padding: 8px; font-size: 13px; color: #666; cursor: pointer;">
        🚪 Sair da conta
    </button>
</div>
```

- [ ] **Passo 2: Exibir nome do usuário no sidebar após login**

Em `js/auth.js`, dentro de `mostrarApp()`, adicionar:

```javascript
function mostrarApp() {
    document.getElementById('loadingScreen').style.display  = 'none';
    document.getElementById('telaLogin').style.display      = 'none';
    document.getElementById('telaBemVindo').style.display   = 'none';
    document.getElementById('mainApp').style.display        = 'block';
    hideLoading();

    const el = document.getElementById('sidebarUsuario');
    if (el && usuarioAtual) {
        el.textContent = usuarioAtual.displayName || usuarioAtual.email || 'Usuário';
    }
}
```

- [ ] **Passo 3: Teste completo do fluxo**

Verificar cada cenário no navegador:

1. Abrir app sem login → tela de login aparece
2. Login com Google → se usuário sem grupo, tela de boas-vindas
3. Criar grupo → app carrega com dados vazios
4. Executar migração → dados do Estrelas FC aparecem
5. Logout → volta para tela de login
6. Login novamente → app carrega direto no grupo Estrelas FC
7. Todas as funcionalidades existentes (times, financeiro, histórico, importação) funcionam normalmente

- [ ] **Passo 4: Commit final do Plano A**

```bash
git add index.html js/auth.js
git commit -m "feat: logout no sidebar e exibição do nome do usuário autenticado"
```

---

## Resultado do Plano A

Ao final destas tasks, o app de homologação:

- Exige login para acessar qualquer funcionalidade
- Dados ficam isolados por grupo no Firebase (`/grupos/{grupoId}/...`)
- O grupo "Estrelas FC" tem todos os dados migrados de produção
- Logout limpa o estado e volta para a tela de login
- Link de convite de 7 dias funciona para convidar novos membros
- Todas as funcionalidades existentes (times, financeiro, histórico, importação) continuam funcionando

O Plano B adicionará: busca de grupos, solicitações de entrada, gestão de membros, guards de permissão por papel e o painel "Meus grupos" no sidebar.
