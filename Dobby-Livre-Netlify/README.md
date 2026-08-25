# Dobby Livre — versão Netlify

Repositório público de livros com busca, filtros por tags, capas e painel manual de cadastro.

## Publicar

1. Crie um repositório vazio no GitHub.
2. Envie todos os arquivos desta pasta para o repositório.
3. No Netlify, escolha **Add new project → Import an existing project**.
4. Selecione GitHub e o repositório criado.
5. O Netlify reconhecerá o arquivo `netlify.toml`. Clique em **Deploy**.
6. Em **Project configuration → Environment variables**, crie:
   - chave: `ADMIN_PASSWORD`
   - valor: uma senha longa, exclusiva e difícil de adivinhar.
7. Faça um novo deploy depois de salvar a variável.

## Usar o painel

Abra `https://SEU-SITE.netlify.app/admin.html`, informe a senha administrativa e preencha:

- título completo;
- autoria;
- ano;
- tags;
- imagem da capa;
- documento PDF.

Os arquivos e os metadados são armazenados em Netlify Blobs. A senha não fica gravada no código nem no GitHub.

## Desenvolvimento local

```bash
npm install
npx netlify dev
```

Crie um arquivo `.env` local com `ADMIN_PASSWORD=sua-senha-de-teste`.
