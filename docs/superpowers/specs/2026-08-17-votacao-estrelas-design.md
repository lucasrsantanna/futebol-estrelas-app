# Reavaliação de Estrelas por Votação — Design Spec

## Objetivo

Substituir a edição manual de estrelas pelo admin por um sistema de votação entre os
próprios mensalistas do grupo, com ciclos periódicos, agregação por média aparada e
aprovação do admin antes de aplicar o resultado.

Complementa as specs de autenticação e multi-tenant (`2026-04-24`) e de plataforma
social (`2026-04-28`). Não altera o sistema de Reputação (comportamental, global entre
grupos) já desenhado em `2026-04-28` — Estrelas (técnico, por grupo) e Reputação
continuam sendo sistemas independentes.

---

## Decisões de base (herdadas, não rediscutidas aqui)

- Login: Google + Email/senha (SMS descartado)
- Papel admin tem liberdade total; membro só visualiza; ações restritas ficam
  escondidas da interface, não desabilitadas
- Presença: jogador só marca a própria presença; desfazer é exclusivo do admin
- Estrelas são por grupo, definidas por ciclo de votação entre mensalistas — nunca
  editadas manualmente pelo admin
- Votação é anônima para os jogadores, mas auditável pelo admin
- Agregação: remove a nota mais alta e a mais baixa recebidas por jogador, tira a
  média do que sobra

---

## 1. Vínculo conta ↔ jogador

### Fluxo padrão (grupos novos, dali em diante)

Quando alguém entra num grupo — por link de convite ou por aprovação de solicitação
via Descobrir (specs `2026-04-24` e `2026-04-28`) — o app checa se aquele grupo tem
algum jogador órfão (`userId == null`):

- **Sem órfãos** (caso comum, grupo criado direto na plataforma): cria o jogador
  automaticamente, no mesmo momento que o registro de `membro`, já com `userId`
  preenchido. Nada é exibido para o usuário — não existe etapa de "reivindicar".
- **Com órfãos** (hoje, só o grupo "Estrelas FC" migrado): mostra a tela de autoclaim
  em vez de criar o jogador de cara (ver abaixo). Cria um jogador novo automaticamente
  só ficaria errado aqui — duplicaria a pessoa, já que ela provavelmente é um dos
  órfãos.

### Autoclaim (ferramenta reaproveitável, na prática só para o "Estrelas FC" migrado)

Ao entrar num grupo que tenha jogadores com `userId == null`, o novo membro vê uma
tela "É você?" com três opções:

- **"Esse sou eu"** — lista dos jogadores órfãos do grupo (nome, estrelas atuais,
  tipo); tocar em um vincula o próprio `userId` àquele `jogadorId`.
- **"Sou novo, não estou nessa lista"** — cria um jogador novo do zero para essa
  pessoa (mesmo fluxo do caso "sem órfãos" acima), para quem entra num grupo com
  histórico migrado mas nunca jogou lá antes.
- **"Agora não"** — pulável. A pessoa usa o app normalmente sem jogador vinculado
  ainda, e pode voltar a decidir depois pelo próprio perfil no grupo.

Sem preparo do admin: nenhuma lista de códigos ou links individuais para gerar ou
distribuir. Mitigação de nomes repetidos: a lista mostra estrelas e tipo junto do nome
para desambiguar; se mesmo assim alguém vincular errado, o admin corrige manualmente
pela tela de Gestão (trocar o `userId` vinculado a um `jogadorId`). O admin passa pelo
mesmo fluxo — nenhum tratamento especial para quem rodou a migração.

---

## 2. Ciclo de votação de estrelas

### Abertura

- Manual, pelo admin — botão "Abrir ciclo de votação" na Gestão do grupo.
- Ao abrir, o admin pode opcionalmente definir uma data de encerramento (`prazo`). Se
  não definir, o ciclo não tem prazo automático.

### Fechamento

O que ocorrer primeiro entre os três gatilhos fecha o ciclo:

1. Admin encerra manualmente (botão "Encerrar votação")
2. Todos os mensalistas do grupo votaram (100% de participação — "votou" aqui
   significa submeteu a própria cédula ao menos uma vez no ciclo, mesmo que tenha
   avaliado só parte dos outros jogadores; ver seção "Quem vota, quem é avaliado")
3. A data definida em `prazo` é atingida — checado passivamente no client quando
   alguém abre o app, mesmo padrão já usado para a expiração do link de convite
   (`2026-04-24`). Só se aplica se um `prazo` foi definido na abertura.

### Quórum e agregação

- Um jogador só entra na agregação do ciclo se tiver recebido **no mínimo 5 votos**.
  Abaixo disso, a estrela dele permanece a mesma nesse ciclo.
- Agregação: remove a nota mais alta e a mais baixa recebidas, tira a média do
  restante.

### Quem vota, quem é avaliado

- Só mensalistas votam.
- Mensalistas e avulsos podem ser avaliados.
- A cédula é livre: cada mensalista escolhe em quem votar (não precisa ter jogado
  junto recentemente), 1–10 estrelas por pessoa avaliada, por bom senso — mesma
  escala já usada em todo o resto do app (badges, dashboard do grupo, etc). Sem
  remapeamento: `teams.js` (linhas 147–150) já separa jogadores em baldes exatos de
  10, 9 e 8 estrelas para balancear os times, e essa lógica depende da granularidade
  1–10 — votar em 1–5 exigiria reescrevê-la para algo baseado em percentil/ranking.
- Jogador que não vota no ciclo não sofre nenhuma consequência — sua própria nota
  continua sendo recalculada normalmente, com base nos votos que ele recebeu dos
  outros.

### Aprovação do admin

O fechamento do ciclo não aplica o resultado direto. Gera uma lista de resultados
propostos (por jogador que bateu o quórum): estrela atual vs. estrela proposta,
quantidade de votos recebidos. Essa lista fica em estado "aguardando aprovação" na
Gestão do grupo, com:

- Aprovação individual por jogador
- Atalho "Aprovar tudo" para o lote inteiro

Só depois de aprovado o valor é escrito em `jogadores/{jogadorId}/estrelas`. Se o
admin rejeitar um jogador específico, a estrela dele não muda nesse ciclo — o admin
pode consultar os votos individuais (auditáveis, ainda que anônimos para os demais
membros) para investigar antes de decidir.

Não existe edição manual da estrela em nenhum ponto desse fluxo — a única ação do
admin é aprovar ou rejeitar o resultado calculado.

### Valor inicial de jogador novo

Como a estrela nunca é editada manualmente — nem na criação — todo jogador novo
nasce com **`estrelas: 5`**, o mesmo valor neutro que `teams.js` (linha 128) já usa
para os jogadores genéricos. Vale tanto para quem entra num grupo pelo fluxo padrão
(seção 1) quanto para quem é cadastrado pelo admin via FAB (cadastro rápido) — o
campo de estrela manual sai da interface de cadastro também, não só da de edição.
O valor `5` permanece até o primeiro ciclo de votação em que esse jogador bate o
quórum (seção "Quórum e agregação") e o admin aprova o resultado; se isso nunca
acontecer, o jogador simplesmente continua em `5`.

---

## 3. Migração do elenco existente do "Estrelas FC"

`js/migration.js` passa a gravar, para cada jogador copiado, o campo novo
`userId: null` — aditivo, com default compatível com a regra do CLAUDE.md de nunca
alterar a estrutura existente sem valor padrão.

Esse campo por si só já representa o estado "pendente de vínculo" — nenhuma flag ou
modo de migração separado é necessário. A tela de autoclaim descrita na seção 1 é
genérica e reage a qualquer jogador com `userId == null`; na prática, hoje, só o
grupo migrado tem esse caso.

Sequência de migração (atualizada):

1. Admin faz login no novo app com sua conta
2. Script lê os dados do Firebase de produção atual (flat) e grava sob
   `/grupos/{grupoId}/...`
3. Cria o grupo "Estrelas FC" com o admin logado como criador
4. Copia jogadores, sessões, restrições e histórico de times preservando todos os
   campos existentes, **adicionando `userId: null` a cada jogador**
5. Adiciona o admin como único membro inicial com `role: "admin"`
6. Admin e demais mensalistas se vinculam aos jogadores migrados pelo fluxo de
   autoclaim, ao entrarem no grupo pelo link de convite normal

---

## Modelo de Dados — Adições Necessárias

Complementa a estrutura definida em `2026-04-24` e `2026-04-28`.

```
/grupos/{grupoId}/jogadores/{jogadorId}
    ...campos existentes...
    userId: string | null    (NOVO — vínculo com a conta; null = órfão, pendente de autoclaim)

/grupos/{grupoId}/ciclosVotacao/{cicloId}
    id: string
    abertoPor: userId
    abertoEm: ISO string
    prazo: ISO string | null       (opcional, definido pelo admin ao abrir)
    status: "aberto" | "aguardandoAprovacao" | "encerrado"
    fechadoEm: ISO string | null
    motivoFechamento: "manual" | "prazo" | "todosVotaram" | null

/grupos/{grupoId}/ciclosVotacao/{cicloId}/votos/{jogadorIdVotante}/{jogadorIdAvaliado}
    nota: number (1–10)
    criadoEm: ISO string

/grupos/{grupoId}/ciclosVotacao/{cicloId}/resultados/{jogadorIdAvaliado}
    estrelaAtual: number
    estrelaProposta: number
    qtdVotos: number
    aprovado: boolean | null   (null = pendente, true = aplicado, false = rejeitado)
    decididoEm: ISO string | null
```

Quando um resultado é aprovado, `jogadores/{jogadorId}/estrelas` é atualizado para
`estrelaProposta` — o algoritmo de balanceamento de times (`teams.js`, `utils.js`)
continua lendo o mesmo campo `estrelas`, sem nenhuma mudança necessária ali.

---

## Correções na spec `2026-04-24`

- Remover telefone/SMS da lista de métodos de login (fica Google + Email/senha)
- Tabela de permissões: nova linha "Desfazer presença marcada" (Admin ✅ / Membro ❌),
  com nota de que o membro só marca a própria presença, nunca desmarca
- Trocar a linha "Editar estrelas de jogador" por "Gerenciar ciclo de votação de
  estrelas" (abrir, encerrar, aprovar resultados)

---

## Arquivos Modificados

### Novos
- `js/votacao.js` — abertura/fechamento de ciclo, registro de votos, cálculo da
  agregação (média aparada), aprovação de resultados
- Telas HTML: autoclaim ("É você?"), cédula de votação, tela de aprovação de
  resultados na Gestão do grupo

### Modificados
- `js/migration.js` — adiciona `userId: null` na cópia de jogadores
- `js/grupos.js` — cria jogador vinculado (`userId` preenchido) junto com o membro,
  no fluxo de entrada por convite e por aprovação de solicitação
- `js/firebase.js` — CRUD de `ciclosVotacao`, `votos`, `resultados`
- `js/players.js` — remove o campo de estrela manual tanto do cadastro rápido (FAB)
  quanto da edição de jogador; novo jogador é criado com `estrelas: 5`
- `index.html` — telas novas; condicionais de renderização por papel
- `style.css` — estilos das telas novas

---

## Restrições

- Estrutura interna dos documentos existentes não é alterada — só adições de campos
  com default compatível (`userId: null`)
- Sem alert() para os fluxos novos — feedback inline, consistente com a spec de auth
- Firebase Security Rules devem impedir que membros não-admin leiam o node
  `votos/` de outros jogadores (voto anônimo é anônimo mesmo no nível de acesso a
  dados, não só na interface)
- Mobile-first (320px–768px+), touch, safe-area iOS
- Nenhuma funcionalidade existente pode regredir
