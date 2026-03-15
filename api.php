<?php
session_start();
error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

$root = __DIR__;
$contentPath = $root . '/data/site-content.json';
$usersPath = $root . '/data/blog-users.json';
$action = isset($_GET['action']) ? $_GET['action'] : '';
$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

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
  if ($raw === false) {
    return null;
  }

  $decoded = @json_decode($raw, true);
  return is_array($decoded) ? $decoded : null;
}

function writeJsonFile($filePath, $data) {
  $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) {
    return false;
  }

  return @file_put_contents($filePath, $json . PHP_EOL, LOCK_EX) !== false;
}

function getRequestData() {
  $raw = @file_get_contents('php://input');
  if (!$raw) {
    return array();
  }

  $decoded = @json_decode($raw, true);
  return is_array($decoded) ? $decoded : array();
}

function toLower($value) {
  if (function_exists('mb_strtolower')) {
    return mb_strtolower($value, 'UTF-8');
  }
  return strtolower($value);
}

function slugify($text) {
  $text = trim(toLower((string)$text));

  if (function_exists('iconv')) {
    $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
    if ($converted !== false) {
      $text = $converted;
    }
  }

  $text = preg_replace('/[^a-z0-9]+/', '-', $text);
  $text = trim($text, '-');
  return substr($text, 0, 80);
}

function requireAuth() {
  if (empty($_SESSION['blog_user'])) {
    jsonResponse(401, array('error' => 'Faça login para continuar.'));
  }
}

if ($action === 'session' && $method === 'GET') {
  if (!empty($_SESSION['blog_user'])) {
    jsonResponse(200, array(
      'authenticated' => true,
      'user' => $_SESSION['blog_user'],
    ));
  }

  jsonResponse(200, array('authenticated' => false));
}

if ($action === 'login' && $method === 'POST') {
  $payload = getRequestData();
  $username = isset($payload['username']) ? trim((string)$payload['username']) : '';
  $password = isset($payload['password']) ? (string)$payload['password'] : '';

  $usersData = readJsonFile($usersPath);
  $users = (is_array($usersData) && isset($usersData['users']) && is_array($usersData['users'])) ? $usersData['users'] : array();

  foreach ($users as $user) {
    $u = isset($user['username']) ? $user['username'] : '';
    $p = isset($user['password']) ? $user['password'] : '';

    if ($u === $username && $p === $password) {
      $_SESSION['blog_user'] = array(
        'username' => $u,
        'displayName' => isset($user['displayName']) ? $user['displayName'] : $u,
      );

      jsonResponse(200, array(
        'ok' => true,
        'user' => $_SESSION['blog_user'],
      ));
    }
  }

  jsonResponse(401, array('error' => 'Credenciais inválidas.'));
}

if ($action === 'logout' && $method === 'POST') {
  $_SESSION = array();

  if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    @setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
  }

  @session_destroy();
  jsonResponse(200, array('ok' => true));
}

if ($action === 'createPost' && $method === 'POST') {
  requireAuth();

  $payload = getRequestData();
  $title = isset($payload['title']) ? trim((string)$payload['title']) : '';
  $author = isset($payload['author']) ? trim((string)$payload['author']) : '';
  $publishedAt = isset($payload['publishedAt']) ? trim((string)$payload['publishedAt']) : '';
  $content = isset($payload['content']) ? trim((string)$payload['content']) : '';

  if ($title === '' || $author === '' || $publishedAt === '' || $content === '') {
    jsonResponse(400, array('error' => 'Título, autor, data e conteúdo são obrigatórios.'));
  }

  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $publishedAt)) {
    jsonResponse(400, array('error' => 'Data inválida. Use o formato AAAA-MM-DD.'));
  }

  $id = isset($payload['id']) ? trim((string)$payload['id']) : '';
  if ($id === '') {
    $id = slugify($title);
  }
  if ($id === '') {
    $id = 'post-' . time();
  }

  $images = array();
  if (isset($payload['images']) && is_array($payload['images'])) {
    foreach ($payload['images'] as $item) {
      $value = trim((string)$item);
      if ($value !== '') {
        $images[] = $value;
      }
    }
  }

  $siteData = readJsonFile($contentPath);
  if (!is_array($siteData)) {
    jsonResponse(500, array('error' => 'Falha ao ler site-content.json.'));
  }

  if (!isset($siteData['blog']) || !is_array($siteData['blog'])) {
    $siteData['blog'] = array();
  }
  if (!isset($siteData['blog']['posts']) || !is_array($siteData['blog']['posts'])) {
    $siteData['blog']['posts'] = array();
  }

  foreach ($siteData['blog']['posts'] as $post) {
    if (isset($post['id']) && $post['id'] === $id) {
      $id = $id . '-' . time();
      break;
    }
  }

  $siteData['blog']['posts'][] = array(
    'id' => $id,
    'title' => $title,
    'author' => $author,
    'publishedAt' => $publishedAt,
    'images' => $images,
    'content' => $content,
  );

  usort($siteData['blog']['posts'], function ($a, $b) {
    $dateA = isset($a['publishedAt']) ? $a['publishedAt'] : '';
    $dateB = isset($b['publishedAt']) ? $b['publishedAt'] : '';
    return strcmp($dateB, $dateA);
  });

  if (!writeJsonFile($contentPath, $siteData)) {
    jsonResponse(500, array('error' => 'Falha ao salvar site-content.json. Verifique permissões de escrita.'));
  }

  jsonResponse(201, array('ok' => true, 'id' => $id));
}

if ($action === 'updatePost' && $method === 'POST') {
  requireAuth();

  $payload = getRequestData();
  $id = isset($payload['id']) ? trim((string)$payload['id']) : '';
  $title = isset($payload['title']) ? trim((string)$payload['title']) : '';
  $author = isset($payload['author']) ? trim((string)$payload['author']) : '';
  $publishedAt = isset($payload['publishedAt']) ? trim((string)$payload['publishedAt']) : '';
  $content = isset($payload['content']) ? trim((string)$payload['content']) : '';

  if ($id === '') {
    jsonResponse(400, array('error' => 'ID da matéria é obrigatório para edição.'));
  }

  if ($title === '' || $author === '' || $publishedAt === '' || $content === '') {
    jsonResponse(400, array('error' => 'Título, autor, data e conteúdo são obrigatórios.'));
  }

  if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $publishedAt)) {
    jsonResponse(400, array('error' => 'Data inválida. Use o formato AAAA-MM-DD.'));
  }

  $images = array();
  if (isset($payload['images']) && is_array($payload['images'])) {
    foreach ($payload['images'] as $item) {
      $value = trim((string)$item);
      if ($value !== '') {
        $images[] = $value;
      }
    }
  }

  $siteData = readJsonFile($contentPath);
  if (!is_array($siteData) || !isset($siteData['blog']['posts']) || !is_array($siteData['blog']['posts'])) {
    jsonResponse(404, array('error' => 'Nenhuma matéria encontrada para edição.'));
  }

  $updated = false;
  foreach ($siteData['blog']['posts'] as $index => $post) {
    $postId = isset($post['id']) ? $post['id'] : '';
    if ($postId === $id) {
      $siteData['blog']['posts'][$index] = array(
        'id' => $id,
        'title' => $title,
        'author' => $author,
        'publishedAt' => $publishedAt,
        'images' => $images,
        'content' => $content,
      );
      $updated = true;
      break;
    }
  }

  if (!$updated) {
    jsonResponse(404, array('error' => 'Matéria não encontrada para edição.'));
  }

  usort($siteData['blog']['posts'], function ($a, $b) {
    $dateA = isset($a['publishedAt']) ? $a['publishedAt'] : '';
    $dateB = isset($b['publishedAt']) ? $b['publishedAt'] : '';
    return strcmp($dateB, $dateA);
  });

  if (!writeJsonFile($contentPath, $siteData)) {
    jsonResponse(500, array('error' => 'Falha ao salvar alterações no site-content.json.'));
  }

  jsonResponse(200, array('ok' => true, 'id' => $id));
}

if ($action === 'deletePost' && $method === 'DELETE') {
  requireAuth();

  $postId = isset($_GET['id']) ? trim((string)$_GET['id']) : '';
  if ($postId === '') {
    jsonResponse(400, array('error' => 'ID inválido.'));
  }

  $siteData = readJsonFile($contentPath);
  if (!is_array($siteData) || !isset($siteData['blog']['posts']) || !is_array($siteData['blog']['posts'])) {
    jsonResponse(404, array('error' => 'Nenhuma matéria encontrada.'));
  }

  $before = count($siteData['blog']['posts']);
  $filtered = array();
  foreach ($siteData['blog']['posts'] as $post) {
    $id = isset($post['id']) ? $post['id'] : '';
    if ($id !== $postId) {
      $filtered[] = $post;
    }
  }

  if (count($filtered) === $before) {
    jsonResponse(404, array('error' => 'Matéria não encontrada.'));
  }

  $siteData['blog']['posts'] = $filtered;

  if (!writeJsonFile($contentPath, $siteData)) {
    jsonResponse(500, array('error' => 'Falha ao salvar site-content.json. Verifique permissões de escrita.'));
  }

  jsonResponse(200, array('ok' => true));
}

if ($action === 'uploadImage' && $method === 'POST') {
  requireAuth();

  if (empty($_FILES['file'])) {
    jsonResponse(400, array('error' => 'Nenhum arquivo foi enviado.'));
  }

  $file = $_FILES['file'];
  $error = isset($file['error']) ? (int)$file['error'] : UPLOAD_ERR_NO_FILE;

  if ($error !== UPLOAD_ERR_OK) {
    $errorMessages = array(
      UPLOAD_ERR_INI_SIZE => 'Arquivo excede o tamanho máximo do servidor.',
      UPLOAD_ERR_FORM_SIZE => 'Arquivo excede o tamanho máximo do formulário.',
      UPLOAD_ERR_PARTIAL => 'Upload foi interrompido.',
      UPLOAD_ERR_NO_FILE => 'Nenhum arquivo foi enviado.',
      UPLOAD_ERR_NO_TMP_DIR => 'Diretório temporário não encontrado.',
      UPLOAD_ERR_CANT_WRITE => 'Falha ao gravar arquivo no disco.',
      UPLOAD_ERR_EXTENSION => 'Upload bloqueado pela extensão do servidor.',
    );

    $message = isset($errorMessages[$error]) ? $errorMessages[$error] : 'Erro desconhecido no upload.';
    jsonResponse(400, array('error' => $message));
  }

  $tmpPath = isset($file['tmp_name']) ? $file['tmp_name'] : '';
  $origName = isset($file['name']) ? $file['name'] : '';

  if ($tmpPath === '' || !file_exists($tmpPath)) {
    jsonResponse(500, array('error' => 'Arquivo temporário não encontrado.'));
  }

  $maxSize = 5 * 1024 * 1024;
  $fileSize = @filesize($tmpPath);
  if ($fileSize === false || $fileSize > $maxSize) {
    jsonResponse(413, array('error' => 'Arquivo muito grande. Máximo 5MB.'));
  }

  $allowedTypes = array('image/jpeg', 'image/png', 'image/webp', 'image/gif');
  $finfo = function_exists('finfo_open') ? @finfo_open(FILEINFO_MIME_TYPE) : false;
  $mimeType = $finfo ? @finfo_file($finfo, $tmpPath) : '';
  if ($finfo) {
    @finfo_close($finfo);
  }

  if (!in_array($mimeType, $allowedTypes, true)) {
    jsonResponse(400, array('error' => 'Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.'));
  }

  $uploadDir = $root . '/assets/blog';
  if (!is_dir($uploadDir)) {
    if (!@mkdir($uploadDir, 0755, true)) {
      jsonResponse(500, array('error' => 'Falha ao criar diretório de upload.'));
    }
  }

  $ext = pathinfo($origName, PATHINFO_EXTENSION);
  if (!preg_match('/^[a-z0-9]{2,5}$/i', $ext)) {
    $ext = 'jpg';
  }

  $baseName = pathinfo($origName, PATHINFO_FILENAME);
  $sanitized = preg_replace('/[^a-z0-9._-]/i', '', $baseName);
  if ($sanitized === '') {
    $sanitized = 'image';
  }

  $newFileName = $sanitized . '-' . time() . '.' . strtolower($ext);
  $newPath = $uploadDir . '/' . $newFileName;

  if (!@move_uploaded_file($tmpPath, $newPath)) {
    jsonResponse(500, array('error' => 'Falha ao mover arquivo para o destino final.'));
  }

  @chmod($newPath, 0644);
  jsonResponse(201, array('ok' => true, 'path' => './assets/blog/' . $newFileName));
}
if ($action === 'mlProducts' && $method === 'GET') {
  $tokenPath = $root . '/data/ml-token.json';
  $mlData = readJsonFile($tokenPath);
  
  if (!$mlData || empty($mlData['access_token'])) {
    jsonResponse(500, array('error' => 'Configuração do Mercado Livre não encontrada no servidor.'));
  }

  $clientId = '3051262405649068';
  $clientSecret = 'gjhOJgdEKcXgVkJXZ7EeWNQEUwKgNymm';
  
  $now = time();
  $expiresAt = isset($mlData['generated_at']) && isset($mlData['expires_in']) 
    ? $mlData['generated_at'] + $mlData['expires_in'] 
    : 0;

  $bufferTime = 300; // 5 minutos de segurança

  if ($now >= ($expiresAt - $bufferTime)) {
    // Atualizar Token
    $refreshUrl = "https://api.mercadolibre.com/oauth/token";
    $postFields = http_build_query(array(
      'grant_type' => 'refresh_token',
      'client_id' => $clientId,
      'client_secret' => $clientSecret,
      'refresh_token' => $mlData['refresh_token']
    ));

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $refreshUrl);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, array('accept: application/json', 'content-type: application/x-www-form-urlencoded'));
    
    $refreshResp = curl_exec($ch);
    $refreshCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($refreshCode >= 200 && $refreshCode < 300) {
      $newTokens = json_decode($refreshResp, true);
      $mlData['access_token'] = $newTokens['access_token'];
      $mlData['refresh_token'] = $newTokens['refresh_token'];
      $mlData['expires_in'] = $newTokens['expires_in'];
      $mlData['generated_at'] = $now;
      
      writeJsonFile($tokenPath, $mlData);
    } else {
      jsonResponse(500, array('error' => 'Falha ao renovar o token do ML.', 'details' => json_decode($refreshResp)));
    }
  }

  $sellerId = '231748369';
  $urlIds = "https://api.mercadolibre.com/users/{$sellerId}/items/search?limit=20";

  $ch = curl_init();
  curl_setopt($ch, CURLOPT_URL, $urlIds);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_HTTPHEADER, array(
    "Authorization: Bearer {$mlData['access_token']}"
  ));
  
  $responseIds = curl_exec($ch);
  $httpCodeIds = curl_getinfo($ch, CURLINFO_HTTP_CODE);

  if ($httpCodeIds >= 200 && $httpCodeIds < 300) {
    curl_close($ch);
    $idsData = json_decode($responseIds, true);
    $results = isset($idsData['results']) ? $idsData['results'] : array();
    
    if (empty($results)) {
       echo json_encode(array('results' => array()));
       exit;
    }

    $idsString = implode(',', $results);
    $urlItems = "https://api.mercadolibre.com/items?ids={$idsString}";

    $ch2 = curl_init();
    curl_setopt($ch2, CURLOPT_URL, $urlItems);
    curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch2, CURLOPT_HTTPHEADER, array(
      "Authorization: Bearer {$mlData['access_token']}"
    ));

    $responseItems = curl_exec($ch2);
    $httpCodeItems = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
    curl_close($ch2);

    if ($httpCodeItems >= 200 && $httpCodeItems < 300) {
       $itemsData = json_decode($responseItems, true);
       $formattedResults = array();
       foreach ($itemsData as $item) {
           if ($item['code'] == 200) {
               $formattedResults[] = $item['body'];
           }
       }
       echo json_encode(array('results' => $formattedResults));
       exit;
    } else {
        jsonResponse(500, array('error' => "Falha ao buscar detalhes dos itens ({$httpCodeItems})", 'details' => json_decode($responseItems)));
    }
  } else {
    curl_close($ch);
    jsonResponse(500, array('error' => "A API do Mercado Livre retornou código {$httpCodeIds} na busca de IDs", 'details' => json_decode($responseIds)));
  }
}

jsonResponse(404, array('error' => 'Rota não encontrada.'));
?>
