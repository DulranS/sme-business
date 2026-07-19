import { createClient } from '@supabase/supabase-js';

let supabase = null;

const initializeSupabase = () => {
  if (supabase) return supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase configuration is missing. Database features will be disabled.');
    return null;
  }

  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    return supabase;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    return null;
  }
};

export const getSupabase = () => initializeSupabase();

export const isSupabaseConfigured = () => {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
};

// Enhanced record queries with user isolation
export const recordQueries = {
  // Get all records for a user
  getAll: async (userId) => {
    const client = getSupabase();
    if (!client) return [];
    
    const { data, error } = await client
      .from('bookkeeping_records')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Get records with attribution data
  getWithAttribution: async (userId, startDate, endDate) => {
    const client = getSupabase();
    if (!client) return [];
    
    let query = client
      .from('bookkeeping_records')
      .select('*')
      .eq('user_id', userId);
    
    if (startDate) query = query.gte('date', startDate);
    if (endDate) query = query.lte('date', endDate);
    
    const { data, error } = await query.order('date', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Create record with attribution
  create: async (record, userId) => {
    const client = getSupabase();
    if (!client) throw new Error('Supabase is not configured');
    
    const { data, error } = await client
      .from('bookkeeping_records')
      .insert({
        ...record,
        user_id: userId,
        attribution_source: record.attribution_source || 'direct',
        conversion_stage: record.conversion_stage || 'closed_won',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update record
  update: async (id, updates) => {
    const client = getSupabase();
    if (!client) throw new Error('Supabase is not configured');
    
    const { data, error } = await client
      .from('bookkeeping_records')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Delete record
  delete: async (id) => {
    const client = getSupabase();
    if (!client) throw new Error('Supabase is not configured');
    
    const { error } = await client
      .from('bookkeeping_records')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// Attribution tracking queries
export const attributionQueries = {
  // Get conversion funnel by source
  getConversionFunnel: async (userId, startDate, endDate) => {
    const client = getSupabase();
    if (!client) return [];
    
    const { data, error } = await client
      .from('bookkeeping_records')
      .select('attribution_source, conversion_stage, amount, quantity, date')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate);
    
    if (error) throw error;
    return data;
  },

  // Get revenue by attribution source
  getRevenueBySource: async (userId, startDate, endDate) => {
    const client = getSupabase();
    if (!client) return [];
    
    const { data, error } = await client
      .from('bookkeeping_records')
      .select('attribution_source, amount, quantity, category')
      .eq('user_id', userId)
      .eq('category', 'Inflow')
      .gte('date', startDate)
      .lte('date', endDate);
    
    if (error) throw error;
    return data;
  },

  // Track conversion metrics
  trackConversion: async (recordId, stage, metadata = {}) => {
    const client = getSupabase();
    if (!client) throw new Error('Supabase is not configured');
    
    const { data, error } = await client
      .from('conversion_events')
      .insert({
        record_id: recordId,
        stage,
        metadata,
        timestamp: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};

// Budget queries
export const budgetQueries = {
  getAll: async (userId) => {
    const client = getSupabase();
    if (!client) return [];
    
    const { data, error } = await client
      .from('category_budgets')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data;
  },

  upsert: async (category, amount, userId) => {
    const client = getSupabase();
    if (!client) throw new Error('Supabase is not configured');
    
    const { data, error } = await client
      .from('category_budgets')
      .upsert({
        category,
        amount,
        user_id: userId,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },
};
