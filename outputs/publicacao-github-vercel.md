# Publicar o CRM com GitHub e Vercel

Este roteiro mantém o desenvolvimento no computador, o histórico de versões no GitHub e a publicação automática pela Vercel.

## 1. Criar o repositório no GitHub

Crie um repositório **privado** e vazio no GitHub. Não marque as opções para criar README, licença ou `.gitignore`: o projeto já tem esses arquivos. Copie o endereço HTTPS do repositório.

## 2. Criar a primeira versão local

Abra o PowerShell na pasta do CRM:

```powershell
cd "C:\Users\Home\Documents\Codex\2026-11-14\prompt-crm-imobili-rio-clientes-e"
```

Confira o que será versionado. O arquivo `.env.local` não deve aparecer na lista:

```powershell
git status --short
```

Se a pasta ainda não tiver um repositório Git, execute:

```powershell
git init
git branch -M main
git add .
git status --short
git commit -m "Versão inicial do CRM imobiliário"
```

Adicione o endereço copiado do GitHub e envie a branch principal:

```powershell
git remote add origin https://github.com/SEU-USUARIO/SEU-REPOSITORIO.git
git push -u origin main
```

Troque o endereço de exemplo pelo endereço real. Para versões seguintes, use `git add .`, `git commit -m "Descreva a alteração"` e `git push`.

## 3. Conectar a Vercel ao GitHub

Na Vercel, escolha **New Project**, importe o repositório e mantenha a pasta raiz do projeto. A Vercel identifica Next.js automaticamente. Antes do primeiro deploy, cadastre estas variáveis em **Project Settings → Environment Variables**:

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave publishable do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave `service_role` ou `secret`, somente no servidor |

Selecione os ambientes que devem usar cada variável. Nunca coloque `SUPABASE_SERVICE_ROLE_KEY` em uma variável `NEXT_PUBLIC_`, em arquivo versionado ou em mensagem. Depois de salvar, faça o deploy.

Com o repositório conectado, cada push para `main` cria uma nova publicação de produção; outras branches podem gerar prévias. Se a prévia usar o banco de produção, os dados serão reais. Para ensaios com dados fictícios, use um projeto Supabase separado.

## 4. Liberar o endereço da Vercel no Supabase

Depois que a Vercel mostrar o endereço publicado, abra **Authentication → URL Configuration** no Supabase. Configure o endereço publicado como **Site URL** e inclua `https://SEU-ENDERECO.vercel.app/auth/callback` na lista de **Redirect URLs**. Se depois adicionar domínio próprio, inclua também o callback desse domínio.

O banco já está no projeto Supabase existente. Não execute novamente os esquemas iniciais. As migrações incrementais usadas pelo CRM são `002`, `003`, `004`, `005` e `006`; execute apenas as que ainda não foram aplicadas.

## 5. Conferência após publicar

- Entre com a conta admin existente.
- Confira **Usuários**, clientes e imóveis.
- Confirme que um corretor não consegue abrir clientes de outra carteira.
- Confira recuperação/login e a URL de retorno.
- Abra o endpoint público de imóveis disponíveis usando a chave publishable.
- Faça um commit pequeno de correção e confirme que o push atualiza a publicação.

Não envie `.env.local` ao GitHub. O `.gitignore` do projeto já ignora arquivos `.env*`, mantendo apenas `.env.example` versionável. GitHub recomenda não adicionar chaves ou senhas ao repositório; a Vercel permite configurar valores por projeto e ambiente.
