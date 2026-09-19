# Quero um PDF — atualização do site

Pacote preparado para substituir os arquivos da pasta do projeto atual.

## O que mudou

- identidade visual baseada no sistema de cores do GT19: laranja `#ED7C27`, laranja escuro `#B85516`, texto `#32373C`, cinza `#667078`, borda `#DEDEDE` e branco;
- cabeçalho fixo durante a rolagem;
- nova marca tipográfica **Quero um PDF** com símbolo vetorial;
- busca sempre disponível no cabeçalho;
- citação de Umberto Eco na abertura;
- cards com capa, título, autoria com ícone e botão de PDF;
- sem tags na interface pública;
- apoio à iniciativa por Pix, com QR que contém a chave `gerlanmatfis@gmail.com` e botão para copiar;
- catálogo atualizado para os 59 PDFs e 59 capas que já estão no Google Drive;
- contador de acessos ao site, leituras e downloads;
- nova aba **Estatísticas** no painel administrativo.

## Importante: contador

O site funciona normalmente sem o contador, mas para persistir as estatísticas é necessário criar/vincular um Cloudflare KV.

No Cloudflare Dashboard:

1. Crie um namespace KV, por exemplo `quero-um-pdf-stats`.
2. Abra o projeto Pages `queroumpdf`.
3. Vá a **Settings > Bindings**.
4. Em **KV namespace bindings**, adicione o binding com o nome exatamente `STATS`.
5. Selecione o namespace criado.
6. Salve e faça um novo deployment.

Depois disso, a aba **Estatísticas** do painel mostrará:

- acessos ao site (uma contagem por sessão do navegador);
- leituras abertas;
- downloads;
- leituras e downloads por documento.

## Pix

O QR incluído no pacote codifica diretamente a chave Pix `gerlanmatfis@gmail.com`. O botão também permite copiar a chave.

## Migração

Os arquivos já foram copiados ao Google Drive. O `catalogo.json` deste pacote já aponta para o Drive. Não é necessário executar novamente a migração do Supabase.
