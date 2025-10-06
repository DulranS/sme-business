import asyncio
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta
import structlog
from notification import DiscordNotifier
import pytz

logger = structlog.get_logger()

# Symbol mapping for proper display names
SYMBOL_DISPLAY_NAMES = {
    "IXIC": "NASDAQ",
    "GC=F": "XAUUSD",
    # Add more mappings as needed
}

class MarketStructureMonitor:
    def __init__(self, symbol, category, notification_config):
        self.symbol = symbol
        self.category = category
        self.notification_config = notification_config
        self.previous_structure = None
        self.last_swing_high = None
        self.last_swing_low = None
        self.logger = logger.bind(symbol=symbol, category=category)
        self.notifier = DiscordNotifier()
        self.ny_tz = pytz.timezone('America/New_York')

    async def get_market_data(self):
        """Fetch market data using yfinance"""
        try:
            ticker = yf.Ticker(self.symbol)
            df = ticker.history(interval='15m', period='2d')
            return df.tail(96)  # 96 15-minute periods in 24 hours
        except Exception as e:
            self.logger.error("Error fetching market data", error=str(e))
            return None

    def detect_swing_points(self, df, window=5):
        """Detect swing highs and lows with improved validation"""
        if df is None or len(df) < window * 2:
            self.logger.warning("Insufficient data for swing detection")
            return None
        try:
            min_price_movement = df['High'].mean() * 0.002
            df['Swing_High'] = df['High'].rolling(window=window, center=True).apply(
                lambda x: 1 if (x.iloc[window // 2] == max(x) and
                                max(x) - min(x) > min_price_movement) else 0
            )
            df['Swing_Low'] = df['Low'].rolling(window=window, center=True).apply(
                lambda x: 1 if (x.iloc[window // 2] == min(x) and
                                max(x) - min(x) > min_price_movement) else 0
            )
            return df
        except Exception as e:
            self.logger.error("Error in swing point detection", error=str(e))
            return None

    def analyze_market_structure(self, df):
        """Analyze market structure with strict trend confirmation"""
        if df is None:
            return None
        try:
            swing_highs = df[df['Swing_High'] == 1]
            swing_lows = df[df['Swing_Low'] == 1]
            if len(swing_highs) > 0 and len(swing_lows) > 0:
                latest_high = swing_highs['High'].iloc[-1]
                latest_low = swing_lows['Low'].iloc[-1]
                last_close = df['Close'].iloc[-1]
                if last_close > latest_high:
                    if self.previous_structure != 'UPTREND':
                        return 'UPTREND'
                elif last_close < latest_low:
                    if self.previous_structure != 'DOWNTREND':
                        return 'DOWNTREND'
            return None
        except Exception as e:
            self.logger.error("Error in market structure analysis", error=str(e))
            return None

    async def run(self):
        """Main monitoring loop aligned to New York time"""
        self.logger.info("Starting monitoring", symbol=self.symbol)

        while True:
            try:
                # Align to the next 15-minute interval starting from midnight NY time
                ny_time = datetime.now(self.ny_tz)
                midnight_ny = ny_time.replace(hour=0, minute=0, second=0, microsecond=0)
                elapsed_minutes = int((ny_time - midnight_ny).total_seconds() / 60)
                next_interval_minutes = ((elapsed_minutes // 15) + 1) * 15
                next_run_time = midnight_ny + timedelta(minutes=next_interval_minutes)
                sleep_time = (next_run_time - ny_time).total_seconds()

                await asyncio.sleep(sleep_time)

                # Fetch and process data
                df = await self.get_market_data()
                df = self.detect_swing_points(df)
                current_structure = self.analyze_market_structure(df)

                if (self.previous_structure and
                    current_structure is not None and
                        current_structure != self.previous_structure):
                    current_price = df['Close'].iloc[-1]
                    ny_time = datetime.now(self.ny_tz)
                    display_symbol = SYMBOL_DISPLAY_NAMES.get(self.symbol, self.symbol)
                    message = (
                        f"Market Structure Change Detected\n\n"
                        f"Asset: {display_symbol} ({self.category})\n"
                        f"Structure Change: {self.previous_structure} → {current_structure}\n"
                        f"Current Price: ${current_price:.2f}\n"
                        f"Time: {ny_time.strftime('%Y-%m-%d %H:%M:%S %Z')}"
                    )
                    self.logger.info(
                        "Market structure changed",
                        previous=self.previous_structure,
                        current=current_structure,
                        price=current_price
                    )
                    if self.notification_config['discord']['enabled']:
                        await self.notifier.send_message(message)

                if current_structure is not None:
                    self.previous_structure = current_structure

            except Exception as e:
                self.logger.error("Error in monitoring loop", error=str(e))
                await asyncio.sleep(900)  # Fallback sleep on error