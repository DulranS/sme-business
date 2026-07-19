import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recordQueries, attributionQueries, budgetQueries, isSupabaseConfigured } from '../services/supabase';
import { useAuth } from '../auth-context';

// Custom hooks for bookkeeping data with caching

export const useRecords = (startDate, endDate) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured();

  return useQuery({
    queryKey: ['records', user?.id, startDate, endDate],
    queryFn: () => recordQueries.getWithAttribution(user?.id, startDate, endDate),
    enabled: !!user?.id && configured,
    staleTime: 1000 * 60 * 5, // 5 minutes
    initialData: [],
  });
};

export const useCreateRecord = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured();

  return useMutation({
    mutationFn: (record) => {
      if (!configured) throw new Error('Supabase is not configured');
      return recordQueries.create(record, user?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
      queryClient.invalidateQueries({ queryKey: ['attribution'] });
    },
  });
};

export const useUpdateRecord = () => {
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured();

  return useMutation({
    mutationFn: ({ id, updates }) => {
      if (!configured) throw new Error('Supabase is not configured');
      return recordQueries.update(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });
};

export const useDeleteRecord = () => {
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured();

  return useMutation({
    mutationFn: (id) => {
      if (!configured) throw new Error('Supabase is not configured');
      return recordQueries.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] });
    },
  });
};

export const useAttributionData = (startDate, endDate) => {
  const { user } = useAuth();
  const configured = isSupabaseConfigured();

  return useQuery({
    queryKey: ['attribution', user?.id, startDate, endDate],
    queryFn: () => attributionQueries.getConversionFunnel(user?.id, startDate, endDate),
    enabled: !!user?.id && configured,
    staleTime: 1000 * 60 * 10, // 10 minutes
    initialData: [],
  });
};

export const useRevenueBySource = (startDate, endDate) => {
  const { user } = useAuth();
  const configured = isSupabaseConfigured();

  return useQuery({
    queryKey: ['revenue-by-source', user?.id, startDate, endDate],
    queryFn: () => attributionQueries.getRevenueBySource(user?.id, startDate, endDate),
    enabled: !!user?.id && configured,
    staleTime: 1000 * 60 * 15, // 15 minutes
    initialData: [],
  });
};

export const useBudgets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured();

  return useQuery({
    queryKey: ['budgets', user?.id],
    queryFn: () => budgetQueries.getAll(user?.id),
    enabled: !!user?.id && configured,
    staleTime: 1000 * 60 * 30, // 30 minutes
    initialData: [],
  });
};

export const useUpsertBudget = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const configured = isSupabaseConfigured();

  return useMutation({
    mutationFn: ({ category, amount }) => {
      if (!configured) throw new Error('Supabase is not configured');
      return budgetQueries.upsert(category, amount, user?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
};
