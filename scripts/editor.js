const CONTENT_PATH = './data/site-content.json';

const editor = document.getElementById('jsonEditor');
const statusLabel = document.getElementById('editorStatus');

function setStatus(text, isError = false) {
  statusLabel.textContent = text;
  statusLabel.classList.toggle('error', isError);
}

async function loadJson() {
  const response = await fetch(CONTENT_PATH);
  const data = await response.json();
  editor.value = JSON.stringify(data, null, 2);
  setStatus('Conteúdo carregado.');
}

function validateJson() {
  try {
    JSON.parse(editor.value);
    setStatus('JSON válido.');
  } catch (error) {
    setStatus(`JSON inválido: ${error.message}`, true);
  }
}

function formatJson() {
  try {
    const data = JSON.parse(editor.value);
    editor.value = JSON.stringify(data, null, 2);
    setStatus('JSON formatado.');
  } catch (error) {
    setStatus(`Não foi possível formatar: ${error.message}`, true);
  }
}

function downloadJson() {
  try {
    const data = JSON.parse(editor.value);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = 'site-content.json';
    anchor.click();
    URL.revokeObjectURL(anchor.href);
    setStatus('Arquivo gerado com sucesso.');
  } catch (error) {
    setStatus(`Não foi possível gerar arquivo: ${error.message}`, true);
  }
}

document.getElementById('validateBtn').addEventListener('click', validateJson);
document.getElementById('formatBtn').addEventListener('click', formatJson);
document.getElementById('downloadBtn').addEventListener('click', downloadJson);

loadJson();
