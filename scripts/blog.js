const CONTENT_PATH = './data/site-content.json';

let blogPosts = [];
let selectedPostIndex = 0;

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

function getPostCoverImage(post) {
  const firstImage = Array.isArray(post.images) ? post.images.find(Boolean) : '';
  return resolveImagePath(firstImage || '');
}

function linkifyText(text) {
  return text.replace(/((https?:\/\/|www\.)[^\s<]+)/gi, (match) => {
    let url = match;
    let trailing = '';

    while (/[),.;!?]$/.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }

    const href = /^www\./i.test(url) ? `https://${url}` : url;
    const safeHref = escapeHtml(href);
    const safeLabel = escapeHtml(url);

    return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>${trailing}`;
  });
}

function resolveImagePath(imagePath) {
  if (!imagePath) return '';
  if (/^https?:\/\//i.test(imagePath) || imagePath.startsWith('data:')) return imagePath;

  if (imagePath.startsWith('/assets/')) {
    const currentPath = window.location.pathname;
    const baseDir = currentPath.endsWith('/')
      ? currentPath.replace(/\/$/, '')
      : currentPath.replace(/\/[^/]*$/, '');

    if (baseDir && baseDir !== '/') {
      return `${baseDir}${imagePath}`;
    }
  }

  return imagePath;
}

function toParagraphs(content) {
  return (content || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${linkifyText(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function renderList(posts, selectedId) {
  const list = document.getElementById('blogList');

  if (!posts.length) {
    list.innerHTML = '<p>Ainda não há matérias publicadas.</p>';
    return;
  }

  list.innerHTML = `
    <div class="blog-carousel" aria-label="Carrossel de publicações">
      <button class="blog-carousel-nav prev" type="button" aria-label="Matéria anterior">&#8592;</button>
      <div class="blog-carousel-viewport" id="blogCarouselViewport">
        <div class="blog-carousel-track">
          ${posts
            .map((post, index) => {
              const postId = getPostId(post);
              const isActive = postId === selectedId;
              const coverImage = getPostCoverImage(post);

              return `
                <article class="blog-list-item ${isActive ? 'active' : ''}" data-post-id="${escapeHtml(postId)}" data-index="${index}" tabindex="0" role="button" aria-pressed="${isActive ? 'true' : 'false'}">
                  <div class="blog-card-media${coverImage ? '' : ' no-image'}"${coverImage ? ` style="background-image: linear-gradient(180deg, rgba(2, 3, 5, 0.05) 0%, rgba(2, 3, 5, 0.4) 100%), url('${escapeHtml(coverImage)}')"` : ''}>
                    <span class="blog-card-chip">Matéria</span>
                  </div>
                  <div class="blog-card-content">
                    <small class="blog-card-meta">${escapeHtml(formatDate(post.publishedAt))} · ${escapeHtml(post.author)}</small>
                    <h3>${escapeHtml(post.title)}</h3>
                    <p>${escapeHtml(toExcerpt(post.content, 155))}</p>
                    <span class="blog-card-cta">Ler matéria <span aria-hidden="true">→</span></span>
                  </div>
                </article>
              `;
            })
            .join('')}
        </div>
      </div>
      <button class="blog-carousel-nav next" type="button" aria-label="Próxima matéria">&#8594;</button>
    </div>
  `;

  attachCarouselEvents();
  scrollSelectedCardIntoView();
}

function updateSelectedCard() {
  const cards = document.querySelectorAll('.blog-list-item[data-index]');
  cards.forEach((card, index) => {
    const isActive = index === selectedPostIndex;
    card.classList.toggle('active', isActive);
    card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function scrollSelectedCardIntoView() {
  const selectedCard = document.querySelector(`.blog-list-item[data-index="${selectedPostIndex}"]`);
  if (!selectedCard) return;

  selectedCard.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function selectPostByIndex(index) {
  if (!blogPosts.length) return;

  const normalizedIndex = Math.max(0, Math.min(index, blogPosts.length - 1));
  selectedPostIndex = normalizedIndex;
  const selectedPost = blogPosts[selectedPostIndex];

  updateSelectedCard();
  scrollSelectedCardIntoView();
  renderArticle(selectedPost);

  const postId = getPostId(selectedPost);
  const nextUrl = `./blog.html?post=${encodeURIComponent(postId)}`;
  window.history.replaceState({}, '', nextUrl);
}

function moveCarousel(direction) {
  selectPostByIndex(selectedPostIndex + direction);
}

function attachCarouselEvents() {
  const list = document.getElementById('blogList');
  const prevButton = list.querySelector('.blog-carousel-nav.prev');
  const nextButton = list.querySelector('.blog-carousel-nav.next');

  prevButton?.addEventListener('click', () => moveCarousel(-1));
  nextButton?.addEventListener('click', () => moveCarousel(1));

  list.querySelectorAll('.blog-list-item[data-index]').forEach((card) => {
    card.addEventListener('click', () => {
      selectPostByIndex(Number(card.dataset.index));
    });

    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectPostByIndex(Number(card.dataset.index));
      }
    });
  });
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
    .map((image) => `<img src="${escapeHtml(resolveImagePath(image))}" alt="Imagem de apoio da matéria ${escapeHtml(post.title)}" loading="lazy" />`)
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
    const selectedIndex = Math.max(
      0,
      posts.findIndex((post) => getPostId(post) === selectedId),
    );

    blogPosts = posts;
    selectedPostIndex = selectedIndex;
    const selectedPost = posts[selectedIndex] || posts[0];

    renderList(posts, selectedId);
    renderArticle(selectedPost || posts[0]);
    renderFooter(data);
  } catch (error) {
    document.body.innerHTML = `<main class="shell"><p>Erro: ${escapeHtml(error.message)}</p></main>`;
  }
}

init();
