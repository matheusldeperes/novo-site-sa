# Novo Site Satte Alam

Landing page rápida com 3 cards principais:
- Seminovos (link para https://www.sattealam.com.br)
- Oficina Mecânica
- Estética Automotiva

## Estrutura

- `index.html`: página principal com cards sobrepostos e efeito de movimento no hover
- `oficina.html`: página de serviços da oficina
- `estetica.html`: página de serviços de estética
- `editor.html`: editor visual simples para atualizar `data/site-content.json`
- `data/site-content.json`: conteúdo central (textos, serviços, contatos, preços)

## Como testar localmente

Abra os arquivos com um servidor local (Live Server no VS Code ou qualquer servidor estático).

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
