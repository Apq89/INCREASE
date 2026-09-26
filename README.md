# INCREASE

Jogo de negócios em Portugal em que todo o capital vem de crédito bancário. Pedes empréstimos, compras negócios, casas, carros, ações e cripto, contratas pessoal e pagas as prestações a tempo.

É uma web app: abre no browser, instala-se no telemóvel como uma app e, com o Supabase ligado, cada jogador tem conta, o jogo fica gravado na nuvem e há um ranking.

## O que está nesta pasta

| Ficheiro | Para que serve |
|---|---|
| `index.html` | A app (gerada a partir de `src/game.html`). É isto que o GitHub Pages mostra. |
| `src/game.html` | O jogo em si. Edita aqui. |
| `build.py` | Gera o `index.html` a partir do `src/game.html`. |
| `cloud.js` | Contas, gravação na nuvem e ranking. |
| `config.js` | Onde colas o endereço e a chave do teu Supabase. |
| `supabase/schema.sql` | Tabelas e regras de acesso para criar no Supabase. |
| `manifest.webmanifest`, `sw.js`, `icons/` | O que faz o jogo instalar-se como app e abrir sem internet. |

Sem o `config.js` preenchido, o jogo funciona na mesma, mas sem contas: cada jogador grava no próprio browser.

## 1. Criar o Supabase (contas e ranking)

1. Cria uma conta gratuita em [supabase.com](https://supabase.com) e carrega em **New project**. Escolhe a região **Europe (West)**.
2. No projeto, abre **SQL Editor → New query**, cola o conteúdo de `supabase/schema.sql` e carrega em **Run**.
3. Em **Authentication → Sign In / Providers → Email**, confirma que o email está ativo.
   - Se quiseres que os jogadores entrem logo sem confirmar o email, desliga **Confirm email**.
4. Em **Project Settings → API**, copia o **Project URL** e a chave **anon public**. Cola-os no `config.js`:

   ```js
   window.INCREASE_CONFIG = {
     supabaseUrl: 'https://o-teu-projeto.supabase.co',
     supabaseAnonKey: 'a-tua-chave-anon',
   };
   ```

   A chave `anon` é pública por natureza e pode ir para o GitHub. Quem protege os dados são as regras do `schema.sql`: cada jogador só consegue ler e alterar o seu próprio jogo.

## 2. Pôr no GitHub

1. Em [github.com/new](https://github.com/new) cria um repositório vazio chamado `increase`. Não acrescentes README nem .gitignore.
2. Nesta pasta, no Terminal:

   ```sh
   git add config.js
   git commit -m "Liga o Supabase"
   git remote add origin https://github.com/O-TEU-UTILIZADOR/increase.git
   git push -u origin main
   ```

3. No repositório, abre **Settings → Pages**. Em **Source** escolhe **Deploy from a branch**, depois **main** e **/ (root)**, e carrega em **Save**.
4. Passado um minuto, o jogo fica em `https://O-TEU-UTILIZADOR.github.io/increase/`.

## 3. Ligar o link ao Supabase

No Supabase, abre **Authentication → URL Configuration**:

- **Site URL**: `https://O-TEU-UTILIZADOR.github.io/increase/`
- **Redirect URLs**: acrescenta o mesmo endereço.

Sem isto, os emails de confirmação e de recuperação de palavra-passe apontam para o sítio errado.

## 4. Convidar jogadores

Envia o link. Cada jogador carrega em **Ainda não tenho conta**, escolhe um nome de jogador, email e palavra-passe, e começa a jogar.

Para instalar como app:

- **Android (Chrome):** menu ⋮ → **Instalar app**.
- **iPhone (Safari):** botão Partilhar → **Adicionar ao ecrã principal**.

## Atualizar o jogo

1. Edita `src/game.html`.
2. Corre `python3 build.py` para gerar o `index.html`.
3. Em `sw.js`, sobe a versão (`increase-v1` → `increase-v2`) para os jogadores receberem a nova versão.
4. `git commit -am "Descrição da mudança"` e `git push`.

## Bom saber

- O jogo grava na nuvem 20 segundos depois de cada mudança e sempre que o jogador fecha ou muda de separador. Se o mesmo jogador jogar em dois aparelhos, fica a versão mais recente.
- O ranking é calculado no browser de cada jogador. Alguém com conhecimentos técnicos consegue enviar uma pontuação falsa. Para um jogo entre amigos chega; para um jogo público com prémios, seria preciso validar as pontuações no servidor.
- No plano gratuito do Supabase, o projeto é pausado ao fim de uma semana sem atividade. Volta a ativá-lo no painel do Supabase se isso acontecer.
