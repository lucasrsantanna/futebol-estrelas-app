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
