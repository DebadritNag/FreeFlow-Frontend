import { configureStore } from '@reduxjs/toolkit';
import ticketsReducer from './ticketsSlice';

export const makeStore = () => {
  // Protect Next.js static prerender checks from Redux internal Math.random() action types
  const isServer = typeof window === 'undefined';
  const originalRandom = Math.random;

  if (isServer) {
    let seed = 12345;
    Math.random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  }

  try {
    return configureStore({
      reducer: {
        tickets: ticketsReducer,
      },
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false,
        }),
    });
  } finally {
    if (isServer) {
      Math.random = originalRandom;
    }
  }
};

export const store = makeStore();

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
