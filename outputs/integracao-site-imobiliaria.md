# Integração do site com imóveis disponíveis

O banco já cria a view pública `public_available_properties`. Ela retorna somente imóveis com status `disponivel` e os campos de anúncio necessários para uma vitrine. Não consulta `properties` diretamente e não inclui CPF, dados do proprietário, corretor responsável, endereço completo, documentos ou dados internos.

## Acesso

Use a URL do projeto Supabase e a chave pública `publishable` (ou `anon`, em projetos que ainda usam as chaves antigas) no site. Essa chave pode ficar no navegador; nunca coloque a chave `secret` ou `service_role` no frontend.

O schema inicial já concede leitura da view para `anon` e `authenticated`. Se o schema inicial foi executado antes da inclusão da view, execute no SQL Editor:

```sql
create or replace view public.public_available_properties with (security_barrier=true) as
select id, internal_code, title, description, property_type, purpose,
       neighborhood, city, state, sale_price, rent_price, condo_fee,
       property_tax, total_area, built_area, bedrooms, suites, bathrooms,
       parking_spaces, created_at, updated_at
from public.properties
where status = 'disponivel';

revoke all on public.public_available_properties from public, anon, authenticated;
grant select on public.public_available_properties to anon, authenticated;
```

## Exemplo em JavaScript/TypeScript

Instale `@supabase/supabase-js` no projeto do site e configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` com os valores do Supabase:

```ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);

const { data, error } = await supabase
  .from("public_available_properties")
  .select("id, internal_code, title, description, property_type, purpose, neighborhood, city, state, sale_price, rent_price, total_area, bedrooms, suites, bathrooms, parking_spaces")
  .order("created_at", { ascending: false })
  .range(0, 19); // primeiros 20 itens

if (error) throw error;
```

Filtros podem ser encadeados antes do `order`, por exemplo `.eq("property_type", "apartamento")`, `.eq("purpose", "venda")`, `.gte("sale_price", 200000)` e `.ilike("neighborhood", "%centro%")`. Para paginação, use intervalos sem sobreposição: página 1 `.range(0, 19)`, página 2 `.range(20, 39)`.

## Campos retornados

`id`, `internal_code`, `title`, `description`, `property_type`, `purpose`, `neighborhood`, `city`, `state`, `sale_price`, `rent_price`, `condo_fee`, `property_tax`, `total_area`, `built_area`, `bedrooms`, `suites`, `bathrooms`, `parking_spaces`, `created_at` e `updated_at`.

Fotos e documentos continuam privados no Storage e não são publicados por esta view. Para mostrar fotos no site, será necessário preparar uma forma separada de publicação das imagens, sem tornar o bucket inteiro público.

## Conferência

Faça uma consulta sem login e confirme que somente imóveis disponíveis aparecem. Depois altere um imóvel para reservado e confirme que ele deixa de aparecer. A view pública não permite inserir, atualizar ou excluir dados.
