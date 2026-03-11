const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8080);
const ROOT_DIR = __dirname;
const CONTENT_PATH = path.join(ROOT_DIR, 'data', 'site-content.json');
const USERS_PATH = path.join(ROOT_DIR, 'data', 'blog-users.json');
const SESSION_COOKIE = 'sa_blog_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

const sessions = new Map();

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
}

function parseCookies(cookieHeader = '') {
  return cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const [key, ...rest] = pair.split('=');
      acc[key] = decodeURIComponent(rest.join('='));
      return acc;
    }, {});
}

function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setSessionCookie(res, token) {
  const attrs = ['HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`];
  if (process.env.NODE_ENV === 'production') attrs.push('Secure');

  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; ${attrs.join('; ')}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';

    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Payload muito grande.'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON inválido.'));
      }
    });

    req.on('error', reject);
  });
}

async function readUsers() {
  const raw = await fs.readFile(USERS_PATH, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data.users) ? data.users : [];
}

async function readContent() {
  const raw = await fs.readFile(CONTENT_PATH, 'utf8');
  return JSON.parse(raw);
}

async function writeContent(data) {
  await fs.writeFile(CONTENT_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;

  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }

  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, ...session };
}

function normalizePost(input) {
  const title = String(input.title || '').trim();
  const author = String(input.author || '').trim();
  const publishedAt = String(input.publishedAt || '').trim();
  const content = String(input.content || '').trim();

  let id = String(input.id || '').trim();
  if (!id) {
    id = title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 80);
  }

  const images = Array.isArray(input.images)
    ? input.images.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  if (!title || !author || !publishedAt || !content) {
    return { error: 'Título, autor, data e conteúdo são obrigatórios.' };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    return { error: 'Data inválida. Use o formato AAAA-MM-DD.' };
  }

  if (!id) {
    id = `post-${Date.now()}`;
  }

  return {
    post: {
      id,
      title,
      author,
      publishedAt,
      images,
      content,
    },
  };
}

function resolveFilePath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  if (cleanPath.includes('..')) return null;

  const routes = {
    '/': '/index.html',
    '/oficina': '/oficina.html',
    '/estetica': '/estetica.html',
    '/blog': '/blog.html',
    '/blog-admin': '/blog-admin.html',
    '/editor': '/editor.html',
  };

  const mappedPath = routes[cleanPath] || cleanPath;
  const absolute = path.join(ROOT_DIR, mappedPath);

  if (!absolute.startsWith(ROOT_DIR)) return null;
  return absolute;
}

async function serveStatic(req, res) {
  const filePath = resolveFilePath(req.url || '/');
  if (!filePath) {
    sendJson(res, 400, { error: 'Caminho inválido.' });
    return;
  }

  if (filePath.endsWith(path.join('data', 'blog-users.json'))) {
    sendJson(res, 404, { error: 'Não encontrado.' });
    return;
  }

  let finalPath = filePath;
  try {
    const stat = await fs.stat(finalPath);
    if (stat.isDirectory()) finalPath = path.join(finalPath, 'index.html');
  } catch {
    if (!path.extname(finalPath)) {
      finalPath = `${finalPath}.html`;
    }
  }

  try {
    const content = await fs.readFile(finalPath);
    const ext = path.extname(finalPath).toLowerCase();
    const contentType = contentTypes[ext] || 'application/octet-stream';

    const headers = { 'Content-Type': contentType };
    if (ext === '.json') headers['Cache-Control'] = 'no-store';

    res.writeHead(200, headers);
    res.end(content);
  } catch {
    sendJson(res, 404, { error: 'Arquivo não encontrado.' });
  }
}

async function handleApi(req, res) {
  const { method, url = '/' } = req;

  if (method === 'GET' && url === '/api/session') {
    const session = getSession(req);
    if (!session) {
      sendJson(res, 200, { authenticated: false });
      return;
    }

    sendJson(res, 200, {
      authenticated: true,
      user: {
        username: session.username,
        displayName: session.displayName,
      },
    });
    return;
  }

  if (method === 'POST' && url === '/api/login') {
    try {
      const body = await readBody(req);
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const users = await readUsers();
      const found = users.find((user) => user.username === username && user.password === password);

      if (!found) {
        sendJson(res, 401, { error: 'Credenciais inválidas.' });
        return;
      }

      const token = newSessionToken();
      sessions.set(token, {
        username: found.username,
        displayName: found.displayName || found.username,
        expiresAt: Date.now() + SESSION_TTL_MS,
      });

      setSessionCookie(res, token);
      sendJson(res, 200, {
        ok: true,
        user: {
          username: found.username,
          displayName: found.displayName || found.username,
        },
      });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (method === 'POST' && url === '/api/logout') {
    const session = getSession(req);
    if (session) sessions.delete(session.token);
    clearSessionCookie(res);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === 'POST' && url === '/api/posts') {
    const session = getSession(req);
    if (!session) {
      sendJson(res, 401, { error: 'Faça login para publicar.' });
      return;
    }

    try {
      const body = await readBody(req);
      const normalized = normalizePost(body);
      if (normalized.error) {
        sendJson(res, 400, { error: normalized.error });
        return;
      }

      const data = await readContent();
      if (!data.blog) data.blog = {};
      if (!Array.isArray(data.blog.posts)) data.blog.posts = [];

      let postId = normalized.post.id;
      if (data.blog.posts.some((post) => post.id === postId)) {
        postId = `${postId}-${Date.now()}`;
      }

      data.blog.posts.push({ ...normalized.post, id: postId });
      data.blog.posts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

      await writeContent(data);
      sendJson(res, 201, { ok: true, id: postId });
    } catch (error) {
      sendJson(res, 500, { error: `Falha ao salvar matéria: ${error.message}` });
    }
    return;
  }

  if (method === 'DELETE' && url.startsWith('/api/posts/')) {
    const session = getSession(req);
    if (!session) {
      sendJson(res, 401, { error: 'Faça login para remover.' });
      return;
    }

    const postId = decodeURIComponent(url.replace('/api/posts/', '')).trim();
    if (!postId) {
      sendJson(res, 400, { error: 'ID inválido.' });
      return;
    }

    try {
      const data = await readContent();
      if (!data.blog || !Array.isArray(data.blog.posts)) {
        sendJson(res, 404, { error: 'Nenhuma matéria encontrada.' });
        return;
      }

      const before = data.blog.posts.length;
      data.blog.posts = data.blog.posts.filter((post) => post.id !== postId);

      if (data.blog.posts.length === before) {
        sendJson(res, 404, { error: 'Matéria não encontrada.' });
        return;
      }

      await writeContent(data);
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 500, { error: `Falha ao remover matéria: ${error.message}` });
    }
    return;
  }

  sendJson(res, 404, { error: 'Rota não encontrada.' });
}

const server = http.createServer(async (req, res) => {
  if ((req.url || '').startsWith('/api/')) {
    await handleApi(req, res);
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Servidor iniciado em http://localhost:${PORT}`);
});
