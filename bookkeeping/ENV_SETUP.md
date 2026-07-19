# Environment Variables Setup

Create a `.env.local` file in the root directory with the following variables:

## Supabase Configuration
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Get these from your Supabase project settings:
1. Go to https://supabase.com/dashboard
2. Create a new project or select existing
3. Navigate to Settings → API
4. Copy the Project URL and anon public key

## Firebase Configuration
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

Get these from your Firebase project:
1. Go to https://console.firebase.google.com
2. Create a new project or select existing
3. Navigate to Project Settings → General
4. Scroll down to "Your apps" section
5. Add a Web app and copy the configuration values

## Required Database Tables

### bookkeeping_records
```sql
CREATE TABLE bookkeeping_records (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  payment_date DATE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  cost_per_unit NUMERIC,
  quantity NUMERIC,
  notes TEXT,
  customer TEXT,
  project TEXT,
  tags TEXT,
  market_price NUMERIC,
  supplied_by TEXT,
  attribution_source TEXT DEFAULT 'direct',
  conversion_stage TEXT DEFAULT 'closed_won',
  campaign_details TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_bookkeeping_user_id ON bookkeeping_records(user_id);
CREATE INDEX idx_bookkeeping_date ON bookkeeping_records(date);
CREATE INDEX idx_bookkeeping_category ON bookkeeping_records(category);
CREATE INDEX idx_bookkeeping_attribution ON bookkeeping_records(attribution_source);
```

### category_budgets
```sql
CREATE TABLE category_budgets (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, category)
);

CREATE INDEX idx_budgets_user_id ON category_budgets(user_id);
```

### recurring_costs
```sql
CREATE TABLE recurring_costs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recurring_user_id ON recurring_costs(user_id);
```

### conversion_events (for attribution tracking)
```sql
CREATE TABLE conversion_events (
  id BIGSERIAL PRIMARY KEY,
  record_id BIGINT REFERENCES bookkeeping_records(id),
  stage TEXT NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversion_record_id ON conversion_events(record_id);
CREATE INDEX idx_conversion_stage ON conversion_events(stage);
```

## Row Level Security (RLS) Policies

Enable RLS on all tables and add policies to ensure users can only access their own data:

```sql
-- Enable RLS
ALTER TABLE bookkeeping_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_events ENABLE ROW LEVEL SECURITY;

-- Bookkeeping records policies
CREATE POLICY "Users can view own records" 
ON bookkeeping_records FOR SELECT 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own records" 
ON bookkeeping_records FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own records" 
ON bookkeeping_records FOR UPDATE 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own records" 
ON bookkeeping_records FOR DELETE 
USING (auth.uid()::text = user_id);

-- Similar policies for other tables
CREATE POLICY "Users can view own budgets" 
ON category_budgets FOR SELECT 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can upsert own budgets" 
ON category_budgets FOR ALL 
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view own recurring costs" 
ON recurring_costs FOR SELECT 
USING (auth.uid()::text = user_id);

CREATE POLICY "Users can manage own recurring costs" 
ON recurring_costs FOR ALL 
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);
```

## Firebase Authentication Setup

1. Enable Email/Password authentication in Firebase Console
2. Enable Google authentication in Firebase Console
3. Add your domain to authorized domains in Firebase Console

## Performance Optimization Features

The app includes:
- **React Query**: Automatic caching with 5-minute stale time for records
- **Persistent Sessions**: Firebase auth keeps users signed in until manual sign out
- **Indexed Queries**: Database indexes for fast queries
- **Code Splitting**: Dynamic imports for better initial load time
- **Memoization**: React useMemo and useCallback for expensive computations

## Cost Optimization

- **Caching**: Reduces Supabase API calls by up to 90%
- **Efficient Queries**: Only fetch needed data with specific selects
- **Pagination**: Large datasets are paginated
- **Lazy Loading**: Components load only when needed
