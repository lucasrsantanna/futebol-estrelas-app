# Plataforma Social de Peladas — Navegação e Produto

## Objetivo

Transformar o app de gerenciamento de times num aplicativo de rede social para amantes de futebol, onde qualquer pessoa pode descobrir e participar de peladas próximas sem precisar conhecer o grupo previamente.

---

## Visão do Produto

Plataforma pública mobile-first onde:
- **Organizadores** criam e gerenciam suas peladas
- **Jogadores** encontram peladas abertas por localização, nível e disponibilidade
- Qualquer usuário pode ser admin de um grupo e membro de outro simultaneamente — os papéis são fluídos por grupo, não globais

---

## Papéis

Dois papéis, sem hierarquia global:

| Papel | Onde se aplica | O que pode |
|---|---|---|
| **Admin** | Dentro do próprio grupo | Publicar sessão, postar aviso, confirmar times, gerenciar membros, gerar link de convite, controle financeiro |
| **Membro** | Dentro do próprio grupo | Ver informações, confirmar presença, checar times e financeiro pessoal |

Fora do contexto do próprio grupo (ex: na tela Descobrir), admin e membro têm a mesma experiência — ambos são jogadores buscando peladas.

---

## Navegação — Bottom Tab Bar

Cinco abas fixas na parte inferior da tela:

| Posição | Aba | Ícone | Acesso sem conta |
|---|---|---|---|
| 1 | **Descobrir** | 🔍 | Sim (leitura apenas) |
| 2 | **Meus Grupos** | 👥 | Não — redireciona ao login |
| 3 | **+** | ➕ | Não — redireciona ao login |
| 4 | **Notificações** | 🔔 | Não — redireciona ao login |
| 5 | **Perfil** | 👤 | Não — redireciona ao login |

**Sidebar removido** como navegação principal. Vira menu de contexto do grupo ativo (ícone ⚙️ no header da tela do grupo), visível apenas para admin.

---

## Telas

### 1. Descobrir

Feed de peladas abertas. Tela inicial do app para qualquer usuário.

**Card de pelada:**
- Nome do grupo + avatar
- Localização (bairro/cidade) + distância aproximada
- Próxima data e horário
- Nível técnico: Família / Amador / Bom de bola / Craque / Elite
- Estilo: Zoeira ou Competitivo
- Vagas abertas (ex: "3 vagas")
- Preço da diária (ex: R$ 15)
- Botão "Solicitar vaga" / "Ver pelada"

**Filtros (barra fixa no topo):**
- Localização (automática ou manual)
- Nível técnico (Família → Elite)
- Estilo (Zoeira / Competitivo)
- Dia da semana
- Toggle "Apenas com vagas abertas"

**Comportamento para usuário sem conta:**
- Pode navegar e ver todos os cards normalmente
- Ao tentar solicitar vaga: prompt amigável — "Faça login ou crie sua conta para pedir para jogar com essa galera!" com botão que leva à tela de login/cadastro

**Estado vazio:** sugestão de ampliar raio de busca quando não há peladas próximas.

---

### 2. Meus Grupos

Lista de todos os grupos que o usuário participa (como admin ou membro).

**Conteúdo:**
- Card por grupo: nome, papel (Admin / Membro), próxima sessão
- Tap num grupo → abre dashboard do grupo
- Ações de criar/entrar em grupo disponíveis via botão + da tab bar

---

### 3. Dashboard do Grupo

Acessado via Meus Grupos → tap no grupo. Organizado em blocos verticais:

**Bloco 1 — Próxima Sessão** (sempre no topo)
- Data, horário e local
- Contador: confirmados vs. esperados + barra de progresso
- Valor da diária
- Botão "Confirmar Presença" (destaque)

**Bloco 2 — Seu Perfil no Grupo**
- Foto + nome + tipo (Mensalista / Avulso) + papel (Admin / Membro)
- Nível de estrelas nesse grupo especificamente: `4 ⭐`
- Status financeiro: Pago / Pendente / Mensalista
- Total de peladas jogadas nesse grupo

**Bloco 3 — Aviso Fixado**
- Recado pinado pelo admin
- Nome do autor + tempo decorrido
- Visível para todos; só admin pode criar/editar

**Bloco 4 — Times**
- Aparece apagado/placeholder até o admin confirmar os times
- Quando formados: exibe os times da próxima sessão

**Bloco 5 — Membros**
- Pílulas com inicial + nível: `R 3 ⭐`
- Link "Ver todos" → lista completa com estrelas e tipo

**Bloco extra (somente admin) — Gestão**
Acessado pelo ícone ⚙️ no header:
- Lista de membros com opção de remover / alterar nível
- Solicitações de entrada pendentes (aprovar / recusar)
- Gerar / revogar link de convite
- Configurações do grupo (nome, visibilidade na busca)
- Controle de pagamentos da sessão

---

### 4. Botão + (Ação Principal)

Abre um bottom sheet com opções. As duas primeiras são sempre fixas para qualquer usuário autenticado; as demais aparecem conforme contexto:

| Opção | Quem vê | Quando aparece |
|---|---|---|
| **Criar grupo** | Qualquer usuário autenticado | Sempre |
| **Solicitar participação em grupo** | Qualquer usuário autenticado | Sempre |
| **Publicar sessão** | Admin | Contexto: dentro de um grupo ativo |
| **Postar aviso** | Admin | Contexto: dentro de um grupo ativo |
| **Confirmar presença** | Membro | Contexto: dentro de um grupo ativo |

Sem conta: tap no "+" redireciona ao login.

---

### 5. Notificações

Central de avisos com badge contador na aba.

**Para o membro:**
- Solicitação de entrada aprovada ou recusada
- Times formados ("Os times de quinta foram definidos!")
- Cobrança criada ("Nova sessão: R$ 15 para quinta-feira")
- Lembrete de presença ("Falta 1 dia — você confirmou?")

**Para o admin (adicional):**
- Nova solicitação de entrada no grupo
- Pagamento registrado por membro

**Comportamento:**
- Tap na notificação navega direto ao contexto relevante
- Notificações lidas somem do badge, ficam no histórico por 30 dias

---

### 6. Perfil

Identidade do usuário na plataforma. Visível publicamente por qualquer usuário.

**Conteúdo:**
- Foto, nome e email
- Total de peladas jogadas na plataforma
- Seção "Meus Grupos" — lista com papel e nível individual em cada grupo
- **Reputação** (ver abaixo)
- Histórico de peladas jogadas (últimas sessões)
- Configurações: alterar nome/foto, logout, excluir conta

**Nota:** não existe "nível médio" global de estrelas no perfil. O nível técnico é sempre relativo a cada grupo e definido pelo admin daquele grupo. No perfil público aparece apenas a reputação comportamental.

---

### 7. Sistema de Reputação

Separado do nível técnico (que é por grupo). Mede comportamento e postura em campo.

**Como funciona:**
- Após cada pelada, participantes podem avaliar os outros jogadores da sessão
- Avaliações são **anônimas** — o avaliado nunca sabe quem avaliou
- Cada avaliação tem: nota de 1–5 + tags descritivas (opcional)

**Tags sugeridas:**
- Positivas: Gente fina, Fair play, Pontual, Comunicativo, Líder natural
- Cautelares: Briga demais, Faltoso, Atrasado sempre

**Exibição no perfil:**
- Nota média: `4.8 😄 · 23 avaliações`
- Tags mais citadas aparecem como pílulas embaixo da nota
- Comentários livres curtos (anônimos) exibidos em lista

**Visibilidade:**
- Qualquer usuário autenticado pode ver o perfil e a reputação de outro
- Só quem jogou na mesma pelada pode deixar avaliação

---

## Tipos de Pelada

O organizador escolhe ao criar:
- **Sessão única** — data e horário específicos
- **Recorrente** — padrão de repetição (ex: toda quinta às 20h), com geração automática de sessões futuras

---

## Entrada num Grupo

Dois mecanismos:
1. **Solicitação** — jogador solicita via Descobrir, admin aprova ou recusa
2. **Link de convite** — admin gera link com validade de 7 dias; quem acessa entra direto sem aprovação

---

## Modelo de Dados — Adições Necessárias

Complementa a estrutura já definida na spec de autenticação e multi-tenant (`2026-04-24`):

```
/grupos/{grupoId}/
    ...campos existentes...
    nivel: number (1–5, nível geral do grupo)
    recorrente: boolean
    recorrencia: string | null  (ex: "quinta-20h")
    localizacao:
        endereco: string
        lat: number
        lng: number

/grupos/{grupoId}/avisos/{avisoId}
    id: string
    texto: string
    autorId: userId
    criadoEm: ISO string
    fixado: boolean

/notificacoes/{userId}/{notifId}
    id: string
    tipo: "solicitacao_aprovada" | "solicitacao_recusada" | "times_formados" | "cobranca" | "lembrete" | "nova_solicitacao" | "pagamento_registrado"
    grupoId: string
    lida: boolean
    criadaEm: ISO string
    payload: object  (dados extras dependendo do tipo)
```

---

## Fases de Implementação

| Fase | Escopo | Entrega |
|---|---|---|
| **1** | Bottom tab bar + Dashboard do grupo + Meus Grupos | Nova navegação com funcionalidade atual reorganizada |
| **2** | Tela Descobrir + publicação de pelada + localização | Plataforma pública no ar |
| **3** | Notificações in-app + badge | Loop de engajamento |
| **4** | Perfil completo + histórico | Identidade social |
| **5** | Push notifications | Retenção |

---

## Restrições

- Stack não muda: Vanilla JS, sem build step, sem frameworks
- Firebase Realtime Database — apenas adições de campos, nunca alteração da estrutura existente
- Mobile-first (320px–768px+), touch, safe-area iOS
- Compatibilidade com dados reais do grupo "Estrelas FC" em produção
- Nenhuma funcionalidade existente pode regredir na Fase 1
