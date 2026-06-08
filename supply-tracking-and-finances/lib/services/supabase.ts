// ==============================
// CENTRALIZED SUPABASE CLIENT
// ==============================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

class SupabaseClient {
  private url: string;
  private key: string;

  constructor(url: string, key: string) {
    this.url = url;
    this.key = key;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.url}/rest/v1/${endpoint}`;
    const response = await fetch(url, {
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Supabase error:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  from(table: string) {
    return {
      select: (columns: string = '*') => ({
        execute: async (): Promise<any[]> =>
          this.request<any[]>(`${table}?select=${columns}`),
        eq: (column: string, value: string | number) => ({
          execute: async (): Promise<any[]> =>
            this.request<any[]>(`${table}?select=${columns}&${column}=eq.${value}`),
        }),
        like: (column: string, pattern: string) => ({
          execute: async (): Promise<any[]> =>
            this.request<any[]>(`${table}?select=${columns}&${column}=like.${encodeURIComponent(pattern)}`),
        }),
        gte: (column: string, value: string | number) => ({
          execute: async (): Promise<any[]> =>
            this.request<any[]>(`${table}?select=${columns}&${column}=gte.${value}`),
        }),
        lte: (column: string, value: string | number) => ({
          execute: async (): Promise<any[]> =>
            this.request<any[]>(`${table}?select=${columns}&${column}=lte.${value}`),
        }),
        order: (column: string, ascending: boolean = true) => ({
          execute: async (): Promise<any[]> =>
            this.request<any[]>(`${table}?select=${columns}&order=${column}.${ascending ? 'asc' : 'desc'}`),
        }),
      }),
      insert: (data: any) => ({
        execute: async (): Promise<any[]> => {
          const response = await fetch(`${this.url}/rest/v1/${table}`, {
            method: 'POST',
            headers: {
              apikey: this.key,
              Authorization: `Bearer ${this.key}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify(Array.isArray(data) ? data : [data]),
          });
          if (!response.ok) throw new Error(`Insert failed: ${response.status}`);
          return response.json();
        },
      }),
      update: (data: any) => ({
        eq: (column: string, value: string | number) => ({
          execute: async (): Promise<void> => {
            const response = await fetch(`${this.url}/rest/v1/${table}?${column}=eq.${value}`, {
              method: 'PATCH',
              headers: {
                apikey: this.key,
                Authorization: `Bearer ${this.key}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error(`Update failed: ${response.status}`);
          },
        }),
      }),
      delete: () => ({
        eq: (column: string, value: string | number) => ({
          execute: async (): Promise<void> => {
            const response = await fetch(`${this.url}/rest/v1/${table}?${column}=eq.${value}`, {
              method: 'DELETE',
              headers: {
                apikey: this.key,
                Authorization: `Bearer ${this.key}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
            });
            if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
          },
        }),
        like: (column: string, pattern: string) => ({
          execute: async (): Promise<void> => {
            const response = await fetch(`${this.url}/rest/v1/${table}?${column}=like.${encodeURIComponent(pattern)}`, {
              method: 'DELETE',
              headers: {
                apikey: this.key,
                Authorization: `Bearer ${this.key}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
            });
            if (!response.ok) throw new Error(`Delete failed: ${response.status}`);
          },
        }),
      }),
    };
  }
}

// Singleton instance
export const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export default SupabaseClient;
