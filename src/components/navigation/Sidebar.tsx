'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/src/store/hooks';
import {
  LayoutDashboard,
  Headset,
  ChartNoAxesColumn,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { activeAgent } = useAppSelector((state) => state.tickets);
  const [mobileOpen, setMobileOpen] = useState(false);

  // A ticket detail route (/tickets/{id}) maps to "Support Operations" active to
  // match the reference. The tickets list (/tickets exactly) stays "Dashboard".
  const isTicketDetail = /^\/tickets\/[^/]+/.test(pathname);
  const isReviewActive = pathname.startsWith('/review') || isTicketDetail;
  const isDashboardActive =
    !isReviewActive && (pathname.startsWith('/tickets') || pathname === '/');

  const activeItemClass =
    'relative flex items-center gap-3 h-[44px] px-3 rounded-[10px] text-[14px] font-semibold bg-surface-green text-[#246B4B] transition-colors duration-200 cursor-pointer';
  const inactiveItemClass =
    'flex items-center gap-3 h-[44px] px-3 rounded-[10px] text-[14px] font-medium text-foreground hover:bg-surface-green transition-colors duration-200 cursor-pointer';
  const inertItemClass =
    'flex items-center gap-3 h-[44px] px-3 rounded-[10px] text-[14px] font-medium text-foreground hover:bg-surface-green transition-colors duration-200 w-full text-left cursor-pointer';

  const closeMobile = () => setMobileOpen(false);

  const sidebarInner = (
    <>
      {/* Brand block */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="w-11 h-11 rounded-[12px] bg-primary text-primary-foreground flex items-center justify-center font-bold text-base tracking-wide flex-shrink-0">
          FF
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-[16px] text-foreground">Freeflow</span>
          <span className="text-[10px] font-medium text-text-secondary tracking-[0.08em] uppercase mt-0.5">
            Support Operations
          </span>
        </div>
      </div>

      {/* Scrollable nav + lower content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col">
        <nav className="flex flex-col gap-3">
          {/* Dashboard - active on /tickets and / */}
          <Link
            href="/tickets"
            onClick={closeMobile}
            className={isDashboardActive ? activeItemClass : inactiveItemClass}
            aria-current={isDashboardActive ? 'page' : undefined}
          >
            {isDashboardActive && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#246B4B]" />
            )}
            <LayoutDashboard
              className={`w-[18px] h-[18px] ${isDashboardActive ? 'text-[#246B4B]' : ''}`}
            />
            <span>Dashboard</span>
          </Link>

          {/* Support Operations - active on /review */}
          <Link
            href="/review"
            onClick={closeMobile}
            className={isReviewActive ? activeItemClass : inactiveItemClass}
            aria-current={isReviewActive ? 'page' : undefined}
          >
            {isReviewActive && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-[#246B4B]" />
            )}
            <Headset
              className={`w-[18px] h-[18px] ${isReviewActive ? 'text-[#246B4B]' : ''}`}
            />
            <span>Support Operations</span>
          </Link>

          {/* Reports - inert, no route */}
          <button type="button" aria-disabled="true" className={inertItemClass}>
            <ChartNoAxesColumn className="w-[18px] h-[18px]" />
            <span>Reports</span>
          </button>
        </nav>

        {/* Bottom promo card — bg-customer.png background */}
        <div className="mt-auto">
          <div
            className="relative w-full h-[145px] rounded-[14px] bg-surface-green overflow-hidden p-4"
            style={{
              backgroundImage: "url('/bg-customer.png')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          >
            {/* Subtle warm-ivory gradient overlay (left → transparent) for text legibility */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#F7F6F2]/85 via-[#F7F6F2]/45 to-transparent"
            />
            <div className="relative z-10">
              <span className="block w-8 h-[3px] rounded-full bg-[#246B4B] mb-3" />
              <p className="text-[15px] font-semibold text-foreground leading-tight">
                Better support.
              </p>
              <p className="text-[15px] font-semibold text-foreground leading-tight">
                Happier customers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Profile section */}
      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-sm font-semibold flex-shrink-0 overflow-hidden">
            {activeAgent.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeAgent.avatarUrl}
                alt={activeAgent.name}
                className="w-full h-full object-cover"
              />
            ) : (
              activeAgent.name.charAt(0)
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1 leading-tight">
            <span className="text-[13px] font-semibold text-foreground truncate">
              Sarah Chen
            </span>
            <span className="text-[11px] text-text-secondary truncate">
              Senior Support Specialist
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-text-secondary flex-shrink-0" />
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop / tablet sidebar — collapses in width below lg; full 276px at xl, ~252px at lg */}
      <aside className="hidden lg:flex w-[252px] xl:w-[276px] flex-shrink-0 h-screen sticky top-0 bg-sidebar border-r border-border flex-col">
        {sidebarInner}
      </aside>

      {/* Mobile open trigger (floating) — hidden on lg+ */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
        className="lg:hidden fixed bottom-4 left-4 z-40 w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-card cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/40 animate-in fade-in duration-150"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <aside className="relative w-[276px] max-w-[85vw] h-full bg-sidebar border-r border-border flex flex-col animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onClick={closeMobile}
              aria-label="Close navigation menu"
              className="absolute top-4 right-3 z-10 p-1.5 rounded-[10px] text-text-secondary hover:bg-secondary hover:text-foreground transition-colors duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarInner}
          </aside>
        </div>
      )}
    </>
  );
}
