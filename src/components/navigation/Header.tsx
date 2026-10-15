'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { setActiveAgent } from '@/src/store/ticketsSlice';
import { Agent } from '@/src/types/ticket';
import {
  ChevronDown,
  ShieldAlert,
  UserCheck,
  Menu,
  X,
  Search,
  Bell,
  Inbox,
} from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { activeAgent, availableAgents, metrics, newTicketsCount } = useAppSelector(
    (state) => state.tickets
  );

  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isReviewActive = pathname.startsWith('/review');

  // Header counts sourced from full-dataset Redux metrics (NOT the current page):
  // myTicketsCount = tickets assigned to the active agent; toReviewCount = manual_review total.
  // Because metrics come from computeMetrics() over the entire dataset, these stay correct
  // after a successful claim, after a rollback, after switching agents, and during live updates.
  const myTicketsCount = metrics?.myTicketsCountByAgent[activeAgent.id] ?? 0;
  const toReviewCount = metrics?.manualReviewTickets ?? 0;

  const handleSelectAgent = (agent: Agent) => {
    dispatch(setActiveAgent(agent));
    setAgentDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-card border-b border-border">
      <div className="h-[72px] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Left: global search (presentational) */}
        <div className="flex-1 min-w-0 max-w-[640px]">
          <label htmlFor="global-search" className="sr-only">
            Search tickets
          </label>
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-secondary pointer-events-none" />
            <input
              id="global-search"
              type="text"
              placeholder="Search tickets, subjects, customers..."
              className="w-full h-[42px] pl-10 pr-16 rounded-[11px] bg-card border border-border text-[14px] text-foreground placeholder:text-text-secondary transition-colors duration-200 focus:outline-hidden focus:ring-2 focus:ring-ring focus:border-primary"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-border bg-secondary text-[11px] font-medium text-text-secondary tabular-nums pointer-events-none">
              ⌘ K
            </span>
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Desktop header counters — full-dataset metrics (My tickets / To review) */}
          <div className="hidden md:flex items-center gap-2">
            <span
              title="Tickets assigned to the active agent (full dataset)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-green text-[12px] font-medium text-[#246B4B] tabular-nums"
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>My tickets ({myTicketsCount})</span>
            </span>
            <Link
              href="/review"
              title="Tickets flagged for manual review (full dataset)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-surface border border-amber-border text-[12px] font-medium text-warning tabular-nums hover:bg-amber-surface/80 transition-colors duration-200 cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>To review ({toReviewCount})</span>
            </Link>
          </div>

          {/* Live-sync indicator restyled as green "Synced" pill
              (same source as the previous Radio indicator: real-time cursor polling) */}
          <div
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface-green text-[12px] font-medium text-[#246B4B]"
            title="Real-time cursor updates active"
          >
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-[#246B4B] opacity-60 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-[#246B4B]" />
            </span>
            <span>Synced</span>
          </div>

          {/* Notifications bell with live new-tickets badge */}
          <Link
            href="/review"
            aria-label="Review queue notifications"
            className={`relative p-2 rounded-[10px] transition-colors duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring ${
              isReviewActive
                ? 'bg-secondary text-foreground'
                : 'text-text-secondary hover:bg-secondary hover:text-foreground'
            }`}
            title="Manual triage queue"
          >
            <Bell className="w-5 h-5" />
            {newTicketsCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-amber-surface border border-amber-border text-[11px] font-semibold text-warning tabular-nums">
                {newTicketsCount}
              </span>
            )}
          </Link>

          {/* Subtle vertical divider */}
          <span className="hidden sm:block w-px h-7 bg-border" aria-hidden="true" />

          {/* Agent Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-[10px] hover:bg-secondary text-foreground transition-colors duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
              aria-haspopup="true"
              aria-expanded={agentDropdownOpen}
            >
              {/* Avatar with fallback initials */}
              <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden">
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

              <div className="flex-col text-left leading-tight hidden sm:flex">
                <span className="text-[13px] font-semibold text-foreground truncate max-w-[140px]">
                  {activeAgent.name}
                </span>
                <span className="text-[11px] text-text-secondary truncate max-w-[140px]">
                  {activeAgent.role}
                </span>
              </div>

              <ChevronDown className="w-4 h-4 text-text-secondary ml-0.5" />
            </button>

            {/* Dropdown Menu */}
            {agentDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAgentDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-1.5 w-64 rounded-lg bg-popover border border-border shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 border-b border-border/60 mb-1">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Active Support Agent
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Claims and audit updates will be recorded under this identity.
                    </p>
                  </div>

                  <div className="max-h-60 overflow-y-auto py-0.5">
                    {availableAgents.map((agent) => {
                      const isCurrent = agent.id === activeAgent.id;
                      return (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => handleSelectAgent(agent)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors duration-200 cursor-pointer ${
                            isCurrent
                              ? 'bg-accent text-accent-foreground font-medium'
                              : 'text-foreground hover:bg-secondary/70'
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center text-xs font-semibold overflow-hidden flex-shrink-0">
                            {agent.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={agent.avatarUrl}
                                alt={agent.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              agent.name.charAt(0)
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-medium text-foreground truncate">
                              {agent.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate">
                              {agent.role}
                            </span>
                          </div>
                          {isCurrent && (
                            <UserCheck className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-[10px] text-text-secondary hover:text-foreground hover:bg-secondary transition-colors duration-200 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-ring"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer — keeps /review reachable on small screens */}
      {mobileMenuOpen && (
        <div className="md:hidden px-4 sm:px-6 py-3 border-t border-border space-y-1 animate-in fade-in duration-100">
          {/* Mobile: My tickets counter (full-dataset metrics) */}
          <Link
            href="/tickets"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:bg-secondary/60 hover:text-foreground transition-colors duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-primary" />
              <span>My tickets</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-green border border-surface-green-hover text-[#246B4B] tabular-nums">
              {myTicketsCount}
            </span>
          </Link>

          <Link
            href="/review"
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 cursor-pointer ${
              isReviewActive
                ? 'bg-secondary text-foreground font-semibold'
                : 'text-text-secondary hover:bg-secondary/60 hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-warning" />
              <span>To review</span>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-surface border border-amber-border text-warning tabular-nums">
              {toReviewCount}
            </span>
          </Link>
        </div>
      )}
    </header>
  );
}
