# Bookkeeping App

An advanced bookkeeping application with attribution tracking, business intelligence, and Firebase authentication. Built with Next.js, React, and Supabase.

## 🚀 Features

### Core Functionality
- **Financial Record Management**: Track income, expenses, and transactions
- **Multi-Category Support**: Inflow, Outflow, Reinvestment, Overhead, Loans, Logistics, and more
- **Customer & Project Tracking**: Associate records with customers and projects
- **Date Filtering**: Filter records by date range for analysis

### Attribution & Conversion Tracking
- **Source Attribution**: Track where customers come from (direct, referral, website, social media, etc.)
- **Conversion Funnel**: Monitor leads through qualified → proposal → negotiation → closed won/lost
- **Revenue by Source**: Analyze which channels generate the most revenue
- **Campaign Tracking**: Track specific marketing campaigns and their performance

### Business Intelligence
- **Real-time Metrics**: Total revenue, net profit, profit margins, average transaction value
- **Cash Flow Health**: Automated health scoring based on financial metrics
- **Actionable Insights**: AI-powered recommendations for business improvement
- **Financial Health Score**: Comprehensive scoring based on profit margins and cash flow

### Authentication & Security
- **Firebase Authentication**: Email/password and Google sign-in support
- **Persistent Sessions**: Users stay signed in until manual sign-out
- **User Isolation**: Each user sees only their own data
- **Row Level Security**: Database-level access control

### Performance & Optimization
- **React Query Caching**: Intelligent data caching with 5-30 minute stale times
- **Lazy Loading**: Dashboard components load only when needed
- **Code Splitting**: Optimized bundle sizes for faster initial load
- **Memoization**: Expensive computations cached for performance

### Export & Reporting
- **CSV Export**: Export records, attribution reports, and financial summaries
- **JSON Export**: Export complete data for backup or analysis
- **Multi-format Support**: Choose between CSV and JSON formats

## 📋 Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm
- Firebase project (for authentication)
- Supabase project (for database)

## 🔧 Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd bookkeeping
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Firebase Configuration (Optional - for authentication)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

### 4. Database Setup

Run the SQL migration in your Supabase SQL editor (see `ENV_SETUP.md` for complete schema):

```sql
-- Create bookkeeping_records table
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

-- Create indexes
CREATE INDEX idx_bookkeeping_user_id ON bookkeeping_records(user_id);
CREATE INDEX idx_bookkeeping_date ON bookkeeping_records(date);
CREATE INDEX idx_bookkeeping_category ON bookkeeping_records(category);
CREATE INDEX idx_bookkeeping_attribution ON bookkeeping_records(attribution_source);

-- Enable RLS
ALTER TABLE bookkeeping_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
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
```

### 5. Firebase Setup (Optional)

If you want authentication:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project
3. Enable Authentication → Sign-in method → Email/Password
4. Enable Authentication → Sign-in method → Google
5. Add a Web app and copy the configuration
6. Add the configuration to your `.env.local` file

## 🏃 Running the App

### Development Mode

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## 📁 Project Structure

```
bookkeeping/
├── app/
│   ├── layout.js          # Root layout with providers
│   ├── page.js            # Main application page
│   └── globals.css        # Global styles
├── components/
│   ├── auth/
│   │   ├── LoginModal.js      # Authentication modal
│   │   └── UserMenu.js        # User menu with sign-out
│   ├── analytics/
│   │   ├── AttributionDashboard.js       # Attribution tracking UI
│   │   └── BusinessIntelligenceDashboard.js # BI dashboard
│   └── forms/
│       └── AttributionFields.js # Attribution form fields
├── lib/
│   ├── auth-context.js     # Authentication context
│   ├── firebase.js        # Firebase configuration
│   ├── react-query-client.js # React Query setup
│   ├── hooks/
│   │   └── useBookkeeping.js # Custom React Query hooks
│   ├── services/
│   │   └── supabase.js    # Supabase service layer
│   └── utils/
│       └── export.js      # Export utilities
├── types/
│   └── index.js           # Type definitions
└── ENV_SETUP.md           # Environment setup guide
```

## 🎯 Usage

### Without Authentication (Development Mode)

If Firebase is not configured, the app runs in development mode without authentication. This is useful for testing and development.

### With Authentication

1. Click "Sign In to Continue"
2. Choose email/password or Google sign-in
3. You'll stay signed in until you manually sign out

### Adding Records

1. Go to the "Records" tab
2. Click "Add Record"
3. Fill in the required fields:
   - Date, Description, Category, Amount
4. Optional fields:
   - Customer, Project, Quantity, Cost per Unit
5. Attribution tracking (NEW):
   - Attribution Source (how they found you)
   - Conversion Stage (where they are in the funnel)
   - Campaign Details (specific campaign info)

### Viewing Analytics

- **Overview**: Key financial metrics and category breakdown
- **Records**: Full record list with filtering and export
- **Attribution**: Conversion funnel and revenue by source
- **Intelligence**: Business insights and recommendations

### Exporting Data

- **Records Tab**: Export all records as CSV
- **Attribution Tab**: Export attribution report as CSV
- **Intelligence Tab**: Export financial summary (CSV) or complete data (JSON)

## 🔒 Security

- **Row Level Security**: Users can only access their own data
- **Authentication**: Firebase authentication with persistent sessions
- **Environment Variables**: Sensitive data stored in environment variables
- **Input Validation**: Form validation on all inputs

## 📊 Performance Optimization

- **React Query**: 5-30 minute cache times reduce API calls by up to 90%
- **Lazy Loading**: Dashboard components load only when viewed
- **Code Splitting**: Optimized bundle sizes (75KB main bundle)
- **Memoization**: Expensive calculations cached with useMemo
- **Indexed Queries**: Database indexes for fast queries

## 🚀 Deployment

### Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- AWS Amplify
- DigitalOcean App Platform

## 📝 Environment Variables

See `ENV_SETUP.md` for detailed environment variable configuration.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions, please open an issue on GitHub.
