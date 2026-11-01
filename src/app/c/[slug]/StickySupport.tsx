'use client';

import { useEffect, useState } from 'react';

/** Phone-only bottom bar that jumps to the contribution form. Hidden while the form itself is on screen. */
export function StickySupport({ remaining }: { remaining: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.getElementById('support');
    if (!target) return;
    const io = new IntersectionObserver(([e]) => {
      // Show only once the user has scrolled past the top area and the form is not visible.
      setShow(!e.isIntersecting && window.scrollY > 400);
    }, { threshold: 0 });
    io.observe(target);
    const onScroll = () => {
      const r = target.getBoundingClientRect();
      setShow(window.scrollY > 400 && (r.bottom < 0 || r.top > window.innerHeight));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-4 pt-3 pb-[max(.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgb(14_19_48/0.2)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <p className="min-w-0 flex-1 text-sm"><b>{remaining}</b> <span className="text-mute">still needed</span></p>
        <a href="#support" className="btn btn-primary min-h-11 px-5 text-sm">Support</a>
      </div>
    </div>
  );
}
