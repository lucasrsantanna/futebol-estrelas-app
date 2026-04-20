# CLAUDE.md — Gerenciador de Times de Futebol

## ⚠️ REGRA MAIS IMPORTANTE
O Firebase de produção já está ativo com dados reais (jogadores, sessões de pagamento,
histórico de times, restrições). NUNCA recriar, limpar ou migrar o banco de dados.
Todas as mudanças devem ser aditivas e compatíveis com a estrutura existente.

---

## O que é o projeto
Aplicativo web mobile-first para gerenciar peladas mensais de futebol.
Funcionalidades: presença de jogadores, separação de times equilibrados com algoritmo
de balanceamento por estrelas, controle financeiro de jogadores avulsos (pagamentos
pendentes/pagos), histórico de times, restrições entre jogadores (não podem ficar no
mesmo time), cadastro rápido via FAB.

## Stack
- HTML + CSS + Vanilla JS — sem frameworks, sem build step
- Firebase Realtime Database — backend e sync em tempo real entre dispositivos
- Fallback para localStorage em modo offline
- Mobile-first com suporte a safe-area (iOS notch), touch, vibração

## Estrutura de arquivos
```
gerenciador-de-times/
├── CLAUDE.md          ← este arquivo
├── index.html         ← estrutura HTML pura (sem CSS/JS inline)
├── style.css          ← todo o CSS mobile-first
├── README.md
└── js/
    ├── state.js       ← variáveis globais compartilhadas entre módulos
    ├── firebase.js    ← config Firebase + CRUD (jogadores, sessões, restrições, histórico)
    ├── utils.js       ← funções puras (ordenar, embaralhar, estrelas, pendências)
    ├── players.js     ← cadastro, edição, presença, FAB, pesquisa
    ├── teams.js       ← algoritmo de separação + modal de aprovação
    ├── finance.js     ← sessões, pendências, controle de pagamentos
    ├── history.js     ← histórico de times
    ├── restrictions.js← modal e lógica de restrições entre jogadores
    ├── ui.js          ← sidebar, navegação, sync status, modais genéricos
    └── app.js         ← bootstrap + event listeners globais (carregado por último)
```

## Firebase — Produção (NÃO ALTERAR)
```javascript
const firebaseConfig = {
    apiKey: "AIzaSyAHTD1vEIh8ehAFR2M4APiE8Ky9HEAuPU",
    authDomain: "futebol-estrelas.firebaseapp.com",
    databaseURL: "https://futebol-estrelas-default-rtdb.firebaseio.com",
    projectId: "futebol-estrelas",
    storageBucket: "futebol-estrelas.firebasestorage.app",
    messagingSenderId: "96538381574",
    appId: "1:96538381574:web:dee50b846e46a898aeaecf"
};
```

## Estrutura do banco de dados Firebase (existente, com dados reais)
```
futebol-estrelas-default-rtdb/
├── jogadores/
│   └── {timestamp_id}/
│       ├── id: string
│       ├── nome: string
│       ├── estrelas: number (1-10)
│       ├── tipo: "mensalista" | "avulso"
│       └── criadoEm: ISO string
│
├── sessoes/
│   └── {timestamp_id}/
│       ├── id: string
│       ├── data: "YYYY-MM-DD"
│       ├── valorDiaria: number
│       ├── todosPresentes: [array de IDs]
│       ├── times: [array de arrays de jogadores]
│       └── pagamentos/
│           └── {jogador_id}: "pendente" | "pago" | "mensalista"
│
├── restricoes/
│   └── {timestamp_id}/
│       ├── id: string
│       ├── jogadores: [array de IDs]
│       └── criadaEm: ISO string
│
└── historicoTimes/
    └── {timestamp_id}/
        ├── id: string
        ├── data: ISO string
        ├── times: [array de arrays]
        ├── totalJogadores: number
        └── genericosAdicionados: number
```

## Regras de desenvolvimento
1. NUNCA alterar a estrutura do banco Firebase — apenas adicionar campos novos opcionais
2. NUNCA apagar dados existentes no banco
3. Todo novo campo no Firebase deve ter valor default para compatibilidade com registros antigos
4. Manter fallback localStorage funcionando para modo offline
5. Toda mudança visual deve continuar funcionando em mobile (320px–768px+)
6. Scripts carregados na ordem: state.js → firebase.js → utils.js → módulos → app.js
7. Funções expostas ao HTML devem ser atribuídas ao `window` (ex: `window.togglePresenca`)
8. Testar no Live Server antes de qualquer commit

## Padrões de código existentes
- IDs gerados com `Date.now().toString()`
- Estado global em variáveis soltas (não usa classes ou módulos ES6)
- Funções de render retornam HTML como string e usam `.innerHTML`
- Modais são `display: none` / `display: flex` — não usar outras abordagens
- Feedback ao usuário via `alert()` — manter consistência por ora

## Funcionalidades implementadas (NÃO reimplementar)
- [x] Separação de times com balanceamento por estrelas
- [x] Algoritmo com restrições (jogadores que não podem ficar juntos)
- [x] Jogadores genéricos quando faltam jogadores para completar times
- [x] Modal de aprovação antes de confirmar distribuição
- [x] Cadastro rápido via FAB (botão flutuante)
- [x] Presença salva no localStorage entre sessões
- [x] Pesquisa e filtros na lista de presença
- [x] Separação visual mensalistas/avulsos
- [x] Badge de pendência financeira na lista de presença
- [x] Controle financeiro com toggle de pagamento
- [x] Histórico de times com visualização detalhada
- [x] Modo offline com localStorage
- [x] Indicador de sync Firebase
- [x] PWA — manifest.json + service worker para instalar no celular

## Funcionalidades pendentes (próximas a implementar)
- [ ] Compartilhamento via WhatsApp dos times formados
- [ ] Firebase Authentication — admin vs jogador comum
- [ ] Notificações push quando times forem separados

## Contexto do negócio
- Grupo de futebol mensal com jogadores fixos (mensalistas) e eventuais (avulsos)
- Avulsos pagam por sessão (valor configurável, padrão R$ 15,00)
- Mensalistas não precisam pagar por sessão
- Times são sempre de 5 jogadores cada
- Há dados reais acumulados: jogadores cadastrados, histórico de jogos, cobranças em aberto
- Qualquer bug financeiro impacta cobranças reais — atenção redobrada nessa área
