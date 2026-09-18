# Sem Barreira — Cloudflare + Google Drive

Esta versão remove Supabase e Netlify Blobs do funcionamento futuro do acervo.

## Arquitetura

- **Cloudflare Pages**: site público, painel e funções administrativas.
- **Google Drive**: PDFs, capas e backups.
- **GitHub**: `public/data/catalogo.json`, em formato aberto e versionado.
- **Sem banco de dados**: o site público lê um JSON estático.

## Pastas do Drive já preparadas

- PDFs: `1crGud0x3BzBdfjQmuLzoZCpWQLNKdvRH`
- Capas: `15i-u7YP80ufKZyyxMG6Nfeaa_StXPFZd`
- Backups do catálogo: `1Abfo-U7hPHEuwazaAJ4RTJMKr1yxRxhJ`
- Backups de planilhas: `1gaVbnfzzWOmdFPRmUE6UvBkHkJNg0fcA`

A pasta principal pode continuar privada. O painel torna públicos somente os arquivos enviados para publicação.

## 1. GitHub

Este projeto ficará na pasta `Sem-Barreira-Cloudflare` do repositório `gerlansilva/mini_repositorio`. O próprio painel atualiza `Sem-Barreira-Cloudflare/public/data/catalogo.json` usando a API do GitHub.

Crie um **fine-grained Personal Access Token** restrito somente a esse repositório, com permissão `Contents: Read and write`. Não coloque o token no código.

## 2. Cloudflare Pages

Conecte o repositório em **Workers & Pages → Create → Pages → Connect to Git**.

Configuração:

- Root directory: `Sem-Barreira-Cloudflare`
- Framework preset: `None`
- Build command: deixe vazio
- Build output directory: `public`

Adicione estas variáveis em **Settings → Variables and Secrets**:

### Secrets

- `ADMIN_PASSWORD`: senha exclusiva do painel.
- `SESSION_SECRET`: texto aleatório longo (idealmente 32+ bytes).
- `GITHUB_TOKEN`: token fine-grained do GitHub.

### Variables

- `GITHUB_OWNER`: `gerlansilva`.
- `GITHUB_REPO`: `mini_repositorio`.
- `GITHUB_BRANCH`: `main`.
- `CATALOG_PATH`: `Sem-Barreira-Cloudflare/public/data/catalogo.json`.
- `GOOGLE_CLIENT_ID`: Client ID OAuth do Google (etapa abaixo).
- `DRIVE_PDFS_FOLDER_ID`: `1crGud0x3BzBdfjQmuLzoZCpWQLNKdvRH`
- `DRIVE_CAPAS_FOLDER_ID`: `15i-u7YP80ufKZyyxMG6Nfeaa_StXPFZd`
- `DRIVE_BACKUP_CATALOGO_FOLDER_ID`: `1Abfo-U7hPHEuwazaAJ4RTJMKr1yxRxhJ`
- `DRIVE_BACKUP_PLANILHAS_FOLDER_ID`: `1gaVbnfzzWOmdFPRmUE6UvBkHkJNg0fcA`
- `LEGACY_CATALOG_URL`: `https://sembarreira.netlify.app/api/livros`

## 3. Google OAuth para o painel

O painel usa OAuth no navegador para enviar arquivos diretamente à sua conta, sem guardar senha do Google e sem service account.

No Google Cloud Console:

1. Crie ou selecione um projeto.
2. Ative **Google Drive API**.
3. Configure a tela de consentimento OAuth.
4. Crie uma credencial **OAuth Client ID → Web application**.
5. Em **Authorized JavaScript origins**, adicione o endereço do site Cloudflare, por exemplo `https://seu-projeto.pages.dev` e, depois, seu domínio próprio.
6. Copie o Client ID para `GOOGLE_CLIENT_ID` no Cloudflare.

O escopo usado é somente `https://www.googleapis.com/auth/drive.file`: o aplicativo trabalha com os arquivos criados/abertos por ele, não recebe acesso irrestrito ao Drive inteiro.

## 4. Migração do acervo existente

**Não desligue Netlify nem Supabase antes desta etapa.**

1. Faça o primeiro deploy no Cloudflare.
2. Abra `/admin.html`.
3. Entre com a senha administrativa.
4. Clique em **Conectar Drive** e autorize sua conta Google.
5. Abra a aba **Migração**.
6. Clique em **Ler catálogo antigo**.
7. Confira a quantidade de registros encontrados.
8. Clique em **Iniciar migração**.

O processo:

- lê o JSON atual do Netlify;
- copia capa por capa e PDF por PDF para as pastas do Drive;
- mantém os IDs e metadados já existentes;
- registra a origem antiga dentro de `legacy`;
- grava o catálogo novo no GitHub somente depois do processamento;
- exibe eventuais arquivos que não puderam ser copiados.

O site antigo continua intacto durante a operação.

## 5. Publicação de novos registros

No painel você pode cadastrar ou editar:

- tipo de publicação;
- título;
- autores;
- ano;
- periódico/fonte;
- DOI;
- link externo;
- palavras-chave;
- resumo;
- capa;
- PDF.

Ao enviar capa/PDF, o arquivo vai direto ao Drive e recebe permissão pública de leitura. Os metadados são commitados no GitHub. Esse commit dispara um novo deploy da Cloudflare, atualizando o JSON público.

## Segurança e portabilidade

- A senha administrativa não fica em `localStorage`; depois do login o servidor usa cookie `HttpOnly` assinado.
- O token temporário do Google existe apenas na aba do navegador e expira automaticamente.
- O token do GitHub fica somente como secret do Cloudflare.
- Excluir um registro **não apaga automaticamente** o PDF/capa do Drive.
- JSON e CSV podem ser baixados pelo painel; também é possível salvar um backup JSON no Drive.
- Não há Supabase, D1, banco SQL ou formato proprietário necessário para reconstruir o catálogo.
