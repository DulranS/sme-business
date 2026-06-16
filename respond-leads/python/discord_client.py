"""
Discord client — handles sending messages via webhooks
and receiving messages via bot or interactions.

Two modes:
1. Bot mode: Uses discord.py gateway to listen for messages in real-time
2. Webhook mode: Uses Discord Interactions endpoint for slash commands

Sending is always done via webhooks (faster, no bot permissions needed).
"""

import logging
from typing import Optional

import httpx
import discord
from discord.ext import commands

from config import Config

logger = logging.getLogger(__name__)


class DiscordWebhookSender:
    """
    Sends messages via Discord webhooks.
    Fast, stateless, no bot permissions required for sending.
    """

    def __init__(self):
        self._client = httpx.AsyncClient(timeout=30)

    async def send_to_webhook(
        self,
        webhook_url: str,
        content: str,
        username: Optional[str] = None,
        avatar_url: Optional[str] = None,
        embeds: Optional[list[dict]] = None
    ) -> dict:
        """Send a message to a Discord webhook."""
        payload: dict = {"content": content}

        if username:
            payload["username"] = username
        if avatar_url:
            payload["avatar_url"] = avatar_url
        if embeds:
            payload["embeds"] = embeds

        # Discord webhook content limit is 2000 chars
        if len(content) > 2000:
            # Split into chunks
            chunks = self._split_message(content, 2000)
            results = []
            for chunk in chunks:
                chunk_payload = payload.copy()
                chunk_payload["content"] = chunk
                resp = await self._client.post(webhook_url, json=chunk_payload)
                resp.raise_for_status()
                results.append(resp.json())
            return {"chunks": results}

        resp = await self._client.post(webhook_url, json=payload)
        resp.raise_for_status()
        return resp.json() if resp.text else {}

    async def send_customer_response(self, content: str, username: str = "Support Bot"):
        """Send response to the main support channel."""
        if not Config.DISCORD_WEBHOOK_URL:
            logger.error("DISCORD_WEBHOOK_URL not configured")
            return
        return await self.send_to_webhook(
            Config.DISCORD_WEBHOOK_URL,
            content,
            username=username
        )

    async def send_battle_card(self, content: str, lead_name: str):
        """Send battle card to the sales channel."""
        if not Config.DISCORD_SALES_WEBHOOK_URL:
            logger.warning("DISCORD_SALES_WEBHOOK_URL not configured — skipping battle card")
            return

        # Format as a nice embed for sales team
        embed = {
            "title": f"🎯 Lead Alert — {lead_name}",
            "description": content[:4000],  # Discord embed limit
            "color": 0x00ff00,  # Green
            "footer": {"text": "AI Sales Intelligence"}
        }

        return await self.send_to_webhook(
            Config.DISCORD_SALES_WEBHOOK_URL,
            "",  # Empty content, using embed instead
            username="Sales Intel Bot",
            embeds=[embed]
        )

    @staticmethod
    def _split_message(text: str, max_len: int) -> list[str]:
        """Split long messages into chunks, preferring line breaks."""
        chunks = []
        while len(text) > max_len:
            # Find last newline before limit
            split_at = text.rfind("\n", 0, max_len)
            if split_at == -1:
                split_at = max_len
            chunks.append(text[:split_at])
            text = text[split_at:].lstrip()
        if text:
            chunks.append(text)
        return chunks

    async def close(self):
        await self._client.aclose()


class DiscordBotClient(commands.Bot):
    """
    Discord bot for receiving messages via the gateway.
    Use this if you need real-time message listening.
    """

    def __init__(self, message_handler):
        intents = discord.Intents.default()
        intents.message_content = True  # Required to read message content
        intents.members = False

        super().__init__(
            command_prefix="!",
            intents=intents,
            help_command=None
        )

        self.message_handler = message_handler
        self._ready = False

    async def setup_hook(self):
        """Called when the bot is starting up."""
        logger.info("Discord bot setup hook running")
        self._ready = True

    async def on_ready(self):
        logger.info(f"Discord bot logged in as {self.user} (ID: {self.user.id})")
        logger.info(f"Connected to {len(self.guilds)} guilds")

    async def on_message(self, message: discord.Message):
        """Handle incoming messages."""
        # Ignore bot's own messages
        if message.author == self.user:
            return

        # Ignore messages from other bots
        if message.author.bot:
            return

        # Only listen in the support channel (if configured)
        if Config.DISCORD_SUPPORT_CHANNEL_ID and message.channel.id != Config.DISCORD_SUPPORT_CHANNEL_ID:
            return

        # Parse message into our standard format
        msg_data = {
            "id": str(message.id),
            "from": str(message.author.id),  # Use Discord user ID as identifier
            "text_body": message.content or "[Empty message]",
            "profile_name": message.author.display_name or message.author.name,
            "timestamp": str(int(message.created_at.timestamp())),
            "channel_id": str(message.channel.id),
            "guild_id": str(message.guild.id) if message.guild else "DM",
            "attachments": [a.url for a in message.attachments],
            "is_thread": isinstance(message.channel, discord.Thread),
            "thread_id": str(message.channel.id) if isinstance(message.channel, discord.Thread) else None
        }

        logger.info(f"Received message from {msg_data['profile_name']}: {msg_data['text_body'][:50]}...")

        # Process the message
        await self.message_handler(msg_data)

    async def send_response(self, channel_id: int, content: str, username: str = "Support Bot"):
        """Send a message directly to a Discord channel (requires bot perms)."""
        channel = self.get_channel(channel_id)
        if not channel:
            try:
                channel = await self.fetch_channel(channel_id)
            except Exception as e:
                logger.error(f"Could not fetch channel {channel_id}: {e}")
                return

        # Split if too long
        if len(content) > 2000:
            chunks = DiscordWebhookSender._split_message(content, 2000)
            for chunk in chunks:
                await channel.send(chunk)
        else:
            await channel.send(content)


def create_bot(message_handler) -> DiscordBotClient:
    """Factory function to create the Discord bot."""
    return DiscordBotClient(message_handler)