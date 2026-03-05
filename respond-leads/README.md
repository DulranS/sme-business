# WhatsApp AI Customer Support System

A production-ready Next.js application that provides intelligent WhatsApp customer support with inventory management and conversation memory using Claude AI and Supabase.

## 🚀 Features

- **WhatsApp Integration**: Real-time message processing via WhatsApp Business Cloud API
- **AI-Powered Responses**: Claude AI for intelligent keyword extraction and customer responses
- **Inventory Management**: Full CRUD operations for product inventory with stock tracking
- **Conversation Memory**: Persistent conversation history with automatic truncation
- **Real-time Dashboard**: Modern UI for monitoring inventory and conversations
- **Production Security**: Webhook verification, rate limiting, input validation, and sanitization
- **Comprehensive Logging**: Structured logging with multiple levels and external service integration
- **Type Safety**: Full TypeScript implementation with strict typing

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WhatsApp      │    │   Next.js       │    │   Supabase      │
│   Business      │───▶│   API Routes    │───▶│   Database      │
│   Cloud API     │    │   (Webhook)     │    │   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Claude AI     │
                       │   (Anthropic)   │
                       └─────────────────┘
```

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- WhatsApp Business Account
- Anthropic Claude API access

## 🛠️ Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd respond-leads
npm install
```

### 2. Environment Configuration

Copy the environment template:

```bash
cp env.example .env.local
```

Fill in your environment variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# WhatsApp Business Cloud Configuration
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_APP_SECRET=your_whatsapp_app_secret
WHATSAPP_VERIFY_TOKEN=your_custom_webhook_verify_token

# Anthropic Claude Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### 3. Database Setup

1. Create a new Supabase project
2. Run the migration script in `supabase/migrations/001_initial_schema.sql`
3. Verify tables are created: `inventory` and `conversations`

### 4. WhatsApp Business Setup

1. Create a Meta Developer Account
2. Set up WhatsApp Business Cloud API
3. Create a Web App and get your:
   - Phone Number ID
   - Access Token
   - App Secret
4. Configure webhook URL: `https://your-domain.com/api/webhook/whatsapp`

### 5. Run the Application

```bash
npm run dev
```

Visit `http://localhost:3000` to access the dashboard.

## 📊 Database Schema

### Inventory Table
```sql
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(50) NOT NULL UNIQUE,
    quantity INTEGER NOT NULL DEFAULT 0,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Conversations Table
```sql
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    customer_name VARCHAR(100) NOT NULL DEFAULT 'Unknown',
    history TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 API Endpoints

### WhatsApp Webhook
- **GET** `/api/webhook/whatsapp` - Webhook verification
- **POST** `/api/webhook/whatsapp` - Process incoming messages

## 🤖 AI Integration

The system uses Claude AI for two main tasks:

1. **Keyword Extraction**: Extracts relevant search terms from customer messages
2. **Response Generation**: Creates contextually appropriate responses based on inventory data and conversation history

### Example Flow

```
Customer: "Do you have Nike Air Max in size 9?"
├─ Claude extracts: "Nike Air Max"
├─ Database search: Finds matching products
├─ Claude generates: "Yes, we have Nike Air Max in stock! Currently 15 pairs available at $120 each."
└─ WhatsApp sends response
```

## 🛡️ Security Features

- **Webhook Verification**: HMAC-SHA256 signature validation
- **Rate Limiting**: Configurable request limits per IP
- **Input Validation**: Comprehensive validation for all inputs
- **Input Sanitization**: XSS prevention and data cleaning
- **CSP Headers**: Content Security Policy for XSS protection
- **Row Level Security**: Database access controls

## 📝 Logging

The application includes structured logging with multiple levels:

- **ERROR**: Critical errors requiring immediate attention
- **WARN**: Warning messages for potential issues
- **INFO**: General information about system operations
- **DEBUG**: Detailed debugging information (development only)

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on git push

### Environment-Specific Considerations

**Production:**
- Set `NODE_ENV=production`
- Use HTTPS for webhook URL
- Configure external logging service
- Enable database backups
- Set up monitoring and alerts

**Development:**
- Use `NODE_ENV=development`
- Debug logging enabled
- Hot reload available

## 🔍 Monitoring

### Key Metrics to Monitor

- API response times
- Error rates (4xx, 5xx)
- WhatsApp webhook failures
- Claude API rate limits
- Database performance
- Memory usage

## 🐛 Troubleshooting

### Common Issues

1. **Webhook Verification Fails**
   - Check `WHATSAPP_VERIFY_TOKEN` matches exactly
   - Ensure webhook URL is publicly accessible
   - Verify SSL certificate is valid

2. **Messages Not Processing**
   - Check WhatsApp API credentials
   - Verify webhook is receiving requests
   - Check application logs for errors

3. **Database Errors**
   - Verify Supabase connection strings
   - Check database migrations are applied
   - Verify RLS policies

4. **AI Response Issues**
   - Check Anthropic API key
   - Monitor rate limits
   - Verify prompt templates

### Debug Mode

Enable debug logging by setting:
```env
NODE_ENV=development
```

## 📚 API Documentation

### WhatsApp Webhook Endpoint

**GET /api/webhook/whatsapp**
Webhook verification for WhatsApp Business Cloud.

**POST /api/webhook/whatsapp**
Processes incoming WhatsApp messages.

Request body:
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "field": "messages",
      "value": {
        "messages": [{
          "id": "message_id",
          "from": "phone_number",
          "text": {"body": "message_text"},
          "type": "text"
        }],
        "contacts": [{
          "profile": {"name": "customer_name"},
          "wa_id": "whatsapp_id"
        }]
      }
    }]
  }]
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the logs for detailed error information

---

**Built with ❤️ using Next.js, Supabase, and Claude AI**
