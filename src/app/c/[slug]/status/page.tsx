import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentAccount } from '@/lib/auth';
import { db } from '@/lib/db';
import { getT } from '@/i18n/server';

const copy = {
  en: ['Campaign status', 'Submitted', 'Moderation', 'Identity and need verification', 'Approved for Sandbox contributions', 'Under review', 'Rejected', 'Hidden'],
  ur: ['مہم کی حالت', 'جمع ہو گئی', 'جائزہ', 'شناخت اور ضرورت کی تصدیق', 'سینڈ باکس تعاون کی اجازت', 'زیر جائزہ', 'مسترد', 'پوشیدہ'],
  es: ['Estado de la campaña', 'Enviada', 'Moderación', 'Verificación de identidad y necesidad', 'Aprobada para aportes de prueba', 'En revisión', 'Rechazada', 'Oculta'],
  fr: ['État de la campagne', 'Soumise', 'Modération', 'Vérification de l’identité et du besoin', 'Contributions de test autorisées', 'En cours d’examen', 'Refusée', 'Masquée'],
};

export const metadata = { robots: { index: false, follow: false } };

export default async function CampaignStatus({ params }: { params: Promise<{ slug: string }> }) {
  const account = await currentAccount();
  if (!account) notFound();
  const { slug } = await params;
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) notFound();
  const { data: campaign } = await db().from('campaigns').select('id,title,created_at,moderation_status,image_url,item_price_cents')
    .eq('slug', slug).eq('owner_id', account.profileId).maybeSingle();
  if (!campaign) notFound();
  const [{ t, locale, dateTime, usd }, history] = await Promise.all([
    getT(),
    db().from('campaign_updates').select('id,body,created_at').eq('campaign_id', campaign.id)
      .eq('kind', 'moderation').order('created_at', { ascending: false }).limit(10),
  ]);
  const [title, submitted, moderation, verification, approved, pending, rejected, hidden] = copy[locale];
  const status = { auto_approved: approved, approved, pending_review: pending, rejected, hidden }[campaign.moderation_status as string] || '—';
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
    <Link href={`/c/${slug}/manage`} className="tap text-sm font-semibold text-brand">{t('mg.title')}</Link>
    <h1 className="h-page mt-2">{title}</h1>
    <div className="card mt-5 border-brand/15 bg-brand-soft/40 p-4 sm:p-6"><div className="flex items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {campaign.image_url && <img src={campaign.image_url} alt="" className="size-20 shrink-0 rounded-xl border border-line bg-white object-contain" />}
      <div className="min-w-0"><span className="chip bg-brand-soft text-brand">PayPal Sandbox</span><h2 className="h-section mt-3" dir="auto">{campaign.title}</h2><p className="mt-1 text-sm text-mute">{t('camp.itemPrice')} · <bdi>{usd(Number(campaign.item_price_cents))}</bdi></p></div></div></div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
    <ol className="card mt-4 px-6 py-3 sm:px-9">
      <li className="relative ms-2 border-s-2 border-brand-soft py-5 ps-6 before:absolute before:start-[-7px] before:top-6 before:size-3 before:rounded-full before:bg-brand before:content-['']"><h2 className="font-bold">{submitted}</h2><time className="mt-2 block text-sm text-mute" dateTime={campaign.created_at}>{dateTime(campaign.created_at)}</time></li>
      <li className="relative ms-2 border-s-2 border-brand-soft py-5 ps-6 before:absolute before:start-[-7px] before:top-6 before:size-3 before:rounded-full before:bg-brand before:content-['']"><h2 className="font-bold">{moderation}</h2><p className="chip mt-2 bg-brand-soft text-brand">{status}</p>
        {!!history.data?.length && <ul className="mt-3 divide-y divide-line">{history.data.map(event => <li key={event.id} className="py-2 text-sm"><time className="block text-xs text-mute" dateTime={event.created_at}>{dateTime(event.created_at)}</time><p dir="auto">{event.body}</p></li>)}</ul>}
      </li>
      <li className="relative ms-2 border-s-2 border-brand-soft py-5 ps-6 before:absolute before:start-[-7px] before:top-6 before:size-3 before:rounded-full before:bg-brand before:content-['']"><h2 className="font-bold">{verification}</h2><p className="mt-2 text-sm text-mute">{t('trust.unverifiedHelp')}</p></li>
    </ol>
    <div className="mt-4 grid content-start gap-2 sm:grid-cols-2 lg:grid-cols-1"><Link href="/me" className="btn btn-primary">{t('nav.me')}</Link><Link href={`/c/${slug}?created=1`} className="btn btn-ghost">{t('mg.viewPublic')}</Link></div>
    </div>
  </div>;
}
