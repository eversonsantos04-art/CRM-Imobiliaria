# Documentação do CRM e da Vitrine

## Visão geral

O projeto reúne, na mesma aplicação Next.js e no mesmo projeto Supabase:

- **CRM privado** para administrar usuários, imóveis, clientes, contatos e acompanhamentos.
- **Vitrine pública** para apresentar imóveis disponíveis, suas fotos e informações de anúncio.

O CRM e a Vitrine usam os mesmos registros de imóveis. O site público consulta a view `public_available_properties`; dados de clientes, documentos e informações internas não são publicados.

## Tecnologias e estrutura

- Next.js com App Router, React e TypeScript.
- Tailwind CSS para partes do CRM e CSS próprio em `app/site.css` para a Vitrine.
- Supabase Auth para login, PostgreSQL para dados, Row Level Security (RLS) para acesso e Storage para fotos e documentos.
- `app/`: páginas, layouts e rotas da aplicação.
- `components/`: componentes compartilhados do CRM.
- `lib/`: clientes Supabase, consultas, importação CSV e funções compartilhadas.
- `outputs/`: migrações SQL e guias operacionais.
- `public/site/`: logo, imagens ilustrativas e avatares usados pela Vitrine.
- `.agents/skills/`: instruções de trabalho para agentes de desenvolvimento; não são dependência de execução do site.

## Mapa de páginas

### Vitrine pública

| Rota | Função |
| --- | --- |
| `/` | Página inicial, busca e catálogo de imóveis, seções institucionais, simulador e depoimentos. |
| `/anuncio/[id]` | Detalhes e galeria de um imóvel público. |
| `/robots.txt` | Orientações para indexadores. |
| `/sitemap.xml` | Página inicial e anúncios disponíveis. |

O catálogo consulta até 48 imóveis, ordenados pelos mais recentes. A página inicial e a página de anúncio usam revalidação de 60 segundos. As URLs assinadas das fotos duram uma hora. Os depoimentos e imagens de pessoas são conteúdo demonstrativo e devem ser substituídos por conteúdo real autorizado antes de apresentar o site como material institucional definitivo.

### CRM

| Rota | Função |
| --- | --- |
| `/login`, `/recuperar-senha`, `/redefinir-senha` | Acesso e recuperação de conta. |
| `/dashboard` | Indicadores de imóveis, clientes e follow-ups. |
| `/agenda` | Acompanhamentos de clientes: hoje, próximos, atrasados, pendentes e concluídos. |
| `/imoveis`, `/imoveis/novo`, `/imoveis/[id]/editar` | Cadastro, consulta, edição, fotos e documentos de imóveis. |
| `/clientes`, `/clientes/novo`, `/clientes/[id]`, `/clientes/[id]/editar` | Carteira, dados, interesses e histórico de clientes. |
| `/importar` | Importação de clientes e imóveis por CSV; somente admin. |
| `/usuarios` | Administração de contas e perfis; somente admin. |
| `/auditoria` | Histórico de alterações; somente admin. |
| `/api/admin/users` | Operações administrativas de contas no Supabase Auth. |
| `/auth/callback` | Retorno de fluxos de autenticação do Supabase. |

## Acesso e segurança

Existem dois perfis: `admin` e `corretor`. A autorização é aplicada no banco por políticas RLS; esconder links na interface não substitui essas políticas.

- Usuários ativos autenticados podem consultar imóveis. Um corretor só pode criar, editar ou excluir imóveis que cadastrou; o admin pode administrar todos.
- Clientes são limitados à carteira atribuída ao corretor e ao admin. A edição por corretor também respeita quem criou o cadastro; o admin pode administrar todos.
- Importação CSV, administração de usuários e auditoria são funções exclusivas do admin.
- Contas desativadas têm o acesso bloqueado também para sessões que já estavam abertas.
- A chave `SUPABASE_SERVICE_ROLE_KEY` é usada somente no servidor. Nunca deve ser enviada ao navegador, prefixada com `NEXT_PUBLIC_`, incluída em arquivos versionados ou compartilhada em mensagens.
- A chave publishable pode aparecer no cliente porque o banco depende de RLS para proteger os dados.
- Os buckets `property-photos` e `property-documents` devem permanecer privados. A Vitrine assina URLs de fotos permitidas no servidor e não publica documentos.

### Dados pessoais

O CRM oferece operações administrativas distintas:

- **Anonimizar cliente:** remove dados pessoais e associações identificáveis conforme a função SQL; mantém um registro genérico de auditoria.
- **Excluir cadastro:** apaga o cliente e seus dados relacionados, remove vínculos de proprietário dos imóveis e mantém apenas um evento genérico de auditoria. A operação é irreversível.
- **Excluir usuário:** o fluxo de administração preserva os registros de CRM; confira transferências de atribuições antes de excluir uma conta.

Essas operações não substituem a revisão das políticas internas de privacidade e dos prazos de retenção da imobiliária.

## Modelo de dados

O esquema principal está em `outputs/001_initial_schema.sql`.

| Tabela / objeto | Conteúdo |
| --- | --- |
| `profiles` | Perfil, nome, função e estado de acesso ligado à conta Auth. |
| `clients` | Cadastro e atribuição de clientes. |
| `client_roles` | Papéis do cliente: comprador, locatário, proprietário ou investidor. |
| `client_interests`, `client_interest_neighborhoods` | Preferências de imóveis, valores, quartos e bairros. |
| `properties` | Cadastro e situação dos imóveis, responsável e proprietário opcional. |
| `property_status_history` | Mudanças de situação dos imóveis. |
| `property_photos` | Fotos, ordem, legenda e indicação de capa. |
| `property_documents` | Documentos privados vinculados a imóveis. |
| `client_interactions` | Histórico de contatos, visitas e negociações. |
| `follow_ups` | Lembretes e acompanhamentos vinculados a clientes. |
| `audit_logs` | Registro de alterações administrativas e de dados. |
| `public_available_properties` | View pública limitada aos campos próprios de anúncio e imóveis disponíveis. |

O banco também usa funções e gatilhos para gerar códigos internos, registrar alterações e aplicar operações controladas de administração. Consulte o SQL correspondente antes de alterar o modelo.

## Supabase: instalação e migrações

Para um projeto Supabase **novo e vazio**, consulte `outputs/README-etapa-1.md` e execute `outputs/001_initial_schema.sql` uma vez. Depois crie a primeira conta admin no Auth e ajuste seu perfil conforme as instruções do guia.

As migrações posteriores são incrementais:

| Arquivo | Finalidade |
| --- | --- |
| `002_reorder_property_photos.sql` | Ordenação de fotos e capa, com validações relacionadas ao imóvel. |
| `003_property_internal_code.sql` | Código sequencial automático de imóveis. |
| `004_client_edit_permissions.sql` | Regras de edição de clientes por admin e criador. |
| `005_lgpd_anonymize_client.sql` | Operação controlada de anonimização. |
| `006_admin_user_lifecycle.sql` | Desativação e ciclo de vida de contas, além das políticas atualizadas. |
| `007_delete_client_data.sql` | Exclusão definitiva controlada de cliente e dados relacionados. |

**Não execute novamente `001_initial_schema.sql` em um banco em uso.** Em bancos existentes, confira quais migrações já foram aplicadas e execute apenas as pendentes, uma por vez, no SQL Editor. Faça backup e revise cada SQL antes de mudanças de produção.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha os valores no computador. `.env.local` é ignorado pelo Git.

| Variável | Necessária | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | Endereço do projeto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sim | Acesso do cliente e consultas protegidas por RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim para administração e fotos públicas | Operações de servidor; segredo, sem prefixo `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | Recomendada | Domínio público completo, incluindo `https://`; metadados e sitemap. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Não | Telefone público com país e DDD, somente números. |

Cadastre os valores de produção em **Vercel → Project Settings → Environment Variables**, nunca no repositório. A URL e a chave publishable podem estar no cliente; a chave de serviço deve ficar disponível apenas ao servidor.

## Desenvolvimento local

Requisitos: Node.js 20.9 ou superior e npm.

```powershell
Copy-Item .env.example .env.local
npm ci
npm run dev
```

Abra `http://localhost:3000`. O site público usa `/`; o login do CRM está em `/login`. Para autenticação local, permita `http://localhost:3000` como Site URL e `http://localhost:3000/auth/callback` como Redirect URL no Supabase.

Comandos do projeto:

```powershell
npm run dev      # servidor local
npm run lint     # ESLint
npm run build    # compilação de produção
npm run start    # serve a compilação de produção
```

O desenvolvimento deve usar `npm ci` para instalar exatamente as versões do `package-lock.json`. Não versione `node_modules/`, `.next/`, arquivos `.env.local` nem saídas de build.

## Publicação no GitHub e Vercel

O remoto Git já está configurado neste projeto. Um push para a branch conectada pode iniciar a publicação automática na Vercel; por isso, finalize e confira as alterações locais antes do commit e do push.

1. Revise `git status --short` e confirme que `.env.local` não aparece.
2. Confirme que as variáveis da tabela acima estão configuradas na Vercel, inclusive `NEXT_PUBLIC_SITE_URL` para o domínio.
3. Confirme a URL de produção como Site URL e o callback `/auth/callback` nas Redirect URLs do Supabase.
4. Revise alterações SQL e verifique quais migrações já foram aplicadas no banco de produção.
5. Execute a compilação e a revisão visual local; então faça commit e push conforme `outputs/publicacao-github-vercel.md`.
6. Após a publicação, confira login, agenda, clientes, imóveis, fotos públicas e acesso por perfil.

Não envie este projeto para um repositório público sem revisar se a imobiliária deseja expor o código, as skills copiadas, imagens e documentos operacionais. Mantenha o repositório privado quando essa for a política da empresa.

## Testes manuais recomendados

- Entrar como admin e como corretor em sessões separadas.
- Confirmar que cada corretor só vê sua carteira de clientes e não pode editar registros de outro criador.
- Confirmar que corretores veem os imóveis da equipe, mas não alteram imóveis criados por outros.
- Criar e concluir um follow-up; conferir hoje, atrasados, próximos e concluídos na Agenda.
- Importar CSV de teste e conferir o relatório de linhas inválidas sem usar dados reais desnecessariamente.
- Alterar situação de imóvel e conferir o histórico/auditoria.
- Na Vitrine, confirmar que só imóveis disponíveis aparecem, as fotos abrem e documentos nunca são exibidos.
- Conferir que a página pública atualiza após as janelas de revalidação e que `robots.txt` e `sitemap.xml` usam o domínio correto.
