'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createDashboardQueryClient } from '@/lib/query-client';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createDashboardQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
