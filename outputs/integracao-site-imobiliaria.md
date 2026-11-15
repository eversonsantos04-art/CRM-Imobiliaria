# Vitrine pública ligada ao CRM

A vitrine está no mesmo projeto Next.js do CRM. Ela usa a rota `/` para o catálogo e `/anuncio/[id]` para os detalhes; o painel interno continua em `/login` e nas rotas administrativas existentes.

## Dados dos anúncios

A vitrine lê somente a view `public_available_properties`, que contém os campos de anúncio e inclui apenas imóveis com status `disponivel`. Não consulte `properties` diretamente no site. A view não inclui CPF, dados do proprietário, corretor responsável, endereço completo ou documentos.

O schema inicial já concede leitura da view para `anon` e `authenticated`. Se a view não existir no projeto Supabase, execute o SQL de criação correspondente em `outputs/001_initial_schema.sql` ou use o SQL Editor do Supabase para aplicar a migração equivalente.

## Fotos privadas

As fotos continuam no bucket privado `property-photos`; o bucket `property-documents` também permanece privado. O servidor primeiro obtém os imóveis liberados pela view pública, depois busca e assina somente as fotos desses imóveis. Os links assinados duram uma hora. O navegador nunca recebe a chave `service_role` e a vitrine nunca consulta nem disponibiliza `property_documents`.

Configure `SUPABASE_SERVICE_ROLE_KEY` somente nas variáveis de ambiente do servidor local e da Vercel, sem o prefixo `NEXT_PUBLIC_`. A chave publishable pode continuar no frontend. Sem a chave de serviço, os anúncios ainda podem aparecer, mas as fotos privadas não serão exibidas.

## Atendimento

`NEXT_PUBLIC_WHATSAPP_NUMBER` é opcional. Quando configurada, deve conter o telefone público com código do país e DDD, somente números (por exemplo, `5511999999999`). Sem esse valor, a vitrine não mostra um contato com destinatário inventado.

## Busca e compartilhamento

O site gera `/sitemap.xml` com a página inicial e somente os imóveis liberados pela view pública; `/robots.txt` aponta para o sitemap e evita indexar as rotas do CRM. Configure `NEXT_PUBLIC_SITE_URL` com a URL principal completa do site (incluindo `https://`) nas variáveis locais e da Vercel. A URL também é usada nos metadados canônicos e de compartilhamento dos anúncios.

## Temas visuais

O tema claro com as cores atuais da identidade visual é o padrão. O botão do cabeçalho alterna entre claro, escuro e a paleta preta/dourada derivada do logo. A escolha fica salva no navegador e só afeta as páginas públicas da vitrine.

## Segurança e publicação

- Revise a view pública no Supabase antes de publicar e confirme que ela só retorna campos apropriados para anúncios.
- Nunca torne público o bucket `property-photos` ou `property-documents`.
- Mantenha `SUPABASE_SERVICE_ROLE_KEY` como variável somente do servidor na Vercel.
- Altere um imóvel para reservado e confirme que ele deixa de aparecer no catálogo e que sua página pública deixa de abrir.
