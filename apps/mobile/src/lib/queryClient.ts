import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Mobile networks are flaky; refetching on reconnect is more useful
      // than refetching on focus (which is constant in RN).
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
});
