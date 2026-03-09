const CONTENT_PATH = './data/site-content.json';

async function getContent() {
  const response = await fetch(CONTENT_PATH);
  if (!response.ok) throw new Error('Falha ao carregar conteúdo do site.');
  return response.json();
}

function applyGlobalInfo(data) {
  const brandName = document.getElementById('brandName');
  if (brandName) {
    brandName.textContent = data.brand.name;
  }

  const phone = document.getElementById('mainPhone');
  phone.href = `tel:${data.contacts.phoneRaw}`;
  phone.textContent = data.contacts.phoneLabel;

  const whatsapp = document.getElementById('mainWhatsapp');
  whatsapp.href = data.contacts.whatsappUrl;

  const footer = document.getElementById('footerInfo');
  footer.innerHTML = `
    <strong>${data.brand.name}</strong><br />
    ${data.contacts.address}<br />
    Tel: ${data.contacts.phoneLabel} · WhatsApp: ${data.contacts.whatsappLabel}<br />
    E-mail: <a href="mailto:${data.contacts.email}">${data.contacts.email}</a>
  `;
}

function renderCards(data) {
  const stage = document.getElementById('cardsStage');
  stage.innerHTML = data.activities
    .map(
      (activity) => `
      <a class="card" href="${activity.link}" style="--card-image: url('${activity.image}')">
        <div class="card-content">
          <span class="card-tag">${activity.tag}</span>
          <h3 class="card-title">${activity.title}</h3>
          <p class="card-visual-text">${activity.visualText || activity.description}</p>
        </div>
      </a>
    `,
    )
    .join('');
}

async function init() {
  try {
    const data = await getContent();
    applyGlobalInfo(data);
    renderCards(data);
  } catch (error) {
    document.body.innerHTML = `<main class="shell"><p>Erro: ${error.message}</p></main>`;
  }
}

init();
