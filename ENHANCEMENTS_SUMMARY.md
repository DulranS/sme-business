# findemails.py - Enhanced Business Intelligence Tool

## Major Enhancements Added

### 1. **LinkedIn Profile Detection** 🔗
- **Company Profiles**: Detects and extracts LinkedIn company URLs
- **CEO Profiles**: Identifies and links to CEO LinkedIn profiles
- **Founder Profiles**: Captures founder/co-founder LinkedIn profiles
- Automatically prioritizes CEO and founder mentions in anchor text and metadata

### 2. **Expanded Social Media Coverage** 📱
- **Facebook**: Extracts Facebook business pages
- **YouTube**: Captures YouTube channel links
- **TikTok**: Detects TikTok business accounts
- All integrated into a comprehensive social media intelligence score

### 3. **Smart Contact Intelligence** 📧
- **Primary Email Detection**: Intelligently identifies the best email contact
  - Prioritizes contact-specific emails (contact@, info@, support@, sales@)
  - Fallback to first found email if no priority match
- **Primary Phone Detection**: Selects the best phone number from multiple options
  - Prioritizes international format numbers
- **Contact Page Detection**: Flags if a dedicated contact page was found (Yes/No)

### 4. **Business Scoring System** ⭐
- **Social Media Score (0-6)**: Quantifies digital presence across:
  - Instagram, Twitter, LinkedIn, Facebook, YouTube, TikTok
- Helps identify digitally engaged businesses vs. minimal presence

### 5. **New Output Columns**
```
- linkedin_company      : Direct link to company's LinkedIn profile
- linkedin_ceo          : Direct link to CEO's LinkedIn profile
- linkedin_founder      : Direct link to founder's LinkedIn profile
- email_primary         : Best contact email identified
- phone_primary         : Best contact phone number
- contact_page_found    : Whether business has dedicated contact page
- social_media_score    : 0-6 scoring of social media presence
```

### 6. **Enhanced Reporting** 📊
The output statistics now include:
- Email coverage percentage
- Phone coverage percentage
- LinkedIn company profile discovery rate
- CEO and founder contact discovery counts
- Contact page detection rate
- Average social media engagement score

## Business Value Improvements

✅ **Better Lead Qualification**: Social media scores help identify actively engaged businesses
✅ **Decision Maker Access**: Direct LinkedIn profiles for CEO/Founders = easier outreach
✅ **Multi-Channel Strategy**: Multiple contact methods across 6+ platforms
✅ **Priority Targeting**: Easily identify best contacts for outreach campaigns
✅ **Data Quality**: Primary contact fields reduce wrong-number/wrong-email dialers
✅ **Competitive Intelligence**: LinkedIn profiles provide company size, growth signals
✅ **Automation-Ready**: Scores and flags enable smart filtering and sorting

## How It Works

1. **Deeper Web Scraping**: Crawls up to 6 pages per website
2. **Pattern Matching**: Uses advanced regex for LinkedIn, Facebook, YouTube, TikTok
3. **Context-Aware**: Identifies CEO/Founder from page context and anchor text
4. **Priority Pages**: Focuses on contact, about, and team pages first
5. **Intelligent Ranking**: Scores contacts based on relevance keywords
6. **Parallel Processing**: 12 concurrent workers for faster enrichment

## Integration with Existing Features

- ✅ All existing email extraction remains
- ✅ Phone number detection enhanced and ranked
- ✅ Instagram/Twitter extraction kept
- ✅ Concurrent processing (12 workers)
- ✅ Rate limiting and respectful scraping
- ✅ Error handling and partial result saving

## Usage

```bash
python findemails.py
```

Input: `c:\Users\dulra\Downloads\google (6).csv` (or modify CSV_INPUT_PATH)
Output: `business_leads_with_email (X).csv` (auto-incrementing)

## Next Steps (Optional Enhancements)

- Email validation API integration
- LinkedIn Scraper API for verified profiles
- Domain reputation/trust scoring
- Employee directory crawling
- B2B database enrichment
