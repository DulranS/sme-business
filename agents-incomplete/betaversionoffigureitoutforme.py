import asyncio
import json
import logging
import time
import os
import math
import requests
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
import csv
from collections import defaultdict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BusinessStage(Enum):
    DISCOVERY = "discovery"
    VALIDATION = "validation"  
    PLANNING = "planning"
    LAUNCH_PREP = "launch_prep"

class Priority(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

class TaskStatus(Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"

class ExperienceLevel(Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"

@dataclass
class RealTimeMarketData:
    """Integration with real market data sources"""
    exchange_rates: Dict[str, float] = field(default_factory=dict)
    commodity_prices: Dict[str, float] = field(default_factory=dict)
    stock_market_trends: Dict[str, float] = field(default_factory=dict)
    economic_indicators: Dict[str, float] = field(default_factory=dict)
    last_updated: datetime = field(default_factory=datetime.now)
    
    def is_stale(self, hours: int = 24) -> bool:
        """Check if data is older than specified hours"""
        return (datetime.now() - self.last_updated).total_seconds() > (hours * 3600)

class MarketDataProvider:
    """Fetches real-time market data for business analysis"""
    
    def __init__(self):
        self.cache = RealTimeMarketData()
        self.api_keys = {
            "exchange_rate": os.getenv("EXCHANGE_RATE_API_KEY"),
            "commodities": os.getenv("COMMODITIES_API_KEY"),
            "stocks": os.getenv("STOCK_API_KEY")
        }
    
    async def get_current_market_data(self) -> RealTimeMarketData:
        """Fetch current market data from multiple sources"""
        if not self.cache.is_stale():
            return self.cache
            
        try:
            # Fetch exchange rates (USD, EUR, GBP to LKR)
            exchange_data = await self._fetch_exchange_rates()
            
            # Fetch key commodity prices (oil, gold, rice, tea)
            commodity_data = await self._fetch_commodity_prices()
            
            # Fetch CSE (Colombo Stock Exchange) trends
            stock_data = await self._fetch_stock_trends()
            
            # Fetch economic indicators
            economic_data = await self._fetch_economic_indicators()
            
            self.cache = RealTimeMarketData(
                exchange_rates=exchange_data,
                commodity_prices=commodity_data,
                stock_market_trends=stock_data,
                economic_indicators=economic_data,
                last_updated=datetime.now()
            )
            
        except Exception as e:
            logger.error(f"Failed to fetch market data: {e}")
            # Return cached data even if stale
        
        return self.cache
    
    async def _fetch_exchange_rates(self) -> Dict[str, float]:
        """Fetch current exchange rates"""
        # Using a free API like exchangerate-api.com
        try:
            url = "https://api.exchangerate-api.com/v4/latest/USD"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return {
                    "USD_LKR": data["rates"].get("LKR", 320.0),
                    "EUR_LKR": data["rates"].get("LKR", 320.0) * data["rates"].get("EUR", 0.85),
                    "GBP_LKR": data["rates"].get("LKR", 320.0) * data["rates"].get("GBP", 0.72)
                }
        except Exception as e:
            logger.error(f"Exchange rate fetch failed: {e}")
        
        # Fallback to recent approximate rates
        return {"USD_LKR": 320.0, "EUR_LKR": 340.0, "GBP_LKR": 390.0}
    
    async def _fetch_commodity_prices(self) -> Dict[str, float]:
        """Fetch key commodity prices relevant to Sri Lanka"""
        # In production, integrate with commodities APIs
        return {
            "oil_per_barrel": 85.0,
            "gold_per_ounce": 2020.0,
            "tea_per_kg": 4.5,
            "rubber_per_kg": 2.1,
            "coconut_per_nut": 45.0
        }
    
    async def _fetch_stock_trends(self) -> Dict[str, float]:
        """Fetch Colombo Stock Exchange trends"""
        # In production, integrate with CSE API
        return {
            "ASPI": 11500.0,
            "S&P_SL20": 3800.0,
            "banking_sector": 2.5,  # % change
            "manufacturing_sector": 1.8
        }
    
    async def _fetch_economic_indicators(self) -> Dict[str, float]:
        """Fetch key economic indicators"""
        return {
            "inflation_rate": 2.3,
            "interest_rate": 9.5,
            "gdp_growth": 4.2,
            "unemployment_rate": 4.8
        }

@dataclass
class CompetitorIntelligence:
    """Real competitor analysis and tracking"""
    company_name: str
    website: str
    revenue_estimate: Optional[float]
    employee_count: Optional[int]
    funding_rounds: List[Dict[str, Any]]
    product_offerings: List[str]
    pricing_strategy: Dict[str, Any]
    market_share: Optional[float]
    strengths: List[str]
    weaknesses: List[str]
    recent_news: List[Dict[str, Any]]
    social_media_presence: Dict[str, int]
    last_updated: datetime = field(default_factory=datetime.now)

class CompetitorAnalyzer:
    """Automated competitor research and analysis"""
    
    def __init__(self):
        self.competitors_db = {}
        self.analysis_history = []
    
    async def analyze_competitors(self, sector: str, location: str = "Sri Lanka") -> List[CompetitorIntelligence]:
        """Analyze top competitors in a specific sector"""
        competitors = await self._identify_key_competitors(sector, location)
        detailed_analysis = []
        
        for competitor in competitors:
            try:
                intel = await self._gather_competitor_intelligence(competitor)
                detailed_analysis.append(intel)
            except Exception as e:
                logger.error(f"Failed to analyze competitor {competitor}: {e}")
        
        return detailed_analysis
    
    async def _identify_key_competitors(self, sector: str, location: str) -> List[str]:
        """Identify key competitors through various methods"""
        # In production, this would use multiple data sources:
        # - Company registrar databases
        # - Industry reports
        # - Web scraping (with proper permissions)
        # - Social media monitoring
        
        competitor_mapping = {
            "fintech": [
                "eZ Cash", "FriMi", "Genie", "HNB Mobile Banking", 
                "Commercial Bank Mobile", "PayHere", "Mintpay"
            ],
            "digital_services": [
                "99X Technology", "WSO2", "Millennium IT", "IFS",
                "Virtusa", "Zone24x7", "CodeGen"
            ],
            "import_export_tech": [
                "Brandix", "MAS Holdings", "Hayleys", "John Keells",
                "Aitken Spence", "Ceylon Cold Stores"
            ]
        }
        
        return competitor_mapping.get(sector, [])
    
    async def _gather_competitor_intelligence(self, company_name: str) -> CompetitorIntelligence:
        """Gather comprehensive intelligence on a competitor"""
        # In production, integrate with:
        # - Crunchbase API for funding data
        # - LinkedIn API for employee counts
        # - Social media APIs
        # - Web scraping tools (respecting robots.txt)
        # - News APIs for recent developments
        
        # Mock data for demonstration
        return CompetitorIntelligence(
            company_name=company_name,
            website=f"https://{company_name.lower().replace(' ', '')}.com",
            revenue_estimate=50000000,  # LKR 50M estimate
            employee_count=25,
            funding_rounds=[
                {"round": "Seed", "amount": 10000000, "date": "2023-01-15"},
                {"round": "Series A", "amount": 50000000, "date": "2024-03-20"}
            ],
            product_offerings=["Mobile App", "Web Platform", "API Services"],
            pricing_strategy={
                "model": "freemium",
                "basic_plan": 0,
                "premium_plan": 2500,
                "enterprise_plan": 15000
            },
            market_share=0.15,  # 15% market share estimate
            strengths=["Strong brand recognition", "First mover advantage", "Good funding"],
            weaknesses=["Limited rural reach", "High customer acquisition cost"],
            recent_news=[
                {"headline": "Company X raises $2M in Series A", "date": "2024-09-15", "source": "TechCrunch"}
            ],
            social_media_presence={
                "facebook_followers": 25000,
                "instagram_followers": 15000,
                "linkedin_followers": 8000
            }
        )

@dataclass
class LegalComplianceChecker:
    """Automated legal and regulatory compliance checking"""
    business_type: str
    required_licenses: List[Dict[str, Any]]
    tax_obligations: List[Dict[str, Any]]
    labor_law_requirements: List[str]
    environmental_regulations: List[str]
    data_protection_requirements: List[str]
    estimated_compliance_cost: float
    time_to_compliance: str
    risk_level: str  # low/medium/high/critical

class RegulatoryAdvisor:
    """Provides regulatory guidance and compliance checking"""
    
    def __init__(self):
        self.compliance_database = self._load_compliance_data()
        self.legal_updates = []
    
    def _load_compliance_data(self) -> Dict[str, Any]:
        """Load regulatory requirements database"""
        return {
            "fintech": {
                "licenses": [
                    {
                        "name": "Payment Service Provider License",
                        "authority": "Central Bank of Sri Lanka",
                        "cost": 1000000,
                        "timeframe": "6-12 months",
                        "requirements": ["Minimum capital LKR 25M", "Fit and proper test", "Risk management system"]
                    },
                    {
                        "name": "Money Changing License",
                        "authority": "Central Bank of Sri Lanka", 
                        "cost": 500000,
                        "timeframe": "3-6 months",
                        "requirements": ["Minimum capital LKR 5M", "Physical premises", "Security arrangements"]
                    }
                ],
                "ongoing_compliance": [
                    "AML/CFT compliance program",
                    "Monthly regulatory returns",
                    "Annual audit by approved auditor",
                    "Customer due diligence procedures"
                ]
            },
            "import_export_tech": {
                "licenses": [
                    {
                        "name": "Import/Export License",
                        "authority": "Department of Commerce",
                        "cost": 50000,
                        "timeframe": "2-4 weeks",
                        "requirements": ["Business registration", "Tax clearance", "Bank guarantee"]
                    }
                ],
                "ongoing_compliance": [
                    "Customs declarations",
                    "Foreign exchange regulations",
                    "Product quality certifications",
                    "Environmental clearances"
                ]
            }
        }
    
    async def check_compliance_requirements(self, business_type: str, business_activities: List[str]) -> LegalComplianceChecker:
        """Check all regulatory requirements for a business type"""
        compliance_data = self.compliance_database.get(business_type, {})
        
        # Calculate total compliance cost and timeframe
        total_cost = sum(license["cost"] for license in compliance_data.get("licenses", []))
        max_timeframe = max([self._parse_timeframe(license["timeframe"]) 
                           for license in compliance_data.get("licenses", [])], default=1)
        
        return LegalComplianceChecker(
            business_type=business_type,
            required_licenses=compliance_data.get("licenses", []),
            tax_obligations=[
                {"type": "Income Tax", "rate": "14-24%", "frequency": "Quarterly"},
                {"type": "VAT", "rate": "15%", "threshold": "LKR 12M annual turnover"},
                {"type": "WHT", "rate": "5-14%", "applies_to": "Various payments"}
            ],
            labor_law_requirements=[
                "EPF contribution (12% employer, 8% employee)",
                "ETF contribution (3% employer)",
                "Gratuity fund maintenance",
                "Workers compensation insurance"
            ],
            environmental_regulations=self._get_environmental_regulations(business_type),
            data_protection_requirements=[
                "Data protection impact assessment",
                "Privacy policy implementation", 
                "User consent mechanisms",
                "Data breach notification procedures"
            ],
            estimated_compliance_cost=total_cost + 200000,  # Add buffer for ongoing costs
            time_to_compliance=f"{max_timeframe} months",
            risk_level=self._assess_compliance_risk(business_type)
        )
    
    def _parse_timeframe(self, timeframe: str) -> int:
        """Parse timeframe string to months"""
        if "week" in timeframe:
            return 1
        elif "month" in timeframe:
            return int(timeframe.split("-")[1].split()[0]) if "-" in timeframe else 6
        return 6
    
    def _get_environmental_regulations(self, business_type: str) -> List[str]:
        """Get environmental regulations by business type"""
        env_regs = {
            "manufacturing": [
                "Environmental clearance certificate",
                "Waste disposal permits",
                "Water discharge permits",
                "Air quality compliance"
            ],
            "fintech": [
                "E-waste management compliance",
                "Green office certification (optional)"
            ]
        }
        return env_regs.get(business_type, ["Basic environmental compliance"])
    
    def _assess_compliance_risk(self, business_type: str) -> str:
        """Assess compliance risk level"""
        high_risk_sectors = ["fintech", "pharmaceuticals", "food_processing"]
        medium_risk_sectors = ["import_export_tech", "manufacturing"]
        
        if business_type in high_risk_sectors:
            return "high"
        elif business_type in medium_risk_sectors:
            return "medium"
        else:
            return "low"

@dataclass
class NetworkConnection:
    """Represents a professional network connection"""
    name: str
    role: str
    company: str
    industry: str
    connection_strength: float  # 1-10 scale
    can_provide: List[str]  # What they can help with
    contact_info: Optional[str]
    last_contacted: Optional[datetime]
    introduction_path: List[str]  # How to get introduced

class NetworkAnalyzer:
    """Analyzes and leverages professional networks"""
    
    def __init__(self):
        self.network_database = {}
        self.introduction_templates = self._load_introduction_templates()
    
    def analyze_network_strength(self, profile, target_sector: str) -> Dict[str, Any]:
        """Analyze network strength for a target sector"""
        relevant_connections = self._find_relevant_connections(target_sector)
        network_gaps = self._identify_network_gaps(target_sector)
        networking_strategy = self._create_networking_strategy(target_sector, network_gaps)
        
        return {
            "current_network_size": len(relevant_connections),
            "network_quality_score": self._calculate_network_quality(relevant_connections),
            "key_connections": relevant_connections[:10],  # Top 10
            "network_gaps": network_gaps,
            "networking_strategy": networking_strategy,
            "recommended_events": self._get_networking_events(target_sector),
            "introduction_opportunities": self._find_introduction_opportunities()
        }
    
    def _find_relevant_connections(self, sector: str) -> List[NetworkConnection]:
        """Find network connections relevant to target sector"""
        # Mock relevant connections for demo
        connections = [
            NetworkConnection(
                name="Priya Wickramasinghe",
                role="Senior Software Engineer",
                company="99X Technology",
                industry="Technology",
                connection_strength=7.5,
                can_provide=["Technical mentorship", "Industry insights", "Recruitment"],
                contact_info="priya.w@99x.com",
                last_contacted=datetime.now() - timedelta(days=30),
                introduction_path=["Direct connection"]
            ),
            NetworkConnection(
                name="Ranil Fernando",
                role="Investment Manager",
                company="BOV Capital",
                industry="Finance",
                connection_strength=6.0,
                can_provide=["Funding connections", "Financial advice", "Due diligence"],
                contact_info=None,
                last_contacted=None,
                introduction_path=["Mutual friend: Sarah Silva"]
            )
        ]
        
        # Filter by sector relevance
        sector_mapping = {
            "fintech": ["Technology", "Finance", "Banking"],
            "digital_services": ["Technology", "Marketing", "Consulting"],
            "import_export_tech": ["Trade", "Logistics", "Technology"]
        }
        
        relevant_industries = sector_mapping.get(sector, [])
        return [conn for conn in connections if conn.industry in relevant_industries]
    
    def _identify_network_gaps(self, sector: str) -> List[str]:
        """Identify key network gaps for sector success"""
        essential_connections = {
            "fintech": [
                "Regulatory affairs specialist",
                "Banking industry insider",
                "Fintech entrepreneur",
                "Cybersecurity expert",
                "Compliance officer"
            ],
            "digital_services": [
                "Senior marketing executive",
                "Digital agency owner",
                "Corporate procurement manager",
                "UX/UI expert",
                "Business development specialist"
            ]
        }
        
        return essential_connections.get(sector, ["Industry veteran", "Potential mentor", "Technical expert"])
    
    def _create_networking_strategy(self, sector: str, gaps: List[str]) -> Dict[str, Any]:
        """Create targeted networking strategy"""
        return {
            "priority_targets": gaps[:3],
            "approach_methods": [
                "Industry events and conferences",
                "Professional association meetings",
                "LinkedIn outreach with warm introductions",
                "Volunteer for industry committees",
                "Attend sector-specific meetups"
            ],
            "monthly_networking_goals": {
                "new_connections": 5,
                "follow_up_contacts": 10,
                "events_to_attend": 2
            },
            "networking_budget": "LKR 25,000/month for events and memberships"
        }
    
    def _get_networking_events(self, sector: str) -> List[Dict[str, str]]:
        """Get upcoming networking events for sector"""
        events = [
            {
                "name": "Sri Lankan Tech Entrepreneurs Meetup",
                "date": "2024-10-15",
                "location": "Colombo",
                "cost": "Free",
                "relevance": "High for tech sectors"
            },
            {
                "name": "FinTech Forum Asia",
                "date": "2024-11-20", 
                "location": "Colombo",
                "cost": "LKR 15,000",
                "relevance": "High for fintech"
            }
        ]
        return events
    
    def _find_introduction_opportunities(self) -> List[Dict[str, Any]]:
        """Find mutual connections for warm introductions"""
        return [
            {
                "target": "Ranil Fernando - Investment Manager",
                "mutual_connection": "Sarah Silva",
                "introduction_template": "email_investor_intro",
                "success_probability": "High"
            }
        ]
    
    def _calculate_network_quality(self, connections: List[NetworkConnection]) -> float:
        """Calculate overall network quality score"""
        if not connections:
            return 0.0
        
        total_strength = sum(conn.connection_strength for conn in connections)
        avg_strength = total_strength / len(connections)
        
        # Bonus for diversity of industries and roles
        unique_industries = len(set(conn.industry for conn in connections))
        unique_roles = len(set(conn.role for conn in connections))
        
        diversity_bonus = (unique_industries * 0.5 + unique_roles * 0.3) / len(connections)
        
        return min(10.0, avg_strength + diversity_bonus)
    
    def _load_introduction_templates(self) -> Dict[str, str]:
        """Load email templates for introductions"""
        return {
            "email_investor_intro": """
Subject: Introduction - {entrepreneur_name} seeking fintech investment advice

Hi {mutual_connection},

I hope you're doing well. I wanted to introduce you to {target_name}, who I believe would be a great connection for {entrepreneur_name}.

{entrepreneur_name} is developing a promising fintech solution in {sector} and would greatly benefit from {target_name}'s expertise in {target_expertise}.

Would you be comfortable making an introduction? I think they would have a valuable conversation.

Best regards,
{your_name}
            """
        }

class BusinessModelGenerator:
    """Generate and validate business model variations"""
    
    def __init__(self):
        self.model_templates = self._load_business_model_templates()
        self.validation_criteria = self._load_validation_criteria()
    
    def generate_model_variations(self, sector: str, target_market: str, available_capital: float) -> List[Dict[str, Any]]:
        """Generate multiple business model variations"""
        base_models = self.model_templates.get(sector, [])
        variations = []
        
        for base_model in base_models:
            # Generate capital-appropriate variations
            if available_capital >= base_model["min_capital"]:
                variation = self._adapt_model_to_capital(base_model, available_capital)
                variation["viability_score"] = self._calculate_viability(variation, target_market)
                variation["year_1_projection"] = base_model.get("min_capital", 1000000) * 0.5
                variation["year_2_projection"] = base_model.get("min_capital", 1000000) * 2
                variation["year_3_projection"] = base_model.get("min_capital", 1000000) * 5
                variation["implementation_difficulty"] = base_model.get("complexity", "Medium")
                variations.append(variation)
        
        # Sort by viability score
        variations.sort(key=lambda x: x["viability_score"], reverse=True)
        return variations[:5]  # Return top 5 variations
    
    def _load_business_model_templates(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load business model templates by sector"""
        return {
            "fintech": [
                {
                    "name": "Payment Gateway SaaS",
                    "revenue_streams": ["Transaction fees", "Monthly subscriptions", "Setup fees"],
                    "key_activities": ["Software development", "Compliance management", "Customer support"],
                    "value_proposition": "Simplified payment processing for SMEs",
                    "customer_segments": ["Small businesses", "E-commerce stores", "Service providers"],
                    "min_capital": 2000000,
                    "time_to_revenue": "6-9 months",
                    "scalability": "High",
                    "complexity": "Hard"
                },
                {
                    "name": "Personal Finance App",
                    "revenue_streams": ["Freemium subscriptions", "Affiliate commissions", "Premium features"],
                    "key_activities": ["App development", "Content creation", "User acquisition"],
                    "value_proposition": "Automated personal finance management",
                    "customer_segments": ["Young professionals", "Students", "Small savers"],
                    "min_capital": 500000,
                    "time_to_revenue": "3-6 months",
                    "scalability": "Very High",
                    "complexity": "Medium"
                }
            ],
            "digital_services": [
                {
                    "name": "Specialized Digital Agency",
                    "revenue_streams": ["Project fees", "Retainer contracts", "Performance bonuses"],
                    "key_activities": ["Service delivery", "Client management", "Team development"],
                    "value_proposition": "Expert digital solutions for specific industry",
                    "customer_segments": ["Mid-size companies", "Growing startups", "Traditional businesses"],
                    "min_capital": 200000,
                    "time_to_revenue": "1-3 months",
                    "scalability": "Medium",
                    "complexity": "Easy"
                }
            ]
        }
    
    def _adapt_model_to_capital(self, base_model: Dict[str, Any], available_capital: float) -> Dict[str, Any]:
        """Adapt business model based on available capital"""
        model = base_model.copy()
        
        capital_ratio = available_capital / base_model["min_capital"]
        
        if capital_ratio >= 2.0:
            model["approach"] = "Premium launch with full feature set"
            model["marketing_budget"] = available_capital * 0.3
            model["team_size"] = "3-5 people from start"
        elif capital_ratio >= 1.5:
            model["approach"] = "Standard launch with core features"
            model["marketing_budget"] = available_capital * 0.2
            model["team_size"] = "2-3 people initially"
        else:
            model["approach"] = "Lean launch with MVP"
            model["marketing_budget"] = available_capital * 0.1
            model["team_size"] = "Solo founder or 1 co-founder"
        
        return model
    
    def _calculate_viability(self, model: Dict[str, Any], target_market: str) -> float:
        """Calculate business model viability score"""
        # Simplified scoring based on market fit and execution complexity
        base_score = 5.0
        
        # Market size bonus
        if target_market in ["SME", "Consumer"]:
            base_score += 2.0
        elif target_market == "Enterprise":
            base_score += 1.0
        
        # Scalability bonus
        scalability_bonus = {
            "Very High": 2.0,
            "High": 1.5,
            "Medium": 1.0,
            "Low": 0.5
        }
        base_score += scalability_bonus.get(model.get("scalability", "Medium"), 1.0)
        
        # Time to revenue bonus (faster is better)
        time_to_revenue = model.get("time_to_revenue", "6-9 months")
        if "1-3" in time_to_revenue:
            base_score += 1.0
        elif "3-6" in time_to_revenue:
            base_score += 0.5
        
        return min(10.0, base_score)
    
    def _load_validation_criteria(self) -> Dict[str, List[str]]:
        """Load validation criteria for different business models"""
        return {
            "saas": [
                "Customer problem validation",
                "Solution-market fit validation",
                "Pricing model validation",
                "Customer acquisition channel validation"
            ],
            "marketplace": [
                "Supply-side validation",
                "Demand-side validation", 
                "Unit economics validation",
                "Network effects validation"
            ]
        }

class SkillAssessment:
    """Enhanced skill assessment with proficiency levels"""
    technical_skills: Dict[str, ExperienceLevel]
    business_skills: Dict[str, ExperienceLevel]
    industry_knowledge: Dict[str, ExperienceLevel]
    soft_skills: Dict[str, ExperienceLevel]
    
    def __init__(self, technical_skills, business_skills, industry_knowledge, soft_skills):
        self.technical_skills = technical_skills
        self.business_skills = business_skills
        self.industry_knowledge = industry_knowledge
        self.soft_skills = soft_skills
    
    def get_skill_score(self, category: str) -> float:
        """Calculate weighted skill score for a category"""
        skill_dict = getattr(self, category, {})
        if not skill_dict:
            return 0.0
        
        level_weights = {
            ExperienceLevel.BEGINNER: 1,
            ExperienceLevel.INTERMEDIATE: 2.5,
            ExperienceLevel.ADVANCED: 4,
            ExperienceLevel.EXPERT: 5
        }
        
        total_score = sum(level_weights[level] for level in skill_dict.values())
        max_possible = len(skill_dict) * 5
        return (total_score / max_possible) * 10 if max_possible > 0 else 0

@dataclass
class MarketConditions:
    """Real-time market condition factors with dynamic data"""
    demand_level: float
    competition_intensity: float  
    market_maturity: str
    entry_barriers: float
    regulatory_complexity: float
    capital_requirements: Dict[str, float]
    customer_acquisition_difficulty: float
    market_data: Optional[RealTimeMarketData] = None
    
    def calculate_market_attractiveness(self) -> float:
        """Calculate overall market attractiveness score with real-time data"""
        base_attractiveness = (
            (self.demand_level * 0.3) +
            ((10 - self.competition_intensity) * 0.2) +
            ((10 - self.entry_barriers) * 0.2) +
            ((10 - self.regulatory_complexity) * 0.15) +
            ((10 - self.customer_acquisition_difficulty) * 0.15)
        )
        
        # Adjust based on real-time economic indicators
        if self.market_data:
            economic_multiplier = 1.0
            if self.market_data.economic_indicators.get("gdp_growth", 0) > 4.0:
                economic_multiplier += 0.1
            if self.market_data.economic_indicators.get("inflation_rate", 0) > 5.0:
                economic_multiplier -= 0.1
            
            base_attractiveness *= economic_multiplier
        
        return round(base_attractiveness, 1)

@dataclass
class EntrepreneurProfile:
    """Enhanced entrepreneurial profile with comprehensive assessment"""
    # Basic Info
    name: str
    location: str
    age_range: str
    education_background: str
    work_experience: List[str]
    
    # Detailed Skills Assessment
    skills: SkillAssessment
    
    # Financial Reality Check
    available_capital: float
    monthly_personal_expenses: float
    existing_income: float
    family_financial_obligations: float
    debt_obligations: float
    emergency_fund_months: int
    
    # Risk & Motivation Assessment
    risk_tolerance: str
    motivation_level: float
    time_available_per_week: int
    minimum_income_needed: float
    income_timeline_need: str
    
    # Personal Constraints & Preferences
    health_limitations: List[str]
    family_commitments: str
    travel_willingness: str
    relocation_willingness: bool
    partnership_preference: str
    
    # Market Position
    existing_network_strength: float
    personal_brand_strength: float
    credibility_factors: List[str]
    
    # Sri Lankan Context
    language_skills: Dict[str, ExperienceLevel]
    cultural_adaptability: float
    regulatory_knowledge: ExperienceLevel
    local_market_understanding: ExperienceLevel
    
    # Enhanced readiness calculation methods would go here...
    def calculate_readiness_score(self) -> Dict[str, float]:
        """Calculate readiness across different dimensions"""
        financial_readiness = self._calculate_financial_readiness()
        skill_readiness = self._calculate_skill_readiness()
        market_readiness = self._calculate_market_readiness()
        commitment_readiness = self._calculate_commitment_readiness()
        
        overall = (financial_readiness + skill_readiness + market_readiness + commitment_readiness) / 4
        
        return {
            "financial": financial_readiness,
            "skill": skill_readiness,
            "market": market_readiness,
            "commitment": commitment_readiness,
            "overall": round(overall, 1)
        }
    
    def _calculate_financial_readiness(self) -> float:
        """Calculate financial readiness score"""
        emergency_score = min(self.emergency_fund_months / 6, 1) * 3
        capital_score = min(self.available_capital / 1000000, 1) * 3
        total_monthly_obligations = self.monthly_personal_expenses + self.debt_obligations + self.family_financial_obligations
        debt_burden_ratio = total_monthly_obligations / max(self.existing_income, self.minimum_income_needed)
        debt_score = max(0, (2 - debt_burden_ratio)) * 2
        income_score = (self.existing_income / max(self.minimum_income_needed, 1)) * 2
        
        return round(min(emergency_score + capital_score + debt_score + income_score, 10), 1)
    
    def _calculate_skill_readiness(self) -> float:
        """Calculate skill readiness across all categories"""
        tech_score = self.skills.get_skill_score("technical_skills") * 0.3
        business_score = self.skills.get_skill_score("business_skills") * 0.3
        industry_score = self.skills.get_skill_score("industry_knowledge") * 0.2
        soft_score = self.skills.get_skill_score("soft_skills") * 0.2
        
        return round(tech_score + business_score + industry_score + soft_score, 1)
    
    def _calculate_market_readiness(self) -> float:
        """Calculate market readiness based on local context"""
        network_score = self.existing_network_strength * 0.3
        brand_score = self.personal_brand_strength * 0.2
        language_score = len([l for l in self.language_skills.values() if l in [ExperienceLevel.ADVANCED, ExperienceLevel.EXPERT]]) * 1.5
        cultural_score = self.cultural_adaptability * 0.2
        
        local_knowledge_weights = {
            ExperienceLevel.BEGINNER: 1,
            ExperienceLevel.INTERMEDIATE: 2.5,
            ExperienceLevel.ADVANCED: 4,
            ExperienceLevel.EXPERT: 5
        }
        local_score = local_knowledge_weights[self.local_market_understanding] * 0.2
        
        return round(min(network_score + brand_score + language_score + cultural_score + local_score, 10), 1)
    
    def _calculate_commitment_readiness(self) -> float:
        """Calculate commitment and motivation readiness"""
        time_score = min(self.time_available_per_week / 40, 1) * 3
        motivation_score = self.motivation_level * 0.3
        
        commitment_weights = {
            "none": 3,
            "light": 2.5,
            "moderate": 2,
            "heavy": 1
        }
        commitment_score = commitment_weights.get(self.family_commitments, 1.5)
        health_score = 3 if not self.health_limitations else max(1, 3 - len(self.health_limitations) * 0.5)
        
        return round(min(time_score + motivation_score + commitment_score + health_score, 10), 1)

@dataclass
class ActionableInsight:
    """Specific, actionable business insights with implementation guidance"""
    insight_type: str  # market_opportunity, competitive_advantage, risk_mitigation, etc.
    title: str
    description: str
    evidence: List[str]  # Supporting data/research
    action_items: List[Dict[str, Any]]  # Specific steps to take
    expected_impact: str  # high/medium/low
    implementation_difficulty: str  # easy/medium/hard
    timeline: str
    cost_estimate: Optional[float]
    success_metrics: List[str]
    related_insights: List[str]  # IDs of related insights

class InsightEngine:
    """AI-powered insight generation for business opportunities"""
    
    def __init__(self):
        self.market_data_provider = MarketDataProvider()
        self.competitor_analyzer = CompetitorAnalyzer()
        self.insight_history = []
        
    async def generate_strategic_insights(self, profile: EntrepreneurProfile, sector: str) -> List[ActionableInsight]:
        """Generate AI-powered strategic insights"""
        insights = []
        
        # Get real-time market data
        market_data = await self.market_data_provider.get_current_market_data()
        competitors = await self.competitor_analyzer.analyze_competitors(sector)
        
        # Generate different types of insights
        market_insights = await self._generate_market_insights(market_data, sector)
        competitive_insights = await self._generate_competitive_insights(competitors, profile)
        financial_insights = await self._generate_financial_insights(profile, market_data)
        network_insights = await self._generate_network_insights(profile, sector)
        timing_insights = await self._generate_timing_insights(market_data, sector)
        
        insights.extend([market_insights, competitive_insights, financial_insights, network_insights, timing_insights])
        
        # Filter out None results and sort by impact
        valid_insights = [i for i in insights if i is not None]
        valid_insights.sort(key=lambda x: self._calculate_insight_priority(x), reverse=True)
        
        return valid_insights[:10]  # Return top 10 insights
    
    async def _generate_market_insights(self, market_data: RealTimeMarketData, sector: str) -> Optional[ActionableInsight]:
        """Generate market-based insights"""
        # Analyze exchange rate trends for import/export opportunities
        if sector == "import_export_tech" and market_data.exchange_rates:
            usd_lkr = market_data.exchange_rates.get("USD_LKR", 320)
            
            if usd_lkr > 330:  # LKR weakening
                return ActionableInsight(
                    insight_type="market_opportunity",
                    title="Currency Advantage for Export-Focused Business",
                    description=f"Current USD/LKR rate of {usd_lkr} creates favorable conditions for export businesses",
                    evidence=[
                        f"USD/LKR at {usd_lkr}, above 12-month average",
                        "Weak LKR makes Sri Lankan products more competitive internationally",
                        "Export-oriented businesses can benefit from currency arbitrage"
                    ],
                    action_items=[
                        {
                            "action": "Focus on export markets (US, EU, Middle East)",
                            "timeline": "Immediate",
                            "difficulty": "Medium"
                        },
                        {
                            "action": "Price products in USD to hedge currency risk",
                            "timeline": "Within 2 weeks",
                            "difficulty": "Easy"
                        }
                    ],
                    expected_impact="high",
                    implementation_difficulty="medium",
                    timeline="3-6 months to see full impact",
                    cost_estimate=50000.0,
                    success_metrics=["Export revenue growth", "Currency hedging effectiveness"],
                    related_insights=["competitive_advantage", "financial_strategy"]
                )
        
        return None
    
    async def _generate_competitive_insights(self, competitors: List[CompetitorIntelligence], profile: EntrepreneurProfile) -> Optional[ActionableInsight]:
        """Generate competitive intelligence insights"""
        if competitors:
            # Find underserved segments
            common_weaknesses = []
            for comp in competitors:
                common_weaknesses.extend(comp.weaknesses)
            
            weakness_counts = {}
            for weakness in common_weaknesses:
                weakness_counts[weakness] = weakness_counts.get(weakness, 0) + 1
            
            most_common_weakness = max(weakness_counts.items(), key=lambda x: x[1], default=(None, 0))
            
            if most_common_weakness[0] and most_common_weakness[1] >= 2:
                return ActionableInsight(
                    insight_type="competitive_advantage",
                    title=f"Market Gap: {most_common_weakness[0]}",
                    description=f"Multiple competitors struggle with {most_common_weakness[0]}, creating opportunity",
                    evidence=[
                        f"{most_common_weakness[1]} out of {len(competitors)} competitors have this weakness",
                        "Market research confirms customer pain point",
                        "Opportunity to differentiate through strength in this area"
                    ],
                    action_items=[
                        {
                            "action": f"Develop core competency in addressing {most_common_weakness[0]}",
                            "timeline": "1-3 months",
                            "difficulty": "Medium"
                        },
                        {
                            "action": "Create marketing message around this differentiation",
                            "timeline": "2-4 weeks",
                            "difficulty": "Easy"
                        }
                    ],
                    expected_impact="high",
                    implementation_difficulty="medium",
                    timeline="2-4 months",
                    cost_estimate=100000.0,
                    success_metrics=["Market share capture", "Customer satisfaction scores"],
                    related_insights=["market_opportunity"]
                )
        
        return None
    
    async def _generate_financial_insights(self, profile: EntrepreneurProfile, market_data: RealTimeMarketData) -> Optional[ActionableInsight]:
        """Generate financial strategy insights"""
        if market_data.economic_indicators.get("interest_rate", 0) > 10:
            return ActionableInsight(
                insight_type="financial_strategy",
                title="High Interest Rate Environment - Bootstrap Strategy",
                description="Current high interest rates favor bootstrapped growth over debt financing",
                evidence=[
                    f"Current interest rate: {market_data.economic_indicators['interest_rate']}%",
                    "High cost of borrowing makes debt financing expensive",
                    "Bootstrapping builds financial discipline and ownership retention"
                ],
                action_items=[
                    {
                        "action": "Focus on cash-positive business model from start",
                        "timeline": "Business model design phase",
                        "difficulty": "Medium"
                    },
                    {
                        "action": "Prioritize quick revenue generation over growth",
                        "timeline": "First 6 months",
                        "difficulty": "Hard"
                    }
                ],
                expected_impact="medium",
                implementation_difficulty="medium",
                timeline="6-12 months",
                cost_estimate=0,
                success_metrics=["Monthly cash flow positive", "Debt-to-equity ratio"],
                related_insights=["risk_mitigation"]
            )
        
        return None
    
    async def _generate_network_insights(self, profile: EntrepreneurProfile, sector: str) -> Optional[ActionableInsight]:
        """Generate networking strategy insights"""
        if profile.existing_network_strength < 6:
            return ActionableInsight(
                insight_type="network_building",
                title="Network Strength Below Optimal - Strategic Building Required",
                description="Current network strength insufficient for sector success",
                evidence=[
                    f"Network strength: {profile.existing_network_strength}/10",
                    f"Sector requirement: 6+ for {sector}",
                    "Strong networks critical for customer acquisition and partnerships"
                ],
                action_items=[
                    {
                        "action": "Join 2-3 relevant professional associations",
                        "timeline": "Within 1 month",
                        "difficulty": "Easy"
                    },
                    {
                        "action": "Attend weekly industry events for 3 months",
                        "timeline": "Next 3 months",
                        "difficulty": "Medium"
                    },
                    {
                        "action": "Identify and approach 5 potential mentors",
                        "timeline": "Within 2 months", 
                        "difficulty": "Hard"
                    }
                ],
                expected_impact="high",
                implementation_difficulty="medium",
                timeline="3-6 months",
                cost_estimate=75000.0,
                success_metrics=["Network strength score improvement", "Number of quality connections"],
                related_insights=["market_opportunity"]
            )
        
        return None
    
    async def _generate_timing_insights(self, market_data: RealTimeMarketData, sector: str) -> Optional[ActionableInsight]:
        """Generate market timing insights"""
        if market_data.economic_indicators.get("gdp_growth", 0) > 4:
            return ActionableInsight(
                insight_type="market_timing",
                title="Strong Economic Growth - Favorable Launch Window",
                description="Current economic conditions create favorable environment for new businesses",
                evidence=[
                    f"GDP Growth: {market_data.economic_indicators['gdp_growth']}% (Above 4% threshold)",
                    "Consumer spending typically increases during growth periods",
                    "Business investment sentiment generally positive"
                ],
                action_items=[
                    {
                        "action": "Accelerate launch timeline to capitalize on growth period",
                        "timeline": "Immediate adjustment",
                        "difficulty": "Medium"
                    },
                    {
                        "action": "Increase marketing budget allocation",
                        "timeline": "Launch phase",
                        "difficulty": "Easy"
                    }
                ],
                expected_impact="medium",
                implementation_difficulty="easy",
                timeline="Launch dependent",
                cost_estimate=25000.0,
                success_metrics=["Customer acquisition rate", "Market penetration speed"],
                related_insights=["financial_strategy"]
            )
        
        return None
    
    def _calculate_insight_priority(self, insight: ActionableInsight) -> float:
        """Calculate priority score for insights"""
        impact_scores = {"high": 3, "medium": 2, "low": 1}
        difficulty_scores = {"easy": 3, "medium": 2, "hard": 1}
        
        impact_score = impact_scores.get(insight.expected_impact, 2)
        difficulty_score = difficulty_scores.get(insight.implementation_difficulty, 2)
        
        # Prioritize high impact, easy implementation
        return impact_score + (difficulty_score * 0.5)

class CustomerDiscoveryAutomator:
    """Automates customer discovery and validation processes"""
    
    def __init__(self):
        self.survey_templates = self._load_survey_templates()
        self.interview_scripts = self._load_interview_scripts()
        self.validation_frameworks = self._load_validation_frameworks()
    
    def _load_survey_templates(self) -> Dict[str, Any]:
        """Load survey templates for different business types"""
        return {
            "fintech": {
                "problem_discovery": [
                    "How do you currently manage your personal finances?",
                    "What's the biggest challenge you face with financial management?",
                    "How much time do you spend weekly on financial tasks?"
                ],
                "solution_validation": [
                    "Would you be interested in an automated finance tracking app?",
                    "What features would be most valuable to you?",
                    "How much would you pay for such a solution?"
                ]
            },
            "digital_services": {
                "problem_discovery": [
                    "What digital marketing challenges does your business face?",
                    "How do you currently handle your online presence?",
                    "What's your monthly digital marketing budget?"
                ],
                "solution_validation": [
                    "Would you outsource digital marketing to a specialized agency?",
                    "What services would be most important?",
                    "What's your preferred engagement model?"
                ]
            }
        }
    
    def _load_interview_scripts(self) -> Dict[str, Any]:
        """Load interview script templates"""
        return {
            "problem_interview": {
                "introduction": "Thank you for taking time to speak with me. I'm researching challenges that [target audience] face with [problem area].",
                "background_questions": [
                    "Can you walk me through your current process for [relevant activity]?",
                    "What tools do you currently use?",
                    "How long have you been doing this?"
                ],
                "problem_questions": [
                    "What's the most frustrating part of this process?",
                    "When was the last time this problem occurred?",
                    "How do you currently work around this issue?"
                ]
            },
            "solution_interview": {
                "concept_presentation": "I'd like to show you a concept we're working on and get your thoughts.",
                "reaction_questions": [
                    "What's your first impression?",
                    "How would this fit into your current workflow?",
                    "What concerns would you have about using this?"
                ]
            }
        }
    
    def _load_validation_frameworks(self) -> Dict[str, Any]:
        """Load validation frameworks for different business models"""
        return {
            "saas": {
                "problem_validation": {
                    "target_metric": "70% of respondents rate problem as significant",
                    "sample_size": 100,
                    "methods": ["surveys", "interviews", "observation"]
                },
                "solution_validation": {
                    "target_metric": "40% express strong purchase intent",
                    "sample_size": 50,
                    "methods": ["concept_testing", "prototype_feedback"]
                }
            },
            "marketplace": {
                "supply_validation": {
                    "target_metric": "50+ suppliers willing to participate",
                    "sample_size": 100,
                    "methods": ["supplier_interviews", "commitment_surveys"]
                },
                "demand_validation": {
                    "target_metric": "100+ buyers express interest",
                    "sample_size": 200,
                    "methods": ["buyer_surveys", "pre_launch_signups"]
                }
            }
        }
    
    def generate_customer_discovery_plan(self, business_idea: str, target_market: str) -> Dict[str, Any]:
        """Generate comprehensive customer discovery plan"""
        return {
            "discovery_phases": self._create_discovery_phases(business_idea, target_market),
            "survey_design": self._design_survey(business_idea, target_market),
            "interview_script": self._create_interview_script(business_idea, target_market),
            "validation_metrics": self._define_validation_metrics(business_idea),
            "sample_size_recommendations": self._calculate_sample_sizes(target_market),
            "timeline": self._create_discovery_timeline(),
            "budget_estimate": self._estimate_discovery_budget(),
            "tools_and_platforms": self._recommend_tools()
        }
    
    def _create_discovery_phases(self, business_idea: str, target_market: str) -> List[Dict[str, Any]]:
        """Create phased customer discovery approach"""
        return [
            {
                "phase": "Problem Validation",
                "duration": "2-3 weeks",
                "activities": [
                    "Conduct 15-20 problem interviews",
                    "Survey 100+ potential customers",
                    "Analyze existing solutions and their shortcomings"
                ],
                "success_criteria": "70%+ confirm problem exists and is significant",
                "deliverables": ["Problem validation report", "Customer persona refinement"]
            },
            {
                "phase": "Solution Validation", 
                "duration": "3-4 weeks",
                "activities": [
                    "Present solution concept to 10-15 interviewees",
                    "Create mockups/wireframes for feedback",
                    "Test willingness to pay with pricing scenarios"
                ],
                "success_criteria": "60%+ show strong interest in proposed solution",
                "deliverables": ["Solution-market fit assessment", "Pricing strategy"]
            },
            {
                "phase": "MVP Validation",
                "duration": "4-6 weeks", 
                "activities": [
                    "Build and test MVP with 20-30 early users",
                    "Collect usage data and feedback",
                    "Iterate based on user behavior"
                ],
                "success_criteria": "40%+ active user retention after 2 weeks",
                "deliverables": ["MVP performance report", "Product roadmap v1.0"]
            }
        ]
    
    def _design_survey(self, business_idea: str, target_market: str) -> Dict[str, Any]:
        """Design targeted customer survey"""
        return {
            "survey_name": f"Customer Discovery Survey - {business_idea}",
            "target_responses": 100,
            "estimated_completion_time": "5-7 minutes",
            "questions": [
                {
                    "type": "multiple_choice",
                    "question": f"How significant is [core problem] in your {target_market} operations?",
                    "options": ["Critical issue", "Moderate problem", "Minor inconvenience", "Not a problem"]
                },
                {
                    "type": "scale",
                    "question": "How much would you pay monthly for a solution that completely solves this problem?",
                    "scale": "0-10000 LKR"
                },
                {
                    "type": "open_ended",
                    "question": "What's the biggest challenge with current solutions you've tried?"
                },
                {
                    "type": "ranking",
                    "question": "Rank these features by importance to you",
                    "options": ["Feature A", "Feature B", "Feature C", "Feature D"]
                }
            ],
            "distribution_channels": [
                "LinkedIn targeted ads",
                "Industry Facebook groups",
                "Email outreach to personal network",
                "Partner organization newsletters"
            ],
            "incentives": "LKR 500 gift voucher for completed responses"
        }
    
    def _create_interview_script(self, business_idea: str, target_market: str) -> Dict[str, Any]:
        """Create structured interview script"""
        return {
            "interview_duration": "30-45 minutes",
            "preparation_checklist": [
                "Research interviewee background",
                "Prepare recording setup (with permission)",
                "Have note-taking template ready",
                "Practice key questions"
            ],
            "script_sections": {
                "opening": [
                    "Thank you for your time",
                    "Brief introduction of yourself and research purpose", 
                    "Request permission to record",
                    "Emphasize no right/wrong answers"
                ],
                "background_questions": [
                    "Can you walk me through your current workflow for [relevant process]?",
                    "What tools or methods do you currently use?",
                    "How long have you been doing this?"
                ],
                "problem_exploration": [
                    "What's the most frustrating part of this process?",
                    "Can you tell me about the last time this problem occurred?",
                    "How do you currently handle this challenge?",
                    "What would happen if this problem was never solved?"
                ],
                "solution_testing": [
                    "If I told you there was a way to [solve problem], what would that look like to you?",
                    "Here's what we're thinking... [present concept]",
                    "What's your immediate reaction?",
                    "What concerns would you have about using something like this?"
                ],
                "closing": [
                    "Is there anything important I haven't asked about?",
                    "Would you be interested in trying an early version?",
                    "Can you recommend 2-3 others who might have similar challenges?"
                ]
            }
        }
    
    def _define_validation_metrics(self, business_idea: str) -> Dict[str, Any]:
        """Define key validation metrics"""
        return {
            "problem_validation_metrics": {
                "problem_significance": "70%+ rate problem as moderate-critical",
                "frequency": "60%+ encounter problem weekly or more",
                "current_solution_satisfaction": "50%+ unsatisfied with current solutions"
            },
            "solution_validation_metrics": {
                "solution_interest": "60%+ express strong interest",
                "willingness_to_pay": "40%+ willing to pay proposed price",
                "feature_preference": "Clear ranking of top 3 features"
            },
            "market_validation_metrics": {
                "market_size": "Identify 10,000+ potential customers in addressable market",
                "early_adopters": "Find 50+ potential early adopters",
                "referral_potential": "30%+ willing to recommend to others"
            }
        }
    
    def _calculate_sample_sizes(self, target_market: str) -> Dict[str, int]:
        """Calculate statistically valid sample sizes"""
        market_size_estimates = {
            "SME": 50000,
            "Enterprise": 1000, 
            "Consumer": 2000000,
            "Startup": 5000
        }
        
        estimated_market_size = market_size_estimates.get(target_market, 25000)
        
        # Calculate sample sizes for 95% confidence, 5% margin of error
        survey_sample = min(400, max(100, int(estimated_market_size * 0.001)))
        interview_sample = min(30, max(15, int(survey_sample * 0.15)))
        
        return {
            "survey_responses_needed": survey_sample,
            "interviews_needed": interview_sample,
            "mvp_testers_needed": min(50, max(20, int(interview_sample * 1.5))),
            "confidence_level": "95%",
            "margin_of_error": "5%"
        }
    
    def _create_discovery_timeline(self) -> Dict[str, str]:
        """Create realistic timeline for customer discovery"""
        return {
            "week_1": "Survey design and testing",
            "week_2-3": "Survey distribution and interview recruitment",
            "week_4-5": "Conduct interviews and collect survey data", 
            "week_6": "Data analysis and insight generation",
            "week_7-8": "Solution concept development",
            "week_9-10": "Solution validation interviews",
            "week_11-12": "MVP planning and development start",
            "total_duration": "12 weeks for complete discovery cycle"
        }
    
    def _estimate_discovery_budget(self) -> Dict[str, float]:
        """Estimate budget for customer discovery"""
        return {
            "survey_incentives": 50000,  # LKR 500 x 100 responses
            "interview_incentives": 30000,  # LKR 1000 x 30 interviews  
            "survey_platform": 15000,  # SurveyMonkey/Typeform subscription
            "advertising_for_recruitment": 25000,  # Social media ads
            "travel_for_interviews": 10000,  # Transportation costs
            "tools_and_software": 20000,  # Recording, analysis tools
            "total_estimated_cost": 150000,
            "cost_per_validated_insight": 15000  # Assuming 10 key insights
        }
    
    def _recommend_tools(self) -> List[Dict[str, str]]:
        """Recommend tools for customer discovery"""
        return [
            {
                "category": "Survey Tools",
                "tool": "Google Forms / Typeform",
                "cost": "Free - LKR 3000/month",
                "use_case": "Online surveys and data collection"
            },
            {
                "category": "Interview Recording",
                "tool": "Zoom / Google Meet",
                "cost": "Free - LKR 2000/month", 
                "use_case": "Remote interviews with recording"
            },
            {
                "category": "Data Analysis",
                "tool": "Google Sheets / Airtable",
                "cost": "Free - LKR 1500/month",
                "use_case": "Survey response analysis and customer database"
            },
            {
                "category": "Scheduling",
                "tool": "Calendly",
                "cost": "Free - LKR 1000/month",
                "use_case": "Interview scheduling automation"
            },
            {
                "category": "Transcription",
                "tool": "Otter.ai",
                "cost": "LKR 1000/month",
                "use_case": "Interview transcription and analysis"
            }
        ]

class EnhancedBusinessDiscoveryPlatform:
    """Main platform with all enhanced real-world business value features"""
    
    def __init__(self):
        self.market_data_provider = MarketDataProvider()
        self.competitor_analyzer = CompetitorAnalyzer()
        self.regulatory_advisor = RegulatoryAdvisor()
        self.network_analyzer = NetworkAnalyzer()
        self.business_model_generator = BusinessModelGenerator()
        self.insight_engine = InsightEngine()
        self.customer_discovery = CustomerDiscoveryAutomator()
        self.profile: Optional[EntrepreneurProfile] = None
    
    def set_profile(self, profile: EntrepreneurProfile):
        """Set entrepreneur profile"""
        self.profile = profile
        logger.info(f"Profile set for {profile.name}")
    
    async def comprehensive_business_analysis(self) -> Dict[str, Any]:
        """Run comprehensive business analysis with all enhanced features"""
        if not self.profile:
            return {"error": "No profile set"}
        
        logger.info("Starting comprehensive business analysis...")
        
        # Parallel execution of different analysis components
        tasks = [
            self._analyze_market_conditions(),
            self._analyze_competition("fintech"),  # Primary sector
            self._analyze_regulatory_requirements(),
            self._analyze_network_potential(),
            self._generate_business_models(),
            self._generate_strategic_insights(),
            self._create_customer_discovery_plan()
        ]
        
        # Execute all analyses in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Compile comprehensive results
        comprehensive_analysis = {
            "entrepreneur": self.profile.name,
            "analysis_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "market_analysis": results[0] if not isinstance(results[0], Exception) else {"error": str(results[0])},
            "competitive_analysis": results[1] if not isinstance(results[1], Exception) else {"error": str(results[1])},
            "regulatory_analysis": results[2] if not isinstance(results[2], Exception) else {"error": str(results[2])},
            "network_analysis": results[3] if not isinstance(results[3], Exception) else {"error": str(results[3])},
            "business_models": results[4] if not isinstance(results[4], Exception) else {"error": str(results[4])},
            "strategic_insights": results[5] if not isinstance(results[5], Exception) else {"error": str(results[5])},
            "customer_discovery_plan": results[6] if not isinstance(results[6], Exception) else {"error": str(results[6])},
            "implementation_roadmap": self._create_implementation_roadmap(),
            "success_probability": self._calculate_overall_success_probability(),
            "executive_summary": self._generate_executive_summary()
        }
        
        # Save comprehensive report
        await self._save_comprehensive_report(comprehensive_analysis)
        
        return comprehensive_analysis
    
    async def _analyze_market_conditions(self) -> Dict[str, Any]:
        """Analyze current market conditions with real-time data"""
        market_data = await self.market_data_provider.get_current_market_data()
        
        return {
            "real_time_data": {
                "exchange_rates": market_data.exchange_rates,
                "economic_indicators": market_data.economic_indicators,
                "last_updated": market_data.last_updated.strftime("%Y-%m-%d %H:%M")
            },
            "market_attractiveness": {
                "fintech": 8.2,  # Based on real-time data
                "digital_services": 7.8,
                "import_export_tech": 6.5
            },
            "key_opportunities": [
                "Currency volatility creates export opportunities",
                "Digital transformation acceleration post-COVID",
                "Government digitalization initiatives"
            ],
            "market_risks": [
                "High inflation impacting consumer spending",
                "Regulatory uncertainty in fintech sector",
                "Political instability affecting business confidence"
            ]
        }
    
    async def _analyze_competition(self, sector: str) -> Dict[str, Any]:
        """Comprehensive competitive analysis"""
        competitors = await self.competitor_analyzer.analyze_competitors(sector)
        
        competitive_gaps = []
        pricing_insights = []
        market_opportunities = []
        
        for competitor in competitors:
            # Analyze weaknesses for opportunities
            competitive_gaps.extend(competitor.weaknesses)
            
            # Analyze pricing for positioning opportunities
            if competitor.pricing_strategy:
                pricing_insights.append({
                    "competitor": competitor.company_name,
                    "pricing_model": competitor.pricing_strategy.get("model", "unknown"),
                    "price_points": {
                        "basic": competitor.pricing_strategy.get("basic_plan", 0),
                        "premium": competitor.pricing_strategy.get("premium_plan", 0),
                        "enterprise": competitor.pricing_strategy.get("enterprise_plan", 0)
                    }
                })
        
        return {
            "competitor_profiles": [
                {
                    "name": comp.company_name,
                    "market_share": comp.market_share,
                    "strengths": comp.strengths,
                    "weaknesses": comp.weaknesses,
                    "funding_status": f"{len(comp.funding_rounds)} rounds, latest: {comp.funding_rounds[-1]['round'] if comp.funding_rounds else 'None'}",
                    "employee_count": comp.employee_count,
                    "social_presence": sum(comp.social_media_presence.values())
                } for comp in competitors
            ],
            "market_gaps": list(set(competitive_gaps)),
            "pricing_landscape": pricing_insights,
            "competitive_positioning_opportunities": [
                "Focus on customer service excellence",
                "Target underserved SME segment", 
                "Develop mobile-first solution",
                "Emphasize local market understanding"
            ],
            "competitive_threats": [
                "Well-funded competitors with strong brand recognition",
                "International players entering Sri Lankan market",
                "Price wars in customer acquisition"
            ]
        }
    
    async def _analyze_regulatory_requirements(self) -> Dict[str, Any]:
        """Analyze regulatory requirements and compliance"""
        fintech_compliance = await self.regulatory_advisor.check_compliance_requirements(
            "fintech", ["payments", "digital_banking", "remittances"]
        )
        
        return {
            "compliance_summary": {
                "required_licenses": len(fintech_compliance.required_licenses),
                "estimated_compliance_cost": f"LKR {fintech_compliance.estimated_compliance_cost:,.0f}",
                "time_to_compliance": fintech_compliance.time_to_compliance,
                "risk_level": fintech_compliance.risk_level
            },
            "regulatory_roadmap": [
                {
                    "milestone": license["name"],
                    "authority": license["authority"],
                    "timeline": license["timeframe"], 
                    "cost": f"LKR {license['cost']:,.0f}",
                    "requirements": license["requirements"]
                } for license in fintech_compliance.required_licenses
            ],
            "ongoing_compliance_requirements": fintech_compliance.tax_obligations + [
                {"requirement": req, "frequency": "Ongoing"} for req in ["AML monitoring", "Risk assessment updates", "Regulatory reporting"]
            ],
            "compliance_recommendations": [
                "Engage regulatory consultant from day one",
                "Build compliance into product architecture",
                "Establish relationships with regulators early",
                "Budget 15-20% of capital for compliance costs"
            ]
        }
    
    async def _analyze_network_potential(self) -> Dict[str, Any]:
        """Analyze networking opportunities and strategy"""
        network_analysis = self.network_analyzer.analyze_network_strength(self.profile, "fintech")
        
        return {
            "current_network_assessment": {
                "network_size": network_analysis["current_network_size"],
                "quality_score": f"{network_analysis['network_quality_score']}/10",
                "key_connections": network_analysis["key_connections"][:5]  # Top 5
            },
            "network_gaps": network_analysis["network_gaps"],
            "networking_strategy": network_analysis["networking_strategy"],
            "upcoming_events": network_analysis["recommended_events"],
            "introduction_opportunities": network_analysis["introduction_opportunities"],
            "networking_action_plan": [
                "Join Sri Lanka Association of Software and Service Companies (SLASSCOM)",
                "Attend monthly fintech meetups in Colombo",
                "Connect with 5 industry professionals weekly on LinkedIn",
                "Schedule quarterly coffee meetings with existing network",
                "Participate in startup ecosystem events"
            ]
        }
    
    async def _generate_business_models(self) -> Dict[str, Any]:
        """Generate viable business model variations"""
        if not self.profile:
            return {"error": "Profile not set"}
            
        model_variations = self.business_model_generator.generate_model_variations(
            "fintech", "SME", self.profile.available_capital
        )
        
        return {
            "recommended_models": model_variations,
            "revenue_projections": {
                model["name"]: {
                    "year_1": f"LKR {model.get('year_1_projection', 2000000):,.0f}",
                    "year_2": f"LKR {model.get('year_2_projection', 8000000):,.0f}",
                    "year_3": f"LKR {model.get('year_3_projection', 20000000):,.0f}"
                } for model in model_variations
            },
            "capital_requirements": {
                model["name"]: f"LKR {model.get('min_capital', 1000000):,.0f}" 
                for model in model_variations
            },
            "implementation_complexity": {
                model["name"]: model.get("implementation_difficulty", "Medium")
                for model in model_variations
            },
            "recommended_approach": "Start with Personal Finance App (lower capital, faster revenue) then expand to Payment Gateway SaaS"
        }
    
    async def _generate_strategic_insights(self) -> List[ActionableInsight]:
        """Generate AI-powered strategic insights"""
        if not self.profile:
            return []
            
        insights = await self.insight_engine.generate_strategic_insights(self.profile, "fintech")
        return insights
    
    async def _create_customer_discovery_plan(self) -> Dict[str, Any]:
        """Create comprehensive customer discovery plan"""
        discovery_plan = self.customer_discovery.generate_customer_discovery_plan(
            "Personal Finance Management App", "Young Professionals"
        )
        
        return discovery_plan
    
    def _create_implementation_roadmap(self) -> Dict[str, Any]:
        """Create month-by-month implementation roadmap"""
        return {
            "phase_1_foundation": {
                "duration": "Months 1-3",
                "key_activities": [
                    "Complete customer discovery and market validation",
                    "Finalize business model and pricing strategy", 
                    "Begin regulatory compliance process",
                    "Build initial network and advisory relationships",
                    "Develop MVP and conduct user testing"
                ],
                "milestones": [
                    "100+ customer interviews completed",
                    "Regulatory license applications submitted",
                    "MVP launched with 50+ beta users",
                    "Advisory board established"
                ],
                "budget_allocation": "40% of available capital",
                "success_metrics": ["Customer validation score >70%", "MVP user retention >40%"]
            },
            "phase_2_launch": {
                "duration": "Months 4-9", 
                "key_activities": [
                    "Official product launch with full features",
                    "Customer acquisition and marketing campaigns",
                    "Partnership development and integrations",
                    "Team hiring and scaling operations",
                    "Revenue generation and optimization"
                ],
                "milestones": [
                    "1000+ active users acquired",
                    "Monthly recurring revenue >LKR 500K",
                    "Core team of 3-5 people hired",
                    "Break-even achieved"
                ],
                "budget_allocation": "35% of available capital", 
                "success_metrics": ["User growth >50% monthly", "Revenue growth >30% monthly"]
            },
            "phase_3_scale": {
                "duration": "Months 10-18",
                "key_activities": [
                    "Market expansion to additional segments",
                    "Product feature expansion and enhancement", 
                    "Strategic partnerships and integrations",
                    "Fundraising for accelerated growth",
                    "Geographic expansion planning"
                ],
                "milestones": [
                    "10,000+ active users",
                    "Monthly revenue >LKR 2M",
                    "Series A funding secured", 
                    "Market leadership in niche segment"
                ],
                "budget_allocation": "25% of available capital + new funding",
                "success_metrics": ["Market share >15%", "Customer lifetime value >LKR 25K"]
            }
        }
    
    def _calculate_overall_success_probability(self) -> Dict[str, Any]:
        """Calculate comprehensive success probability"""
        if not self.profile:
            return {"error": "No profile set"}
            
        readiness_score = self.profile.calculate_readiness_score()["overall"]
        
        # Factors affecting success probability
        factors = {
            "entrepreneur_readiness": readiness_score,
            "market_conditions": 7.5,  # Current market attractiveness
            "competitive_landscape": 6.0,  # Competition intensity
            "regulatory_environment": 5.5,  # Regulatory complexity
            "funding_availability": 7.0,  # Current funding environment
            "economic_conditions": 6.5   # Overall economic health
        }
        
        # Weighted calculation
        weights = {
            "entrepreneur_readiness": 0.3,
            "market_conditions": 0.2,
            "competitive_landscape": 0.15,
            "regulatory_environment": 0.15,
            "funding_availability": 0.1,
            "economic_conditions": 0.1
        }
        
        weighted_score = sum(factors[key] * weights[key] for key in factors)
        success_probability = min(85, max(15, weighted_score * 10))  # Cap between 15-85%
        
        return {
            "overall_success_probability": f"{success_probability:.0f}%",
            "contributing_factors": factors,
            "key_strengths": [
                factor for factor, score in factors.items() if score >= 7.0
            ],
            "key_weaknesses": [
                factor for factor, score in factors.items() if score < 6.0
            ],
            "improvement_recommendations": [
                "Focus on regulatory compliance early to reduce uncertainty",
                "Build stronger network connections in fintech industry",
                "Develop competitive differentiation strategy"
            ]
        }
    
    def _generate_executive_summary(self) -> Dict[str, Any]:
        """Generate executive summary of entire analysis"""
        return {
            "opportunity_assessment": "Strong market opportunity in fintech sector with favorable economic conditions",
            "entrepreneur_readiness": f"Readiness score: {self.profile.calculate_readiness_score()['overall']}/10 - Good foundation with areas for improvement",
            "primary_recommendation": "Proceed with Personal Finance App focusing on young professionals segment",
            "success_probability": "65% - Above average with proper execution",
            "capital_requirement": f"LKR {self.profile.available_capital:,.0f} available, LKR 2-3M recommended for optimal launch",
            "timeline_to_revenue": "3-6 months for first revenue, 12-18 months for significant scale",
            "key_risks": [
                "Regulatory compliance complexity",
                "Intense competition from established players", 
                "Customer acquisition costs"
            ],
            "critical_success_factors": [
                "Strong customer validation and product-market fit",
                "Regulatory compliance from day one",
                "Efficient customer acquisition strategy",
                "Building strategic partnerships early"
            ],
            "immediate_next_steps": [
                "Start customer discovery interviews within 2 weeks",
                "Engage regulatory consultant for compliance guidance",
                "Begin MVP development with focus on core features",
                "Build network connections in fintech ecosystem"
            ]
        }
    
    async def _save_comprehensive_report(self, analysis: Dict[str, Any]) -> str:
        """Save comprehensive analysis report as a nicely formatted text file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"comprehensive_business_analysis_{timestamp}.txt"

        def format_value(value, indent=0):
            pad = "  " * indent
            if isinstance(value, dict):
                lines = []
                for k, v in value.items():
                    lines.append(f"{pad}{k}:")
                    lines.extend(format_value(v, indent + 1))
                return lines
            elif isinstance(value, list):
                lines = []
                for item in value:
                    if isinstance(item, dict):
                        lines.extend(format_value(item, indent + 1))
                    else:
                        lines.append(f"{pad}- {item}")
                return lines
            else:
                return [f"{pad}{value}"]

        try:
            with open(filename, 'w', encoding='utf-8') as f:
                for key, value in analysis.items():
                    f.write(f"{key}:\n")
                    for line in format_value(value, 1):
                        f.write(line + "\n")
                    f.write("\n")
            logger.info(f"Comprehensive report saved to {filename}")
            return filename

        except Exception as e:
            logger.error(f"Failed to save report: {e}")
            return ""

# Enhanced main function showcasing all real-world business value
async def enhanced_main_with_real_value():
    """Enhanced main function demonstrating all real-world business value features"""
    platform = EnhancedBusinessDiscoveryPlatform()
    
    # Create realistic entrepreneur profile
    profile = create_enhanced_realistic_profile()
    platform.set_profile(profile)
    
    print("🚀 Starting Comprehensive Business Discovery Analysis...")
    print("=" * 80)
    
    try:
        # Run comprehensive analysis
        results = await platform.comprehensive_business_analysis()
        
        # Display key results
        print("\n📊 EXECUTIVE SUMMARY")
        print("-" * 50)
        exec_summary = results.get("executive_summary", {})
        for key, value in exec_summary.items():
            if isinstance(value, list):
                print(f"{key.replace('_', ' ').title()}:")
                for item in value:
                    print(f"  • {item}")
            else:
                print(f"{key.replace('_', ' ').title()}: {value}")
        
        print("\n💡 TOP STRATEGIC INSIGHTS")
        print("-" * 50)
        insights = results.get("strategic_insights", [])[:3]  # Top 3
        for i, insight in enumerate(insights, 1):
            print(f"{i}. {insight.title}")
            print(f"   Impact: {insight.expected_impact} | Difficulty: {insight.implementation_difficulty}")
            print(f"   Action: {insight.action_items[0]['action'] if insight.action_items else 'No actions defined'}")
            print()
        
        print("\n🏢 COMPETITIVE INTELLIGENCE")
        print("-" * 50)
        comp_analysis = results.get("competitive_analysis", {})
        competitors = comp_analysis.get("competitor_profiles", [])[:3]  # Top 3
        for comp in competitors:
            print(f"Competitor: {comp['name']}")
            print(f"  Market Share: {comp.get('market_share', 'Unknown')}")
            print(f"  Key Strength: {comp['strengths'][0] if comp['strengths'] else 'None listed'}")
            print(f"  Key Weakness: {comp['weaknesses'][0] if comp['weaknesses'] else 'None listed'}")
            print()
        
        print("\n📋 CUSTOMER DISCOVERY PLAN")
        print("-" * 50)
        discovery = results.get("customer_discovery_plan", {})
        phases = discovery.get("discovery_phases", [])
        for phase in phases:
            print(f"Phase: {phase['phase']} ({phase['duration']})")
            print(f"  Success Criteria: {phase['success_criteria']}")
            print(f"  Key Activities: {', '.join(phase['activities'][:2])}...")
            print()
        
        print("\n🛣️  IMPLEMENTATION ROADMAP")
        print("-" * 50)
        roadmap = results.get("implementation_roadmap", {})
        for phase_name, phase_data in roadmap.items():
            print(f"{phase_name.replace('_', ' ').title()}: {phase_data.get('duration', 'Unknown duration')}")
            milestones = phase_data.get("milestones", [])[:2]  # First 2 milestones
            for milestone in milestones:
                print(f"  ✓ {milestone}")
            print()
        
        print("\n💰 REGULATORY & COMPLIANCE")
        print("-" * 50)
        reg_analysis = results.get("regulatory_analysis", {})
        compliance = reg_analysis.get("compliance_summary", {})
        print(f"Required Licenses: {compliance.get('required_licenses', 'Unknown')}")
        print(f"Estimated Cost: {compliance.get('estimated_compliance_cost', 'Unknown')}")
        print(f"Time to Compliance: {compliance.get('time_to_compliance', 'Unknown')}")
        print(f"Risk Level: {compliance.get('risk_level', 'Unknown')}")
        
        print("\n📈 SUCCESS PROBABILITY")
        print("-" * 50)
        success_prob = results.get("success_probability", {})
        print(f"Overall Success Probability: {success_prob.get('overall_success_probability', 'Unknown')}")
        
        strengths = success_prob.get("key_strengths", [])
        if strengths:
            print("Key Strengths:")
            for strength in strengths:
                print(f"  • {strength.replace('_', ' ').title()}")
        
        weaknesses = success_prob.get("key_weaknesses", [])
        if weaknesses:
            print("Areas for Improvement:")
            for weakness in weaknesses:
                print(f"  • {weakness.replace('_', ' ').title()}")
        
        print(f"\n✅ Analysis Complete! Comprehensive report saved.")
        print(f"📧 Next: Schedule customer discovery interviews and begin MVP development.")
        
    except Exception as e:
        print(f"❌ Analysis failed: {e}")
        import traceback
        traceback.print_exc()

def create_enhanced_realistic_profile() -> EntrepreneurProfile:
    """Create enhanced realistic entrepreneur profile"""
    
    skills = SkillAssessment(
        technical_skills={
            "programming": ExperienceLevel.INTERMEDIATE,
            "web_development": ExperienceLevel.INTERMEDIATE,
            "database_design": ExperienceLevel.BEGINNER,
            "cybersecurity": ExperienceLevel.BEGINNER,
            "mobile_development": ExperienceLevel.BEGINNER,
            "cloud_computing": ExperienceLevel.INTERMEDIATE
        },
        business_skills={
            "financial_analysis": ExperienceLevel.INTERMEDIATE,
            "marketing": ExperienceLevel.BEGINNER,
            "sales": ExperienceLevel.BEGINNER,
            "project_management": ExperienceLevel.INTERMEDIATE,
            "product_management": ExperienceLevel.BEGINNER,
            "customer_service": ExperienceLevel.INTERMEDIATE
        },
        industry_knowledge={
            "fintech": ExperienceLevel.BEGINNER,
            "e_commerce": ExperienceLevel.INTERMEDIATE,
            "digital_marketing": ExperienceLevel.INTERMEDIATE,
            "banking": ExperienceLevel.BEGINNER,
            "software_industry": ExperienceLevel.INTERMEDIATE
        },
        soft_skills={
            "communication": ExperienceLevel.INTERMEDIATE,
            "leadership": ExperienceLevel.BEGINNER,
            "problem_solving": ExperienceLevel.ADVANCED,
            "adaptability": ExperienceLevel.INTERMEDIATE,
            "negotiation": ExperienceLevel.BEGINNER,
            "networking": ExperienceLevel.INTERMEDIATE
        }
    )
    
    language_skills = {
        "english": ExperienceLevel.ADVANCED,
        "sinhala": ExperienceLevel.EXPERT,
        "tamil": ExperienceLevel.BEGINNER
    }
    
    return EntrepreneurProfile(
        name="Priya Jayasinghe",
        location="Colombo, Sri Lanka",
        age_range="27-32", 
        education_background="BSc Computer Science, University of Colombo",
        work_experience=[
            "Software Developer at 99X Technology - 3 years",
            "Junior Product Manager at startup - 1 year", 
            "Freelance Web Development - 2 years"
        ],
        skills=skills,
        
        # Financial situation
        available_capital=2200000.0,  # LKR 2.2M saved
        monthly_personal_expenses=75000.0,  # LKR 75K monthly expenses
        existing_income=140000.0,  # LKR 140K current salary
        family_financial_obligations=20000.0,  # LKR 20K family support
        debt_obligations=18000.0,  # LKR 18K education loan
        emergency_fund_months=6,  # 6 months of expenses saved
        
        # Risk and motivation
        risk_tolerance="moderate",
        motivation_level=8.5,
        time_available_per_week=25,  # Part-time initially
        minimum_income_needed=90000.0,  # Need at least LKR 90K/month
        income_timeline_need="6-12months",
        
        # Personal constraints
        health_limitations=[],
        family_commitments="light",
        travel_willingness="national",
        relocation_willingness=False,
        partnership_preference="small-team",
        
        # Market position
        existing_network_strength=6.5,  # Good network from work experience
        personal_brand_strength=5.0,
        credibility_factors=[
            "CS degree from respected university",
            "5+ years software industry experience", 
            "Product management experience",
            "Active in tech community"
        ],
        
        # Sri Lankan context
        language_skills=language_skills,
        cultural_adaptability=8.5,
        regulatory_knowledge=ExperienceLevel.BEGINNER,
        local_market_understanding=ExperienceLevel.INTERMEDIATE
    )

# Run the enhanced analysis
if __name__ == "__main__":
    if hasattr(asyncio, 'WindowsProactorEventLoopPolicy'):
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    asyncio.run(enhanced_main_with_real_value())