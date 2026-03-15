const CONTENT_PATH = './data/site-content.json';
const API_PATH = './api.php';

const loginPanel = document.getElementById('loginPanel');
const editorPanel = document.getElementById('editorPanel');
const postsPanel = document.getElementById('postsPanel');
const loginForm = document.getElementById('loginForm');
const postForm = document.getElementById('postForm');
const adminStatus = document.getElementById('adminStatus');
const loginStatus = document.getElementById('loginStatus');
const postsList = document.getElementById('adminPostsList');
const savePostBtn = document.getElementById('savePostBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editingPostIdInput = document.getElementById('editingPostId');
const existingImagesInfo = document.getElementById('existingImagesInfo');

let siteData = null;
let currentUser = null;
let editingPostImages = [];

async function requestApiJson(url, options = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();

  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error('Resposta inválida da API (esperado JSON). Verifique caminho do api.php na subpasta /novo.');
  }

  if (!response.ok) {
    throw new Error(data.error || `Erro ${response.status} na API.`);
  }

  return data;
}

function setStatus(text, isError = false) {
  adminStatus.textContent = text;
  adminStatus.classList.toggle('error', isError);
}

function setLoginStatus(text, isError = false) {
  if (!loginStatus) return;
  loginStatus.textContent = text;
  loginStatus.classList.toggle('error', isError);
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
        <button type="button" class="button" data-edit-id="${post.id}">Editar</button>
        <button type="button" class="button ghost" data-remove-id="${post.id}">Remover</button>
      </article>
    `,
    )
    .join('');
}

function resetEditorForm() {
  postForm.reset();
  editingPostIdInput.value = '';
  editingPostImages = [];
  savePostBtn.textContent = 'Adicionar matéria';
  cancelEditBtn.hidden = true;
  existingImagesInfo.textContent = '';
  document.getElementById('imagePreview').innerHTML = '';
  document.getElementById('postDate').value = new Date().toISOString().slice(0, 10);

  if (currentUser) {
    document.getElementById('postAuthor').value = currentUser.displayName || currentUser.username;
  }
}

function startEditingPost(post) {
  editingPostIdInput.value = post.id || '';
  editingPostImages = Array.isArray(post.images) ? [...post.images] : [];

  document.getElementById('postTitle').value = post.title || '';
  document.getElementById('postAuthor').value = post.author || (currentUser ? (currentUser.displayName || currentUser.username) : '');
  document.getElementById('postDate').value = post.publishedAt || new Date().toISOString().slice(0, 10);
  document.getElementById('postContent').value = post.content || '';
  document.getElementById('postImages').value = '';
  document.getElementById('imagePreview').innerHTML = '';

  savePostBtn.textContent = 'Salvar alterações';
  cancelEditBtn.hidden = false;
  existingImagesInfo.textContent = editingPostImages.length
    ? `Esta matéria já possui ${editingPostImages.length} imagem(ns). As novas serão adicionadas às existentes.`
    : 'Esta matéria não possui imagens salvas.';

  setStatus(`Editando matéria: ${post.title}`);
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
  setLoginStatus('');
  resetEditorForm();
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
      const result = await requestApiJson(`${API_PATH}?action=uploadImage`, {
        method: 'POST',
        credentials: 'same-origin',
        body: formData,
      });

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
    const result = await requestApiJson(`${API_PATH}?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });

    showLoggedInState(result.user);
  } catch (error) {
    setLoginStatus(`Falha no login: ${error.message}`, true);
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
  const editingId = editingPostIdInput.value.trim();

  if (!title || !publishedAt || !content) {
    setStatus('Preencha título, data e conteúdo.', true);
    return;
  }

  setStatus('Processando imagens...');

  let images = editingId ? [...editingPostImages] : [];
  if (files.length > 0) {
    const uploadedImages = await uploadImages(files);
    if (uploadedImages.error) {
      setStatus(uploadedImages.error, true);
      return;
    }
    images = [...images, ...(uploadedImages.paths || [])];
  }

  let id = editingId;
  if (!id) {
    id = slugify(title);
    if (!id) id = `post-${Date.now()}`;

    if ((siteData.blog.posts || []).some((post) => post.id === id)) {
      id = `${id}-${Date.now()}`;
    }
  }

  try {
    await requestApiJson(`${API_PATH}?action=${editingId ? 'updatePost' : 'createPost'}`, {
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

    await loadContent();
    resetEditorForm();
    setStatus(editingId ? 'Matéria atualizada com sucesso.' : 'Matéria adicionada e publicada com sucesso.');
  } catch (error) {
    setStatus(`Falha ao salvar matéria: ${error.message}`, true);
  }
}

async function init() {
  if (window.location.hostname.includes('github.io')) {
    setLoginStatus('No GitHub Pages, o login não funciona porque ele não executa PHP. Use seu domínio/cPanel para publicar matérias.', true);
  }

  await loadContent();
  document.getElementById('postDate').value = new Date().toISOString().slice(0, 10);

  try {
    const sessionData = await requestApiJson(`${API_PATH}?action=session`, { credentials: 'same-origin' });
    if (sessionData.authenticated) {
      showLoggedInState(sessionData.user);
    }
  } catch (error) {
    setLoginStatus(`Falha na API: ${error.message}`, true);
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
    await requestApiJson(`${API_PATH}?action=logout`, { method: 'POST', credentials: 'same-origin' });
    resetEditorForm();
    showLoggedOutState();
  });

  cancelEditBtn.addEventListener('click', () => {
    resetEditorForm();
    setStatus('Edição cancelada.');
  });

  postsList.addEventListener('click', async (event) => {
    const editButton = event.target.closest('button[data-edit-id]');
    if (editButton) {
      const postId = editButton.dataset.editId;
      const post = (siteData.blog.posts || []).find((item) => item.id === postId);
      if (post) {
        startEditingPost(post);
      }
      return;
    }

    const button = event.target.closest('button[data-remove-id]');
    if (!button) return;

    try {
      const postId = button.dataset.removeId;
      await requestApiJson(`${API_PATH}?action=deletePost&id=${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });

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
