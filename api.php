<?php
/**
 * API de Blog - Satte Alam
 * Endpoints para autenticação e gerenciamento de matérias
 * Fluxo: login → sessão → criar/deletar posts → gravação em site-content.json
 */

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$root = __DIR__;
$contentPath = $root . '/data/site-content.json';
$usersPath = $root . '/data/blog-users.json';

// ============================================================================
// Funções Auxiliares
// ============================================================================

function jsonResponse($status, $payload) {
  http_response_code($status);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function readJsonFile($filePath) {
  if (!file_exists($filePath)) {
    return null;
  }
  $raw = @file_get_contents($filePath);
  if ($raw === false) return null;
  $decoded = @json_decode($raw, true);
  return is_array($decoded) ? $decoded : null;
}

function writeJsonFile($filePath, $data) {
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) return false;
  return @file_put_contents($filePath, $json . PHP_EOL, LOCK_EX) !== false;
}

function getRequestData() {
  $raw = @file_get_contents('php://input');
  if (!$raw) return [];
  $decoded = @json_decode($raw, true);
  return is_array($decoded) ? $decoded : [];
}

function slugify($text) {
  $text = trim(mb_strtolower((string)$text));
  $text = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
  $text = preg_replace('/[^a-z0-9]+/', '-', $text);
  $text = trim($text, '-');
  return substr($text, 0, 80);
}

function requireAuth() {
  if (empty($_SESSION['blog_user'])) {
    jsonResponse(401, ['error' => 'Faça login para continuar.']);
  }
}

// ============================================================================
// Endpoints
// ============================================================================

// GET /api.php?action=session
if ($action === 'session' && $method === 'GET') {
  if (!empty($_SESSION['blog_user'])) {
    jsonResponse(200, [
      'authenticated' => true,
      'user' => $_SESSION['blog_user'],
    ]);
  }
  jsonResponse(200, ['authenticated' => false]);
}

// POST /api.php?action=login
if ($action === 'login' && $method === 'POST') {
  $payload = getRequestData();
  $username = trim((string)($payload['username'] ?? ''));
  $password = (string)($payload['password'] ?? '');

  $usersData = readJsonFile($usersPath);
  $users = is_array($usersData['users'] ?? null) ? $usersData['users'] : [];

  foreach ($users as $user) {
    if (($user['username'] ?? '') === $username && ($user['password'] ?? '') === $password) {
      $_SESSION['blog_user'] = [
        'username' => $user['username'],
        'displayName' => $user['displayName'] ?? $user['username'],
      ];

      jsonResponse(200, [
        'ok' => true,
        'user' => $_SESSION['blog_user'],
      ]);
    }
  }

  jsonResponse(401, ['error' => 'Credenciais inválidas.']);
}

// POST /api.php?action=logout
if ($action === 'logout' && $method === 'POST') {
  $_SESSION = [];
  if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    @setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
  }
  @session_destroy();
  jsonResponse(200, ['ok' => true]);
}

// POST /api.php?action=createPost
if ($action === 'createPost' && $method === 'POST') {
  requireAuth();

  $payload = getRequestData();
  $title = trim((string)($payload['title'] ?? ''));
  $author = trim((string)($payload['author'] ?? ''));
  $publishedAt = trim((string)($payload['publishedAt'] ?? ''));
  $content = trim((string)($payload['content'] ?? ''));

  if ($title === '' || $author === '' || $publishedAt === '' || $content === '') {
    jsonResponse(400, ['error' => 'Título, autor, data e conteúdo são obrigatórios.']);
  }

  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $publishedAt)) {
    jsonResponse(400, ['error' => 'Data inválida. Use o formato AAAA-MM-DD.']);
  }

  $id = trim((string)($payload['id'] ?? ''));
  if ($id === '') {
    $id = slugify($title);
  }
  if ($id === '') {
    $id = 'post-' . time();
  }

  $images = [];
  if (is_array($payload['images'] ?? null)) {
    foreach ($payload['images'] as $item) {
      $value = trim((string)$item);
      if ($value !== '') $images[] = $value;
    }
  }

  $siteData = readJsonFile($contentPath);
  if (!$siteData) {
    jsonResponse(500, ['error' => 'Falha ao ler site-content.json']);
  }

  if (!isset($siteData['blog']) || !is_array($siteData['blog'])) {
    $siteData['blog'] = [];
  }
  if (!isset($siteData['blog']['posts']) || !is_array($siteData['blog']['posts'])) {
    $siteData['blog']['posts'] = [];
  }

  foreach ($siteData['blog']['posts'] as $post) {
    if (($post['id'] ?? '') === $id) {
      $id = $id . '-' . time();
      break;
    }
  }

  $siteData['blog']['posts'][] = [
    'id' => $id,
    'title' => $title,
    'author' => $author,
    'publishedAt' => $publishedAt,
    'images' => $images,
    'content' => $content,
  ];

  usort($siteData['blog']['posts'], function ($a, $b) {
    return strcmp((string)($b['publishedAt'] ?? ''), (string)($a['publishedAt'] ?? ''));
  });

  if (!writeJsonFile($contentPath, $siteData)) {
    jsonResponse(500, ['error' => 'Falha ao salvar site-content.json. Verifique permissões de escrita.']);
  }

  jsonResponse(201, ['ok' => true, 'id' => $id]);
}

// DELETE /api.php?action=deletePost&id=post-id
if ($action === 'deletePost' && $method === 'DELETE') {
  requireAuth();

  $postId = trim((string)($_GET['id'] ?? ''));
  if ($postId === '') {
    jsonResponse(400, ['error' => 'ID inválido.']);
  }

  $siteData = readJsonFile($contentPath);
  if (!$siteData || !is_array($siteData['blog']['posts'] ?? null)) {
    jsonResponse(404, ['error' => 'Nenhuma matéria encontrada.']);
  }

  $before = count($siteData['blog']['posts']);
  $siteData['blog']['posts'] = array_values(array_filter(
    $siteData['blog']['posts'],
    function ($post) use ($postId) {
      return (($post['id'] ?? '') !== $postId);
    }
  ));

  if (count($siteData['blog']['posts']) === $before) {
    jsonResponse(404, ['error' => 'Matéria não encontrada.']);
  }

  if (!writeJsonFile($contentPath, $siteData)) {
    jsonResponse(500, ['error' => 'Falha ao salvar site-content.json. Verifique permissões de escrita.']);
  }

  jsonResponse(200, ['ok' => true]);
}

// POST /api.php?action=uploadImage
if ($action === 'uploadImage' && $method === 'POST') {
  requireAuth();

  if (empty($_FILES['file'])) {
    jsonResponse(400, ['error' => 'Nenhum arquivo foi enviado.']);
  }

  $file = $_FILES['file'];
  $error = $file['error'] ?? UPLOAD_ERR_NO_FILE;

  if ($error !== UPLOAD_ERR_OK) {
    $errorMessages = [
      UPLOAD_ERR_INI_SIZE => 'Arquivo excede o tamanho máximo do servidor.',
      UPLOAD_ERR_FORM_SIZE => 'Arquivo excede o tamanho máximo do formulário.',
      UPLOAD_ERR_PARTIAL => 'Upload foi interrompido.',
      UPLOAD_ERR_NO_FILE => 'Nenhum arquivo foi enviado.',
      UPLOAD_ERR_NO_TMP_DIR => 'Diretório temporário não encontrado.',
      UPLOAD_ERR_CANT_WRITE => 'Falha ao gravar arquivo no disco.',
      UPLOAD_ERR_EXTENSION => 'Upload bloqueado pela extensão do servidor.',
    ];
    jsonResponse(400, ['error' => $errorMessages[$error] ?? 'Erro desconhecido no upload.']);
  }

  $maxSize = 5 * 1024 * 1024;
  $allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  $tmpPath = $file['tmp_name'] ?? '';
  $origName = $file['name'] ?? '';

  if (empty($tmpPath) || !file_exists($tmpPath)) {
    jsonResponse(500, ['error' => 'Arquivo temporário não encontrado.']);
  }

  $finfo = @finfo_open(FILEINFO_MIME_TYPE);
  $mimeType = $finfo ? @finfo_file($finfo, $tmpPath) : '';
  @finfo_close($finfo);

  if (!in_array($mimeType, $allowedTypes)) {
    jsonResponse(400, ['error' => 'Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.']);
  }

  $fileSize = @filesize($tmpPath);
  if ($fileSize === false || $fileSize > $maxSize) {
    jsonResponse(413, ['error' => 'Arquivo muito grande. Máximo 5MB.']);
  }

  $uploadDir = $root . '/assets/blog';
  if (!is_dir($uploadDir)) {
    if (!@mkdir($uploadDir, 0755, true)) {
      jsonResponse(500, ['error' => 'Falha ao criar diretório de upload.']);
    }
  }

  $ext = pathinfo($origName, PATHINFO_EXTENSION);
  if (!preg_match('/^[a-z0-9]{2,5}$/i', $ext)) {
    $ext = 'jpg';
  }

  $sanitized = preg_replace('/[^a-z0-9._-]/i', '', pathinfo($origName, PATHINFO_FILENAME));
  if (strlen($sanitized) === 0) {
    $sanitized = 'image';
  }

  $newFileName = $sanitized . '-' . time() . '.' . strtolower($ext);
  $newPath = $uploadDir . '/' . $newFileName;

  if (!@move_uploaded_file($tmpPath, $newPath)) {
    jsonResponse(500, ['error' => 'Falha ao mover arquivo para o destino final.']);
  }

  @chmod($newPath, 0644);

  $relativePath = '/assets/blog/' . $newFileName;
  jsonResponse(201, ['ok' => true, 'path' => $relativePath]);
}

// Rota não encontrada
jsonResponse(404, ['error' => 'Rota não encontrada.']);
