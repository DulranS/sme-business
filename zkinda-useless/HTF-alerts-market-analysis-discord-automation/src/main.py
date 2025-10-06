import asyncio
import yaml
import os
from typing import Dict, Any, List
from market_monitor import MarketStructureMonitor
import structlog
from dotenv import load_dotenv

logger = structlog.get_logger()

class ConfigLoader:
    @staticmethod
    def load_config(config_path: str = 'config/assets.yaml') -> Dict[str, Any]:
        """
        Robust configuration loading with multiple validation checks
        
        Args:
            config_path (str): Path to the configuration YAML file
        
        Returns:
            Dict[str, Any]: Loaded and validated configuration
        """
        # Load environment variables
        load_dotenv()
        
        # Validate required environment variables
        required_env_vars = ['DISCORD_WEBHOOK_URL']
        missing_vars = [var for var in required_env_vars if not os.getenv(var)]
        empty_vars = [var for var in required_env_vars if os.getenv(var) == ""]
        
        if missing_vars or empty_vars:
            logger.error(
                "Missing or empty required environment variables",
                missing_vars=missing_vars,
                empty_vars=empty_vars
            )
            raise ValueError(f"Missing or empty env vars: {', '.join(missing_vars + empty_vars)}")
        
        # Load configuration file
        try:
            with open(config_path, 'r') as file:
                config = yaml.safe_load(file)
            
            # Validate configuration structure
            ConfigLoader._validate_config(config)
            
            return config
        
        except FileNotFoundError:
            logger.error("Configuration file not found", path=config_path)
            raise
        except yaml.YAMLError as e:
            logger.error("YAML parsing error", error=str(e))
            raise
    
    @staticmethod
    def _validate_config(config: Dict[str, Any]):
        """
        Validate configuration schema and content
        
        Args:
            config (Dict[str, Any]): Configuration to validate
        
        Raises:
            ValueError: If configuration is invalid
        """
        if not isinstance(config, dict):
            raise ValueError("Configuration must be a dictionary")
        
        # Validate 'assets' section
        if 'assets' not in config or not isinstance(config['assets'], dict):
            raise ValueError("Missing or invalid 'assets' key in configuration")
        
        for category, assets in config['assets'].items():
            if not isinstance(assets, list) or not all(isinstance(asset, str) for asset in assets):
                raise ValueError(f"Invalid assets list for category '{category}'")
        
        # Validate 'notification' section
        if 'notification' not in config or not isinstance(config['notification'], dict):
            raise ValueError("Missing or invalid 'notification' key in configuration")
        
        if 'discord' not in config['notification'] or not isinstance(config['notification']['discord'], dict):
            raise ValueError("Missing or invalid 'discord' configuration")
        
        if 'enabled' not in config['notification']['discord'] or not isinstance(config['notification']['discord']['enabled'], bool):
            raise ValueError("Missing or invalid 'enabled' flag in discord notification configuration")
        
        # Validate 'logging' section
        if 'logging' not in config['notification'] or not isinstance(config['notification']['logging'], dict):
            raise ValueError("Missing or invalid 'logging' configuration")
        
        if 'enabled' not in config['notification']['logging'] or not isinstance(config['notification']['logging']['enabled'], bool):
            raise ValueError("Missing or invalid 'enabled' flag in logging configuration")
        
        if 'level' not in config['notification']['logging'] or config['notification']['logging']['level'].upper() not in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
            raise ValueError("Missing or invalid 'level' in logging configuration")
        
        # Validate optional 'settings' section
        if 'settings' in config:
            if not isinstance(config['settings'], dict):
                raise ValueError("Invalid 'settings' section in configuration")
            
            if 'timezone' in config['settings'] and not isinstance(config['settings']['timezone'], str):
                raise ValueError("Invalid 'timezone' in settings")
            
            if 'interval_minutes' in config['settings'] and not isinstance(config['settings']['interval_minutes'], int):
                raise ValueError("Invalid 'interval_minutes' in settings")

async def main():
    try:
        # Load configuration
        logger.info("Loading configuration...")
        config = ConfigLoader.load_config()
        
        # Create monitors for each asset
        logger.info("Initializing market structure monitors...")
        monitors: List[MarketStructureMonitor] = [
            MarketStructureMonitor(
                symbol=asset,
                category=category,
                notification_config=config['notification']
            )
            for category, assets in config['assets'].items()
            for asset in assets
        ]
        
        # Run all monitors concurrently with error handling
        logger.info("Starting market structure monitors...")
        await asyncio.gather(*(monitor.run() for monitor in monitors))
    
    except Exception as e:
        logger.error("Failed to start service", error=str(e))
        raise

if __name__ == "__main__":
    try:
        logger.info("Starting Market Structure Monitor Service")
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Service stopped by user")
    except Exception as e:
        logger.error("Service crashed", error=str(e))
        raise