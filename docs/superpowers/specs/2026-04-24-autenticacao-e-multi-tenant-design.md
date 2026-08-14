# Autenticação e Multi-Tenant — Design Spec

## Objetivo

Transformar o app de uma ferramenta single-tenant (um único grupo fixo) em uma plataforma multi-tenant onde múltiplos grupos de pelada podem se cadastrar, gerenciar seus jogadores de forma isolada e crescer de forma independente.

---

## Contexto do Projeto

- Vanilla JS, sem 
build step, sem ES6 modules — variáveis globais, padrão `window.X`
- Firebase Realtime Database com dados reais do grupo "Estrelas FC" em produção
- Mobile-first (320px–768px), touch
- Stack não muda — sem migração para framework
- Ambiente de homologação: novo projeto Firebase separado do de produção

---

## Abordagem Escolhida

**Novo projeto Firebase para homologação.** A produção nunca é tocada durante o desenvolvimento. Quando tudo estiver validado, um script de migração roda apontando para o banco de produção. Os dados do "Estrelas FC" são migrados automaticamente para a nova estrutura.

---

## 1. Nova Estrutura de Dados

A mudança central: todos os dados passam a viver sob `/grupos/{grupoId}/`. A estrutura interna de cada entidade (jogadores, sessões, restrições, histórico) permanece idêntica — só o caminho no banco muda.

```
/usuarios/{userId}
    nome: string
    fotoUrl: string | null
    criadoEm: ISO string

/grupos/{grupoId}
    nome: string
    criadoPor: userId
    criadoEm: ISO string
    visivelNaBusca: boolean

/grupos/{grupoId}/membros/{userId}
    role: "admin" | "membro"
    entradaEm: ISO string

/grupos/{grupoId}/jogadores/{jogadorId}
    (estrutura idêntica à atual)

/grupos/{grupoId}/sessoes/{sessaoId}
    (estrutura idêntica à atual)

/grupos/{grupoId}/restricoes/{restricaoId}
    (estrutura idêntica à atual)

/grupos/{grupoId}/historicoTimes/{historicoId}
    (estrutura idêntica à atual)

/convites/{token}
    grupoId: string
    criadoPor: userId
    criadoEm: ISO string
    expiresAt: ISO string  (criadoEm + 7 dias, fixo)

/solicitacoes/{grupoId}/{userId}
    nome: string
    fotoUrl: string | null
    criadoEm: ISO string
    status: "pendente" | "recusada"
    recusadaEm: ISO string | null
```

---

## 2. Autenticação

Provedor: **Firebase Auth** (já disponível no projeto Firebase).

Três métodos de login:
- Google (OAuth)
- Email + senha
- Número de telefone (SMS)

### Estados do app

| Estado | Condição | Tela exibida |
|---|---|---|
| Não autenticado | Sem sessão ativa | Tela de login |
| Autenticado, sem grupo | Usuário novo | Tela de boas-vindas |
| Autenticado, um grupo | Membro de exatamente um grupo | App direto no grupo |
| Autenticado, múltiplos grupos | Membro de 2+ grupos | App no último grupo acessado |

Em todos os estados autenticados, o menu lateral expõe "Meus grupos" para criar ou entrar em outros grupos. O último grupo acessado é salvo no localStorage para que o app abra diretamente nele na próxima sessão.

---

## 3. Papéis e Permissões

Dois papéis: **admin** e **membro**.

| Ação | Admin | Membro |
|---|---|---|
| Marcar presença (qualquer jogador da lista) | ✅ | ✅ |
| Ver times formados | ✅ | ✅ |
| Ver próprio saldo financeiro | ✅ | ✅ |
| Confirmar times | ✅ | ❌ |
| Redistribuir times | ✅ | ❌ |
| Editar estrelas de jogador | ✅ | ❌ |
| Cadastrar jogador | ✅ | ❌ |
| Importar lista WhatsApp | ✅ | ❌ |
| Controle financeiro completo | ✅ | ❌ |
| Gestão de membros do grupo | ✅ | ❌ |
| Gerar link de convite | ✅ | ❌ |
| Configurações do grupo | ✅ | ❌ |

Quando um membro acessa uma ação restrita, o elemento simplesmente não é exibido — sem mensagem de erro, sem botão desabilitado.

---

## 4. Grupos — Criação e Entrada

### Criar um grupo
- Admin define: nome do grupo e visibilidade na busca (público ou privado)
- Criador vira admin automaticamente
- Um usuário pode administrar múltiplos grupos

### Entrar por link de convite
- Admin gera o link dentro do app (menu de gestão do grupo)
- Link tem validade fixa de **7 dias**
- Quem acessa o link entra direto, sem aprovação
- Admin pode revogar o link atual e gerar um novo a qualquer momento
- Ao revogar, links anteriores param de funcionar imediatamente

### Entrar por busca
- Disponível apenas para grupos com `visivelNaBusca: true`
- Usuário pesquisa pelo nome do grupo
- Envia solicitação de entrada
- Admin recebe notificação e aprova ou recusa
- Solicitação recusada pode ser reenviada após 24h

---

## 5. Interface — Mudanças

### Telas novas

**Tela de login**
- Exibida para qualquer usuário não autenticado
- Três botões: Google, Email+Senha, Telefone
- Sem navegação para outras partes do app sem autenticação

**Tela de boas-vindas**
- Exibida após primeiro login (usuário sem grupo)
- Dois botões: "Criar meu grupo" e "Entrar num grupo"

**Meus grupos** (acessível pelo menu lateral)
- Lista de grupos do usuário com nome e papel (admin/membro)
- Botão para criar novo grupo
- Botão para entrar num grupo (link ou busca)
- Tap em um grupo muda o contexto do app para aquele grupo

### Menu lateral — novas seções (admin)

- **Gestão do grupo:** lista de membros, solicitações pendentes, gerar/revogar link de convite
- **Configurações:** nome do grupo, visibilidade na busca

### Comportamento condicional

Elementos restritos a admin simplesmente não são renderizados para membros. A lógica de renderização verifica o papel do usuário autenticado no grupo atual antes de gerar o HTML de cada seção.

---

## 6. Migração dos Dados Existentes

Script de migração executado uma vez, manualmente, antes do primeiro uso do novo ambiente.

**Sequência:**
1. Admin faz login no novo app com sua conta
2. Script lê todos os dados do Firebase atual (flat) e grava no novo Firebase sob `/grupos/{grupoId}/...`
3. Cria o grupo "Estrelas FC" com o admin logado como criador
4. Copia jogadores, sessões, restrições e histórico de times preservando todos os campos existentes
5. Adiciona o admin como único membro inicial com `role: "admin"`

**Ambiente de homologação:** script aponta para o novo Firebase de homologação. Produção intacta.

**Ambiente de produção (quando for a hora):** mesmo script, apontando para o Firebase de produção. Roda uma única vez.

---

## 7. Arquivos Modificados

### Novos
- `js/auth.js` — inicialização do Firebase Auth, estado de autenticação, login/logout
- `js/grupos.js` — criação de grupo, entrada por link, busca, gestão de membros
- `js/migration.js` — script de migração one-shot (usado só no setup)
- Telas HTML: login, boas-vindas, meus grupos, gestão do grupo

### Modificados
- `js/firebase.js` — todos os caminhos de leitura/escrita passam a incluir `/grupos/{grupoId}/`
- `js/state.js` — adicionar `usuarioAtual`, `grupoAtual`, `papelNoGrupo`
- `js/app.js` — bootstrap condicional: verifica auth antes de inicializar o app
- `js/players.js`, `teams.js`, `finance.js`, `history.js`, `restrictions.js`, `import.js` — guard de permissão nas funções restritas a admin
- `index.html` — adicionar telas de login, boas-vindas e gestão; condicionais de renderização por papel
- `style.css` — estilos das telas novas

### Ordem de carregamento atualizada
```
state.js → firebase.js → auth.js → utils.js → players.js → import.js
→ teams.js → finance.js → history.js → restrictions.js → grupos.js
→ ui.js → app.js
```

---

## Restrições

- Não alterar a estrutura interna dos documentos existentes (jogadores, sessões, etc.)
- Sem alert() para erros de autenticação — usar feedback inline
- Firebase Security Rules devem impedir que um usuário leia dados de um grupo do qual não é membro
- O app deve continuar funcionando offline para ações de leitura (localStorage como fallback)
- Migração é idempotente: rodar duas vezes não duplica dados
