const CONTENT_PATH = './data/site-content.json';

function makeServiceList(services, page, contacts) {
  const phoneDigits = (contacts.whatsappUrl.match(/\d+/g) || []).join('') || contacts.phoneRaw.replace(/\D/g, '');

  return `
    <ul class="service-list">
      ${services
        .map((service) => {
          if (page === 'oficina' || page === 'estetica') {
            const message = `Olá, tudo bem? Quero agendar o serviço de ${service.name}`;
            const link = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;

            return `
              <li>
                <a class="service-item-link" href="${link}" target="_blank" rel="noopener noreferrer">
                  <div>
                    <strong>${service.name}</strong><br />
                    <small>${service.detail}</small>
                  </div>
                  <strong>${service.price}</strong>
                </a>
              </li>
            `;
          }

          return `
            <li>
              <div>
                <strong>${service.name}</strong><br />
                <small>${service.detail}</small>
              </div>
              <strong>${service.price}</strong>
            </li>
          `;
        })
        .join('')}
    </ul>
  `;
}

function makeSpecializedCards(specializedServices, contacts) {
  const phoneDigits = (contacts.whatsappUrl.match(/\d+/g) || []).join('') || contacts.phoneRaw.replace(/\D/g, '');

  return `
    <div class="specialized-grid">
      ${specializedServices
        .map((service) => {
          const message = `Olá! Gostaria de informações sobre o serviço de ${service.name}`;
          const link = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;

          return `
            <a href="${link}" class="specialized-card" target="_blank" rel="noopener noreferrer">
              <div class="specialized-card-bg" style="background-image: url('${service.image}')"></div>
              <div class="specialized-card-content">
                <h3>${service.name}</h3>
              </div>
            </a>
          `;
        })
        .join('')}
    </div>
  `;
}

async function initPage() {
  const page = document.body.dataset.page;
  const response = await fetch(CONTENT_PATH);
  const data = await response.json();

  const whatsapp = document.getElementById('mainWhatsapp');
  whatsapp.href = data.contacts.whatsappUrl;
  whatsapp.textContent = `WhatsApp ${data.contacts.whatsappLabel}`;

  const content = data.pages[page];
  if (!content) return;

  document.getElementById('servicePage').innerHTML = `
    <section>
      <p class="eyebrow">${content.tag}</p>
      <h1>${content.title}</h1>
      <p>${content.subtitle}</p>
    </section>

    <section>
      <h2>Cardápio de serviços</h2>
      <p class="services-helper-text">Clique na opção preferida para agendar!</p>
      ${makeServiceList(content.services, page, data.contacts)}
    </section>

    ${content.specializedServices ? `
    <section>
      <h2>Serviços Especializados</h2>
      <p>Contamos com equipe especializada e equipamentos específicos para atender as necessidades do seu veículo.</p>
      ${makeSpecializedCards(content.specializedServices, data.contacts)}
    </section>
    ` : ''}

    <section>
      <h2>Atendimento e agendamento</h2>
      <div class="channels">
        ${content.channels
          .map(
            (channel) => `
          <article>
            <h3>${channel.title}</h3>
            <p>${channel.text}</p>
            <a href="${channel.link}" class="button">${channel.cta}</a>
          </article>
        `,
          )
          .join('')}
      </div>
    </section>

    <section>
      <h2>Condições de pagamento</h2>
      <p>${content.payment}</p>
    </section>
  `;

  document.getElementById('footerInfo').innerHTML = `
    <strong>${data.brand.name}</strong><br />
    ${data.contacts.address}<br />
    Tel: ${data.contacts.phoneLabel} · WhatsApp: ${data.contacts.whatsappLabel}<br />
    E-mail: <a href="mailto:${data.contacts.email}">${data.contacts.email}</a>
  `;
}

initPage();
