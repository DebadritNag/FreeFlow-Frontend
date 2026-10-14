'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { setActiveAgent } from '@/src/store/ticketsSlice';
import { Agent } from '@/src/types/ticket';
import {
  ChevronDown,
  Inbox,
  ShieldAlert,
  UserCheck,
  Menu,
  X,
  Radio,
} from 'lucide-react';

export default function Header() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const { activeAgent, availableAgents, metrics, newTicketsCount } = useAppSelector(
    (state) => state.tickets
  );

  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isTicketsActive = pathname.startsWith('/tickets') || pathname === '/';
  const isReviewActive = pathname.startsWith('/review');

  const handleSelectAgent = (agent: Agent) => {
    dispatch(setActiveAgent(agent));
    setAgentDropdownOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 w-full bg-card/95 backdrop-blur-sm border-b border-border shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          
          {/* Product Brand */}
          <div className="flex items-center gap-6">
            <Link href="/tickets" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm tracking-wider shadow-xs group-hover:opacity-90 transition-opacity">
                FF
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm sm:text-base tracking-tight text-foreground leading-none">
                  Freeflow
                </span>
                <span className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase mt-0.5">
                  Support Operations
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1.5 ml-4">
              <Link
                href="/tickets"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  isTicketsActive
                    ? 'bg-secondary text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <Inbox className="w-4 h-4" />
                <span>All Tickets</span>
                {metrics && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-mono bg-muted text-muted-foreground tabular-nums">
                    {metrics.totalTickets}
                  </span>
                )}
                {newTicketsCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </Link>

              <Link
                href="/review"
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                  isReviewActive
                    ? 'bg-secondary text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Manual Triage Queue</span>
                {metrics && metrics.manualReviewTickets > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 tabular-nums">
                    {metrics.manualReviewTickets}
                  </span>
                )}
              </Link>
            </nav>
          </div>

          {/* Right Header Area: Live Sync Dot & Agent Switcher */}
          <div className="flex items-center gap-3">
            {/* Realtime Stream indicator */}
            <div
              className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1 rounded bg-muted/50 border border-border/50"
              title="Real-time cursor updates active"
            >
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              <span className="font-mono text-[11px] tracking-tight">Syncing</span>
            </div>

            {/* Agent Selector Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setAgentDropdownOpen(!agentDropdownOpen)}
                className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-lg border border-border bg-card hover:bg-secondary/50 text-foreground transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-ring"
                aria-haspopup="true"
                aria-expanded={agentDropdownOpen}
              >
                {/* Avatar with fallback initials */}
                <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0 overflow-hidden">
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

                <div className="flex flex-col text-left leading-tight hidden sm:block">
                  <span className="text-xs font-medium text-foreground truncate max-w-[120px]">
                    {activeAgent.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                    {activeAgent.role}
                  </span>
                </div>

                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
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
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors ${
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
              className="md:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-border space-y-1 animate-in fade-in duration-100">
            <Link
              href="/tickets"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium ${
                isTicketsActive
                  ? 'bg-secondary text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4" />
                <span>All Tickets</span>
              </div>
              {metrics && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-muted text-muted-foreground tabular-nums">
                  {metrics.totalTickets}
                </span>
              )}
            </Link>

            <Link
              href="/review"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium ${
                isReviewActive
                  ? 'bg-secondary text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-secondary/60'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Manual Triage Queue</span>
              </div>
              {metrics && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-100 text-amber-800 tabular-nums">
                  {metrics.manualReviewTickets}
                </span>
              )}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
