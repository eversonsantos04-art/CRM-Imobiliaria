# Etapa 1 — banco e permissões

## Aplicar

1. Crie um projeto Supabase.
2. Abra **SQL Editor → New query**.
3. Execute o conteúdo de [001_initial_schema.sql](001_initial_schema.sql).
4. Crie a conta do primeiro administrador em **Authentication → Users**.
5. Copie o UUID dessa conta e execute no SQL Editor, substituindo o valor:
   `update public.profiles set role = 'admin' where id = 'UUID-DO-USUARIO';`
6. Convide/crie os corretores pelo Supabase Auth. A trigger cria o perfil de cada conta como corretor.

Execute a migração uma única vez em um projeto vazio. Ela cria as tabelas do CRM e os buckets privados no Storage; não deve ser reaplicada por cima do próprio esquema.

## Conferência manual das permissões

Use duas contas de corretor e uma de admin:

- Cadastre um imóvel com o corretor A. O corretor B deve conseguir consultar o imóvel, mas não editar nem excluir.
- O corretor A deve conseguir editar e excluir o próprio imóvel.
- O admin deve conseguir consultar e editar imóveis de ambos.
- Cadastre um cliente atribuído ao corretor A. O corretor B não deve conseguir consultar esse cliente nem seus papéis, interesses, contatos ou lembretes.
- O admin deve conseguir consultar todos os clientes.
- Altere o status de um imóvel e confira a linha correspondente em `property_status_history`.
- Faça uma alteração de cadastro e confira os campos registrados em `audit_logs` com a conta admin. A conta de corretor não deve consultar essa tabela.
- Consulte `public_available_properties` sem autenticação e confirme que aparecem apenas imóveis disponíveis e sem campos de contato pessoal.

Faça as verificações usando sessões de usuário distintas, não a chave `service_role`: essa chave ignora RLS e não serve para validar as permissões.

## Escopo desta etapa

O arquivo implementa a base de dados e políticas RLS. Ainda não há interface Next.js, login do CRM, telas, compressão de fotos, relatórios, importação CSV ou função de anonimização; entram nas próximas etapas.

A view pública contém campos de anúncio e endereço do imóvel. Os anexos ficam em buckets privados. Os limites gratuitos do Supabase e da Vercel variam; confira os limites vigentes antes do deploy, especialmente armazenamento e tráfego das fotos.

