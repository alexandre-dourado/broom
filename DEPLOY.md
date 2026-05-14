# The Broom — Guia de Deploy

## Estrutura final

```
the-broom/
├── backend/
│   └── code.gs
└── frontend/
    ├── index.html
    ├── styles.css
    ├── icons.js
    ├── db.js
    ├── api.js
    ├── ui.js
    ├── app.js
    ├── sw.js
    ├── manifest.json
    └── icons/
        ├── icon-192.png
        └── icon-512.png
```

---

## PASSO 1 — Google Sheets

1. Crie uma planilha nova em https://sheets.google.com
2. Dê o nome: **The Broom**
3. Anote o ID da planilha (está na URL: `https://docs.google.com/spreadsheets/d/ESTE_É_O_ID/edit`)

---

## PASSO 2 — Google Apps Script

1. Na planilha, vá em: **Extensões → Apps Script**
2. Apague todo o conteúdo do editor
3. Cole o conteúdo do arquivo `backend/code.gs`
4. Salve (Ctrl+S) — nomeie o projeto como **The Broom**

### Configurar as sheets

No editor do Apps Script:
1. No menu superior, selecione a função `configSheet`
2. Clique em **▶ Executar**
3. Autorize as permissões quando solicitado
4. Aguarde. No log deve aparecer: `Sheets configuradas com sucesso.`

Isso cria automaticamente:
- Sheet `items` com todos os cabeçalhos
- Sheet `categories` com as 7 categorias padrão
- Sheet `settings` vazia

### Publicar como Web App

1. Clique em **Implantar → Nova implantação**
2. Tipo: **Aplicativo da Web**
3. Execute como: **Eu (sua conta)**
4. Quem tem acesso: **Qualquer pessoa**
5. Clique em **Implantar**
6. Copie a **URL do aplicativo da web** — você vai precisar dela

> ⚠️ A URL tem o formato:
> `https://script.google.com/macros/s/XXXXXXXXXX/exec`

---

## PASSO 3 — Configurar URL no frontend

Abra o arquivo `frontend/api.js` e substitua:

```javascript
const API_URL = 'COLE_URL_WEBAPP_AQUI';
```

Pela URL copiada:

```javascript
const API_URL = 'https://script.google.com/macros/s/SUA_URL_AQUI/exec';
```

---

## PASSO 4 — Ícones PWA

Você precisa de dois arquivos PNG para os ícones do app:
- `frontend/icons/icon-192.png` — 192×192px
- `frontend/icons/icon-512.png` — 512×512px

**Opção rápida:** Use qualquer ferramenta de imagem (Figma, Canva, etc.) e crie um ícone simples com um símbolo de vassoura ou "B" em fundo preto.

**Opção online:** https://realfavicongenerator.net — gera todos os tamanhos.

---

## PASSO 5 — GitHub Pages

### Criar o repositório

```bash
# No Git Bash
cd /pasta/onde/quer/criar

# Clone ou crie o repo
git clone https://github.com/alexandre-dourado/broom.git
cd broom
```

### Copiar os arquivos frontend

Copie todo o conteúdo da pasta `frontend/` para a raiz do repositório:

```
broom/ (repositório)
├── index.html
├── styles.css
├── icons.js
├── db.js
├── api.js
├── ui.js
├── app.js
├── sw.js
├── manifest.json
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

### Deploy

```bash
git add .
git commit -m "feat: initial deploy The Broom"
git push origin main
```

### Ativar GitHub Pages

1. Vá em: **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / **/ (root)**
4. Salvar

O app ficará disponível em:
**https://alexandre-dourado.github.io/broom/**

> Pode levar até 2 minutos para propagar.

---

## PASSO 6 — Testar

### Verificar API

Abra no browser:
```
https://script.google.com/macros/s/SUA_URL/exec?action=ping
```

Deve retornar:
```json
{"success": true, "message": "The Broom API online"}
```

### Verificar categorias

```
https://script.google.com/macros/s/SUA_URL/exec?action=getCategories
```

Deve retornar as 7 categorias.

### Abrir o app

```
https://alexandre-dourado.github.io/broom/
```

---

## PASSO 7 — Instalar no celular (PWA)

### Android (Chrome)
1. Abra o app no Chrome
2. Menu (⋮) → **Adicionar à tela inicial**
3. Confirmar

### iOS (Safari)
1. Abra no Safari
2. Botão de compartilhar → **Adicionar à Tela de Início**
3. Confirmar

---

## Atualizações futuras

Para atualizar o app:

```bash
# Edite os arquivos localmente
git add .
git commit -m "fix: descrição da mudança"
git push origin main
```

GitHub Pages faz o deploy automaticamente.

Para forçar o usuário a pegar a versão nova do Service Worker, incremente a versão no `sw.js`:
```javascript
const CACHE_NAME = 'thebroom-v2'; // incrementar
```

---

## Funções úteis no Apps Script

### Reconfigurar estrutura (safe — preserva dados)
```javascript
configSheet()
```

### Debug estrutural
```javascript
debugSheets()
```

### Testar addItem manualmente
```javascript
addItem({ title: 'Teste', description: 'Descrição', category: 'cat-1' })
```

---

## Troubleshooting

### CORS error na API
O GAS usa `Content-Type: text/plain` nas requisições POST para evitar preflight CORS. Se aparecer erro de CORS, verifique se o `api.js` está usando `'Content-Type': 'text/plain'` no header.

### SW não atualiza
Abra DevTools → Application → Service Workers → clique em **Unregister**, recarregue.

### IndexedDB corrompido
DevTools → Application → IndexedDB → Delete database `thebroom-db`, recarregue.

### Sync não funciona offline → online
O app detecta `window.online` event. Verifique se o evento está disparando corretamente no DevTools → Network (toggle offline).
