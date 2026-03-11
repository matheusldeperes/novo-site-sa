const CONTENT_PATH = './data/site-content.json';

const loginPanel = document.getElementById('loginPanel');
const editorPanel = document.getElementById('editorPanel');
const postsPanel = document.getElementById('postsPanel');
const loginForm = document.getElementById('loginForm');
const postForm = document.getElementById('postForm');
const adminStatus = document.getElementById('adminStatus');
const postsList = document.getElementById('adminPostsList');

let siteData = null;
let currentUser = null;

function setStatus(text, isError = false) {
  adminStatus.textContent = text;
  adminStatus.classList.toggle('error', isError);
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80);
}

function sortPosts() {
  siteData.blog.posts = [...siteData.blog.posts].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function renderPosts() {
  const posts = siteData?.blog?.posts || [];

  if (!posts.length) {
    postsList.innerHTML = '<p>Nenhuma matéria cadastrada até o momento.</p>';
    return;
  }

  postsList.innerHTML = posts
    .map(
      (post) => `
      <article class="blog-admin-item">
        <h3>${post.title}</h3>
        <p>Por ${post.author} · ${post.publishedAt}</p>
        <button type="button" class="button ghost" data-remove-id="${post.id}">Remover</button>
      </article>
    `,
    )
    .join('');
}

async function loadContent() {
  const response = await fetch(`${CONTENT_PATH}?v=${Date.now()}`);
  if (!response.ok) throw new Error('Não foi possível carregar o conteúdo base.');

  siteData = await response.json();
  if (!siteData.blog) siteData.blog = {};
  if (!Array.isArray(siteData.blog.posts)) siteData.blog.posts = [];

  sortPosts();
  renderPosts();
}

function showLoggedInState(user) {
  currentUser = user;
  document.getElementById('postAuthor').value = user.displayName || user.username;

  loginPanel.hidden = true;
  editorPanel.hidden = false;
  postsPanel.hidden = false;
  setStatus(`Login realizado. Bem-vindo(a), ${user.displayName || user.username}.`);
}

function showLoggedOutState() {
  currentUser = null;
  loginPanel.hidden = false;
  editorPanel.hidden = true;
  postsPanel.hidden = true;
  loginForm.reset();
}

async function uploadImages(fileList) {
  const MAX_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const paths = [];

  for (const file of fileList) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { error: `Tipo inválido: ${file.name}. Use JPEG, PNG, WebP ou GIF.` };
    }

    if (file.size > MAX_SIZE) {
      return { error: `Arquivo muito grande: ${file.name}. Máximo 5MB.` };
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api.php?action=uploadImage', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        return { error: result.error || `Falha ao enviar ${file.name}` };
      }

      const result = await response.json();
      if (result.path) {
        paths.push(result.path);
      }
    } catch (error) {
      return { error: `Erro ao enviar ${file.name}: ${error.message}` };
    }
  }

  return { paths };
}

async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const response = await fetch('/api.php?action=login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      setStatus('Usuário ou senha inválidos.', true);
      return;
    }

    const result = await response.json();
    showLoggedInState(result.user);
  } catch (error) {
    setStatus(`Falha no login: ${error.message}`, true);
  }
}

async function handlePostSubmit(event) {
  event.preventDefault();

  const title = document.getElementById('postTitle').value.trim();
  const author = document.getElementById('postAuthor').value.trim() || currentUser.displayName || currentUser.username;
  const publishedAt = document.getElementById('postDate').value;
  const content = document.getElementById('postContent').value.trim();
  const fileInput = document.getElementById('postImages');
  const files = fileInput.files || [];

  if (!title || !publishedAt || !content) {
    setStatus('Preencha título, data e conteúdo.', true);
    return;
  }

  setStatus('Processando imagens...');

  let images = [];
  if (files.length > 0) {
    const uploadedImages = await uploadImages(files);
    if (uploadedImages.error) {
      setStatus(uploadedImages.error, true);
      return;
    }
    images = uploadedImages.paths || [];
  }

  let id = slugify(title);
  if (!id) id = `post-${Date.now()}`;

  if ((siteData.blog.posts || []).some((post) => post.id === id)) {
    id = `${id}-${Date.now()}`;
  }

  try {
    const response = await fetch('/api.php?action=createPost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        id,
        title,
        author,
        publishedAt,
        images,
        content,
      }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setStatus(result.error || 'Não foi possível salvar a matéria.', true);
      return;
    }

    await loadContent();
    postForm.reset();
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('postAuthor').value = author;
    document.getElementById('postDate').value = new Date().toISOString().slice(0, 10);
    setStatus('Matéria adicionada e publicada com sucesso.');
  } catch (error) {
    setStatus(`Falha ao salvar matéria: ${error.message}`, true);
  }
}

async function init() {
  await loadContent();
  document.getElementById('postDate').value = new Date().toISOString().slice(0, 10);

  const sessionResponse = await fetch('/api.php?action=session', { credentials: 'same-origin' });
  if (sessionResponse.ok) {
    const sessionData = await sessionResponse.json();
    if (sessionData.authenticated) {
      showLoggedInState(sessionData.user);
    }
  }

  loginForm.addEventListener('submit', handleLogin);
  postForm.addEventListener('submit', handlePostSubmit);

  document.getElementById('postImages').addEventListener('change', (event) => {
    const fileInput = event.target;
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';

    for (const file of fileInput.files) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.maxWidth = '100px';
        img.style.maxHeight = '100px';
        img.style.marginRight = '8px';
        img.style.marginBottom = '8px';
        img.style.borderRadius = '4px';
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api.php?action=logout', { method: 'POST', credentials: 'same-origin' });
    showLoggedOutState();
  });

  postsList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-remove-id]');
    if (!button) return;

    try {
      const postId = button.dataset.removeId;
      const response = await fetch(`/api.php?action=deletePost&id=${encodeURIComponent(postId)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        setStatus(result.error || 'Não foi possível remover a matéria.', true);
        return;
      }

      await loadContent();
      setStatus('Matéria removida com sucesso.');
    } catch (error) {
      setStatus(`Falha ao remover matéria: ${error.message}`, true);
    }
  });
}

init().catch((error) => {
  loginPanel.innerHTML = `<p class="status error">Erro ao iniciar painel: ${error.message}</p>`;
});
