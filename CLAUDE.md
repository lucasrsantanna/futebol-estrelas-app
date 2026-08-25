# Contexto do projeto

Esta pasta é um snapshot recuperado do código que roda em produção (https://futebol-estrelas.web.app), projeto Firebase "futebol-estrelas". Branch correspondente no GitHub: "producao", no repositório lucasrsantanna/futebol-estrelas-app.

⚠️ Esta pasta é PRODUÇÃO DE VERDADE — qualquer firebase deploy aqui afeta usuários reais imediatamente. Trate qualquer alteração com o mesmo cuidado de um hotfix: diagnosticar, testar antes, e nunca aplicar direto sem confirmação explícita do usuário.

# ⚠️ REGRA OBRIGATÓRIA — INÍCIO DE TODA SESSÃO

Antes de fazer QUALQUER alteração de código nesta sessão, rode primeiro, nessa ordem:

1. git fetch
2. git log HEAD..origin/producao --oneline
   → Se isso devolver algo, existem commits no GitHub que este PC não tem. Rode "git pull" antes de continuar.
3. git status
4. git log origin/producao..HEAD --oneline
   → Se isso devolver algo, existem commits locais neste PC nunca enviados ao GitHub. Rode "git push" antes de fazer qualquer coisa nova.

Nunca inicie trabalho novo, e nunca rode "firebase deploy", sem essas quatro checagens confirmando que local e remoto estão sincronizados.

Commita e faz push depois de QUALQUER correção aplicada aqui, mesmo pequena — antes ou logo depois do deploy, nunca deixando um hotfix só local.
