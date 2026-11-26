import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const { products } = JSON.parse(readFileSync(new URL('../../fixtures/channel3-laptops.json', import.meta.url), 'utf8'));
const product = products.find(item => item.id === '9kpreIm');
const profile = '10000000-0000-4000-8000-000000000001';
const session = '10000000-0000-4000-8000-000000000002';

createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  let body = [];
  if (request.method === 'GET' && url.pathname === '/rest/v1/search_cache') {
    body = [{ response: { products: [product] }, created_at: '2026-11-26T00:00:00Z' }];
  }
  if (request.method === 'GET' && url.pathname === '/rest/v1/ai_sessions'
    && url.searchParams.get('id') === `eq.${session}` && url.searchParams.get('user_id') === `eq.${profile}`) {
    body = [{ prompt: 'Laptop', safety: { notices: [] }, intent: {
      version: 2, category: 'laptop', stated: [], brandsExclude: [], brandsInclude: [], colors: [], usedOk: null,
      budget: { maxCents: 90000, usable: true }, ownFundsCents: 10000, lastProductIds: [product.id],
    } }];
  }
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}).listen(3198, '127.0.0.1', () => process.stdout.write('Local Phase 2 catalog fixture ready\n'));
