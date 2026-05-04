# TX·AI Proxy Worker

## Deploy lên Cloudflare (2 cách)

### Cách 1: Dashboard (không cần cài gì)
1. Vào https://dash.cloudflare.com
2. **Workers & Pages** → **Create** → **Create Worker**
3. Đặt tên: `tx-proxy`
4. Copy toàn bộ nội dung `worker.js` paste vào editor
5. Bấm **Deploy**
6. Copy URL worker: `https://tx-proxy.<your-subdomain>.workers.dev`

### Cách 2: Wrangler CLI
```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

## Sau khi deploy

Mở file `js/config.js` trong web tool, tìm dòng:
```js
const PROXY_BASE = "";
```
Thay bằng URL worker của bạn:
```js
const PROXY_BASE = "https://tx-proxy.ten-ban.workers.dev";
```

## Test
Truy cập: `https://tx-proxy.ten-ban.workers.dev/proxy?url=https://sunwin.mw`
Nếu thấy web sunwin hiện ra = thành công ✅
