import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

const { products } = JSON.parse(readFileSync(new URL('../../fixtures/channel3-laptops.json', import.meta.url), 'utf8'));
const product = products.find(item => item.id === '9kpreIm');
const profile = '10000000-0000-4000-8000-000000000001';
const session = '10000000-0000-4000-8000-000000000002';

const moderator = '10000000-0000-4000-8000-000000000003';
const other = '10000000-0000-4000-8000-000000000004';
const accountId = '20000000-0000-4000-8000-000000000001';
const campaignId = '30000000-0000-4000-8000-000000000001';
const campaign = {
  id: campaignId, slug: 'fixture-campaign', title: 'Fixture study laptop', creator_name: 'Fixture creator',
  story: 'A local fixture campaign for a study laptop.', created_at: '2026-11-26T00:00:00Z',
  moderation_status: 'pending_review', moderation_reasons: [], status: 'active', visibility: 'unlisted',
  item_price_cents: 50000, own_funds_cents: 10000, target_cents: 40000, owner_id: profile,
};

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
  if (request.method === 'GET' && url.pathname === '/rest/v1/profiles') {
    const requested = url.searchParams.get('id')?.slice(3);
    if ([profile, moderator, other].includes(requested)) body = [{
      id: requested, auth_user_id: accountId, role: requested === moderator ? 'moderator' : 'user',
      email: 'local@example.invalid', email_verified: false,
    }];
  }
  if (request.method === 'GET' && url.pathname === '/rest/v1/campaigns' && url.searchParams.get('slug') === 'eq.fixture-campaign') {
    const owner = url.searchParams.get('owner_id');
    body = !owner || owner === `eq.${profile}` ? [campaign] : [];
  }
  if (request.method === 'GET' && url.pathname === '/rest/v1/campaigns' && url.searchParams.get('visibility') === 'eq.public') {
    body = [{ ...campaign, title: 'Study laptop fixture', category: 'Study', slug: 'market-fixture',
      image_url: '/stitch/hardware-studio.webp', visibility: 'public', moderation_status: 'approved' }];
  }
  if (request.method === 'GET' && url.pathname === '/rest/v1/campaign_totals') {
    body = [{ campaign_id: campaignId, raised_cents: 0, supporter_count: 0 }];
  }
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}).listen(3198, '127.0.0.1', () => process.stdout.write('Local Phase 2 catalog fixture ready\n'));
