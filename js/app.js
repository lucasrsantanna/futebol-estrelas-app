// ==============================================
// app.js — Bootstrap e event listeners globais
// Carregado por último, depois de todos os módulos
// ==============================================

// ---------- Inicialização ----------

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

// ---------- Event listeners de modais (fechar ao clicar fora) ----------

document.addEventListener('click', function(e) {
    const modais = [
        { id: 'editModal',          fn: fecharModal              },
        { id: 'aprovacaoModal',     fn: cancelarAprovacao        },
        { id: 'sessaoModal',        fn: fecharSessaoModal        },
        { id: 'restricoesModal',    fn: fecharModalRestricoes    },
        { id: 'confirmDeleteModal', fn: cancelarExclusao         },
        { id: 'quickAddModal',      fn: fecharCadastroRapido     },
        { id: 'historicoViewModal', fn: fecharHistoricoView      },
    ];
    modais.forEach(({ id, fn }) => {
        if (e.target === document.getElementById(id)) fn();
    });
});

// ---------- Tecla Escape fecha tudo ----------

document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    closeSidebar();
    fecharModal();
    fecharSessaoModal();
    fecharModalRestricoes();
    fecharCadastroRapido();
    fecharHistoricoView();
    document.getElementById('aprovacaoModal').style.display     = 'none';
    document.getElementById('confirmDeleteModal').style.display = 'none';
    ultimaDistribuicao           = null;
    timesFormados                = null;
    selectedPlayersForRestriction = [];
    sessaoParaExcluir            = null;
    historicoParaExcluir         = null;
});

// ---------- Online / Offline ----------

window.addEventListener('online',  () => { isOnline = true;  updateSyncStatus('synced');  });
window.addEventListener('offline', () => { isOnline = false; updateSyncStatus('offline'); });

// Touch — evita delay em iOS
document.addEventListener('touchstart', function() {}, true);
