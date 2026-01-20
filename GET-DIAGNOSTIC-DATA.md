# 🔥 URGENT: GET YOUR DIAGNOSTIC DATA NOW

## STEP 1: Open DevTools
Press **F12** on your keyboard → A panel appears at bottom of screen

## STEP 2: Go to Network Tab
Click the **"Network"** tab at the top of DevTools

## STEP 3: Upload & Send Your CSV
1. Upload your CSV file in the dashboard
2. Click "Send Emails" button

## STEP 4: Find the Request
In the Network tab, you'll see requests appearing. Look for one called:
```
send-email
```

Click on it.

## STEP 5: Open Response Tab
Once clicked, a panel opens on the right. Click the **"Response"** tab.

## STEP 6: Look for invalidDetails

You'll see something like:

```json
{
  "error": "No valid recipients...",
  "stats": { ... },
  "invalidDetails": [
    {
      "raw": "john@example.c",
      "cleaned": "john@example.c",
      "reasons": ["Invalid TLD: \"c\" (len=1)"]
    },
    {
      "raw": "broken@test",
      "cleaned": "broken@test",
      "reasons": ["Domain has no dot"]
    }
  ]
}
```

## THIS IS GOLD 🎯

That `invalidDetails` array shows me:
- What the email looked like before cleaning
- What it looked like after cleaning
- **EXACTLY why it failed**

## Send Me:

1. Copy the entire `invalidDetails` array
2. Also copy a few rows from your CSV that you KNOW have valid emails
3. Paste both here

---

## Example to Show Me:

**Your CSV rows:**
```
email,business_name
john@example.com,Company A
sales@mycompany.co.uk,Company B
contact@business.org,Company C
```

**API Response invalidDetails:**
```json
[
  {
    "raw": "john@example.com",
    "cleaned": "john@example.com",
    "reasons": ["Invalid TLD: \"com\" (len=3)"]
  }
]
```

Then I can see the pattern and fix it immediately.

---

## IF YOU DON'T SEE invalidDetails

Try this:

1. Open DevTools (F12)
2. Click **Console** tab
3. Type: `copy(JSON.stringify(performance.getEntriesByName('send-email')[0], null, 2))`
4. Right-click → Paste somewhere to see it

Or just take a **screenshot** of the Response tab and send it to me.

---

## Quick Test

Try uploading this CSV first:

```csv
email,name
test123@testdomain.com,Test
valid@example.org,Valid
good@company.co.uk,Good
```

Then check `invalidDetails` - tell me what it says about each one.

That will tell us if the issue is:
- Your actual email data
- The email validation rules
- The CSV parsing
- Something else entirely
