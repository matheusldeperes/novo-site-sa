# Guia de Deploy - sattealam.com

## Informações do Servidor

- **Domínio**: sattealam.com
- **IP**: 187.86.152.162
- **Servidor**: Apache
- **Provedor**: Vetorial.Net
- **Name Server**: NS1.VIRTUAL.VETORIALNET.COM.BR

## Contatos para Solicitar Acesso

1. **Vetorial.Net**: https://www.vetorialnet.com.br/suporte
2. **Create.art.br** (desenvolvedor anterior): https://create.art.br/

## Credenciais Necessárias

Solicite ao provedor:
- [ ] Usuário FTP
- [ ] Senha FTP
- [ ] URL do cPanel (geralmente: sattealam.com:2083)
- [ ] Usuário cPanel
- [ ] Senha cPanel

## Passo a Passo do Deploy

### 1. Backup do Site Atual
**IMPORTANTE**: Antes de qualquer alteração!
- Acesse via FTP ou cPanel
- Baixe TODOS os arquivos de `/public_html/`
- Guarde em local seguro com data (ex: backup-sattealam-09-03-2026.zip)

### 2. Upload via FTP (FileZilla)

**Configuração do FileZilla:**
```
Host: ftp.sattealam.com (ou 187.86.152.162)
Usuário: [solicitar]
Senha: [solicitar]
Porta: 21
```

**Passos:**
1. Conectar ao servidor
2. Navegar até `/public_html/`
3. Criar pasta `backup-old-site` e mover arquivos atuais
4. Fazer upload de TODOS os arquivos do projeto "Novo Site SA"
5. Verificar permissões (644 para arquivos, 755 para pastas)

### 3. Upload via cPanel

1. Acessar: https://sattealam.com:2083
2. Login com credenciais fornecidas
3. **Gerenciador de Arquivos** → `public_html`
4. Selecionar tudo → **Compactar** → **Baixar** (backup)
5. **Upload** → Arrastar arquivos ou usar botão Upload
6. Se enviou ZIP: **Extrair** → Confirmar

### 4. Verificação Pós-Deploy

Acessar e testar:
- [ ] https://sattealam.com (página principal)
- [ ] https://sattealam.com/oficina (página oficina)
- [ ] https://sattealam.com/estetica (página estética)
- [ ] Todos os cards clicam corretamente
- [ ] Imagens carregam
- [ ] Links do WhatsApp funcionam
- [ ] Link "Seminovos" aponta para sattealam.com.br

### 5. Checklist Pré-Deploy

- [x] Link seminovos aponta para sattealam.com.br
- [ ] Substituir imagens de teste por reais
- [ ] Verificar dados de contato
- [ ] Testar WhatsApp numbers
- [ ] Adicionar favicon.ico
- [ ] Testar em mobile

## Estrutura de Arquivos no Servidor

```
/public_html/
├── index.html
├── oficina.html
├── estetica.html
├── editor.html
├── .htaccess
├── assets/
│   ├── cards/
│   ├── specialized/
│   └── logo_exp.png
├── data/
│   └── site-content.json
├── scripts/
│   ├── app.js
│   ├── page.js
│   └── editor.js
├── styles/
│   └── style.css
└── README.md
```

## Troubleshooting

### Problema: Site não carrega
- Verificar se `.htaccess` está funcionando
- Checar permissões de arquivos (644) e pastas (755)
- Ver logs de erro no cPanel → Logs → Error Log

### Problema: Imagens não aparecem
- Verificar caminhos (devem começar com `/`)
- Permissões das pastas assets (755)
- Cache do navegador (Ctrl+Shift+R)

### Problema: JSON não carrega
- Verificar tipo MIME no servidor (.json deve ser application/json)
- Adicionar ao .htaccess: `AddType application/json .json`

## Rollback (Voltar ao Anterior)

Se algo der errado:
1. Acessar FTP/cPanel
2. Deletar arquivos novos
3. Restaurar backup anterior
4. Aguardar 5 minutos para DNS propagar

## Suporte Técnico

- **Vetorial.Net**: suporte@vetorialnet.com.br
- **Emergency**: Restaurar backup do cPanel → Backups → Baixar backup completo
