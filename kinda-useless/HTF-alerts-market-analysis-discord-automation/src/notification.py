import os
import aiohttp
import structlog
from datetime import datetime
import pytz
from typing import Dict, Optional, List, Union
import resend  # Import the Resend SDK
logger = structlog.get_logger()

class DiscordNotifier:
    def __init__(self, webhook_url: Optional[str] = None):
        # Discord Webhook Configuration
        self.webhook_url = webhook_url or os.getenv('DISCORD_WEBHOOK_URL')
        if not self.webhook_url:
            raise ValueError(
                "DISCORD_WEBHOOK_URL environment variable is not set")
        # Add support for multiple webhooks and fallback mechanisms
        self.backup_webhooks = os.getenv(
            'DISCORD_BACKUP_WEBHOOKS', '').split(',')
        # Define New York timezone
        self.ny_tz = pytz.timezone('America/New_York')
        # Email configuration (using Resend SDK)
        self.resend_api_key = os.getenv('RESEND_API_KEY')
        if not self.resend_api_key:
            raise ValueError("RESEND_API_KEY environment variable is not set")
        resend.api_key = self.resend_api_key  # Set the Resend API key
        self.email_sender = os.getenv(
            'EMAIL_SENDER', 'onboarding@resend.dev')  # Default sender
        self.email_recipient = os.getenv(
            'EMAIL_RECIPIENT', 'dulransamarasinghe3@gmail.com')

    async def send_message(
        self,
        message: str,
        title: str = "Market Structure Change Alert",
        color: int = 3447003,  # Default blue color
        additional_embeds: Optional[List[Dict]] = None
    ):
        """
        Send a message with enhanced flexibility and error handling.
        Args:
            message (str): Main message content
            title (str, optional): Embed title
            color (int, optional): Embed color
            additional_embeds (List[Dict], optional): Additional embed objects
        """
        try:
            # Use New York time for timestamp
            ny_time = datetime.now(self.ny_tz)
            # Create a nicely formatted embed
            embed = {
                "title": f"🔔 {title}",  # Add an emoji for attention
                "description": f"**{message}**",  # Bold the main message
                "color": color,
                "timestamp": ny_time.isoformat(),
                "footer": {
                    "text": "Market Monitor Bot",  # Footer text
                    "icon_url": "https://cdn-icons-png.flaticon.com/512/2914/2914685.png"  # Example icon
                },
                "thumbnail": {
                    "url": "https://cdn-icons-png.flaticon.com/512/1076/1076341.png"  # Example thumbnail
                },
                "fields": [
                    {
                        "name": "Time (NY)",
                        "value": ny_time.strftime('%Y-%m-%d %H:%M:%S %Z'),
                        "inline": True
                    }
                ]
            }
            payload = {
                "embeds": [embed] + (additional_embeds or [])
            }
            # Add rate limit handling and webhook fallback
            webhooks_to_try = [self.webhook_url] + self.backup_webhooks
            discord_success = False
            for webhook in webhooks_to_try:
                if not webhook:
                    continue
                try:
                    async with aiohttp.ClientSession() as session:
                        async with session.post(webhook, json=payload) as response:
                            if response.status == 204:
                                logger.info(
                                    "Discord notification sent successfully")
                                discord_success = True
                                break
                            else:
                                logger.warning(
                                    "Failed to send Discord notification",
                                    status=response.status,
                                    webhook=webhook
                                )
                except Exception as e:
                    logger.error(
                        "Error sending Discord notification to webhook",
                        error=str(e),
                        webhook=webhook
                    )

            # Send email notification via Resend SDK
            email_success = self.send_email_via_resend(title, message, embed)

            return discord_success and email_success
        except Exception as e:
            logger.error(
                "Unexpected error in Discord notification", error=str(e))
            return False

    def send_email_via_resend(self, subject: str, body: str, embed: Dict) -> bool:
        """
        Send an email notification using the Resend SDK.
        Args:
            subject (str): Email subject
            body (str): Email body content
            embed (Dict): Discord embed data to include in the email
        Returns:
            bool: True if the email was sent successfully, False otherwise
        """
        try:
            # Construct the HTML email body based on the embed data
            html_body = f"""
            <h1>{subject}</h1>
            <p><strong>Message:</strong> {body}</p>
            <p><strong>Timestamp:</strong> {embed['timestamp']}</p>
            <p><strong>Footer:</strong> {embed['footer']['text']}</p>
            <img src="{embed['thumbnail']['url']}" alt="Thumbnail" style="max-width: 100px;">
            """
            # Send the email using Resend's SDK
            r = resend.Emails.send({
                "from": self.email_sender,
                "to": [self.email_recipient],
                "subject": subject,
                "html": html_body
            })
            logger.info(
                "Email notification sent successfully via Resend",
                email_id=r.get("id")  # Log the email ID for tracking
            )
            return True
        except Exception as e:
            logger.error("Error sending email via Resend", error=str(e))
            return False