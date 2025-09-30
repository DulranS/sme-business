import asyncio
import json
import logging
import time
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
from datetime import datetime
import re

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

@dataclass
class EntrepreneurProfile:
    """Your personal entrepreneurial profile for Sri Lanka"""
    name: str
    location: str  # Colombo, Kandy, Galle, etc.
    age_range: str  # "20-25", "26-35", etc.
    education_background: str
    work_experience: List[str]
    current_skills: List[str]
    
    # Financial situation - BE HONEST HERE
    available_capital: float  # in LKR - ACTUAL money you can lose
    monthly_expenses: float  # personal monthly expenses
    risk_tolerance: str  # conservative/moderate/aggressive
    income_timeline_need: str  # immediate/3-6months/1year+
    
    # Preferences and constraints
    time_commitment: str  # part-time/full-time
    preferred_work_style: str  # solo/small-team/remote/physical-location
    industry_interests: List[str]
    deal_breakers: List[str]  # things you absolutely won't do
    
    # Sri Lankan specific
    language_skills: List[str]  # Sinhala, Tamil, English
    local_connections: str  # none/few/moderate/strong
    regulatory_comfort: str  # beginner/comfortable/expert
    
    # BRUTAL REALITY CHECK FIELDS
    actual_coding_hours_per_day: int  # Be honest
    months_of_runway_without_income: int  # How long can you survive with no income
    family_financial_support: bool  # Can family bail you out
    has_existing_clients: bool  # Do you have ANY paying customers now
    debt_obligations: float  # Monthly debt payments (loans, etc.)
    
    def get_context_summary(self) -> str:
        return f"""
ENTREPRENEUR: {self.name} | {self.location}, Sri Lanka
BACKGROUND: {self.education_background} | Experience: {', '.join(self.work_experience[:2])}
CAPITAL: LKR {self.available_capital:,.0f} available | Monthly burn: LKR {self.monthly_expenses + self.debt_obligations:,.0f}
RUNWAY: {self.months_of_runway_without_income} months survival | Family support: {self.family_financial_support}
TIMELINE: Need income {self.income_timeline_need} | Risk tolerance: {self.risk_tolerance}
COMMITMENT: {self.time_commitment} | Coding capacity: {self.actual_coding_hours_per_day}h/day
REALITY: Existing clients: {self.has_existing_clients} | Connections: {self.local_connections}
"""

@dataclass 
class MarketIntelligence:
    """BRUTALLY REALISTIC Sri Lankan market conditions and opportunities"""
    
    def __init__(self):
        self.economic_context = {
            "gdp_growth": "1.5-2.5% actual (optimistic projections ignore reality)",
            "inflation_impact": "Real purchasing power down 25-40% since 2022", 
            "usd_lkr_volatility": "300-350 range, but can spike to 400+ anytime",
            "business_loan_reality": "20-30% interest rates, 6-12 month approval process",
            "market_size_reality": "Most 'billion rupee markets' are actually 100-500M accessible",
            "customer_payment_reality": "B2B customers take 60-180 days to pay, many default"
        }
        
        self.sector_brutal_reality = {
            "technology": {
                "market_reality": "LKR 20-30B actual addressable (not 75B claimed)",
                "entry_barrier": "EXTREMELY HIGH - saturated with failed startups",
                "actual_startup_cost": "LKR 2M - 8M (hidden costs kill most businesses)",
                "realistic_revenue": "85% make less than LKR 2M annually, 50% fail in 2 years",
                "success_rate": "Less than 10% achieve sustainable profitability",
                "brutal_truths": [
                    "Most 'tech' businesses are just glorified service providers",
                    "Government contracts take 2+ years and require connections",
                    "Export market requires 5+ years to establish credibility",
                    "Local businesses won't pay premium for tech solutions",
                    "You're competing with Indian/Philippines developers at 1/10th cost"
                ],
"realistic_opportunities": [
                    "Specialized consulting in your exact area of expertise",
                    "Maintenance services for existing systems/businesses",
                    "Training and education services (if you're genuinely expert)"
                ],
                "critical_suppliers_people": {
                    "essential_team": [
                        "Part-time assistant for admin work (LKR 25K-40K/month) - Your time too valuable for admin",
                        "Freelance graphic designer for proposals/presentations (LKR 15K-30K per project)",
                        "Accountant for tax and compliance (LKR 10K-25K/month)"
                    ],
                    "key_suppliers": [
                        "Professional website developer (LKR 150K-400K one-time)",
                        "Digital marketing services (LKR 50K-150K/month)", 
                        "Professional liability insurance (LKR 50K-150K annually)",
                        "Office space or co-working membership (LKR 15K-60K/month)",
                        "Laptop, software, and tech tools (LKR 300K-800K initial setup)"
                    ],
                    "critical_relationships": [
                        "Industry association members - Source of referrals and credibility",
                        "Complementary service providers - Web designers, lawyers, etc. for referral exchange", 
                        "Former colleagues/classmates - First source of potential clients",
                        "Senior professionals in your field - Mentors and potential referral sources",
                        "Business networking groups - BNI, Rotary, Chamber of Commerce membership"
                    ],
                    "brutal_reality": "Services businesses live or die on your personal reputation and network. No network = no clients = no business."
                },
                "failure_reasons": [
                    "Building solutions nobody wants to pay for",
                    "Underestimating sales cycle (6-18 months typical)",
                    "Burning through capital on 'MVP development'",
                    "Competing on features instead of solving real pain"
                ]
            },
            "fintech_trading": {
                "market_reality": "Highly regulated, dominated by established players",
                "entry_barrier": "MASSIVE - regulatory compliance costs LKR 10M+ before you start",
                "actual_startup_cost": "LKR 20M - 50M minimum (licensing, compliance, security)",
                "realistic_revenue": "99% of fintech startups fail due to regulatory/capital requirements",
                "success_rate": "Less than 1% - this is venture capital territory",
                "brutal_truths": [
                    "CBSL approval takes 2-3 years and requires proven track record",
                    "Established banks will crush any threat to their business",
                    "Customer acquisition cost is 10x higher than projections",
                    "Fraud and security breaches will kill you instantly",
                    "Need LKR 100M+ in capital reserves for serious fintech"
                ],
                "realistic_opportunities": [
                    "Financial education/consulting services (service, not tech)",
                    "Investment research for existing wealth managers",
                    "Back-office software for existing financial firms"
                ],
                "critical_suppliers_people": {
                    "essential_team": [
                        "Compliance officer with CBSL experience (LKR 200K-400K/month) - MANDATORY",
                        "Financial lawyer specializing in fintech (LKR 100K-300K per legal opinion)",
                        "Senior software architect with banking experience (LKR 300K-500K/month)",
                        "Cybersecurity specialist (LKR 150K-250K/month) - Cannot compromise on security"
                    ],
                    "key_suppliers": [
                        "Legal firm for regulatory compliance - LKR 500K-2M for initial setup",
                        "Cybersecurity audit firm - LKR 300K-800K per audit (quarterly required)",
                        "Banking partner for payment processing - Revenue sharing 1-3%",
                        "Cloud infrastructure (enterprise grade) - LKR 200K-800K/month",
                        "Insurance (Professional indemnity, cyber) - LKR 100K-500K annually"
                    ],
                    "critical_relationships": [
                        "CBSL officials - Required for any payment system approval",
                        "Banking sector executives - 2-3 year relationship building needed",
                        "Existing financial institutions - Will be competitors AND potential partners",
                        "Government officials in finance ministry - Policy changes affect everything"
                    ],
                    "brutal_reality": "You need LKR 50M+ and 2-3 years BEFORE getting regulatory approval. Most fintech 'startups' are just consultancies pretending to be tech companies."
                },
                "failure_reasons": [
                    "Underestimating regulatory complexity",
                    "Insufficient capital for compliance requirements",
                    "Naive about customer acquisition costs",
                    "Ignoring established player advantages"
                ]
            },
            "import_export_tech": {
                "market_reality": "Traditional industry resistant to change, relationship-driven",
                "entry_barrier": "HIGH - requires deep industry knowledge + capital",
                "actual_startup_cost": "LKR 15M - 40M (licensing, inventory, working capital)",
                "realistic_revenue": "70% struggle with cash flow, 40% fail due to payment delays",
                "success_rate": "30% if you have industry experience, 5% if you don't",
                "brutal_truths": [
                    "Customers won't pay for software - they want cheap services",
                    "Import licenses require established business and connections",
                    "Currency fluctuations can wipe out 6 months profit overnight",
                    "Customs and regulatory changes happen with zero notice",
                    "Established players have 20+ year relationships"
                ],
                "realistic_opportunities": [
                    "Become an agent for existing importers (learn the business first)",
                    "Customs clearance services (if you understand regulations)",
                    "Specialized product sourcing for specific industries"
                ],
                "critical_suppliers_people": {
                    "essential_team": [
                        "Customs clearance agent with 10+ years experience (LKR 80K-150K/month)",
                        "Logistics coordinator (LKR 60K-100K/month)",
                        "Inventory manager (LKR 50K-80K/month)",
                        "Documentation specialist familiar with trade regulations (LKR 40K-70K/month)"
                    ],
                    "key_suppliers": [
                        "Freight forwarders - 2-3 reliable partners essential (rates vary by volume)",
                        "Customs clearance firms - LKR 15K-50K per shipment",
                        "Warehouse facilities - LKR 200-800 per sq ft monthly",
                        "Insurance providers for cargo - 0.1-0.5% of shipment value",
                        "Banking partners for Letters of Credit - Fees 0.25-2% of transaction value",
                        "Quality inspection services - LKR 25K-100K per inspection"
                    ],
                    "critical_relationships": [
                        "Overseas suppliers - 2-3 year relationship building required for credit terms",
                        "Customs officials - Good relationships prevent delays and issues",
                        "Bank trade finance managers - Essential for LC and financing",
                        "Industry association members - Access to market intelligence",
                        "Existing importers - Can become mentors or competitors"
                    ],
                    "brutal_reality": "Import/export is 90% relationships and cash flow management, 10% technology. You need LKR 10M+ working capital just for your first few shipments."
                },
                "failure_reasons": [
                    "Underestimating relationship requirements",
                    "Insufficient working capital for inventory",
                    "Currency risk management failures",
                    "Regulatory compliance violations"
                ]
            },
            "services": {
                "market_reality": "LKR 500B actual addressable, extremely fragmented",
                "entry_barrier": "LOW capital, but HIGH competition and price pressure",
                "actual_startup_cost": "LKR 200K - 1M (but income is uncertain)",
                "realistic_revenue": "50% make less than minimum wage equivalent", 
                "success_rate": "60% survival, but 80% struggle financially",
                "brutal_truths": [
                    "Race to the bottom on pricing - customers want cheapest option",
                    "Payment delays are standard - expect 90+ days",
                    "No scalability - your time = your income forever",
                    "Economic downturns kill discretionary service spending first",
                    "Need 3-5 years to build sustainable client base"
                ],
                "realistic_opportunities": [
                    "Specialized consulting in your exact area of expertise",
                    "Maintenance services for existing systems/businesses",
                    "Training and education services (if you're genuinely expert)"
                ],
                "failure_reasons": [
                    "Competing on price instead of value",
                    "Taking on clients who can't/won't pay",
                    "No systems for scaling beyond personal time",
                    "Underestimating business development time"
                ]
            },
            "food_beverage": {
                "market_reality": "Saturated market, thin margins, high failure rate",
                "entry_barrier": "MODERATE capital, but extremely competitive",
                "actual_startup_cost": "LKR 3M - 15M (hidden costs in compliance/equipment)",
                "realistic_revenue": "60% fail in first 2 years, margins under 10%",
                "success_rate": "25% achieve profitability, fewer scale significantly",
                "brutal_truths": [
                    "Food safety compliance costs more than projected",
                    "Inventory spoilage will kill your margins",
                    "Customer loyalty is non-existent - they buy cheapest",
                    "Seasonal demand fluctuations create cash flow hell",
                    "Distribution costs eat 30-50% of margins"
                ],
                "realistic_opportunities": [
                    "Specific niche with premium pricing (if you can defend it)",
                    "B2B supply to established restaurants/hotels",
                    "Catering services for corporate events"
                ],
                "critical_suppliers_people": {
                    "essential_team": [
                        "Food safety certified manager (LKR 60K-100K/month) - LEGALLY REQUIRED",
                        "Production workers (LKR 35K-50K/month each) - Need 2-3 minimum",
                        "Sales person with hotel/restaurant connections (LKR 50K + commission)",
                        "Delivery driver with own vehicle (LKR 40K-60K/month)"
                    ],
                    "key_suppliers": [
                        "Raw material suppliers - 2-3 reliable sources essential for price/quality",
                        "Packaging suppliers - LKR 50K-200K monthly depending on volume",
                        "Equipment suppliers/maintenance - LKR 100K-500K initial, LKR 25K monthly maintenance",
                        "Cold storage facility - LKR 100K-400K monthly depending on size",
                        "Food safety certification body - LKR 100K-300K annually",
                        "Transportation/logistics - LKR 80K-200K monthly for distribution"
                    ],
                    "critical_relationships": [
                        "Hotel/restaurant procurement managers - 6-12 month relationship building",
                        "Supermarket chain buyers - Extremely difficult to access, need intermediaries",
                        "Food safety inspectors - Good relationship prevents shutdowns",
                        "Raw material suppliers - Credit terms crucial for cash flow",
                        "Distributors/wholesalers - Essential for market reach beyond direct sales"
                    ],
                    "brutal_reality": "Food business margins are 5-15% maximum. One food safety violation can destroy years of work. Inventory spoilage will kill you."
                },
                "failure_reasons": [
                    "Underestimating food safety and compliance costs",
                    "Poor inventory management and spoilage control",
                    "Competing on price in commoditized market",
                    "Insufficient capital for marketing and distribution"
                ]
            }
        }
        
        self.regional_brutal_reality = {
            "Colombo": {
                "advantages": ["Only real market for B2B services", "Infrastructure exists"],
                "brutal_reality": [
                    "Rent costs will eat 40-60% of early revenue",
                    "Competition is intense - 50+ similar businesses in every sector",
                    "Customer acquisition costs 5x higher than other cities",
                    "Traffic/logistics add 2-3 hours daily to any business requiring movement"
                ],
                "who_survives": "Businesses with strong differentiation and premium pricing"
            },
            "Kandy": {
                "advantages": ["Lower costs", "Less competition"],
                "brutal_reality": [
                    "Market size 1/10th of Colombo - max LKR 2M annual revenue",
                    "Customers expect Colombo prices but can't pay them",
                    "Seasonal tourism = 6 months good, 6 months struggling",
                    "Limited pool of skilled employees"
                ],
                "who_survives": "Ultra-lean operations serving local market needs"
            },
            "Other_Cities": {
                "advantages": ["Very low costs"],
                "brutal_reality": [
                    "Market size insufficient for most tech/service businesses",
                    "Customer sophistication very low",
                    "Payment capacity severely limited",
                    "Brain drain - talented people leave for Colombo"
                ],
                "who_survives": "Traditional businesses serving basic local needs"
            }
        }

class BrutalOpportunityAnalyzer:
    """Analyzes opportunities with ZERO sugar-coating"""
    
    def __init__(self, market_intel: MarketIntelligence):
        self.market_intel = market_intel
        
    def calculate_monthly_dependency_costs(self, sector: str) -> Dict[str, Any]:
        """Calculate brutal reality of monthly costs for people and suppliers"""
        
        if sector not in self.market_intel.sector_brutal_reality:
            return {"error": "Sector not found"}
            
        sector_info = self.market_intel.sector_brutal_reality[sector]
        suppliers_data = sector_info.get("critical_suppliers_people", {})
        
        if not suppliers_data:
            return {"total_monthly_cost": 0, "breakdown": {}}
        
        # Extract costs from team descriptions
        team_costs = []
        for person in suppliers_data.get('essential_team', []):
            # Extract cost range from strings like "(LKR 150K-300K/month)"
            import re
            cost_match = re.search(r'LKR\s+(\d+)K(?:-(\d+)K)?/month', person)
            if cost_match:
                min_cost = int(cost_match.group(1)) * 1000
                max_cost = int(cost_match.group(2)) * 1000 if cost_match.group(2) else min_cost
                avg_cost = (min_cost + max_cost) / 2
                team_costs.append(avg_cost)
        
        # Extract supplier costs
        supplier_costs = []
        for supplier in suppliers_data.get('key_suppliers', []):
            cost_match = re.search(r'LKR\s+(\d+)K(?:-(\d+)K)?/month', supplier)
            if cost_match:
                min_cost = int(cost_match.group(1)) * 1000
                max_cost = int(cost_match.group(2)) * 1000 if cost_match.group(2) else min_cost
                avg_cost = (min_cost + max_cost) / 2
                supplier_costs.append(avg_cost)
        
        total_team_cost = sum(team_costs)
        total_supplier_cost = sum(supplier_costs)
        total_monthly_cost = total_team_cost + total_supplier_cost
        
        return {
            "total_monthly_cost": total_monthly_cost,
            "breakdown": {
                "team_costs": total_team_cost,
                "supplier_costs": total_supplier_cost,
                "team_count": len(team_costs),
                "supplier_count": len(supplier_costs)
            },
            "reality_check": f"You need LKR {total_monthly_cost:,.0f}/month BEFORE generating any revenue"
        }
    
    def analyze_brutal_fit(self, profile: EntrepreneurProfile, sector: str) -> Dict[str, Any]:
        """BRUTALLY HONEST analysis of sector fit"""
        
        if sector not in self.market_intel.sector_brutal_reality:
            return {"error": f"Sector {sector} not in database"}
            
        sector_info = self.market_intel.sector_brutal_reality[sector]
        
        # BRUTAL reality checks
        capital_reality = self._brutal_capital_assessment(profile, sector_info)
        timeline_reality = self._brutal_timeline_assessment(profile, sector)
        skill_reality = self._brutal_skill_assessment(profile, sector)
        market_reality = self._brutal_market_assessment(profile, sector_info)
        survival_probability = self._calculate_survival_probability(profile, sector_info)
        
        return {
            "sector": sector,
            "survival_probability": survival_probability,
            "brutal_assessment": {
                "capital_reality": capital_reality,
                "timeline_reality": timeline_reality,
                "skill_reality": skill_reality,
                "market_reality": market_reality
            },
            "realistic_outcomes": self._get_realistic_outcomes(sector_info),
            "failure_modes": sector_info["failure_reasons"],
            "hard_truths": sector_info["brutal_truths"],
            "actionable_alternatives": sector_info["realistic_opportunities"],
            "critical_suppliers_people": sector_info.get("critical_suppliers_people", {}),
            "honest_recommendation": self._generate_brutal_recommendation(profile, sector_info, survival_probability)
        }
    
    def _brutal_capital_assessment(self, profile: EntrepreneurProfile, sector_info: Dict) -> Dict[str, Any]:
        """Brutal assessment of capital adequacy"""
        min_cost_str = sector_info["actual_startup_cost"]
        
        # Extract minimum realistic cost
        if "20M" in min_cost_str:
            min_realistic = 20000000
        elif "15M" in min_cost_str:
            min_realistic = 15000000
        elif "3M" in min_cost_str:
            min_realistic = 3000000
        elif "2M" in min_cost_str:
            min_realistic = 2000000
        else:
            min_realistic = 1000000
            
        monthly_burn = profile.monthly_expenses + profile.debt_obligations
        
        if profile.available_capital < min_realistic * 0.5:
            verdict = "COMPLETELY INADEQUATE"
            reasoning = f"You need minimum LKR {min_realistic/1000000:.1f}M, you have {profile.available_capital/1000000:.1f}M"
        elif profile.available_capital < min_realistic:
            verdict = "DANGEROUSLY LOW" 
            reasoning = f"50% undercapitalized. Will likely run out of money during setup phase"
        elif profile.available_capital < min_realistic * 1.5:
            verdict = "RISKY"
            reasoning = f"No buffer for unexpected costs or revenue delays"
        else:
            verdict = "ADEQUATE"
            reasoning = f"Sufficient capital, but expect to use most of it"
            
        return {
            "verdict": verdict,
            "reasoning": reasoning,
            "runway_months": int(profile.available_capital / monthly_burn) if monthly_burn > 0 else "infinite",
            "reality_check": f"With LKR {monthly_burn:,.0f} monthly burn, your money lasts {int(profile.available_capital / monthly_burn) if monthly_burn > 0 else 'forever'} months without revenue"
        }
    
    def _brutal_timeline_assessment(self, profile: EntrepreneurProfile, sector: str) -> Dict[str, Any]:
        """Brutal timeline reality check"""
        realistic_timelines = {
            "technology": "12-24 months to meaningful revenue",
            "fintech_trading": "36-48 months (if you survive regulatory process)",
            "import_export_tech": "18-36 months to establish relationships",
            "services": "6-18 months if you're good, 24+ months if you're not",
            "food_beverage": "12-24 months to break even"
        }
        
        expected_timeline = realistic_timelines.get(sector, "18-24 months typically")
        
        if profile.income_timeline_need == "immediate":
            if sector == "services":
                verdict = "POSSIBLE BUT UNLIKELY"
                reasoning = "Services can generate quick income, but building sustainable business takes time"
            else:
                verdict = "COMPLETELY UNREALISTIC"
                reasoning = f"You need immediate income, {sector} takes {expected_timeline}"
        elif profile.income_timeline_need == "3-6months":
            verdict = "VERY OPTIMISTIC"
            reasoning = f"Most {sector} businesses take {expected_timeline}, not 3-6 months"
        else:
            verdict = "REALISTIC EXPECTATION"
            reasoning = f"Timeline matches {expected_timeline} reality"
            
        return {
            "verdict": verdict,
            "reasoning": reasoning,
            "realistic_timeline": expected_timeline,
            "cash_flow_warning": f"Expect negative cash flow for first {expected_timeline.split('-')[0]} months minimum"
        }
    
    def _brutal_skill_assessment(self, profile: EntrepreneurProfile, sector: str) -> Dict[str, Any]:
        """Brutal assessment of actual capability"""
        
        if sector == "technology":
            if profile.actual_coding_hours_per_day < 4:
                verdict = "INSUFFICIENT COMMITMENT"
                reasoning = "Tech businesses require 8+ hours daily coding/technical work"
            elif "programming" not in [skill.lower() for skill in profile.current_skills]:
                verdict = "MISSING CORE SKILLS"
                reasoning = "No programming skills = not a tech business"
            else:
                verdict = "POTENTIALLY ADEQUATE"
                reasoning = "Has technical skills, but business/sales skills equally important"
        
        elif sector == "services":
            if not profile.has_existing_clients:
                verdict = "HIGH RISK"
                reasoning = "No existing clients = starting from zero with long sales cycles"
            else:
                verdict = "GOOD FOUNDATION"
                reasoning = "Existing clients provide validation and initial revenue"
        
        else:
            verdict = "UNCERTAIN"
            reasoning = f"Sector {sector} requires deep industry knowledge you may lack"
            
        return {
            "verdict": verdict,
            "reasoning": reasoning,
            "skill_gaps": self._identify_critical_gaps(profile, sector),
            "development_time": "6-24 months to acquire missing critical skills"
        }
    
    def _identify_critical_gaps(self, profile: EntrepreneurProfile, sector: str) -> List[str]:
        """Identify what's actually missing"""
        gaps = []
        
        if sector == "technology":
            if profile.actual_coding_hours_per_day < 6:
                gaps.append("Insufficient daily coding practice")
            if profile.local_connections == "none":
                gaps.append("No local business network for customer acquisition")
            if not profile.has_existing_clients:
                gaps.append("No proven ability to acquire paying customers")
        
        if profile.local_connections in ["none", "few"]:
            gaps.append("Weak local business network - critical for B2B sales")
            
        if profile.regulatory_comfort == "beginner":
            gaps.append("No understanding of business regulations and compliance")
            
        return gaps
    
    def _brutal_market_assessment(self, profile: EntrepreneurProfile, sector_info: Dict) -> Dict[str, Any]:
        """Assess market reality"""
        return {
            "market_size": sector_info["market_reality"],
            "competition_level": "INTENSE in all sectors - assume 50+ direct competitors",
            "customer_behavior": "Sri Lankan customers are extremely price-sensitive and slow to pay",
            "growth_potential": "Most businesses plateau at 10-20% of founder projections",
            "economic_sensitivity": "All sectors affected by economic volatility - plan for 30% demand drops"
        }
    
    def _calculate_survival_probability(self, profile: EntrepreneurProfile, sector_info: Dict) -> Dict[str, Any]:
        """Calculate realistic probability of success"""

        # Try to extract the first percentage number from the string
        rate_str = sector_info.get("success_rate", "")
        match = re.search(r"(\d+)", rate_str)
        if match:
            base_success_rate = float(match.group(1)) / 100
        else:
            base_success_rate = 0.3  # Default if not found

        # Adjust for profile factors
        multiplier = 1.0
        
        # Capital adequacy
        if profile.available_capital < 2000000:  # < 2M
            multiplier *= 0.5
        elif profile.available_capital > 5000000:  # > 5M
            multiplier *= 1.5
            
        # Experience and connections
        if profile.local_connections in ["none", "few"]:
            multiplier *= 0.6
        elif profile.local_connections == "strong":
            multiplier *= 1.8
            
        # Financial runway
        if profile.months_of_runway_without_income < 6:
            multiplier *= 0.3
        elif profile.months_of_runway_without_income > 12:
            multiplier *= 1.5
            
        # Existing clients
        if profile.has_existing_clients:
            multiplier *= 2.0
            
        # Family support
        if profile.family_financial_support:
            multiplier *= 1.3
            
        final_probability = min(base_success_rate * multiplier, 0.95)  # Cap at 95%
        
        if final_probability < 0.1:
            assessment = "EXTREMELY LOW - Reconsider entirely"
        elif final_probability < 0.3:
            assessment = "LOW - High risk of failure"
        elif final_probability < 0.6:
            assessment = "MODERATE - Significant risk but possible"
        else:
            assessment = "REASONABLE - Good chance with proper execution"
            
        return {
            "probability": round(final_probability * 100, 1),
            "assessment": assessment,
            "key_factors": self._get_key_success_factors(profile),
            "biggest_risks": self._get_biggest_risks(profile, sector_info)
        }
    
    def _get_key_success_factors(self, profile: EntrepreneurProfile) -> List[str]:
        """What actually matters for success"""
        factors = []
        
        if profile.has_existing_clients:
            factors.append("Existing client base provides revenue foundation")
        if profile.local_connections == "strong":
            factors.append("Strong local network enables faster customer acquisition")
        if profile.family_financial_support:
            factors.append("Family financial backup reduces pressure")
        if profile.months_of_runway_without_income > 12:
            factors.append("Long financial runway allows proper business development")
        if profile.available_capital > 5000000:
            factors.append("Adequate capital for proper business setup")
            
        return factors or ["No significant advantages identified - success depends on exceptional execution"]
    
    def _get_biggest_risks(self, profile: EntrepreneurProfile, sector_info: Dict) -> List[str]:
        """What will probably kill the business"""
        risks = []
        
        if profile.months_of_runway_without_income < 6:
            risks.append("Insufficient runway - will run out of money before revenue stabilizes")
        if profile.local_connections in ["none", "few"]:
            risks.append("No network for customer acquisition - sales will be extremely difficult")
        if not profile.has_existing_clients:
            risks.append("Starting from zero customers - long ramp-up period")
        if profile.income_timeline_need == "immediate":
            risks.append("Unrealistic income expectations will force bad decisions")
        if not profile.family_financial_support and profile.available_capital < 2000000:
            risks.append("Undercapitalized with no safety net - high stress will impair decision-making")
            
        return risks + sector_info["failure_reasons"][:2]
    
    def _get_realistic_outcomes(self, sector_info: Dict) -> Dict[str, str]:
        """What actually happens to businesses in this sector"""
        return {
            "best_case": f"Top 10% achieve {sector_info['realistic_revenue']}",
            "typical_case": "50% struggle to cover expenses, work more hours than employment for less money",
            "worst_case": "40-60% close within 2 years, lose most invested capital",
            "reality_check": "Most 'successful' businesses just replace founder's salary with business income"
        }
    
    def _generate_brutal_recommendation(self, profile: EntrepreneurProfile, sector_info: Dict, survival_prob: Dict) -> str:
        """Generate honest recommendation"""
        prob = survival_prob["probability"]
        
        if prob < 15:
            return f"DON'T DO IT. {prob}% success chance. Your profile shows multiple critical gaps. Consider employment or skill building first."
        elif prob < 30:
            return f"HIGH RISK. {prob}% success chance. Only proceed if you can afford to lose everything and have backup plans."
        elif prob < 50:
            return f"RISKY BUT POSSIBLE. {prob}% success chance. Address critical gaps first, start small, keep employment income."
        elif prob < 70:
            return f"REASONABLE CHANCE. {prob}% success chance. Good foundation but still significant risk. Proceed with caution."
        else:
            return f"GOOD PROSPECTS. {prob}% success chance. Strong foundation for success but still requires excellent execution."

class SMEDiscoveryPlatform:
    """BRUTALLY HONEST platform for Sri Lankan SME discovery"""

    def __init__(self):
        self.market_intel = MarketIntelligence()
        self.analyzer = BrutalOpportunityAnalyzer(self.market_intel)
        self.profile: Optional[EntrepreneurProfile] = None

    def set_profile(self, profile: EntrepreneurProfile):
        """Set the entrepreneur profile"""
        self.profile = profile
        logger.info(f"Profile set for {profile.name} in {profile.location}")

    def discover_opportunities(self) -> Dict[str, Any]:
        """BRUTAL analysis - no sugar-coating"""
        if not self.profile:
            return {"error": "No entrepreneur profile set"}

        results = {
            "entrepreneur": self.profile.name,
            "location": self.profile.location,
            "analysis_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "brutal_reality_check": self._overall_reality_check(),
            "sector_analysis": {},
            "ranked_opportunities": [],
            "immediate_survival_plan": [],
            "harsh_truths": self._get_harsh_truths()
        }

        # Analyze each sector with brutal honesty
        sector_scores = {}
        for sector in self.market_intel.sector_brutal_reality.keys():
            analysis = self.analyzer.analyze_brutal_fit(self.profile, sector)
            results["sector_analysis"][sector] = analysis
            sector_scores[sector] = analysis["survival_probability"]["probability"]

        # Rank by realistic success probability
        sorted_sectors = sorted(sector_scores.items(), key=lambda x: x[1], reverse=True)

        for i, (sector, prob) in enumerate(sorted_sectors):
            results["ranked_opportunities"].append({
                "rank": i + 1,
                "sector": sector,
                "success_probability": f"{prob}%",
                "brutal_assessment": results["sector_analysis"][sector]["brutal_assessment"],
                "recommendation": results["sector_analysis"][sector]["honest_recommendation"],
                "biggest_risks": results["sector_analysis"][sector]["brutal_assessment"]["market_reality"]
            })

        # Generate survival plan
        results["immediate_survival_plan"] = self._generate_survival_plan()

        return results

    def _overall_reality_check(self) -> Dict[str, Any]:
        """Overall brutal assessment of entrepreneurial readiness"""
        
        financial_health = "POOR"
        if self.profile.available_capital > 5000000 and self.profile.months_of_runway_without_income > 12:
            financial_health = "GOOD"
        elif self.profile.available_capital > 2000000 and self.profile.months_of_runway_without_income > 6:
            financial_health = "MODERATE"
            
        market_readiness = "NOT READY"
        if self.profile.has_existing_clients and self.profile.local_connections == "strong":
            market_readiness = "READY"
        elif self.profile.has_existing_clients or self.profile.local_connections in ["moderate", "strong"]:
            market_readiness = "PARTIALLY READY"
            
        return {
            "financial_health": financial_health,
            "market_readiness": market_readiness,
            "overall_assessment": self._get_overall_assessment(financial_health, market_readiness),
            "critical_gaps": self._identify_critical_preparation_gaps(),
            "time_to_readiness": self._estimate_preparation_time()
        }
    
    def _get_overall_assessment(self, financial_health: str, market_readiness: str) -> str:
        """Overall readiness assessment"""
        if financial_health == "POOR" or market_readiness == "NOT READY":
            return "NOT READY FOR ENTREPRENEURSHIP - Focus on preparation first"
        elif financial_health == "MODERATE" and market_readiness == "PARTIALLY READY":
            return "MARGINAL READINESS - Can start but high risk"
        else:
            return "READY TO START - Good foundation for entrepreneurship"
    
    def _identify_critical_preparation_gaps(self) -> List[str]:
        """What needs to be fixed before starting"""
        gaps = []
        
        if self.profile.months_of_runway_without_income < 6:
            gaps.append("Insufficient financial runway - save more or reduce expenses")
        if not self.profile.has_existing_clients:
            gaps.append("No existing revenue stream - start freelancing/consulting first")
        if self.profile.local_connections in ["none", "few"]:
            gaps.append("Weak professional network - join industry associations, attend events")
        if self.profile.available_capital < 2000000 and not self.profile.family_financial_support:
            gaps.append("Undercapitalized with no backup - extremely high risk")
        if self.profile.regulatory_comfort == "beginner":
            gaps.append("No business/legal knowledge - take courses or find mentor")
            
        return gaps
    
    def _estimate_preparation_time(self) -> str:
        """How long to get ready"""
        gaps = len(self._identify_critical_preparation_gaps())
        
        if gaps == 0:
            return "Ready now"
        elif gaps <= 2:
            return "6-12 months preparation needed"
        elif gaps <= 4:
            return "12-24 months preparation needed"
        else:
            return "24+ months preparation needed - consider different path"
    
    def _get_harsh_truths(self) -> List[str]:
        """Uncomfortable truths about Sri Lankan entrepreneurship"""
        return [
            "90% of businesses fail because founders ignore cash flow reality",
            "Your 'innovative idea' probably exists - customer acquisition is the real challenge",
            "Sri Lankan customers will pay 30-50% less than you think and take 3x longer",
            "Government contracts sound great but take 2+ years and require political connections",
            "Most 'tech solutions' fail because they solve problems customers don't want to pay to solve",
            "Your friends and family praising your idea means nothing - only paying customers matter",
            "Import/export sounds glamorous but it's mostly paperwork, relationships, and cash flow management",
            "Service businesses don't scale - you're buying yourself a job, not building wealth",
            "Economic instability in Sri Lanka makes long-term planning nearly impossible"
        ]
    
    def _generate_survival_plan(self) -> List[Dict[str, str]]:
        """Immediate actions for financial survival while building business"""
        plan = []
        
        if self.profile.income_timeline_need == "immediate":
            plan.extend([
                {
                    "priority": "URGENT",
                    "action": "Start freelancing/consulting in existing skills TODAY",
                    "timeline": "This week",
                    "expected_income": "LKR 50K-200K/month if you're good"
                },
                {
                    "priority": "URGENT", 
                    "action": "Apply for part-time employment to cover basic expenses",
                    "timeline": "Next 2 weeks",
                    "expected_income": "LKR 30K-80K/month guaranteed"
                }
            ])
        
        plan.extend([
            {
                "priority": "HIGH",
                "action": "Build professional network through industry events",
                "timeline": "Ongoing - 2 events per month minimum",
                "expected_outcome": "Potential clients and mentors"
            },
            {
                "priority": "HIGH",
                "action": "Validate business ideas with 20+ potential customers",
                "timeline": "Next 4 weeks",
                "expected_outcome": "Real market demand data"
            },
            {
                "priority": "MEDIUM",
                "action": "Learn business regulations and compliance requirements",
                "timeline": "Next 2 months",
                "expected_outcome": "Avoid costly legal mistakes"
            },
            {
                "priority": "LOW",
                "action": "Build MVP only after customer validation",
                "timeline": "Month 3-6",
                "expected_outcome": "Product customers actually want"
            }
        ])
        
        return plan

def create_realistic_profile() -> EntrepreneurProfile:
    """
    BRUTALLY HONEST profile - fill this with YOUR REAL situation
    """
    
    return EntrepreneurProfile(
        # PERSONAL INFO - BE HONEST
        name="Your Name Here",
        location="Colombo",  
        age_range="20-25",
        education_background="Computer Science/Business/Engineering", 
        work_experience=["Student projects", "Internships", "Freelance work"],
        current_skills=[
            "Python", "Web Development", "Basic Business Knowledge"
        ],
        
        # FINANCIAL REALITY - BE BRUTALLY HONEST
        available_capital=500000.0,  # LKR 500K - what you can actually LOSE
        monthly_expenses=35000.0,    # Your real monthly expenses
        risk_tolerance="moderate",   
        income_timeline_need="3-6months",  
        
        # WORK REALITY
        time_commitment="full-time",  
        preferred_work_style="solo",  
        industry_interests=[
            "Technology", "Services", "Digital Marketing"
        ],
        deal_breakers=["Physical labor", "Door-to-door sales", "MLM schemes"],
        
        # SRI LANKAN CONTEXT
        language_skills=["English", "Sinhala"],  
        local_connections="few",  # BE HONEST
        regulatory_comfort="beginner",  
        
        # BRUTAL REALITY FIELDS - BE HONEST HERE
        actual_coding_hours_per_day=3,  # Hours you ACTUALLY code daily
        months_of_runway_without_income=12,  # How long can you survive with no income
        family_financial_support=True,  # Can family help if you fail
        has_existing_clients=False,  # Do you have ANY paying customers now
        debt_obligations=0.0  # Monthly debt payments
    )

# Main execution function
async def main():
    """
    BRUTALLY REALISTIC Sri Lankan SME Business Discovery Platform
    
    This tells you the UNCOMFORTABLE TRUTH about:
    1. Your actual chances of success (not fantasy projections)
    2. Real costs and timelines (not optimistic estimates)  
    3. What will probably kill your business
    4. Why most businesses fail in Sri Lanka
    5. Whether you're actually ready (probably not)
    6. What you should do instead of chasing unrealistic dreams
    """

    print("=" * 80)
    print("🇱🇰 BRUTALLY REALISTIC SRI LANKAN SME DISCOVERY PLATFORM")
    print("=" * 80)
    print("UNCOMFORTABLE TRUTHS ABOUT STARTING A BUSINESS IN SRI LANKA")
    print("No sugar-coating. No false hope. Just brutal reality.")
    print()

    # Initialize the platform
    platform = SMEDiscoveryPlatform()

    # Set up realistic profile (CUSTOMIZE THIS WITH YOUR REAL DETAILS)
    your_profile = create_realistic_profile()
    platform.set_profile(your_profile)

    print("ENTREPRENEUR PROFILE LOADED:")
    print(your_profile.get_context_summary())

    print("\n" + "=" * 60)
    print("🔍 BRUTAL OPPORTUNITY ANALYSIS")
    print("=" * 60)

    # Run brutal analysis
    discovery_results = platform.discover_opportunities()

    # Display brutal reality check
    print(f"\n💀 OVERALL READINESS ASSESSMENT:")
    reality = discovery_results["brutal_reality_check"]
    print(f"   Financial Health: {reality['financial_health']}")
    print(f"   Market Readiness: {reality['market_readiness']}")
    print(f"   Overall Assessment: {reality['overall_assessment']}")
    print(f"   Time to Readiness: {reality['time_to_readiness']}")

    if reality["critical_gaps"]:
        print(f"\n⚠️ CRITICAL GAPS YOU MUST FIX FIRST:")
        for gap in reality["critical_gaps"]:
            print(f"   • {gap}")

    # Display harsh truths
    print(f"\n💥 HARSH TRUTHS ABOUT SRI LANKAN ENTREPRENEURSHIP:")
    for truth in discovery_results["harsh_truths"]:
        print(f"   • {truth}")

    # Display ranked opportunities by REALISTIC success probability
    print(f"\n📊 OPPORTUNITIES RANKED BY REALISTIC SUCCESS PROBABILITY:")
    for opp in discovery_results["ranked_opportunities"]:
        print(f"\n   RANK #{opp['rank']}: {opp['sector'].upper()}")
        print(f"   Success Probability: {opp['success_probability']}")
        print(f"   Brutal Assessment: {opp['brutal_assessment']['capital_reality']['verdict']}")
        print(f"   Recommendation: {opp['recommendation']}")

    # Detailed sector analysis
    print(f"\n" + "=" * 60)
    print("🏢 DETAILED BRUTAL SECTOR ANALYSIS")
    print("=" * 60)

    for sector, analysis in discovery_results["sector_analysis"].items():
        print(f"\n💀 {sector.upper()} SECTOR")
        print(f"   Success Probability: {analysis['survival_probability']['probability']}%")
        print(f"   Assessment: {analysis['survival_probability']['assessment']}")
        
        # Calculate and display dependency costs
        cost_analysis = platform.analyzer.calculate_monthly_dependency_costs(sector)
        if cost_analysis.get("total_monthly_cost", 0) > 0:
            print(f"\n   💰 MONTHLY DEPENDENCY COSTS:")
            print(f"   Total Monthly Burn: LKR {cost_analysis['total_monthly_cost']:,.0f}")
            print(f"   Team Costs: LKR {cost_analysis['breakdown']['team_costs']:,.0f} ({cost_analysis['breakdown']['team_count']} people)")
            print(f"   Supplier Costs: LKR {cost_analysis['breakdown']['supplier_costs']:,.0f} ({cost_analysis['breakdown']['supplier_count']} services)")
            print(f"   Reality: {cost_analysis['reality_check']}")
            
            # Show capital adequacy vs dependency costs
            monthly_burn = cost_analysis['total_monthly_cost'] + your_profile.monthly_expenses + your_profile.debt_obligations
            months_runway = your_profile.available_capital / monthly_burn if monthly_burn > 0 else float('inf')
            print(f"   Your Runway: {months_runway:.1f} months with LKR {your_profile.available_capital:,.0f} capital")
        
        print(f"\n   💰 CAPITAL REALITY:")
        cap = analysis['brutal_assessment']['capital_reality']
        print(f"   Verdict: {cap['verdict']}")
        print(f"   Reality: {cap['reality_check']}")
        
        print(f"\n   ⏱️ TIMELINE REALITY:")
        time = analysis['brutal_assessment']['timeline_reality']
        print(f"   Verdict: {time['verdict']}")
        print(f"   Reality: {time['cash_flow_warning']}")
        
        print(f"\n   💥 HARD TRUTHS:")
        for truth in analysis['hard_truths'][:3]:
            print(f"   • {truth}")
            
        print(f"\n   💀 WHY YOU'LL PROBABLY FAIL:")
        for reason in analysis['failure_modes'][:2]:
            print(f"   • {reason}")
            
        print(f"\n   👥 PEOPLE/SUPPLIERS YOU ACTUALLY NEED:")
        suppliers = analysis.get('critical_suppliers_people', {})
        if suppliers:
            print(f"   Essential Team (Monthly Cost):")
            for person in suppliers.get('essential_team', [])[:3]:
                print(f"   • {person}")
            print(f"   Key Suppliers (Monthly Cost):")  
            for supplier in suppliers.get('key_suppliers', [])[:3]:
                print(f"   • {supplier}")
            print(f"   Critical Relationships (Time to Build):")
            for relationship in suppliers.get('critical_relationships', [])[:2]:
                print(f"   • {relationship}")
            if 'brutal_reality' in suppliers:
                print(f"   Reality Check: {suppliers['brutal_reality']}")
        
        print(f"\n   🎯 IF YOU INSIST ON TRYING:")
        for alt in analysis['actionable_alternatives'][:2]:
            print(f"   • {alt}")

    # Survival plan
    print(f"\n" + "=" * 60)
    print("🆘 IMMEDIATE SURVIVAL PLAN")
    print("=" * 60)
    print("What you should ACTUALLY do (not your dream business):")

    for action in discovery_results["immediate_survival_plan"]:
        print(f"\n   {action['priority']}: {action['action']}")
        print(f"   Timeline: {action['timeline']}")
        if 'expected_income' in action:
            print(f"   Income: {action['expected_income']}")
        else:
            print(f"   Outcome: {action['expected_outcome']}")

    print(f"\n" + "=" * 60)
    print("🎯 CONSTRUCTIVE RECOMMENDATIONS")
    print("=" * 60)
    
    # Generate final recommendations based on overall assessment
    overall = reality['overall_assessment']
    
    if "NOT READY" in overall:
        print("⚠️ RECOMMENDATION: FOCUS ON PREPARATION FIRST")
        print("\n   Strategic preparation steps:")
        print("   1. Secure employment to build financial foundation")
        print("   2. Start weekend freelancing to learn customer acquisition") 
        print("   3. Join industry associations to build your network")
        print("   4. Save aggressively while learning business fundamentals")
        print("   5. Find a mentor who's succeeded in your target sector")
        
    elif "MARGINAL" in overall:
        print("⚠️ RECOMMENDATION: START LEAN AND TEST CAREFULLY")
        print("\n   Risk mitigation approach:")
        print("   1. Keep employment income while testing business concept")
        print("   2. Start with minimal viable service offering")
        print("   3. Get paying customers before investing in infrastructure")
        print("   4. Build team only after proven revenue stream")
        print("   5. Set strict capital limits and timeline checkpoints")
        
    else:
        print("✅ RECOMMENDATION: PROCEED WITH STRATEGIC PLANNING")
        print("\n   Success framework:")
        print("   1. Focus on cash flow positive operations from month 1")
        print("   2. Build key relationships before needing them")
        print("   3. Start with proven market demand, not innovative solutions")
        print("   4. Hire slowly and fire quickly to conserve capital")
        print("   5. Plan for 2-3x longer timeline than initial projections")

    print(f"\n💡 This analysis aims to help you succeed by being realistic about challenges.")
    print("The goal is informed decision-making, not discouragement.")
    print("Many successful entrepreneurs wish they had this level of insight before starting.")

    # Save results
    with open("brutal_business_analysis.txt", "w", encoding="utf-8") as f:
        f.write("BRUTAL BUSINESS ANALYSIS RESULTS\n")
        f.write("=" * 50 + "\n\n")
        f.write(f"Entrepreneur: {your_profile.name}\n")
        f.write(f"Overall Assessment: {reality['overall_assessment']}\n")
        f.write(f"Time to Readiness: {reality['time_to_readiness']}\n\n")
        
        f.write("SECTOR RANKINGS BY SUCCESS PROBABILITY:\n")
        for opp in discovery_results["ranked_opportunities"]:
            f.write(f"{opp['rank']}. {opp['sector']}: {opp['success_probability']} - {opp['recommendation']}\n")
        
        f.write(f"\nCRITICAL GAPS TO ADDRESS:\n")
        for gap in reality.get("critical_gaps", []):
            f.write(f"• {gap}\n")
            
        f.write(f"\nHARSH TRUTHS:\n")
        for truth in discovery_results["harsh_truths"]:
            f.write(f"• {truth}\n")

    print(f"\n📄 Detailed analysis saved to brutal_business_analysis.txt")

# Run the brutal analysis
if __name__ == "__main__":
    asyncio.run(main())