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
import requests
from concurrent.futures import ThreadPoolExecutor
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

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
    
    # Financial situation
    available_capital: float  # in LKR
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
    
    def get_context_summary(self) -> str:
        return f"""
ENTREPRENEUR: {self.name} | {self.location}, Sri Lanka
BACKGROUND: {self.education_background} | Experience: {', '.join(self.work_experience[:2])}
CAPITAL: LKR {self.available_capital:,.0f} available | Monthly needs: LKR {self.monthly_expenses:,.0f}
TIMELINE: Need income {self.income_timeline_need} | Risk tolerance: {self.risk_tolerance}
COMMITMENT: {self.time_commitment} | Prefer {self.preferred_work_style} setup
SKILLS: {', '.join(self.current_skills[:4])}
INTERESTS: {', '.join(self.industry_interests[:3])}
"""

@dataclass 
class MarketIntelligence:
    """Current Sri Lankan market conditions and opportunities"""
    
    def __init__(self):
        self.economic_context = {
            "gdp_growth": "2-3% projected for 2024-2025",
            "inflation_rate": "Declining from peaks, ~15-20%", 
            "usd_lkr_rate": "300-330 range, stabilizing",
            "interest_rates": "15-25% for business loans",
            "key_challenges": ["High capital costs", "Power supply", "Skilled labor gaps"],
            "key_opportunities": ["Digital services boom", "Tourism recovery", "Export incentives"]
        }
        
        self.sector_data = {
            "technology": {
                "market_size": "LKR 75+ billion and growing rapidly",
                "entry_barrier": "Low capital, high skill requirement",
                "avg_startup_cost": "LKR 300K - 3M",
                "revenue_potential": "LKR 500K - 25M annually",
                "success_rate": "High with technical skills",
                "key_opportunities": [
                    "FinTech apps for Sri Lankan market (digital wallets, investment platforms)",
                    "Import/Export management software for SMEs", 
                    "Cryptocurrency trading bots and analytics platforms",
                    "Stock analysis and portfolio management tools",
                    "Supply chain management systems for traders",
                    "Automated loan processing and credit scoring systems",
                    "E-commerce platforms with integrated payment solutions",
                    "Blockchain solutions for trade finance"
                ]
            },
            "fintech_trading": {
                "market_size": "LKR 200+ billion financial services market",
                "entry_barrier": "Medium capital, regulatory compliance needed",
                "avg_startup_cost": "LKR 2M - 15M",
                "revenue_potential": "LKR 2M - 100M annually",
                "success_rate": "High with tech + finance skills",
                "key_opportunities": [
                    "Robo-advisory platform for Sri Lankan investors",
                    "Cryptocurrency exchange with LKR integration",
                    "P2P lending platform for SMEs",
                    "Algorithmic trading systems for CSE",
                    "Investment research and analysis platform",
                    "Digital loan brokerage connecting borrowers to lenders",
                    "Portfolio management app for retail investors",
                    "Trade finance platform for import/export businesses"
                ]
            },
            "import_export_tech": {
                "market_size": "LKR 3+ trillion import/export market",
                "entry_barrier": "Medium capital, licensing requirements",
                "avg_startup_cost": "LKR 5M - 30M",
                "revenue_potential": "LKR 10M - 200M annually",
                "success_rate": "Medium-High with proper market research",
                "key_opportunities": [
                    "Tech-enabled import business (electronics, components)",
                    "Software-as-a-Service for import/export documentation",
                    "Digital marketplace connecting Sri Lankan exporters to global buyers",
                    "Supply chain financing platform for traders",
                    "Logistics optimization software with IoT integration",
                    "Customs clearance automation system",
                    "Trade compliance and regulatory software",
                    "Import/export analytics and market intelligence platform"
                ]
            },
            "services": {
                "market_size": "LKR 2+ trillion service economy",
                "entry_barrier": "Low capital, relationship-dependent",
                "avg_startup_cost": "LKR 200K - 2M",
                "revenue_potential": "LKR 1M - 15M annually", 
                "success_rate": "High with specialization",
                "key_opportunities": [
                    "Financial advisory services for young professionals",
                    "Investment portfolio management for HNIs",
                    "Trading consultancy for financial firms",
                    "Digital transformation consulting for traditional businesses",
                    "Cryptocurrency education and advisory services",
                    "Import/export consulting with tech solutions",
                    "Custom Trading for trading firms",
                    "Business intelligence and analytics consulting"
                ]
            },
            "food_beverage": {
                "market_size": "LKR 1.2+ trillion domestic market",
                "entry_barrier": "Moderate capital, food safety compliance",
                "avg_startup_cost": "LKR 2M - 20M",
                "revenue_potential": "LKR 5M - 100M annually",
                "success_rate": "Medium with differentiation",
                "key_opportunities": [
                    "Tech-enabled food delivery platform",
                    "Smart vending machine business with cashless payments",
                    "Food import business with tech optimization",
                    "Restaurant management software solutions",
                    "Healthy snack manufacturing with e-commerce",
                    "Food truck business with mobile app integration"
                ]
            },
            "manufacturing": {
                "market_size": "LKR 1.8+ trillion with export potential",
                "entry_barrier": "High capital, regulatory compliance",
                "avg_startup_cost": "LKR 10M - 100M",
                "revenue_potential": "LKR 20M - 500M annually",
                "success_rate": "Medium, requires expertise",
                "key_opportunities": [
                    "Electronics assembly with import component optimization",
                    "Software-hardware integration products for export",
                    "IoT devices for smart home/office markets",
                    "3D printing services for rapid prototyping",
                    "Tech accessories manufacturing for export"
                ]
            },
            "tourism": {
                "market_size": "LKR 600+ billion (recovering from crisis)",
                "entry_barrier": "Moderate capital, location-dependent", 
                "avg_startup_cost": "LKR 3M - 25M",
                "revenue_potential": "LKR 2M - 50M annually",
                "success_rate": "High with unique positioning",
                "key_opportunities": [
                    "Tourism booking platform with AI recommendations",
                    "Digital tour guide app with AR features",
                    "Crypto-friendly accommodation booking",
                    "Travel fintech solutions for tourists"
                ]
            }
        }
        
        self.regional_advantages = {
            "Colombo": {
                "advantages": ["Largest market", "Best infrastructure", "International connections"],
                "challenges": ["High competition", "Expensive real estate", "Traffic congestion"],
                "best_for": ["Tech startups", "Financial services", "Import/export", "Corporate services"]
            },
            "Kandy": {
                "advantages": ["Tourism hub", "Cultural heritage", "Lower costs", "Educational institutions"],
                "challenges": ["Smaller market", "Limited infrastructure", "Seasonal tourism"],
                "best_for": ["Tourism services", "Education", "Handicrafts", "Wellness services"]
            },
            "Galle": {
                "advantages": ["Beach tourism", "Port access", "Growing expat community"],
                "challenges": ["Seasonal business", "Limited local market", "Infrastructure gaps"],
                "best_for": ["Tourism", "Hospitality", "Water sports", "Seafood processing"]
            },
            "Other_Cities": {
                "advantages": ["Lower costs", "Less competition", "Government incentives"],
                "challenges": ["Limited market size", "Infrastructure constraints", "Talent shortage"],
                "best_for": ["Agriculture value-add", "Manufacturing", "Regional services"]
            }
        }

class OpportunityAnalyzer:
    """Analyzes business opportunities with Sri Lankan context"""
    
    def __init__(self, market_intel: MarketIntelligence):
        self.market_intel = market_intel
        
    def analyze_fit(self, profile: EntrepreneurProfile, sector: str) -> Dict[str, Any]:
        """Analyze how well a sector fits the entrepreneur's profile"""
        
        if sector not in self.market_intel.sector_data:
            return {"error": f"Sector {sector} not in database"}
            
        sector_info = self.market_intel.sector_data[sector]
        regional_info = self.market_intel.regional_advantages.get(profile.location, 
                                                                self.market_intel.regional_advantages["Other_Cities"])
        
        # Calculate fit scores
        capital_fit = self._calculate_capital_fit(profile.available_capital, sector_info)
        timeline_fit = self._calculate_timeline_fit(profile.income_timeline_need, sector)
        skill_fit = self._calculate_skill_fit(profile.current_skills, sector)
        location_fit = self._calculate_location_fit(sector, regional_info)
        risk_fit = self._calculate_risk_fit(profile.risk_tolerance, sector_info)
        
        overall_fit = (capital_fit + timeline_fit + skill_fit + location_fit + risk_fit) / 5
        
        return {
            "sector": sector,
            "overall_fit_score": round(overall_fit, 1),
            "fit_analysis": {
                "capital_fit": {"score": capital_fit, "reasoning": self._get_capital_reasoning(profile.available_capital, sector_info)},
                "timeline_fit": {"score": timeline_fit, "reasoning": self._get_timeline_reasoning(profile.income_timeline_need, sector)},
                "skill_fit": {"score": skill_fit, "reasoning": self._get_skill_reasoning(profile.current_skills, sector)},
                "location_fit": {"score": location_fit, "reasoning": self._get_location_reasoning(sector, regional_info)},
                "risk_fit": {"score": risk_fit, "reasoning": self._get_risk_reasoning(profile.risk_tolerance, sector)}
            },
            "top_opportunities": sector_info["key_opportunities"][:3],
            "realistic_projections": {
                "startup_investment": sector_info["avg_startup_cost"],
                "revenue_potential": sector_info["revenue_potential"],
                "market_size": sector_info["market_size"]
            },
            "next_steps": self._generate_next_steps(sector, profile),
            "specific_recommendations": self._generate_recommendations(sector, profile, overall_fit)
        }
    
    def _calculate_capital_fit(self, available_capital: float, sector_info: Dict) -> float:
        """Calculate how well available capital fits sector requirements"""
        cost_range = sector_info["avg_startup_cost"]
        # Extract minimum cost from range string like "LKR 500K - 5M"
        if "500K" in cost_range:
            min_cost = 500000
        elif "2M" in cost_range:
            min_cost = 2000000  
        elif "200K" in cost_range:
            min_cost = 200000
        elif "10M" in cost_range:
            min_cost = 10000000
        elif "5M" in cost_range:
            min_cost = 5000000
        else:
            min_cost = 1000000  # default
            
        if available_capital >= min_cost * 2:
            return 9.0
        elif available_capital >= min_cost * 1.5:
            return 7.5
        elif available_capital >= min_cost:
            return 6.0
        elif available_capital >= min_cost * 0.7:
            return 4.0
        else:
            return 2.0
    
    def _calculate_timeline_fit(self, income_need: str, sector: str) -> float:
        """Calculate how well sector fits income timeline needs"""
        quick_income_sectors = ["services", "technology"]
        medium_income_sectors = ["food_beverage", "tourism"] 
        slow_income_sectors = ["manufacturing"]
        
        if income_need == "immediate":
            if sector in quick_income_sectors:
                return 8.0
            elif sector in medium_income_sectors:
                return 5.0
            else:
                return 2.0
        elif income_need == "3-6months":
            if sector in quick_income_sectors:
                return 9.0
            elif sector in medium_income_sectors:
                return 7.0
            else:
                return 4.0
        else:  # 1year+
            return 8.0  # All sectors work with longer timeline
    
    def _calculate_skill_fit(self, skills: List[str], sector: str) -> float:
        """Calculate skill alignment with sector needs"""
        tech_skills = ["programming", "digital marketing", "web design", "data analysis", "software"]
        business_skills = ["marketing", "sales", "management", "finance", "customer service"]
        creative_skills = ["design", "writing", "photography", "video", "content"]
        
        skill_keywords = [skill.lower() for skill in skills]
        
        if sector == "technology":
            tech_match = sum(1 for skill in skill_keywords if any(tech in skill for tech in tech_skills))
            return min(9.0, 3.0 + tech_match * 2)
        elif sector == "services":
            business_match = sum(1 for skill in skill_keywords if any(biz in skill for biz in business_skills))
            return min(9.0, 4.0 + business_match * 1.5)
        elif sector in ["food_beverage", "manufacturing"]:
            return 6.0  # Moderate - can be learned
        else:
            return 7.0  # Default moderate fit
    
    def _calculate_location_fit(self, sector: str, regional_info: Dict) -> float:
        """Calculate how well sector fits the location"""
        if sector in [item.lower() for item in regional_info["best_for"]]:
            return 9.0
        else:
            return 6.0
    
    def _calculate_risk_fit(self, risk_tolerance: str, sector_info: Dict) -> float:
        """Calculate risk alignment"""
        success_rate = sector_info["success_rate"]
        
        if risk_tolerance == "conservative":
            if "High" in success_rate:
                return 8.0
            elif "Medium" in success_rate:
                return 6.0
            else:
                return 3.0
        elif risk_tolerance == "moderate":
            return 7.0  # Most sectors work
        else:  # aggressive
            return 8.0  # Willing to take risks
    
    def _get_capital_reasoning(self, capital: float, sector_info: Dict) -> str:
        cost_range = sector_info["avg_startup_cost"]
        return f"Your LKR {capital:,.0f} vs typical {cost_range} needed for this sector"
    
    def _get_timeline_reasoning(self, timeline: str, sector: str) -> str:
        timeline_map = {
            "technology": "3-6 months to first revenue",
            "services": "1-3 months to first revenue", 
            "food_beverage": "4-8 months to establish market",
            "manufacturing": "6-12 months for setup and sales",
            "tourism": "6+ months due to seasonality"
        }
        expected = timeline_map.get(sector, "6+ months typically")
        return f"Your {timeline} need vs {expected} for {sector}"
    
    def _get_skill_reasoning(self, skills: List[str], sector: str) -> str:
        return f"Your skills {skills[:2]} have moderate to good alignment with {sector} requirements"
    
    def _get_location_reasoning(self, sector: str, regional_info: Dict) -> str:
        return f"{sector.title()} sector alignment with your location advantages: {regional_info['advantages'][:2]}"
    
    def _get_risk_reasoning(self, risk_tolerance: str, sector: str) -> str:
        return f"Your {risk_tolerance} risk appetite matches {sector} sector dynamics"
    
    def _generate_next_steps(self, sector: str, profile: EntrepreneurProfile) -> List[str]:
        """Generate specific next steps for this sector"""
        base_steps = [
            f"Research top 5 competitors in {sector} in {profile.location}",
            f"Interview 3 potential customers in {sector}",
            f"Calculate detailed startup costs for {sector} business",
            f"Identify key suppliers/partners for {sector} in Sri Lanka"
        ]
        
        if sector == "technology":
            base_steps.extend([
                "Build a simple MVP or prototype",
                "Join Colombo tech meetups and SLASSCOM events",
                "Research government tech incentives (ICTA, etc.)"
            ])
        elif sector == "food_beverage":
            base_steps.extend([
                "Get food safety certification requirements",
                "Test recipes with 20+ people for feedback", 
                "Research export potential and certifications"
            ])
        elif sector == "services":
            base_steps.extend([
                "Offer free pilot service to 3 businesses",
                "Create case studies and testimonials",
                "Develop standardized service packages"
            ])
            
        return base_steps
    
    def _generate_recommendations(self, sector: str, profile: EntrepreneurProfile, fit_score: float) -> List[str]:
        """Generate specific recommendations based on fit analysis"""
        recommendations = []
        
        if fit_score >= 7.5:
            recommendations.append(f"Strong fit for {sector} - proceed with detailed planning")
            recommendations.append("Focus on rapid validation and MVP development")
        elif fit_score >= 6.0:
            recommendations.append(f"Good potential in {sector} with some adjustments needed")
            recommendations.append("Consider partnership to fill skill/resource gaps")
        else:
            recommendations.append(f"Consider {sector} only after building more capabilities")
            recommendations.append("Look for mentor or co-founder with relevant experience")
        
        # Add capital-specific recommendations
        if profile.available_capital < 1000000:  # < 1M LKR
            recommendations.append("Consider service-based businesses to minimize capital needs")
            recommendations.append("Explore government SME funding schemes")
        
        # Add timeline-specific recommendations  
        if profile.income_timeline_need == "immediate":
            recommendations.append("Start with consulting/freelance in your skill area")
            recommendations.append("Use revenue to fund bigger venture later")
            
        return recommendations

class Qwen3RAGPipeline:
    """
    Qwen3 8B + RAG pipeline for local inference and retrieval.
    """
    def __init__(self, model_path="Qwen/Qwen1.5-8B-Chat", knowledge_base_path="knowledge_base/"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(model_path, trust_remote_code=True, torch_dtype=torch.float16, device_map="auto")
        self.knowledge_base_path = knowledge_base_path
        self.documents = self._load_documents()

    def _load_documents(self):
        docs = []
        if not os.path.exists(self.knowledge_base_path):
            return docs
        for fname in os.listdir(self.knowledge_base_path):
            if fname.endswith(".txt"):
                with open(os.path.join(self.knowledge_base_path, fname), "r", encoding="utf-8") as f:
                    docs.append({"title": fname, "content": f.read()})
        return docs

    def retrieve(self, query: str, top_k: int = 2) -> List[str]:
        # Simple keyword search for demonstration; replace with vector search for production
        results = []
        for doc in self.documents:
            if query.lower() in doc["content"].lower():
                results.append(doc["content"][:500])
        return results[:top_k]

    def generate(self, prompt: str, context: List[str], max_new_tokens: int = 256) -> str:
        # Concatenate context and prompt for RAG
        context_str = "\n\n".join(context)
        full_prompt = f"Context:\n{context_str}\n\nPrompt:\n{prompt}"
        inputs = self.tokenizer(full_prompt, return_tensors="pt").to(self.model.device)
        outputs = self.model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=True, temperature=0.7)
        return self.tokenizer.decode(outputs[0], skip_special_tokens=True)

class SMEDiscoveryPlatform:
    """Main platform for Sri Lankan SME discovery"""

    def __init__(self):
        self.market_intel = MarketIntelligence()
        self.analyzer = OpportunityAnalyzer(self.market_intel)
        self.profile: Optional[EntrepreneurProfile] = None
        self.rag_pipeline = Qwen3RAGPipeline(
            model_path="Qwen/Qwen1.5-8B-Chat",  # Adjust path if needed
            knowledge_base_path="knowledge_base/"  # Folder with .txt docs for retrieval
        )

    def set_profile(self, profile: EntrepreneurProfile):
        """Set the entrepreneur profile"""
        self.profile = profile
        logger.info(f"Profile set for {profile.name} in {profile.location}")

    def discover_opportunities(self) -> Dict[str, Any]:
        """Main discovery function - analyzes all sectors for the entrepreneur"""
        if not self.profile:
            return {"error": "No entrepreneur profile set"}

        # --- Qwen3 8B + RAG ENRICHMENT ---
        rag_query = (
            f"Best business opportunities for a {self.profile.age_range} entrepreneur in {self.profile.location} "
            f"with skills: {', '.join(self.profile.current_skills[:5])} and interests: {', '.join(self.profile.industry_interests[:3])}"
        )
        retrieved_contexts = self.rag_pipeline.retrieve(rag_query, top_k=3)
        rag_prompt = (
            f"Given the entrepreneur profile:\n{self.profile.get_context_summary()}\n"
            f"and the Sri Lankan market context, analyze and recommend the most suitable business sectors and paths. "
            f"Provide sector fit, financial projections, and actionable steps."
        )
        rag_llm_output = self.rag_pipeline.generate(rag_prompt, retrieved_contexts, max_new_tokens=350)

        results = {
            "entrepreneur": self.profile.name,
            "location": self.profile.location,
            "analysis_date": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "economic_context": self.market_intel.economic_context,
            "sector_analysis": {},
            "top_recommendations": [],
            "immediate_actions": [],
            "funding_options": self._get_funding_options(),
            "regulatory_checklist": self._get_regulatory_checklist(),
            "rag_llm_output": rag_llm_output  # Add RAG LLM output to results
        }

        # Analyze each sector
        sector_scores = {}
        for sector in self.market_intel.sector_data.keys():
            analysis = self.analyzer.analyze_fit(self.profile, sector)
            results["sector_analysis"][sector] = analysis
            sector_scores[sector] = analysis["overall_fit_score"]

        # Generate top recommendations based on fit scores
        sorted_sectors = sorted(sector_scores.items(), key=lambda x: x[1], reverse=True)

        for sector, score in sorted_sectors[:3]:
            sector_data = self.market_intel.sector_data[sector]
            results["top_recommendations"].append({
                "sector": sector,
                "fit_score": score,
                "why_good_fit": f"Score {score}/10 based on your capital, skills, and timeline",
                "best_opportunity": sector_data["key_opportunities"][0],
                "investment_needed": sector_data["avg_startup_cost"],
                "revenue_potential": sector_data["revenue_potential"]
            })

        # Generate immediate actions
        best_sector = sorted_sectors[0][0]
        results["immediate_actions"] = [
            f"Deep dive research on {best_sector} opportunities in {self.profile.location}",
            "Conduct 5 customer interviews in your top sector",
            "Calculate exact startup costs for your specific business idea",
            "Join relevant industry associations and networking groups",
            "Create a 90-day validation plan",
            "Identify potential mentors in your chosen sector"
        ]

        return results

    def validate_specific_idea(self, business_idea: str) -> Dict[str, Any]:
        """Validate a specific business idea"""
        if not self.profile:
            return {"error": "No entrepreneur profile set"}
        
        validation = {
            "business_idea": business_idea,
            "entrepreneur": self.profile.name,
            "validation_date": datetime.now().strftime("%Y-%m-%d"),
            "initial_assessment": self._assess_idea_viability(business_idea),
            "market_validation_steps": self._generate_validation_steps(business_idea),
            "financial_reality_check": self._financial_reality_check(business_idea),
            "competitive_landscape": self._quick_competitive_check(business_idea),
            "regulatory_requirements": self._check_regulatory_needs(business_idea),
            "risk_assessment": self._assess_risks(business_idea),
            "go_no_go_recommendation": self._generate_recommendation(business_idea)
        }
        
        return validation
    
    def _get_funding_options(self) -> List[Dict[str, str]]:
        """Get funding options relevant to entrepreneur's situation"""
        options = []
        
        if self.profile.available_capital < 2000000:  # < 2M LKR
            options.extend([
                {"source": "SLDB SME Loans", "amount": "Up to LKR 10M", "requirement": "Business plan + collateral"},
                {"source": "Microfinance", "amount": "LKR 100K - 2M", "requirement": "Basic business plan"},
                {"source": "Bootstrappa/Angel Networks", "amount": "LKR 1M - 10M", "requirement": "Scalable tech business"}
            ])
        
        if "technology" in [interest.lower() for interest in self.profile.industry_interests]:
            options.append({"source": "ICTA Grants", "amount": "Up to LKR 5M", "requirement": "Tech innovation project"})
        
        options.extend([
            {"source": "Personal Network", "amount": "Variable", "requirement": "Trust + clear plan"},
            {"source": "Revenue-based Financing", "amount": "LKR 2M+", "requirement": "Existing revenue stream"}
        ])
        
        return options
    
    def _get_regulatory_checklist(self) -> List[str]:
        """Get regulatory checklist for Sri Lankan businesses"""
        return [
            "Company name reservation (Registrar of Companies)",
            "Business registration (Private Limited/Partnership)",
            "Tax Identification Number (TIN) registration", 
            "Municipal/Local Authority business license",
            "EPF/ETF registration (if hiring employees)",
            "VAT registration (if turnover > LKR 12M annually)",
            "Sector-specific licenses (FDA, SLTDA, etc.)",
            "Environmental clearance (if applicable)",
            "Import/Export license (if applicable)",
            "Professional indemnity insurance"
        ]
    
    def _assess_idea_viability(self, idea: str) -> Dict[str, Any]:
        """Quick viability assessment of business idea"""
        # This would ideally use NLP to parse the idea, but for now we'll provide general framework
        return {
            "market_size_estimate": "To be researched based on your specific idea",
            "competition_level": "Requires market research",
            "capital_intensity": "Depends on business model chosen",
            "regulatory_complexity": "Varies by industry",
            "scalability_potential": "To be evaluated through customer validation",
            "preliminary_assessment": "Idea has potential - needs detailed validation"
        }
    
    def _generate_validation_steps(self, idea: str) -> List[Dict[str, str]]:
        """Generate validation steps for the specific idea"""
        return [
            {
                "step": "Customer Problem Validation",
                "action": "Interview 20 potential customers about the problem your idea solves",
                "timeline": "Week 1-2",
                "cost": "LKR 10,000 (transport, incentives)"
            },
            {
                "step": "Solution Validation", 
                "action": "Create mockups/prototype and get feedback from 10 customers",
                "timeline": "Week 3-4",
                "cost": "LKR 25,000 (design, basic prototype)"
            },
            {
                "step": "Pricing Validation",
                "action": "Test different pricing models with potential customers", 
                "timeline": "Week 5-6",
                "cost": "LKR 5,000 (surveys, incentives)"
            },
            {
                "step": "Market Size Validation",
                "action": "Research total addressable market in Sri Lanka",
                "timeline": "Week 7-8", 
                "cost": "LKR 15,000 (research tools, data)"
            }
        ]
    
    def _financial_reality_check(self, idea: str) -> Dict[str, str]:
        """Provide financial reality check framework"""
        return {
            "startup_cost_estimate": f"LKR 500K - 5M (varies significantly by business model)",
            "monthly_operating_costs": f"LKR 100K - 500K (depends on team size, location)",
            "break_even_timeline": "6-18 months typical for service businesses",
            "cash_flow_warning": "Plan for 6 months of expenses without revenue",
            "profitability_factors": "Customer acquisition cost vs lifetime value critical"
        }
    
    def _quick_competitive_check(self, idea: str) -> Dict[str, Any]:
        """Framework for competitive analysis"""
        return {
            "direct_competitors": "List top 3-5 businesses doing exactly what you plan",
            "indirect_competitors": "Identify how customers currently solve this problem",
            "competitive_advantages": "What will make you different and better?",
            "market_gaps": "What are competitors NOT doing well?",
            "differentiation_strategy": "How will you position vs competitors?"
        }
    
    def _check_regulatory_needs(self, idea: str) -> List[str]:
        """Check regulatory requirements for business idea"""
        return [
            "Basic business registration requirements apply",
            "Sector-specific licenses may be needed",
            "Tax obligations (income tax, VAT if applicable)",
            "Labor law compliance if hiring",
            "Consumer protection regulations",
            "Data protection compliance (if handling personal data)",
            "Environmental regulations (if applicable)",
            "Import/export regulations (if applicable)"
        ]
    
    def _assess_risks(self, idea: str) -> Dict[str, List[str]]:
        """Assess business risks"""
        return {
            "high_risks": [
                "Market may not be ready for this solution",
                "Competition from well-funded players", 
                "Regulatory changes could impact business"
            ],
            "medium_risks": [
                "Customer acquisition may be slower than expected",
                "Key team members leaving",
                "Economic downturn affecting demand"
            ],
            "low_risks": [
                "Technology changes",
                "Supplier issues",
                "Seasonal demand fluctuations"
            ],
            "mitigation_strategies": [
                "Start small and test assumptions quickly",
                "Build strong customer relationships", 
                "Maintain healthy cash reserves",
                "Diversify revenue sources over time"
            ]
        }
    
    def _generate_recommendation(self, idea: str) -> Dict[str, str]:
        """Generate go/no-go recommendation"""
        return {
            "recommendation": "PROCEED WITH VALIDATION", 
            "confidence": "Medium - requires detailed market research",
            "reasoning": "Idea shows potential but needs customer validation before significant investment",
            "next_immediate_action": "Start with customer interviews this week",
            "investment_recommendation": "Limit initial investment to LKR 100K for validation phase",
            "timeline_recommendation": "Spend 8-12 weeks on validation before major decisions"
        }

def create_your_profile() -> EntrepreneurProfile:
    """
    Kay Flock's entrepreneurial profile
    """
    
    return EntrepreneurProfile(
        # PERSONAL INFO
        name="Kay Flock",
        location="Colombo",  # Assuming Colombo for best business opportunities
        age_range="18-25",
        education_background="Business", 
        work_experience=["Trading", "Violence Projects", "Pest control Solutions"],
        current_skills=[
            "Trading", "Violence", "System Architecture", "Database Design",
            "Web Development", "Mobile Development", "API Development", "Cloud Computing",
            "Financial Analysis", "Investment Analysis", "Cryptocurrency Trading", 
            "Stock Market Analysis", "Portfolio Management", "Risk Assessment"
        ],
        
        # FINANCIAL SITUATION - Conservative estimates for 20-year-old
        available_capital=800000.0,  # LKR 800K - realistic for young professional
        monthly_expenses=45000.0,     # Conservative monthly expenses
        risk_tolerance="aggressive",  # Given crypto/stock investment experience
        income_timeline_need="3-6months",  # Need to build income stream
        
        # WORK PREFERENCES
        time_commitment="full-time",  
        preferred_work_style="solo",  # Tech-savvy, can work independently
        industry_interests=[
            "Technology", "Financial Technology", "Import/Export", "Trading",
            "Investment Services", "Cryptocurrency", "E-commerce", "Digital Services"
        ],
        deal_breakers=["Heavy physical labor", "Low-tech industries", "Limited growth potential"],
        
        # SRI LANKAN CONTEXT
        language_skills=["English", "Sinhala"],  
        local_connections="few",  # Young professional, still building network
        regulatory_comfort="beginner"  # Smart but new to business regulations
    )

# Main execution function
async def main():
    """
    Sri Lankan SME Business Discovery Platform

    This provides unique value beyond ChatGPT by:
    1. Current Sri Lankan market data and economic context
    2. Realistic financial projections in LKR
    3. Location-specific opportunities and challenges
    4. Regulatory requirements and compliance checklists
    5. Funding options specific to Sri Lankan entrepreneurs  
    6. Personalized fit analysis based on your profile
    7. Actionable validation steps you can execute locally
    8. Network connections and local resource mapping
    """

    output_lines = []

    output_lines.append("=" * 80)
    output_lines.append("🇱🇰 SRI LANKAN SME BUSINESS DISCOVERY PLATFORM")
    output_lines.append("=" * 80)
    output_lines.append("Find Your Perfect Business Opportunity in Sri Lanka")
    output_lines.append("Personalized Analysis Based on Your Unique Situation")

    # Initialize the platform
    platform = SMEDiscoveryPlatform()

    # Set up your profile (CUSTOMIZE THIS WITH YOUR DETAILS)
    your_profile = create_your_profile()
    platform.set_profile(your_profile)

    output_lines.append(f"\nENTREPRENEUR PROFILE LOADED:")
    output_lines.append(your_profile.get_context_summary())

    output_lines.append("\n" + "=" * 60)
    output_lines.append("🔍 COMPREHENSIVE OPPORTUNITY DISCOVERY")
    output_lines.append("=" * 60)

    # Run comprehensive opportunity discovery
    discovery_results = platform.discover_opportunities()

    # Add Qwen3 8B + RAG LLM output at the top of the report
    output_lines.append("\n" + "=" * 60)
    output_lines.append("🤖 QWEN3 8B + RAG LLM RECOMMENDATION")
    output_lines.append("=" * 60)
    output_lines.append(discovery_results.get("rag_llm_output", "No LLM output."))

    # Display results in an organized way
    output_lines.append(f"\n📊 ECONOMIC CONTEXT FOR SRI LANKA:")
    economic = discovery_results["economic_context"]
    output_lines.append(f"   GDP Growth: {economic['gdp_growth']}")
    output_lines.append(f"   Inflation: {economic['inflation_rate']}")
    output_lines.append(f"   USD/LKR: {economic['usd_lkr_rate']}")
    output_lines.append(f"   Business Loans: {economic['interest_rates']}")

    output_lines.append(f"\n🎯 YOUR TOP 3 BUSINESS OPPORTUNITIES:")
    for i, rec in enumerate(discovery_results["top_recommendations"], 1):
        output_lines.append(f"\n   {i}. {rec['sector'].upper()} SECTOR")
        output_lines.append(f"      Fit Score: {rec['fit_score']}/10")
        output_lines.append(f"      Why Good Fit: {rec['why_good_fit']}")
        output_lines.append(f"      Best Opportunity: {rec['best_opportunity']}")
        output_lines.append(f"      Investment Needed: {rec['investment_needed']}")
        output_lines.append(f"      Revenue Potential: {rec['revenue_potential']}")

    output_lines.append(f"\n📋 YOUR IMMEDIATE ACTION PLAN:")
    for i, action in enumerate(discovery_results["immediate_actions"], 1):
        output_lines.append(f"   {i}. {action}")

    output_lines.append(f"\n💰 FUNDING OPTIONS FOR YOU:")
    for option in discovery_results["funding_options"]:
        output_lines.append(f"   • {option['source']}: {option['amount']} ({option['requirement']})")

    # Detailed sector analysis
    output_lines.append(f"\n" + "=" * 60)
    output_lines.append("📈 DETAILED SECTOR ANALYSIS")
    output_lines.append("=" * 60)

    for sector, analysis in discovery_results["sector_analysis"].items():
        if "error" not in analysis:
            output_lines.append(f"\n🏢 {sector.upper()} SECTOR - Fit Score: {analysis['overall_fit_score']}/10")
            output_lines.append(f"   💰 Capital Fit: {analysis['fit_analysis']['capital_fit']['score']}/10")
            output_lines.append(f"      {analysis['fit_analysis']['capital_fit']['reasoning']}")
            output_lines.append(f"   ⏱️ Timeline Fit: {analysis['fit_analysis']['timeline_fit']['score']}/10")
            output_lines.append(f"      {analysis['fit_analysis']['timeline_fit']['reasoning']}")
            output_lines.append(f"   🎯 Top Opportunities in {sector}:")
            for opp in analysis['top_opportunities']:
                output_lines.append(f"      • {opp}")
            output_lines.append(f"   📝 Next Steps for {sector}:")
            for step in analysis['next_steps'][:3]:
                output_lines.append(f"      • {step}")
            output_lines.append(f"   💡 Specific Recommendations:")
            for rec in analysis['specific_recommendations'][:2]:
                output_lines.append(f"      • {rec}")

    # Business idea validation example
    output_lines.append(f"\n" + "=" * 60)
    output_lines.append("🧪 BUSINESS IDEA VALIDATION EXAMPLE")
    output_lines.append("=" * 60)

    sample_idea = """
    A comprehensive FinTech platform called "TradeFlow Sri Lanka" that combines:

    1. Import/Export Management Software:
       - Automated documentation and customs clearance
       - Supplier verification and due diligence tools
       - Real-time shipment tracking with IoT integration
       - Currency hedging recommendations based on market analysis

    2. Trade Finance Solutions:
       - AI-powered credit scoring for importers/exporters
       - Invoice factoring and supply chain financing
       - Letters of credit digitization and processing
       - Working capital optimization algorithms

    3. Investment Analytics Integration:
       - Portfolio tracking for trade-related investments
       - Commodity price prediction using ML models
       - Foreign exchange risk analysis and hedging strategies
       - Cryptocurrency payment integration for international trades

    Target Market: 
    - Sri Lankan SME importers/exporters (5,000+ active businesses)
    - Trading companies looking for digital transformation
    - Financial institutions needing trade finance solutions

    Revenue Model:
    - SaaS subscription: LKR 25,000-100,000/month per business
    - Transaction fees: 0.5-2% on financing facilitated
    - Premium analytics: LKR 15,000/month for advanced features

    Unique Value Proposition:
    - First integrated trade + finance + investment platform in Sri Lanka
    - Leverages your Business + financial analysis skills
    - Addresses real pain points in import/export processes
    - Scalable across South Asian markets

    Investment Estimate: LKR 8-12 million for MVP development and first-year operations
    Revenue Projection: LKR 2-5 million in year 1, scaling to LKR 50-200 million by year 3
    """

    validation_results = platform.validate_specific_idea(sample_idea)

    output_lines.append(f"BUSINESS IDEA: TradeFlow Sri Lanka - Integrated Trade & Finance Platform")
    output_lines.append(f"VALIDATION ANALYSIS:")

    output_lines.append(f"\n📋 VALIDATION STEPS TO EXECUTE:")
    for step in validation_results["market_validation_steps"]:
        output_lines.append(f"   {step['step']}: {step['action']}")
        output_lines.append(f"   Timeline: {step['timeline']} | Cost: {step['cost']}")

    output_lines.append(f"\n💰 FINANCIAL REALITY CHECK:")
    financial = validation_results["financial_reality_check"]
    for key, value in financial.items():
        output_lines.append(f"   {key.replace('_', ' ').title()}: {value}")

    output_lines.append(f"\n⚠️ RISK ASSESSMENT:")
    risks = validation_results["risk_assessment"]
    output_lines.append(f"   High Risks: {', '.join(risks['high_risks'][:2])}")
    output_lines.append(f"   Mitigation: {risks['mitigation_strategies'][0]}")

    recommendation = validation_results["go_no_go_recommendation"]
    output_lines.append(f"\n🎯 RECOMMENDATION: {recommendation['recommendation']}")
    output_lines.append(f"   Confidence: {recommendation['confidence']}")
    output_lines.append(f"   Next Action: {recommendation['next_immediate_action']}")
    output_lines.append(f"   Investment Limit: {recommendation['investment_recommendation']}")

    output_lines.append(f"\n" + "=" * 60)
    output_lines.append("💡 Kay Flock'S SPECIFIC OPPORTUNITIES")
    output_lines.append("=" * 60)
    output_lines.append("Based on your unique profile combining Business,")
    output_lines.append("financial analysis skills, and import/export interests:")
    output_lines.append("")
    output_lines.append("🚀 HIGH-POTENTIAL OPPORTUNITIES:")
    output_lines.append("1. FinTech Import/Export Platform (TradeFlow concept above)")
    output_lines.append("2. Cryptocurrency Trading Bot for CSE-listed companies")  
    output_lines.append("3. AI-powered Investment Research Platform for Sri Lankans")
    output_lines.append("4. Import Optimization Software for Electronics/Tech Components")
    output_lines.append("5. Digital Loan Marketplace connecting SME traders to lenders")
    output_lines.append("")
    output_lines.append("💰 IMMEDIATE INCOME OPPORTUNITIES (While Building Main Venture):")
    output_lines.append("• Freelance Trading for trading firms")
    output_lines.append("• Investment portfolio consulting for young professionals")  
    output_lines.append("• Custom trading algorithm development")
    output_lines.append("• Import/export process consulting with tech solutions")
    output_lines.append("• Cryptocurrency education workshops")
    output_lines.append("")
    output_lines.append("🎯 YOUR COMPETITIVE ADVANTAGES:")
    output_lines.append("• Young + tech-savvy = can build modern solutions")
    output_lines.append("• Software skills + financial knowledge = rare combination")
    output_lines.append("• Understanding both crypto and traditional investments")
    output_lines.append("• Can code solutions that older entrepreneurs can't")
    output_lines.append("• Lower living costs = can take more risks")
    output_lines.append("• English fluency = can access global markets")

    output_lines.append(f"\n" + "=" * 60)
    output_lines.append("📚 REGULATORY CHECKLIST FOR YOUR BUSINESS")
    output_lines.append("=" * 60)

    for i, requirement in enumerate(discovery_results["regulatory_checklist"], 1):
        output_lines.append(f"   {i}. {requirement}")

    output_lines.append(f"\n📄 ADDITIONAL REGULATIONS FOR FINTECH/IMPORT-EXPORT:")
    output_lines.append("   • Central Bank of Sri Lanka (CBSL) approval for payment systems")
    output_lines.append("   • Sri Lanka Accounting Standards for financial reporting")
    output_lines.append("   • Data Protection compliance for customer financial data")
    output_lines.append("   • Import/Export license from Department of Commerce")
    output_lines.append("   • Foreign exchange regulations compliance (if handling forex)")
    output_lines.append("   • Anti-Money Laundering (AML) compliance procedures")

    output_lines.append(f"\n" + "=" * 60)
    output_lines.append("🚀 Flocka'S NEXT 90 DAYS ACTION PLAN")
    output_lines.append("=" * 60)
    output_lines.append("WEEKS 1-2: Market Research & Validation")
    output_lines.append("• Interview 20 import/export businesses about pain points")
    output_lines.append("• Survey 50 young professionals about investment needs")
    output_lines.append("• Research competitors in FinTech and trade finance")
    output_lines.append("")
    output_lines.append("WEEKS 3-6: Technical Feasibility & Prototyping")
    output_lines.append("• Build MVP of trade documentation automation")
    output_lines.append("• Create investment analytics dashboard prototype")
    output_lines.append("• Test cryptocurrency payment integration")
    output_lines.append("")  
    output_lines.append("WEEKS 7-10: Business Model Validation")
    output_lines.append("• Pilot with 3-5 import/export SMEs")
    output_lines.append("• Test pricing models and revenue assumptions")
    output_lines.append("• Validate regulatory compliance requirements")
    output_lines.append("")
    output_lines.append("WEEKS 11-12: Funding & Next Steps Decision")
    output_lines.append("• Apply to ICTA grants and startup accelerators")
    output_lines.append("• Pitch to angel investors in Colombo tech scene")
    output_lines.append("• Decide on full-time commitment vs gradual transition")

    output_lines.append(f"\n" + "=" * 60)
    output_lines.append("🌟 WHY THIS ANALYSIS IS UNIQUE FOR YOU")
    output_lines.append("=" * 60)
    output_lines.append("Unlike generic ChatGPT advice, this platform provides:")
    output_lines.append("")
    output_lines.append("✅ Your exact fit scores for each business sector")
    output_lines.append("✅ Opportunities matching your software + finance skills")
    output_lines.append("✅ Realistic LKR projections for your capital level") 
    output_lines.append("✅ Age-appropriate risk tolerance and timeline")
    output_lines.append("✅ Sri Lankan market-specific insights and data")
    output_lines.append("✅ Actual funding sources available to you locally")
    output_lines.append("✅ Regulatory requirements you'll actually face")
    output_lines.append("✅ Network building strategies for young entrepreneurs")
    output_lines.append("✅ Validation steps you can execute with limited resources")
    output_lines.append("✅ Business ideas combining your unique skill mix")

    output_lines.append(f"\n🎯 YOUR ENTREPRENEURIAL ADVANTAGES AT 20:")
    output_lines.append("• High risk tolerance and adaptability")
    output_lines.append("• Native digital skills and tech fluency")  
    output_lines.append("• Lower personal expenses = more flexibility")
    output_lines.append("• Long time horizon for building wealth")
    output_lines.append("• Energy and motivation to work intensively")
    output_lines.append("• Growing network of young professionals as potential customers")
    output_lines.append("• Understanding of emerging technologies (crypto, AI, blockchain)")

    output_lines.append(f"\n💡 REMEMBER: Start small, validate quickly, scale systematically.")
    output_lines.append("Your Business skills give you the ability to build")
    output_lines.append("solutions that solve real problems in finance and trade.")
    output_lines.append("Focus on solving one specific pain point extremely well first.")

    # Save all output to a text file
    with open("business_discovery_report.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines))

    print("\nAnalysis complete. Results saved to business_discovery_report.txt")

# Example of how to customize and run your analysis
def run_your_discovery():
    """Run this function after customizing your profile"""
    asyncio.run(main())

# Run the platform
if __name__ == "__main__":
    run_your_discovery()