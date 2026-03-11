# Novo Site Satte Alam

Landing page rápida com 3 cards principais:
- Seminovos (link para https://www.sattealam.com.br)
- Oficina Mecânica
- Estética Automotiva
- Blog (conteúdo informativo, sem foco comercial)

## Estrutura

- `index.html`: página principal com cards sobrepostos e efeito de movimento no hover
- `oficina.html`: página de serviços da oficina
- `estetica.html`: página de serviços de estética
- `editor.html`: editor visual simples para atualizar `data/site-content.json`
- `blog.html`: página pública do blog (sem botão de WhatsApp)
- `blog-admin.html`: painel simples com login para cadastrar novas matérias
- `data/site-content.json`: conteúdo central (textos, serviços, contatos, preços)

## Como testar localmente

Use qualquer servidor local com suporte a PHP:

1. `php -S localhost:8000` (PHP embutido)  
   **OU** Use Live Server do VS Code
2. Acesse `http://localhost:8000` (ou a porta que configurar)

## Como publicar no GitHub Pages

1. Crie um repositório (ex.: `novo-site-sattealam`).
2. Faça upload destes arquivos.
3. Vá em **Settings > Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha a branch `main` e pasta `/ (root)`.
6. Aguarde a URL do GitHub Pages ser gerada.

## Como atualizar conteúdo sem mexer no código

1. Abra `editor.html`.
2. Atualize os dados no JSON.
3. Clique em **Baixar arquivo atualizado**.
4. Substitua `data/site-content.json` no repositório.
5. Faça commit para publicar as mudanças.

## Fluxo simples para alimentar o Blog

1. Abra `blog-admin.html`.
2. Faça login com um colaborador cadastrado em `data/blog-users.json`.
3. Preencha título, autor, data, imagens (URLs) e conteúdo.
4. Clique em **Adicionar matéria**.
5. Pronto: a matéria é salva automaticamente em `data/site-content.json` e já aparece no blog.
