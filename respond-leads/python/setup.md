# 1. Create Discord Application
# Go to https://discord.com/developers/applications
# Create New Application → "Inventory Support Bot"
# Copy: Application ID, Public Key

# 2. Create Bot
# Go to "Bot" tab → Reset Token → Copy bot token
# Enable: Message Content Intent, Server Members Intent

# 3. Create Webhooks
# In your Discord server:
#   - Support channel → Edit Channel → Integrations → Webhooks → New Webhook → Copy URL
#   - Sales channel → Same steps → Copy URL

# 4. Invite bot to server
# OAuth2 → URL Generator → Select: bot, applications.commands
# Scopes: Send Messages, Read Message History, View Channels
# Copy generated URL → Open in browser → Select server

# 5. Install and run
pip install -r requirements.txt
cp .env.example .env
# Fill in .env with your tokens/URLs

uvicorn main:app --host 0.0.0.0 --port 8000