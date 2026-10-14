import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  Agent,
  Ticket,
  TicketFilterState,
  TicketMetrics,
} from '@/src/types/ticket';

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: 'agent-1',
    name: 'Priya',
    email: 'priya@freeflow.ventures',
    role: 'Senior Support Specialist',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=faces',
  },
  {
    id: 'agent-2',
    name: 'Rahul',
    email: 'rahul@freeflow.ventures',
    role: 'Enterprise Operations Lead',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
  },
  {
    id: 'agent-3',
    name: 'Meera',
    email: 'meera@freeflow.ventures',
    role: 'Technical Support Engineer',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
  },
];

export interface TicketsState {
  items: Ticket[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  metrics: TicketMetrics | null;
  cursor: string;
  newTicketsCount: number;
  newlyArrivedIds: string[];
  currentTicket: Ticket | null;
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  filters: TicketFilterState;
  activeAgent: Agent;
  availableAgents: Agent[];
}

export const initialFilterState: TicketFilterState = {
  search: '',
  status: 'all',
  priority: 'all',
  category: 'all',
  triageDecision: 'all',
  assigneeId: 'all',
  slaStatus: 'all',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  pageSize: 25,
};

const initialState: TicketsState = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 25,
  totalPages: 1,
  metrics: null,
  cursor: '',
  newTicketsCount: 0,
  newlyArrivedIds: [],
  currentTicket: null,
  loading: false,
  actionLoading: false,
  error: null,
  filters: initialFilterState,
  activeAgent: DEFAULT_AGENTS[0],
  availableAgents: DEFAULT_AGENTS,
};

export const ticketsSlice = createSlice({
  name: 'tickets',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
      if (action.payload) {
        state.error = null;
      }
    },
    setActionLoading: (state, action: PayloadAction<boolean>) => {
      state.actionLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
      state.actionLoading = false;
    },
    setPaginatedTickets: (
      state,
      action: PayloadAction<{
        tickets: Ticket[];
        totalCount: number;
        page: number;
        pageSize: number;
        totalPages: number;
        metrics: TicketMetrics;
        cursor: string;
      }>
    ) => {
      state.items = action.payload.tickets;
      state.totalCount = action.payload.totalCount;
      state.page = action.payload.page;
      state.pageSize = action.payload.pageSize;
      state.totalPages = action.payload.totalPages;
      state.metrics = action.payload.metrics;
      if (!state.cursor || action.payload.cursor) {
        state.cursor = action.payload.cursor;
      }
      state.loading = false;
      state.error = null;
    },
    setCurrentTicket: (state, action: PayloadAction<Ticket | null>) => {
      state.currentTicket = action.payload;
      state.loading = false;
      state.error = null;
    },
    updateTicketLocally: (state, action: PayloadAction<Ticket>) => {
      const updated = action.payload;
      // Update in items array if present
      const index = state.items.findIndex((t) => t.id === updated.id);
      if (index !== -1) {
        state.items[index] = updated;
      }
      // Update in currentTicket if currently viewing
      if (state.currentTicket && state.currentTicket.id === updated.id) {
        state.currentTicket = updated;
      }
    },
    optimisticClaimTicket: (
      state,
      action: PayloadAction<{ ticketId: string; agent: Agent }>
    ) => {
      const { ticketId, agent } = action.payload;
      const index = state.items.findIndex((t) => t.id === ticketId);
      if (index !== -1) {
        state.items[index].assignee = agent;
        if (state.items[index].status === 'open') {
          state.items[index].status = 'in_progress';
        }
      }
      if (state.currentTicket && state.currentTicket.id === ticketId) {
        state.currentTicket.assignee = agent;
        if (state.currentTicket.status === 'open') {
          state.currentTicket.status = 'in_progress';
        }
      }
    },
    rollbackClaimTicket: (
      state,
      action: PayloadAction<{ originalTicket: Ticket }>
    ) => {
      const { originalTicket } = action.payload;
      const index = state.items.findIndex((t) => t.id === originalTicket.id);
      if (index !== -1) {
        state.items[index] = originalTicket;
      }
      if (state.currentTicket && state.currentTicket.id === originalTicket.id) {
        state.currentTicket = originalTicket;
      }
    },
    unclaimTicketLocally: (state, action: PayloadAction<string>) => {
      const ticketId = action.payload;
      const index = state.items.findIndex((t) => t.id === ticketId);
      if (index !== -1) {
        state.items[index].assignee = null;
        if (state.items[index].status === 'in_progress') {
          state.items[index].status = 'open';
        }
      }
      if (state.currentTicket && state.currentTicket.id === ticketId) {
        state.currentTicket.assignee = null;
        if (state.currentTicket.status === 'in_progress') {
          state.currentTicket.status = 'open';
        }
      }
    },
    setFilters: (state, action: PayloadAction<Partial<TicketFilterState>>) => {
      state.filters = {
        ...state.filters,
        ...action.payload,
      };
      if (action.payload.page === undefined && !action.payload.pageSize) {
        state.filters.page = 1;
      }
    },
    resetFilters: (state) => {
      state.filters = initialFilterState;
    },
    setActiveAgent: (state, action: PayloadAction<Agent>) => {
      state.activeAgent = action.payload;
    },
    handleCursorUpdates: (
      state,
      action: PayloadAction<{ updatedTickets: Ticket[]; newCursor: string }>
    ) => {
      const { updatedTickets, newCursor } = action.payload;
      if (!updatedTickets || updatedTickets.length === 0) {
        if (newCursor) state.cursor = newCursor;
        return;
      }

      state.cursor = newCursor;

      // Identify brand new tickets vs modified tickets
      const existingIds = new Set(state.items.map((t) => t.id));
      const newlyAdded: string[] = [];

      for (const updated of updatedTickets) {
        if (existingIds.has(updated.id)) {
          const idx = state.items.findIndex((t) => t.id === updated.id);
          if (idx !== -1) {
            state.items[idx] = updated;
          }
        } else {
          newlyAdded.push(updated.id);
        }

        if (state.currentTicket && state.currentTicket.id === updated.id) {
          state.currentTicket = updated;
        }
      }

      if (newlyAdded.length > 0) {
        state.newTicketsCount += newlyAdded.length;
        state.newlyArrivedIds = [...state.newlyArrivedIds, ...newlyAdded];
      }
    },
    clearNewTicketsAlert: (state) => {
      state.newTicketsCount = 0;
      state.newlyArrivedIds = [];
    },
  },
});

export const {
  setLoading,
  setActionLoading,
  setError,
  setPaginatedTickets,
  setCurrentTicket,
  updateTicketLocally,
  optimisticClaimTicket,
  rollbackClaimTicket,
  unclaimTicketLocally,
  setFilters,
  resetFilters,
  setActiveAgent,
  handleCursorUpdates,
  clearNewTicketsAlert,
} = ticketsSlice.actions;

export default ticketsSlice.reducer;
