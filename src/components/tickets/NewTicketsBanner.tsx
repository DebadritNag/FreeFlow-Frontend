'use client';

import React from 'react';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { clearNewTicketsAlert } from '@/src/store/ticketsSlice';
import { RefreshCw, Sparkles, X } from 'lucide-react';

export default function NewTicketsBanner({ onRefresh }: { onRefresh: () => void }) {
  const dispatch = useAppDispatch();
  const { newTicketsCount } = useAppSelector((state) => state.tickets);

  if (newTicketsCount <= 0) return null;

  const handleRefresh = () => {
    dispatch(clearNewTicketsAlert());
    onRefresh();
  };

  const handleDismiss = () => {
    dispatch(clearNewTicketsAlert());
  };

  return (
    <div className="mb-4 flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 animate-bounce" />
        <span>
          <strong className="font-semibold tabular-nums">{newTicketsCount}</strong>{' '}
          {newTicketsCount === 1 ? 'new ticket has arrived' : 'new tickets have arrived'} via live sync.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 shadow-2xs transition-all duration-150"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh View</span>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded text-emerald-700 hover:text-emerald-900 dark:text-emerald-400"
          title="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
