'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/src/store/hooks';
import {
  LayoutDashboard,
  Ticket,
  Headset,
  ChartNoAxesColumn,
  Settings,
  ChevronRight,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { metrics, activeAgent } = useAppSelector((state) => state.tickets);

  const isDashboardActive = pathname.startsWith('/tickets') || pathname === '/';
  const ticketsBadge = metrics ? metrics.totalTickets : '';

  const inactiveItemClass =
    'flex items-center gap-3 h-[42px] px-3 rounded-[10px] text-[14px] font-medium text-foreground hover:bg-[#F0F1EC] transition-colors duration-200 cursor-pointer';
  const inertItemClass =
    'flex items-center gap-3 h-[42px] px-3 rounded-[10px] text-[14px] font-medium text-foreground hover:bg-[#F0F1EC] transition-colors duration-200 w-full text-left cursor-pointer';

  return (
    <aside className="w-[276px] flex-shrink-0 h-screen sticky top-0 bg-sidebar border-r border-border flex flex-col">
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
          {/* Dashboard - active route */}
          <Link
            href="/tickets"
            className={
              isDashboardActive
                ? 'relative flex items-center gap-3 h-[42px] px-3 rounded-[10px] text-[14px] font-semibold bg-surface-green text-[#246B4B] transition-colors duration-200 cursor-pointer'
                : inactiveItemClass
            }
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

          {/* Tickets - count badge bound to live metrics.totalTickets */}
          <button type="button" aria-disabled="true" className={inertItemClass}>
            <Ticket className="w-[18px] h-[18px]" />
            <span className="flex-1">Tickets</span>
            <span className="ml-auto min-w-[26px] px-2 py-0.5 rounded-full text-[12px] font-semibold text-text-secondary bg-secondary text-center tabular-nums">
              {ticketsBadge}
            </span>
          </button>

          {/* Support Operations - inert, no route */}
          <button type="button" aria-disabled="true" className={inertItemClass}>
            <Headset className="w-[18px] h-[18px]" />
            <span>Support Operations</span>
          </button>

          {/* Reports - inert, no route */}
          <button type="button" aria-disabled="true" className={inertItemClass}>
            <ChartNoAxesColumn className="w-[18px] h-[18px]" />
            <span>Reports</span>
          </button>

          {/* Settings - inert, no route */}
          <button type="button" aria-disabled="true" className={inertItemClass}>
            <Settings className="w-[18px] h-[18px]" />
            <span>Settings</span>
          </button>
        </nav>

        {/* Bottom promo card */}
        <div className="mt-auto">
          <div className="relative w-full h-[145px] rounded-[14px] bg-surface-green overflow-hidden p-4">
            <span className="block w-8 h-[3px] rounded-full bg-[#246B4B] mb-3" />
            <p className="text-[15px] font-semibold text-foreground leading-tight">
              Better support.
            </p>
            <p className="text-[15px] font-semibold text-foreground leading-tight">
              Happier customers.
            </p>
            {/* Subtle low-contrast decorative leaf */}
            <svg
              aria-hidden="true"
              viewBox="0 0 48 48"
              className="absolute bottom-2 right-2 w-14 h-14 text-[#246B4B]/10"
              fill="currentColor"
            >
              <path d="M40 8C20 8 8 20 8 40c0 0 0-14 14-22C34 11 40 8 40 8zm-6 10C22 22 16 32 16 40c6-2 14-8 18-22z" />
            </svg>
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
    </aside>
  );
}
