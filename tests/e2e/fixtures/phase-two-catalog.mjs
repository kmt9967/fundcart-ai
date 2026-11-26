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

const publicCampaigns = [
  { ...campaign, title: 'Study laptop fixture', category: 'Study', slug: 'market-fixture', image_url: '/stitch/hardware-studio.webp' },
  { ...campaign, id: '30000000-0000-4000-8000-000000000002', title: 'Audio production equipment fixture', category: 'Audio', slug: 'audio-fixture', image_url: '/stitch/featured-audio.webp', target_cents: 30000 },
  { ...campaign, id: '30000000-0000-4000-8000-000000000003', title: 'Accessible workspace fixture', category: 'Accessibility', slug: 'workspace-fixture', status: 'goal_reached', image_url: '/stitch/featured-workspace.webp', target_cents: 60000 },
].map(row => ({ ...row, visibility: 'public', moderation_status: 'approved', is_demo_seed: true }));

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
    body = publicCampaigns;
  }
  if (request.method === 'GET' && url.pathname === '/rest/v1/campaigns' && !url.searchParams.has('slug')) {
    if (url.searchParams.get('owner_id') === `eq.${profile}`) body = [campaign, ...publicCampaigns];
    if (url.searchParams.get('moderation_status') === 'eq.pending_review') body = [campaign];
  }
  const publicCampaign = publicCampaigns.find(row => url.searchParams.get('slug') === `eq.${row.slug}`);
  if (request.method === 'GET' && url.pathname === '/rest/v1/campaigns' && publicCampaign) {
    body = [{ ...publicCampaign, suggested_amounts_cents: [1000, 2500, 5000], country: null,
      verification_status: 'unverified', product_snapshot_id: 'fixture-product' }];
  }
  if (request.method === 'GET' && url.pathname === '/rest/v1/product_snapshots') {
    body = [{ id: 'fixture-product', title: 'Vivobook 15 Laptop', brand: 'ASUS', fetched_at: campaign.created_at,
      image_url: '/stitch/featured-laptop.webp' }];
  }
  if (request.method === 'GET' && url.pathname === '/rest/v1/contributions' && url.searchParams.get('status') === 'eq.COMPLETED'
    && url.searchParams.get('campaign_id') === `eq.${campaignId}`) {
    body = [{ amount_cents: 14800, supporter_name: 'Fixture supporter', supporter_message: 'For your studies.',
      is_anonymous: false, created_at: campaign.created_at }];
  }
  if (request.method === 'GET' && url.pathname === '/rest/v1/campaign_totals') {
    const raised = [14800, 19500, 60000];
    const supporters = [4, 5, 8];
    body = publicCampaigns.map((row, index) => ({ campaign_id: row.id, raised_cents: raised[index], supporter_count: supporters[index] }));
    const id = url.searchParams.get('campaign_id');
    if (id?.startsWith('eq.')) body = body.filter(row => row.campaign_id === id.slice(3));
  }
  if (request.method === 'GET' && url.pathname === '/rest/v1/payment_orders'
    && url.searchParams.get('campaign_id') === `eq.${campaignId}`) {
    body = [{ id: '50000000-0000-4000-8000-000000000001', kind: 'contribution', paypal_order_id: 'FIXTUREDONE123',
      amount_cents: 14800, status: 'COMPLETED', capture_status: 'COMPLETED', capture_id: 'FIXTURECAPTURE',
      supporter_name: 'Fixture supporter', created_at: campaign.created_at, updated_at: campaign.created_at }];
  }
  if (request.method === 'GET' && url.pathname === '/rest/v1/payment_events'
    && url.searchParams.get('paypal_order_id')?.includes('FIXTUREDONE123')) {
    body = [{ id: 1, paypal_order_id: 'FIXTUREDONE123', source: 'webhook', event_type: 'PAYMENT.CAPTURE.COMPLETED',
      status: 'COMPLETED', created_at: campaign.created_at }];
  }
  const paymentId = url.searchParams.get('paypal_order_id')?.slice(3);
  if (request.method === 'GET' && url.pathname === '/rest/v1/payment_orders' && ['FIXTUREDONE123', 'FIXTUREPEND123', 'FIXTUREFAIL123'].includes(paymentId)) {
    const complete = paymentId === 'FIXTUREDONE123';
    body = [{ id: '50000000-0000-4000-8000-000000000001', user_id: profile, kind: 'contribution', campaign_id: null,
      paypal_order_id: paymentId, amount_cents: 4150, currency: 'USD', status: complete ? 'COMPLETED' : 'APPROVED',
      capture_status: complete ? 'COMPLETED' : paymentId === 'FIXTUREFAIL123' ? 'DECLINED' : 'PENDING', capture_id: 'FIXTURECAPTURE', created_at: campaign.created_at, updated_at: campaign.created_at }];
  }
  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}).listen(3198, '127.0.0.1', () => process.stdout.write('Local Phase 2 catalog fixture ready\n'));
