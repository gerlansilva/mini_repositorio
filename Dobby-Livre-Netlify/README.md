# Dobby Livre — versão Netlify

Repositório público de livros com busca, filtros por tags, capas e painel manual de cadastro.

## Publicar

1. Crie um repositório vazio no GitHub.
2. Envie todos os arquivos desta pasta para o repositório.
3. No Netlify, escolha **Add new project → Import an existing project**.
4. Selecione GitHub e o repositório criado.
5. O Netlify reconhecerá o arquivo `netlify.toml`. Clique em **Deploy**.
6. Crie gratuitamente um projeto em `https://supabase.com`.
7. No Supabase, abra **Storage → New bucket** e crie o bucket `livros` marcado como **Public**. Não defina um limite pequeno de arquivo.
8. No Supabase, abra **Project Settings → API** e copie a URL do projeto, a chave pública/anon e a chave secreta `service_role`.
9. No Netlify, em **Project configuration → Environment variables**, crie:
   - `ADMIN_PASSWORD`: uma senha longa e exclusiva;
   - `SUPABASE_URL`: URL do projeto;
   - `SUPABASE_ANON_KEY`: chave pública/anon;
   - `SUPABASE_SERVICE_ROLE_KEY`: chave secreta service_role;
   - `SUPABASE_BUCKET`: `livros`.
10. Faça um novo deploy depois de salvar as variáveis.

Nunca coloque a chave `service_role` no GitHub ou em arquivos públicos. Ela deve existir somente nas variáveis protegidas do Netlify.

## Usar o painel

Abra `https://SEU-SITE.netlify.app/admin.html`, informe a senha administrativa e preencha:

- título completo;
- autoria;
- ano;
- tags;
- imagem da capa;
- documento PDF.

As capas e os PDFs são enviados diretamente ao Supabase Storage. Os metadados ficam no Netlify Blobs. A senha e a chave secreta não ficam gravadas no código nem no GitHub.

## Desenvolvimento local

```bash
npm install
npx netlify dev
```

Crie um arquivo `.env` local com `ADMIN_PASSWORD=sua-senha-de-teste`.
