const CONTENT_PATH = './data/site-content.json';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(dateValue) {
  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateValue;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

function toExcerpt(content, max = 140) {
  const normalized = (content || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max).trim()}...`;
}

function getPostId(post) {
  return post.id || post.slug || '';
}

function toParagraphs(content) {
  return (content || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function renderList(posts, selectedId) {
  const list = document.getElementById('blogList');

  if (!posts.length) {
    list.innerHTML = '<p>Ainda não há matérias publicadas.</p>';
    return;
  }

  list.innerHTML = posts
    .map((post) => {
      const postId = getPostId(post);
      const isActive = postId === selectedId;

      return `
        <article class="blog-list-item ${isActive ? 'active' : ''}">
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(toExcerpt(post.content))}</p>
          <small>Por ${escapeHtml(post.author)} · ${escapeHtml(formatDate(post.publishedAt))}</small>
          <a class="button ghost" href="./blog.html?post=${encodeURIComponent(postId)}">Ler matéria</a>
        </article>
      `;
    })
    .join('');
}

function renderArticle(post) {
  const section = document.getElementById('articleSection');

  if (!post) {
    section.hidden = true;
    return;
  }

  document.getElementById('articleTitle').textContent = post.title;
  document.getElementById('articleBody').innerHTML = toParagraphs(post.content);
  document.getElementById('articleMeta').textContent = `Por ${post.author} · Publicado em ${formatDate(post.publishedAt)}`;

  const imagesWrap = document.getElementById('articleImages');
  const images = Array.isArray(post.images) ? post.images.filter(Boolean) : [];

  imagesWrap.innerHTML = images
    .map((image) => `<img src="${escapeHtml(image)}" alt="Imagem de apoio da matéria ${escapeHtml(post.title)}" loading="lazy" />`)
    .join('');

  section.hidden = false;
}

function renderFooter(data) {
  const footer = document.getElementById('blogFooter');

  footer.innerHTML = `
    <strong>${escapeHtml(data.brand.name)}</strong><br />
    ${escapeHtml(data.contacts.address)}<br />
    Tel: ${escapeHtml(data.contacts.phoneLabel)}<br />
    E-mail: <a href="mailto:${escapeHtml(data.contacts.email)}">${escapeHtml(data.contacts.email)}</a>
  `;
}

async function init() {
  try {
    const response = await fetch(CONTENT_PATH);
    if (!response.ok) throw new Error('Não foi possível carregar o conteúdo do blog.');

    const data = await response.json();
    const blog = data.blog || {};
    const posts = Array.isArray(blog.posts)
      ? [...blog.posts].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      : [];

    document.getElementById('blogTitle').textContent = blog.title || 'Blog';
    document.getElementById('blogSubtitle').textContent = blog.subtitle || '';
    document.getElementById('blogDescription').textContent = blog.description || '';

    const params = new URLSearchParams(window.location.search);
    const selectedId = params.get('post') || getPostId(posts[0] || {});
    const selectedPost = posts.find((post) => getPostId(post) === selectedId);

    renderList(posts, selectedId);
    renderArticle(selectedPost || posts[0]);
    renderFooter(data);
  } catch (error) {
    document.body.innerHTML = `<main class="shell"><p>Erro: ${escapeHtml(error.message)}</p></main>`;
  }
}

init();
