# Bruxa e Magia

Site completo: tarot interativo, horóscopo diário, mapa astral personalizado com pagamento via Pix, jogo de búzios, magia, simpatias, fases da lua, blog, eBooks e área administrativa.

Este guia assume que você **não é desenvolvedor** — todos os passos podem ser feitos pelo navegador, sem instalar nada.

---

## Índice

1. [Colocar o site no ar (GitHub Pages)](#1-colocar-o-site-no-ar-github-pages)
2. [Ativar o banco de dados (Supabase)](#2-ativar-o-banco-de-dados-supabase)
3. [Primeiro acesso à área administrativa](#3-primeiro-acesso-à-área-administrativa)
4. [Aparecer no Google (Search Console)](#4-aparecer-no-google-search-console)
5. [Avisos importantes antes de divulgar](#5-avisos-importantes-antes-de-divulgar)

---

## 1. Colocar o site no ar (GitHub Pages)

1. Crie uma conta gratuita em [github.com](https://github.com), se ainda não tiver.
2. Clique em **"New repository"** (Novo repositório).
   - Nome: `bruxaemagia`
   - Marque como **Public**
   - Não marque "Add a README" (já temos um)
3. Dentro do repositório recém-criado, clique em **"uploading an existing file"** (ou arraste os arquivos direto na página).
4. Arraste estes arquivos desta pasta para o GitHub:
   - `index.html`
   - `robots.txt`
   - `sitemap.xml`
   - `README.md`
5. Clique em **"Commit changes"** para salvar.
6. Vá em **Settings → Pages** (menu lateral do repositório).
7. Em "Branch", selecione `main` e pasta `/ (root)`, depois clique em **Save**.
8. Em alguns minutos, seu site estará no ar em:
   ```
   https://oraculobruxaemagia.github.io/bruxa-e-magia/
   ```

### Se quiser um domínio próprio (ex: bruxaemagia.com.br)
Depois de comprar o domínio em um registrador (Registro.br, GoDaddy, etc.), em **Settings → Pages → Custom domain**, digite seu domínio e siga as instruções de DNS que o GitHub mostrar.

---

## 2. Ativar o banco de dados (Supabase)

Sem este passo, o site funciona normalmente (tarot, horóscopo, blog, etc.), mas **eBooks, pedidos de mapa astral e a área administrativa ficam vazios**, porque eles precisam de um lugar para salvar os dados.

Usamos o [Supabase](https://supabase.com) — gratuito, e **não pede cartão de crédito** no plano gratuito.

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita (dá para entrar direto com GitHub ou Google).
2. Clique em **"New project"**.
   - Nome: `bruxaemagia`
   - Crie uma senha de banco de dados (guarde-a, mas você não vai precisar dela no dia a dia)
   - Região: escolha a mais próxima do Brasil (ex: `South America (São Paulo)`)
   - Clique em **"Create new project"** e espere alguns minutos até o projeto ficar pronto
3. No menu lateral, clique em **"SQL Editor"**.
4. Clique em **"New query"** e cole o código abaixo:
   ```sql
   create table kv_store (
     id text primary key,
     key text not null,
     value text not null,
     shared boolean not null default false,
     updated_at timestamptz default now()
   );

   alter table kv_store disable row level security;
   ```
5. Clique em **"Run"** (ou aperte Ctrl+Enter). Isso cria a "tabela" onde todos os dados do site (pedidos, eBooks, chave Pix, senha do admin) vão ser guardados.

   > ⚠️ **Importante:** desativar a "Row Level Security" (RLS) permite que qualquer pessoa leia e grave dados diretamente pela API do Supabase, não só pelo seu site. Isso é uma limitação de qualquer site que não tem um servidor próprio por trás. Para um negócio pequeno é um risco aceitável no início, mas veja o item 5 (Avisos) para entender o que isso significa na prática.

6. No menu lateral, clique em **"Project Settings"** (ícone de engrenagem) → **"API"**.
7. Você vai ver dois valores importantes:
   - **Project URL** (algo como `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (uma sequência longa de letras e números, em "Project API keys")
8. Abra o arquivo `index.html` (pode editar direto pelo GitHub: abra o arquivo no repositório e clique no ícone de lápis ✏️).
9. Procure por `SUPABASE_URL` e `SUPABASE_ANON_KEY` perto do topo do arquivo (dentro da primeira tag `<script>`, logo depois do `<div class="toast">`) e substitua os valores `"COLE_AQUI..."` pelos valores reais copiados do Supabase.
10. Clique em **"Commit changes"** para salvar. Em 1-2 minutos o GitHub Pages já estará atualizado com o banco conectado.

---

## 3. Primeiro acesso à área administrativa

1. Acesse seu site publicado e role até o final da página, ou vá direto em `https://oraculobruxaemagia.github.io/bruxa-e-magia/#admin`.
2. Como é o primeiro acesso, o site vai pedir para você **criar sua senha** (mínimo 6 caracteres). Ela é salva de forma criptografada (hash), não em texto puro.
3. Depois de criada, use essa senha para entrar sempre que quiser conferir pedidos, cadastrar a chave Pix ou adicionar eBooks.
4. Na aba **"Chave Pix"**, cadastre sua chave real — sem isso, os clientes não conseguem finalizar o pagamento do mapa astral.

---

## 4. Aparecer no Google (Search Console)

Isso é diferente de "estar no ar" — é o processo de pedir ao Google para indexar (ler e mostrar) seu site nos resultados de busca.

1. Acesse [search.google.com/search-console](https://search.google.com/search-console) com sua conta Google.
2. Escolha **"Prefixo do URL"** e digite `https://oraculobruxaemagia.github.io/bruxa-e-magia/`.
3. Verifique a propriedade pelo método **"Tag HTML"**:
   - O Google vai te dar uma linha parecida com `<meta name="google-site-verification" content="XXXXXXX" />`
   - Cole essa linha dentro do `<head>` do `index.html` (logo abaixo da tag `<title>`), salve e publique (commit) no GitHub
   - Volte ao Search Console e clique em **"Verificar"**
4. Depois de verificado, vá em **Sitemaps** (menu lateral) e envie:
   ```
   sitemap.xml
   ```
5. Pronto — o Google vai visitar e indexar o site nos próximos dias. Você pode acompanhar o progresso na própria ferramenta.

> Dica: antes de tudo isso, troque `oraculobruxaemagia` por seu usuário real do GitHub em **todos** os arquivos (`index.html`, `robots.txt`, `sitemap.xml`) nos lugares onde aparece `https://oraculobruxaemagia.github.io/bruxa-e-magia/`.

---

## 5. Avisos importantes antes de divulgar

Sendo direto sobre os limites reais desta versão, para você decidir com informação completa:

- **Pagamento continua manual.** O site gera um QR Code Pix válido e recebe o comprovante, mas a confirmação de que o dinheiro realmente caiu é feita por você, no painel administrativo. Não há integração bancária automática.
- **E-mail continua manual.** O painel gera o texto pronto do e-mail para cada pedido; você copia e envia pelo seu provedor de e-mail (Gmail, Outlook, etc.). Não há disparo automático.
- **Segurança de dados é básica.** As regras do banco (passo 2.5) permitem acesso amplo aos dados por qualquer pessoa que souber como consultar a API do Supabase diretamente — isso é bem mais difícil do que usar o site normalmente, mas não é impossível para alguém técnico. Para um volume pequeno de pedidos, isso é uma prática comum em MVPs; se o negócio crescer, vale contratar um desenvolvedor para adicionar autenticação real (Supabase Auth) restringindo quem pode escrever dados.
- **Sem backups automáticos.** Vale exportar os pedidos periodicamente (Firestore permite exportar dados pelo console) até ter um processo mais robusto.

Nada disso impede o lançamento — é assim que a maioria dos pequenos negócios digitais começa. São só pontos para você ter clareza do que existe hoje e do que pode evoluir depois.
