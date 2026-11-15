# CRM Imobiliária

Painel CRM em Next.js, TypeScript, Tailwind CSS e Supabase.

## Configuração local

1. Instale Node.js 20.9 ou superior.
2. Copie `.env.example` para `.env.local`.
3. No Supabase, abra **Connect** ou **Settings → API Keys** e copie a Project URL e a publishable key para `.env.local`.
4. Em **Authentication → URL Configuration**, permita `http://localhost:3000` como Site URL e `http://localhost:3000/auth/callback` como Redirect URL.
5. No terminal, nesta pasta, execute `npm install` e depois `npm run dev`.
6. Acesse `http://localhost:3000` e entre com o usuário do Supabase.

## Atualizar o banco para fotos e imóveis

No SQL Editor do Supabase, execute uma vez o arquivo `outputs/002_reorder_property_photos.sql`. Ele habilita a ordenação/capa das fotos e valida que o corretor só associe ao imóvel um cliente que pode consultar.

Para ativar o código automático dos imóveis, execute uma vez `outputs/003_property_internal_code.sql` no SQL Editor. Os códigos existentes permanecem; novos códigos passam a ser numéricos sequenciais e não são reutilizados após exclusão.

Para liberar a edição de clientes conforme o criador do registro, execute `outputs/004_client_edit_permissions.sql` no SQL Editor. O corretor só poderá alterar clientes que cadastrou; o admin poderá alterar todos.

Depois de iniciar o painel, abra **Imóveis → Cadastrar imóvel**. Corretores visualizam todos os imóveis, mas só podem editar ou excluir os que cadastraram; o admin pode editar e excluir todos.

## Conferência manual desta etapa

- Entre com a conta admin e cadastre um imóvel com fotos e um documento.
- Confira a busca e os filtros de tipo, status, finalidade, bairro, quartos e preço.
- Reordene as fotos, marque outra como capa e confirme que a capa aparece na listagem.
- Crie duas contas de corretor: um deve ver o imóvel do outro, sem conseguir editá-lo ou excluí-lo.
- Confirme que o corretor criador consegue editar e excluir seu próprio imóvel e que o admin consegue alterar os dois.

As contas são criadas ou gerenciadas pelo admin; não há cadastro público. Use a chave publishable no frontend. Nunca use uma chave secret/service_role no navegador.

## Gerenciamento de usuários pelo CRM

Execute uma vez `outputs/006_admin_user_lifecycle.sql` no SQL Editor do Supabase. Essa migração permite excluir a conta de um usuário sem apagar clientes, imóveis, histórico ou documentos que ele cadastrou; atribuições atuais precisam ser transferidas para outra conta ativa.

Em **Usuários**, o admin pode criar conta diretamente com e-mail e senha inicial, editar nome, e-mail e perfil, desativar ou restaurar o acesso, redefinir senha e excluir. O fluxo não envia convites nem redefinições por e-mail. A senha inicial ou redefinida deve ser entregue ao usuário por um canal seguro. O sistema nunca mostra a senha depois que o formulário é enviado e nunca a grava na auditoria.

Configure `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` local e nas variáveis de ambiente da Vercel. Ela é usada somente nas rotas do servidor para administrar o Auth; nunca use um prefixo `NEXT_PUBLIC_` nessa variável nem a compartilhe. Reinicie o servidor local depois de alterar `.env.local`. A desativação também bloqueia as consultas do CRM no banco, mesmo para sessões que já estavam abertas. A própria conta admin não pode alterar sua senha ou excluir/desativar a si mesma pela tela; mantenha ao menos um admin ativo.

## Fluxo de publicação

Siga o [roteiro de publicação pelo GitHub e Vercel](outputs/publicacao-github-vercel.md). Ele cobre o primeiro envio local, variáveis de ambiente e os endereços de autenticação do Supabase. Nunca inclua `.env.local` no GitHub.

O painel contém login, recuperação de senha, listagem de imóveis com filtros e paginação, cadastro/edição, fotos comprimidas com capa e ordenação, documentos e exclusão sujeita à RLS.

## Importação de planilhas CSV

Somente o admin acessa **Importar** no menu. Baixe o modelo de clientes ou imóveis, preencha a linha de cabeçalho sem renomear as colunas e salve como CSV UTF-8. Na tela, selecione o corretor responsável (aplicado às linhas importadas), carregue o arquivo e confira o relatório de validação antes de importar. O resultado pode ser baixado como CSV.

Para imóveis, informe o CPF/CNPJ do proprietário somente se esse cliente já estiver cadastrado; a coluna é opcional. O código interno do imóvel é criado pelo banco. Para clientes, vários papéis podem ser separados por `|`; bairros de interesse também podem ser separados por `|` ou vírgula. Números aceitam vírgula decimal (por exemplo, `350000,00`) e pontos de milhar no padrão brasileiro. Faça a importação de clientes antes de importar imóveis que os referenciem como proprietários.

As linhas válidas são gravadas separadamente. Se uma linha falhar, o relatório identifica a linha e a mensagem retornada pelo banco; linhas com erro não impedem a gravação das demais. A associação de registros e as permissões continuam protegidas pelas políticas RLS já aplicadas. A tela não envia fotos ou documentos na importação CSV.

Para conectar a vitrine do site aos imóveis disponíveis, consulte [integração do site](outputs/integracao-site-imobiliaria.md). A view pública retorna apenas campos de anúncio de imóveis disponíveis; fotos e documentos seguem privados.

Para habilitar anonimização LGPD, execute uma vez `outputs/005_lgpd_anonymize_client.sql` no SQL Editor do Supabase. Na ficha do cliente, o admin verá **Anonimizar dados**. A ação limpa os dados de contato e observações, remove papéis, interesses e lembretes, apaga o vínculo do proprietário nos imóveis e retira dos logs os valores pessoais anteriores, mantendo um evento genérico de anonimização. O histórico de contatos conserva tipo e data, mas remove as anotações. A ação não pode ser desfeita.

Para habilitar a exclusão definitiva de clientes pelo admin, execute uma vez `outputs/007_delete_client_data.sql` no SQL Editor do Supabase. Na ficha do cliente, **Excluir cadastro** remove o cliente, papéis, interesses, histórico e lembretes; imóveis permanecem cadastrados, sem o vínculo de proprietário. O log conserva apenas um evento genérico de exclusão, sem dados pessoais. A operação é irreversível.

