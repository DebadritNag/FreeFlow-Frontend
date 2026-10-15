'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Provider } from 'react-redux';
import { makeStore, AppStore } from './index';
import { setActiveAgent, setFilters } from './ticketsSlice';
import { loadPersistedState, persistState } from './persistence';

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<AppStore>(() => makeStore());
  const hydratedRef = useRef(false);

  // Hydrate persisted activeAgent + filters AFTER mount only (never during the
  // initial render) so server and first client render stay identical — no
  // hydration mismatch. Then subscribe to write activeAgent + filters back.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const persisted = loadPersistedState();
    if (persisted) {
      if (persisted.activeAgentId) {
        const roster = store.getState().tickets.availableAgents;
        const match = roster.find((a) => a.id === persisted.activeAgentId);
        if (match) {
          store.dispatch(setActiveAgent(match));
        }
      }
      if (persisted.filters) {
        store.dispatch(setFilters(persisted.filters));
      }
    }

    const unsubscribe = store.subscribe(() => {
      const { activeAgent, filters } = store.getState().tickets;
      persistState({ activeAgentId: activeAgent.id, filters });
    });

    return () => {
      unsubscribe();
    };
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
