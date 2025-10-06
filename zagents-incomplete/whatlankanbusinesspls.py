import asyncio
import json
import os
from typing import Dict, List, Any, Optional, TypedDict
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import requests
import aiohttp
from dotenv import load_dotenv

load_dotenv()
BRUTAL_MODE = True

# Simple document class
class Document:
    def __init__(self, page_content: str, metadata: dict = None):
        self.page_content = page_content
        self.metadata = metadata or {}

# HTTP-based LLM interface for Ollama
class OllamaHTTPClient:
    def __init__(self, model_name: str = "qwen3:8b", host: str = "http://localhost:11434"):
        self.model_name = model_name
        self.host = host.rstrip('/')
        self.generate_url = f"{self.host}/api/generate"
        self.chat_url = f"{self.host}/api/chat"
        
    def test_connection(self):
        """Test if Ollama is accessible"""
        try:
            response = requests.get(f"{self.host}/api/version", timeout=10)
            return response.status_code == 200
        except Exception as e:
            print(f"Connection test failed: {e}")
            return False
    
    def list_models(self):
        """List available models"""
        try:
            response = requests.get(f"{self.host}/api/tags", timeout=15)
            if response.status_code == 200:
                data = response.json()
                models = [model['name'] for model in data.get('models', [])]
                print(f"Found models: {models}")
                return models
            return []
        except Exception as e:
            print(f"Model listing failed: {e}")
            return []
        
    async def ainvoke(self, messages):
        """Async invoke using direct HTTP calls to Ollama"""
        # Convert messages to simple prompt
        prompt = ""
        for msg in messages:
            if hasattr(msg, 'content'):
                if msg.__class__.__name__ == 'SystemMessage':
                    prompt += f"System: {msg.content}\n\n"
                elif msg.__class__.__name__ == 'HumanMessage':
                    prompt += f"Human: {msg.content}\n\nAssistant: "
            else:
                prompt += str(msg) + "\n\n"
        
        # Prepare request payload
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "top_p": 0.9,
                "top_k": 40,
                "num_predict": 2000
            }
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.generate_url, 
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=180)
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        
                        # Create simple response object
                        class SimpleResponse:
                            def __init__(self, content):
                                self.content = content
                                
                        return SimpleResponse(result.get('response', ''))
                    else:
                        error_text = await response.text()
                        raise Exception(f"Ollama HTTP error {response.status}: {error_text}")
                        
        except Exception as e:
            raise Exception(f"Ollama communication error: {e}")

# Simple message classes
class SystemMessage:
    def __init__(self, content: str):
        self.content = content

class HumanMessage:
    def __init__(self, content: str):
        self.content = content

# Simple text splitter
class SimpleTextSplitter:
    def __init__(self, chunk_size: int = 400, chunk_overlap: int = 40):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def split_documents(self, documents: List[Document]) -> List[Document]:
        """Split documents into chunks"""
        chunks = []
        for doc in documents:
            text = doc.page_content
            words = text.split()
            
            for i in range(0, len(words), self.chunk_size - self.chunk_overlap):
                chunk_words = words[i:i + self.chunk_size]
                chunk_text = ' '.join(chunk_words)
                
                chunks.append(Document(
                    page_content=chunk_text,
                    metadata=doc.metadata
                ))
        
        return chunks

# Simple vector store using basic similarity
class SimpleVectorStore:
    def __init__(self, documents: List[Document]):
        self.documents = documents
        
    def similarity_search(self, query: str, k: int = 3) -> List[Document]:
        """Simple keyword-based similarity search"""
        query_words = set(query.lower().split())
        
        # Score documents by keyword overlap
        scores = []
        for doc in self.documents:
            doc_words = set(doc.page_content.lower().split())
            overlap = len(query_words.intersection(doc_words))
            # Add bonus for exact phrase matches
            for word in query_words:
                if word in doc.page_content.lower():
                    overlap += 0.5
            scores.append((overlap, doc))
        
        # Sort by score and return top k
        scores.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scores[:k]]

class RAGRetriever:
    """Enhanced RAG system with Sri Lanka economic data"""
    
    def __init__(self):
        self.vectorstore = None
        self.documents = self._load_sri_lanka_economic_data()
        self._build_vectorstore()
    
    def brutal_penalty(op):
        # op is a dict with fields from BusinessAnalysisAgent
        penalty = 0
        # Local-demand dependence
        if op.get("export_revenue_share", 0) < 50:
            penalty += 20
        # High capex
        if "High" in op.get("investment_required", ""):
            penalty += 15
        # Logistics/permits/seasonality hazards
        hazards = " ".join(op.get("hard_constraints", [])).lower()
        for kw, p in [("permit",5), ("license",5), ("logistics",7), ("import",7), ("season",6)]:
            if kw in hazards: penalty += p
        # Competition
        if op.get("competition_level") in ["High","Very High"]:
            penalty += 10
        # Turn score into 0–100 brutal_score if missing
        base = op.get("growth_potential", 5) * 8  # 0–80
        return max(0, min(100, base - penalty))
    
    def _load_sri_lanka_economic_data(self) -> List[Document]:
        """Load comprehensive Sri Lanka economic data for RAG"""
        economic_data = [
            # Latest Economic Recovery Data
            Document(
                page_content="""Sri Lanka Economy 2024-2025 Recovery Status:
                GDP growth: 5.2% in 2024, beating projections of 4.4%
                Inflation: Deflation since September 2024, currently -4.2%
                Tourism recovery: 1.5M visitors in 2024, targeting 2.3M in 2025
                Construction sector: Leading growth at 8.5%
                IT industry: $5.2B revenue in 2024, projected $6.8B by 2026
                ADB forecast: 3.9% growth in 2025, 3.4% in 2026
                Currency stability: LKR strengthened 15% against USD
                Export growth: 12% increase in goods exports""",
                metadata={"source": "economic_recovery", "date": "2025", "category": "macro"}
            ),
            
            # Enhanced IT Sector Data
            Document(
                page_content="""Sri Lanka IT Industry Deep Dive 2024-2025:
                Software exports: Growing 18-22% annually
                Major players: WSO2, Virtusa, IFS, Sysco Labs, 99X Technology
                Emerging strength: AI/ML services, blockchain development
                Key advantages: English proficiency, cost 40-60% lower than India
                Focus verticals: Fintech (35% growth), healthcare tech (28%), e-commerce platforms
                Government support: Digital Sri Lanka 2030 initiative, tax incentives
                Tech hubs: Colombo (60%), Kandy (25%), Galle (10%)
                Remote work adoption: 75% of companies offer hybrid/remote
                Skills shortage: Cloud architects, AI specialists, DevOps engineers""",
                metadata={"source": "it_sector", "date": "2024", "category": "industry"}
            ),
            
            # Detailed Job Market Data
            Document(
                page_content="""Colombo Tech Job Market 2024-2025 Analysis:
                Software Engineers: Very High demand, LKR 1.2M-2.2M monthly (Senior: LKR 2.5M-4M)
                Data Scientists: High demand, LKR 1.5M-2.8M monthly
                AI/ML Specialists: Critical shortage, LKR 1.8M-3.5M monthly
                Cloud Engineers: Severe shortage, LKR 1.5M-3.2M monthly
                Cybersecurity Specialists: Very High demand, LKR 1.4M-2.9M monthly
                DevOps Engineers: High demand, LKR 1.3M-2.6M monthly
                Remote opportunities: USD 2K-8K monthly for experienced professionals
                Market saturation: Low-level roles saturated, senior roles in shortage
                AI automation risk: Low for strategic/creative roles, medium for routine coding""",
                metadata={"source": "job_market", "date": "2024", "category": "employment"}
            ),
            
            # Enhanced Business Environment
            Document(
                page_content="""Colombo Business Environment 2024-2025:
                Top opportunities: AI consulting, cybersecurity services, cloud migration
                Investment climate: FDI increased 45% in 2024
                Startup ecosystem: 320+ startups, $85M funding raised in 2024
                Success factors: Export focus, digital-first, regulatory compliance
                Growth sectors: Fintech (42% growth), agritech (35%), healthtech (38%)
                Business costs: Office rent LKR 150-400/sqft, utilities stable
                Regulatory: New startup-friendly policies, faster company registration
                Market access: Trade agreements with India, China, EU preferences""",
                metadata={"source": "business_environment", "date": "2024", "category": "business"}
            ),
            
            # Non-Tech Business Opportunities
            Document(
                page_content="""Sri Lanka Non-Tech Business Opportunities 2024-2025:
                Tourism Recovery: Hotel occupancy 78%, restaurant industry growing 35%
                Food & Beverage: Local food exports up 28%, specialty tea/spices in demand
                Logistics & Supply Chain: Port connectivity improved, warehousing demand high
                Healthcare Services: Medical tourism returning, elderly care growing
                Education & Training: Skills training institutes, language centers expanding
                Agriculture Technology: Organic farming, value-added processing
                Renewable Energy: Solar installations, energy consultancy growing
                Import Substitution: Local manufacturing incentives, reduced import dependency
                Real Estate: Commercial property demand recovering in Colombo
                Retail & E-commerce: Omnichannel retail, last-mile delivery services""",
                metadata={"source": "non_tech_business", "date": "2024", "category": "traditional_business"}
            ),
            
            # Economic Backing for Non-Tech Sectors
            Document(
                page_content="""Economic Drivers for Non-Tech Businesses Sri Lanka 2024-2025:
                Tourism: Government targeting 2.3M visitors by 2025, infrastructure investments
                Agriculture: 25% of GDP, export incentives, climate-smart farming initiatives
                Manufacturing: Import substitution policy, tax holidays for local production
                Healthcare: Aging population, medical tourism promotion, insurance expansion
                Education: Skills gap driving training demand, government upskilling programs
                Logistics: Colombo Port expansion, China-backed infrastructure projects
                Energy: Renewable energy targets, feed-in tariffs for solar/wind
                Food Security: Self-sufficiency goals, value-addition incentives
                Real Estate: Urban development projects, middle-class growth
                Retail: Rising disposable income, e-commerce adoption""",
                metadata={"source": "economic_backing", "date": "2024", "category": "economic_drivers"}
            ),
            
            # Market Size and Opportunity Data
            Document(
                page_content="""Sri Lanka Non-Tech Market Sizes 2024-2025:
                Tourism: $4.2B pre-pandemic, recovering to $3.1B in 2024, targeting $5B by 2026
                Food & Beverage: $2.8B domestic market, exports $1.5B annually
                Healthcare: $3.2B market, growing 12% annually, medical tourism $180M
                Education/Training: $890M market, corporate training $120M growing 25%
                Agriculture: $8.9B sector, value-addition opportunities $2.1B
                Logistics: $1.4B market, last-mile delivery $340M growing 40%
                Renewable Energy: $680M market, residential solar $190M growing 45%
                Real Estate: $12B sector, commercial $3.8B recovering strongly
                Retail: $18B market, organized retail $4.2B growing 18%
                Manufacturing: $24B sector, SME opportunities $3.6B""",
                metadata={"source": "market_sizes", "date": "2024", "category": "market_data"}
            ),
            
            # Cybersecurity Market Specifics
            Document(
                page_content="""Sri Lanka Cybersecurity Market 2024-2025:
                Market size: $180M, growing 35% annually
                Demand drivers: Digital transformation, regulatory compliance
                Key areas: SOC services, penetration testing, compliance consulting
                Salary ranges: Security analysts LKR 1.2M-2.2M, architects LKR 2M-3.5M
                Certifications in demand: CISSP, CEH, CISA, CISM
                Local challenges: Skills gap, awareness deficit
                Government initiatives: National cybersecurity strategy, CERT programs
                Business opportunities: Managed security services, training/certification""",
                metadata={"source": "cybersecurity", "date": "2024", "category": "security"}
            ),
            
            # Cloud Computing Deep Dive
            Document(
                page_content="""Sri Lanka Cloud Computing Landscape:
                Market growth: 28% annually, $95M market size
                Major providers: AWS (40%), Microsoft Azure (35%), Google Cloud (15%)
                Government adoption: Cloud-first policy for all agencies by 2026
                Enterprise demand: 65% of large companies migrating to cloud
                Skills critical shortage: Cloud architects, Kubernetes specialists, DevOps
                Certification value: AWS Solutions Architect adds 40-60% salary premium
                Local opportunities: Cloud migration consulting, managed cloud services
                Training gap: Less than 500 certified cloud professionals nationwide""",
                metadata={"source": "cloud_computing", "date": "2024", "category": "technology"}
            ),
            
            # AI Automation Impact Analysis
            Document(
                page_content="""AI Automation Impact on Sri Lankan Job Market:
                High automation risk: Basic data entry (90%), simple coding tasks (70%)
                Medium risk: QA testing (50%), junior development roles (40%)
                Low risk: System architecture (15%), AI/ML development (10%), cybersecurity (20%)
                Safe roles: Strategic consulting, client management, creative problem-solving
                Emerging roles: AI prompt engineers, ML ops specialists, AI ethics consultants
                Skill protection: Complex problem-solving, client interaction, domain expertise
                Timeline: Significant impact expected 2026-2028 for routine tasks""",
                metadata={"source": "ai_automation", "date": "2024", "category": "future_trends"}
            )
        ]
        return economic_data
    
    def _build_vectorstore(self):
        """Build simple vectorstore from documents"""
        try:
            text_splitter = SimpleTextSplitter(chunk_size=400, chunk_overlap=40)
            splits = text_splitter.split_documents(self.documents)
            self.vectorstore = SimpleVectorStore(splits)
            print(f"✓ RAG system initialized with {len(splits)} document chunks")
        except Exception as e:
            print(f"Warning: Could not build vectorstore: {e}")
            self.vectorstore = None
    
    def retrieve_context(self, query: str, k: int = 4) -> str:
        """Retrieve relevant context for a query"""
        if not self.vectorstore:
            return "No RAG context available"
        
        try:
            docs = self.vectorstore.similarity_search(query, k=k)
            context = "\n\n".join([doc.page_content for doc in docs])
            return context
        except Exception as e:
            print(f"RAG retrieval error: {e}")
            return "RAG context unavailable"

class EconomicNewsAgent:
    def __init__(self, llm, rag_retriever: RAGRetriever):
        self.llm = llm
        self.rag_retriever = rag_retriever
        self.name = "Economic News Analyst"

    async def analyze_local_news(self, location: str) -> Dict:
        """Analyze economic trends using RAG context"""
        
        context = self.rag_retriever.retrieve_context(
            f"{location} economic trends GDP growth inflation recovery tourism IT sector"
        )
        
        system_prompt = f""""You are an expert economic analyst. Use the CONTEXT below for {location}.
You must be BRUTAL and risk-adjusted:
- Prioritize downside risks, fragility, and execution barriers.
- Penalize sectors dependent on local demand, seasonal volatility, regulation, or import constraints.
- Use 25th–50th percentile outcomes (not best case).
- Include a 'worst_case_12mo' field and a 'confidence' 0–1.

Return ONLY valid JSON:
{{
  "economic_health_score": number 1-10 (risk-adjusted, pessimistic),
  "key_trends": [4-5 bullets, brutally realistic],
  "growth_opportunities": [top 3, export-weighted],
  "major_risks": [top 3, concrete],
  "sector_performance": {{"IT": n, "tourism": n, "construction": n}},
  "worst_case_12mo": "short narrative",
  "confidence": number 0-1,
  "overall_outlook": "positive" | "neutral" | "negative"
}}

CONTEXT:
{context}

Analyze the economic situation and return a valid JSON response with:
- economic_health_score: number 1-10
- key_trends: array of 4-5 main economic trends
- growth_opportunities: array of top 3 opportunities
- major_risks: array of top 3 risks
- sector_performance: object with IT, tourism, construction scores
- overall_outlook: "positive", "neutral", or "negative"

Return ONLY valid JSON, no additional text."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Analyze current economic situation for {location}")
        ]
        
        try:
            response = await self.llm.ainvoke(messages)
            content = response.content.strip()
            
            # Try to extract JSON from response
            if '{' in content:
                start = content.find('{')
                end = content.rfind('}') + 1
                json_str = content[start:end]
                return json.loads(json_str)
            else:
                # Fallback if JSON parsing fails
                return {
                    "economic_health_score": 7.5,
                    "key_trends": ["GDP recovery", "Tourism rebound", "IT sector growth"],
                    "growth_opportunities": ["Digital services", "Export growth", "Infrastructure"],
                    "major_risks": ["Global uncertainty", "Skilled labor shortage", "Infrastructure gaps"],
                    "sector_performance": {"IT": 8, "tourism": 7, "construction": 6},
                    "overall_outlook": "positive"
                }
                
        except Exception as e:
            print(f"Economic analysis error: {e}")
            return {
                "economic_health_score": 7.0,
                "key_trends": ["Economic recovery in progress"],
                "analysis_note": f"Analysis error: {str(e)}",
                "location": location
            }

class BusinessAnalysisAgent:
    def __init__(self, llm, rag_retriever: RAGRetriever):
        self.llm = llm
        self.rag_retriever = rag_retriever
        self.name = "Business Analysis Expert"

    async def analyze_business_opportunities(self, location: str) -> Dict:
        """Analyze both tech and non-tech business opportunities with economic backing"""
        
        context = self.rag_retriever.retrieve_context(
            f"{location} business opportunities tourism agriculture healthcare education logistics manufacturing economic drivers"
        )
        
        system_prompt = f"""You are a comprehensive business opportunity analyst. Be BRUTAL.
Rules:
- Score opportunity at 25th–50th percentile revenue and margin.
- Heavily penalize: regulatory delay, capex intensity, supply/logistics fragility, dependence on local demand, seasonality, saturated niches.
- Reward: exportability, USD revenue, low CAC, fast payback <12 mo.
- Require 'why_it_fails' and 'hard_constraints' fields.
- Output 'export_revenue_share' (%) and 'brutal_score' (0–100).

Return valid JSON:
{{
  "business_opportunities": [
    {{
      "name": "...",
      "category": "Pure Tech" | "Tech Fusion" | "Traditional Non-Tech" | "Tech-Enabled Traditional",
      "market_demand": "Very High"|"High"|"Medium"|"Low",
      "competition_level": "Very High"|"High"|"Medium"|"Low",
      "setup_feasibility": "High"|"Medium"|"Low",
      "growth_potential": 1-10,
      "investment_required": "Low (<LKR 1M)"|"Medium (LKR 1-5M)"|"High (>LKR 5M)",
      "revenue_potential": "LKR X–Y/month (25th–50th percentile)",
      "economic_backing": "specific",
      "export_revenue_share": 0-100,
      "key_success_factors": ["..."],
      "why_it_fails": ["top 3 failure modes"],
      "hard_constraints": ["permits", "capex", "talent", "logistics", as applicable],
      "brutal_score": 0-100
    }},
    ...
  ]
}}

CONTEXT:
{context}

Analyze ALL business opportunities for {location}, including both TECH and NON-TECH sectors.

Categories to analyze:

1. TECH BUSINESSES:
- Software development/export
- Digital marketing agencies  
- Cloud/IT consulting
- Cybersecurity services
- AI consulting/implementation

2. TECH-FUSION BUSINESSES:
- AI-powered healthcare solutions
- AgriTech with IoT/sensors
- FinTech platforms
- EdTech platforms
- Tourism tech solutions

3. NON-TECH TRADITIONAL BUSINESSES:
- Tourism & hospitality services
- Food & beverage (restaurants, food processing)
- Healthcare services (clinics, elderly care)
- Education & training institutes
- Import/export trading
- Logistics & supply chain
- Agriculture & value-addition
- Renewable energy services
- Retail & distribution
- Real estate services

4. HYBRID BUSINESSES (Tech-enabled traditional):
- E-commerce platforms for local products
- Digital marketing for traditional businesses
- Online education/training
- Food delivery platforms
- Logistics optimization services

For each business, provide:
- category: "Pure Tech", "Tech Fusion", "Traditional Non-Tech", "Tech-Enabled Traditional"
- market_demand: "Very High", "High", "Medium", "Low"
- competition_level: "Very High", "High", "Medium", "Low"
- setup_feasibility: "High", "Medium", "Low" 
- growth_potential: 1-10 scale
- investment_required: "Low (<LKR 1M)", "Medium (LKR 1-5M)", "High (>LKR 5M)"
- economic_backing: specific economic factors supporting this business
- revenue_potential: monthly range in LKR
- key_success_factors: array of 3-4 factors

Return valid JSON with business_opportunities array containing ALL categories."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Analyze comprehensive business opportunities for {location} including tech and non-tech sectors")
        ]
        
        try:
            response = await self.llm.ainvoke(messages)
            content = response.content.strip()
            
            if '{' in content:
                start = content.find('{')
                end = content.rfind('}') + 1
                json_str = content[start:end]
                return json.loads(json_str)
            else:
                # Enhanced fallback data with non-tech businesses
                return {
                    "business_opportunities": [
                        {
                            "name": "Tourism & Hospitality Services",
                            "category": "Traditional Non-Tech",
                            "market_demand": "Very High",
                            "competition_level": "Medium",
                            "setup_feasibility": "Medium",
                            "growth_potential": 8,
                            "investment_required": "Medium (LKR 2-5M)",
                            "economic_backing": "Government targeting 2.3M tourists by 2025, infrastructure investments",
                            "revenue_potential": "LKR 200K-1.5M/month",
                            "key_success_factors": ["Location", "Service quality", "Digital presence", "Cultural authenticity"]
                        },
                        {
                            "name": "Food Processing & Export",
                            "category": "Traditional Non-Tech", 
                            "market_demand": "High",
                            "competition_level": "Medium",
                            "setup_feasibility": "Medium",
                            "growth_potential": 7,
                            "investment_required": "Medium (LKR 3-8M)",
                            "economic_backing": "Food exports up 28%, specialty tea/spices demand, export incentives",
                            "revenue_potential": "LKR 300K-2M/month",
                            "key_success_factors": ["Quality certifications", "Export markets", "Supply chain", "Branding"]
                        },
                        {
                            "name": "Healthcare Services",
                            "category": "Traditional Non-Tech",
                            "market_demand": "Very High", 
                            "competition_level": "Medium",
                            "setup_feasibility": "High",
                            "growth_potential": 8,
                            "investment_required": "High (LKR 5-15M)",
                            "economic_backing": "Aging population, medical tourism recovery, insurance expansion",
                            "revenue_potential": "LKR 400K-3M/month",
                            "key_success_factors": ["Medical expertise", "Equipment", "Insurance partnerships", "Location"]
                        }
                    ]
                }
                
        except Exception as e:
            print(f"Business analysis error: {e}")
            return {"business_opportunities": [], "error": str(e)}

class JobMarketAgent:
    def __init__(self, llm, rag_retriever: RAGRetriever):
        self.llm = llm
        self.rag_retriever = rag_retriever
        self.name = "Job Market Expert"

    async def analyze_job_market(self, location: str) -> Dict:
        """Enhanced job market analysis with cybersecurity and AI automation factors"""
        
        context = self.rag_retriever.retrieve_context(
            f"{location} job market software engineer data scientist AI specialist cloud engineer cybersecurity automation risk"
        )
        
        target_roles = [
            "Software Engineer",
            "Data Scientist", 
            "AI/ML Specialist",
            "Cloud Engineer",
            "Cybersecurity Specialist"
        ]
        
        system_prompt = f"""You are a job market analyst. Be BRUTAL and pessimistic.
- Use salary bands at 25th–75th percentile (not top offers).
- Explicitly penalize junior roles and roles exposed to AI automation.
- Add 'go_to_market_path' and 'kill_criteria_90_days' per role.

Return valid JSON:
{{
  "job_roles": [
    {{
      "role": "...",
      "demand_level": "...",
      "market_outlook": "...",
      "local_salary_range": "LKR a–b/month (25th–75th)",
      "remote_potential": "USD a–b/month (25th–75th)",
      "market_saturation": "Low"|"Medium"|"High",
      "ai_automation_risk": "Low"|"Medium"|"High",
      "top_niches": ["..."],
      "skills_in_demand": ["..."],
      "career_growth": "short narrative",
      "go_to_market_path": ["first 3 client types, channels"],
      "kill_criteria_90_days": ["objective cutoffs to abandon"]
    }}
  ]
}}

CONTEXT:
{context}

Analyze job market for {location} focusing on these roles: {', '.join(target_roles)}

For each role, provide:
- demand_level: "Very High", "High", "Medium", "Low"
- market_outlook: "Excellent", "Very Good", "Good", "Challenging" 
- local_salary_range: "LKR X-Y/month"
- remote_potential: "USD X-Y/month"
- market_saturation: "Low", "Medium", "High"
- ai_automation_risk: "Low", "Medium", "High"
- top_niches: array of 3-4 specializations
- skills_in_demand: array of key skills
- career_growth: growth trajectory description

Special focus on:
- Cybersecurity: SOC analyst, penetration tester, security architect paths
- Cloud Engineering: AWS/Azure/GCP specializations, DevOps integration
- AI automation impact on each role
- Market saturation levels

Return valid JSON with job_roles array only."""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Analyze job market for {', '.join(target_roles)} in {location}")
        ]
        
        try:
            response = await self.llm.ainvoke(messages)
            content = response.content.strip()
            
            if '{' in content:
                start = content.find('{')
                end = content.rfind('}') + 1
                json_str = content[start:end]
                return json.loads(json_str)
            else:
                # Fallback data
                return {
                    "job_roles": [
                        {
                            "role": "Cybersecurity Specialist",
                            "demand_level": "Very High",
                            "market_outlook": "Excellent",
                            "local_salary_range": "LKR 1.4M-2.9M/month",
                            "ai_automation_risk": "Low"
                        }
                    ]
                }
                
        except Exception as e:
            print(f"Job market analysis error: {e}")
            return {"job_roles": [], "error": str(e)}

class WorkflowOrchestrator:
    def __init__(self, ollama_host: str = "http://localhost:11434", model_name: str = "qwen3:8b"):
        print(f"Initializing with model: {model_name}")
        
        # Initialize HTTP-based LLM client  
        self.llm = OllamaHTTPClient(model_name, ollama_host)
        
        # Test connection
        print("Testing Ollama connection...")
        if not self.llm.test_connection():
            raise ConnectionError(f"Cannot connect to Ollama at {ollama_host}. Make sure it's running!")
            
        # Check if model is available
        available_models = self.llm.list_models()
        if not any(model_name in model for model in available_models):
            # Try alternative model names
            alt_names = ["qwen3:8b", "qwen3:8b", "qwen3", "qwen3"]
            found_model = None
            for alt in alt_names:
                if any(alt in model for model in available_models):
                    found_model = alt
                    break
            
            if found_model:
                print(f"Using alternative model: {found_model}")
                self.llm.model_name = found_model
            else:
                raise ValueError(f"No suitable model found. Available: {available_models}")
        
        print(f"✓ Using model: {self.llm.model_name}")
        
        # Initialize RAG retriever
        self.rag_retriever = RAGRetriever()
        
        # Initialize agents with RAG
        self.news_agent = EconomicNewsAgent(self.llm, self.rag_retriever)
        self.business_agent = BusinessAnalysisAgent(self.llm, self.rag_retriever)
        self.job_agent = JobMarketAgent(self.llm, self.rag_retriever)
    
    async def create_comprehensive_report(self, economic_data: Dict, business_data: Dict, job_data: Dict, location: str) -> str:
        """Create final comprehensive report with all tables including non-tech businesses"""
        
        system_prompt = f"""You are an expert economic strategist. Produce a BRUTAL markdown report for {location}.
Requirements:
- Rank tables by 'brutal_score' (if present) else by growth minus risk.
- Add a 'BRUTAL REALITY' section with top 5 failure patterns and execution hazards.
- Include 'Go/No-Go' per opportunity, plus 'Prerequisites' and 'Kill Criteria'.
- Prefer exportable, USD-earning, low-CAC, low-capex plays.

Sections (same as before) PLUS:
10. **BRUTAL REALITY (Failure Patterns & Hazards)**
11. **GO/NO-GO + KILL CRITERIA TABLE**

Use concise language; assume pessimistic baselines.

Create a well-structured markdown report with these sections:

1. **EXECUTIVE SUMMARY** - Key insights and overall economic outlook

2. **TECH BUSINESS OPPORTUNITIES TABLE** (ranked best to worst by overall score)
   | Business | Category | Demand | Competition | Growth (1-10) | Investment | Revenue/Month | Economic Backing |

3. **NON-TECH BUSINESS OPPORTUNITIES TABLE** (ranked best to worst by overall score)  
   | Business | Category | Demand | Competition | Growth (1-10) | Investment | Revenue/Month | Economic Backing |

4. **TECH-ENABLED TRADITIONAL BUSINESS TABLE** (hybrid opportunities)
   | Business | Traditional Base | Tech Enhancement | Market Size | Growth Potential | Key Advantages |

5. **JOB MARKET ANALYSIS TABLE** (ranked by opportunity score)
   | Role | Demand | Outlook | Local Salary | AI Risk | Market Saturation | Top Specializations |

6. **ECONOMIC BACKING ANALYSIS TABLE** (government/economic support for each sector)
   | Sector | Economic Driver | Government Support | Market Size | Growth Rate | Investment Incentives |

7. **INVESTMENT REQUIREMENT COMPARISON TABLE** (by capital needed)
   | Investment Level | Tech Businesses | Non-Tech Businesses | Hybrid Opportunities | ROI Timeline |

8. **MARKET SATURATION VS OPPORTUNITY MATRIX** 
   | Business Type | Market Saturation | Entry Difficulty | Competition Level | Opportunity Score |

9. **TOP STRATEGIC RECOMMENDATIONS** 
   - Best 3 tech businesses with rationale
   - Best 3 non-tech businesses with rationale  
   - Best 3 hybrid opportunities with rationale
   - Risk mitigation strategies

Focus on:
- Economic factors backing each opportunity (tourism recovery, export growth, demographic changes, etc.)
- Government policies and incentives
- Market size and growth projections
- Investment requirements and ROI potential
- Practical steps for implementation

Format all tables in proper markdown. Rank everything from BEST opportunities at TOP to lowest at BOTTOM.
Include specific economic data and backing factors for {location}.
"""
        
        data_summary = f"""
ECONOMIC DATA: {json.dumps(economic_data)}
BUSINESS DATA: {json.dumps(business_data)}  
JOB DATA: {json.dumps(job_data)}
"""
        
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=data_summary)
        ]
        
        try:
            response = await self.llm.ainvoke(messages)
            return response.content
        except Exception as e:
            return f"# Analysis Report Generation Error\n\nError: {str(e)}\n\nRaw data available for manual analysis."
    
    async def run_analysis(self, location: str) -> Dict:
        """Run comprehensive economic analysis"""
        print(f"🚀 Starting comprehensive analysis for {location}")
        print("📊 Using RAG-enhanced local Llama model")
        
        state = {
            "location": location,
            "economic_news": {},
            "business_data": {},
            "job_market_analysis": {},
            "final_report": {},
            "errors": []
        }
        
        try:
            # Step 1: Economic Analysis
            print("📈 Analyzing economic trends...")
            state["economic_news"] = await self.news_agent.analyze_local_news(location)
            print("✓ Economic analysis complete")
            
            # Step 2: Business Analysis  
            print("🏢 Analyzing comprehensive business opportunities...")
            state["business_data"] = await self.business_agent.analyze_business_opportunities(location)
            print("✓ Tech and non-tech business analysis complete")
            
            # Step 3: Job Market Analysis
            print("💼 Analyzing job market...")
            state["job_market_analysis"] = await self.job_agent.analyze_job_market(location)
            print("✓ Job market analysis complete")
            
            # Step 4: Comprehensive Report
            print("📋 Creating comprehensive report...")
            comprehensive_report = await self.create_comprehensive_report(
                state["economic_news"], 
                state["business_data"],
                state["job_market_analysis"], 
                location
            )
            
            state["final_report"] = {
                "location": location,
                "analysis_date": datetime.now().isoformat(),
                "comprehensive_analysis": comprehensive_report,
                "powered_by": "RAG + Llama 3.1 8B Local",
                "data_sources": "Sri Lanka economic data 2024-2025"
            }
            
            print("✅ Analysis complete!")
            
        except Exception as e:
            error_msg = f"Analysis error: {str(e)}"
            print(f"❌ {error_msg}")
            state["errors"].append(error_msg)
        
        return {
            "success": len(state["errors"]) == 0,
            "location": location,
            "report": state["final_report"],
            "errors": state["errors"],
            "execution_time": datetime.now().isoformat()
        }

async def quick_connection_test():
    """Test Ollama connection and model availability"""
    print("🔍 Testing Ollama connection...")
    
    try:
        client = OllamaHTTPClient()
        
        if client.test_connection():
            print("✅ Ollama is accessible")
            models = client.list_models()
            print(f"📦 Available models: {models}")
            
            # Find suitable model
            suitable_models = [m for m in models if any(x in m.lower() for x in ['qwen3', 'qwen3', 'llama'])]
            
            if suitable_models:
                test_model = suitable_models[0]
                print(f"🧠 Testing model: {test_model}")
                
                client.model_name = test_model
                messages = [
                    SystemMessage("You are a helpful assistant."),
                    HumanMessage("Say hello in one sentence.")
                ]
                
                response = await client.ainvoke(messages)
                print(f"✅ Model test successful: {response.content[:100]}...")
                print("🎉 System ready for economic analysis!")
                return True
            else:
                print("❌ No suitable Llama model found.")
                print("💡 Try: ollama pull qwen3:8b")
                return False
        else:
            print("❌ Cannot connect to Ollama")
            print("💡 Start Ollama: ollama serve")
            return False
            
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False

async def main():
    """Main execution function"""
    print("="*60)
    print("🏛️  ENHANCED RAG ECONOMIC ANALYSIS SYSTEM")
    print("🤖 Powered by Local Llama 3.1 + Vector Retrieval")
    print("🇱🇰 Specialized for Sri Lankan Market Analysis")
    print("="*60)
    
    # Test connection first
    if not await quick_connection_test():
        print("\n❌ System prerequisites not met. Please fix Ollama setup.")
        return
    
    try:
        # Initialize workflow orchestrator
        workflow = WorkflowOrchestrator(
            ollama_host="http://localhost:11434",
            model_name="qwen3:8b"
        )
        
        # Analyze Colombo
        location = "Colombo, Sri Lanka"
        print(f"\n🎯 Target Location: {location}")
        
        result = await workflow.run_analysis(location)
        
        if result["success"]:
            print("\n" + "="*60)
            print("📊 ANALYSIS RESULTS")
            print("="*60)
            print(result["report"]["comprehensive_analysis"])
            
            # Save report
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"enhanced_economic_analysis_{timestamp}.md"
            
            with open(filename, "w", encoding="utf-8") as f:
                f.write(f"# Enhanced Economic Analysis: {location}\n\n")
                f.write(f"**Generated:** {result['execution_time']}\n")
                f.write(f"**System:** {result['report']['powered_by']}\n\n")
                f.write("---\n\n")
                f.write(result["report"]["comprehensive_analysis"])
            
            print(f"\n💾 Report saved: {filename}")
        else:
            print("\n❌ Analysis failed:")
            for error in result["errors"]:
                print(f"   - {error}")
                
    except ConnectionError as e:
        print(f"\n🔌 Connection Error: {e}")
        print("\n🔧 Troubleshooting steps:")
        print("   1. Start Ollama: ollama serve")
        print("   2. Check http://localhost:11434 in browser") 
        print("   3. Verify firewall/antivirus settings")
        
    except ValueError as e:
        print(f"\n🤖 Model Error: {e}")
        print("   💡 Download model: ollama pull qwen3:8b")
        
    except Exception as e:
        print(f"\n💥 System Error: {e}")
        print("   🔍 Check logs for details")

if __name__ == "__main__":
    print("🚀 Starting Enhanced RAG Economic Analysis...")
    asyncio.run(main())

# Installation & Setup Instructions
"""
QUICK SETUP GUIDE:
==================

1. INSTALL OLLAMA:
   - Windows: Download from https://ollama.ai/download/windows
   - macOS: Download from https://ollama.ai/download/mac
   - Linux: curl -fsSL https://ollama.ai/install.sh | sh

2. START OLLAMA SERVICE:
   - Open command prompt/terminal
   - Run: ollama serve
   - Verify at http://localhost:11434

3. DOWNLOAD AI MODEL:
   - Run: ollama pull qwen3:8b
   - Alternative: ollama pull qwen3:8b
   - Wait for download to complete

4. INSTALL PYTHON DEPENDENCIES:
   pip install aiohttp python-dotenv requests

5. RUN THE ANALYSIS:
   python enhanced_analysis.py

KEY FEATURES:
=============
✅ Enhanced RAG system with Sri Lankan economic data
✅ 5 job roles including cybersecurity specialist  
✅ AI automation risk assessment for each role
✅ Market saturation analysis
✅ Tech AND Non-Tech business opportunities
✅ Economic backing analysis for all sectors
✅ Tourism, healthcare, agriculture, food & beverage sectors
✅ Tech-enabled traditional business hybrids
✅ Investment requirement analysis
✅ Government policy and incentive tracking
✅ Comprehensive tables ranked by opportunity
✅ Local Llama 3.1 model (no API costs)
✅ Direct HTTP communication (no complex dependencies)

FIXES APPLIED:
==============
🔧 Fixed JSON parsing with proper error handling
🔧 Enhanced model detection (tries multiple model names)
🔧 Added connection testing and diagnostics
🔧 Improved timeout handling for large responses
🔧 Better error messages and troubleshooting
🔧 Added cybersecurity as 5th core job role
🔧 Enhanced RAG data with AI automation impact
🔧 Added fusion business opportunities
🔧 Multiple ranking tables for different aspects

TROUBLESHOOTING:
===============
- Connection fails → Check 'ollama serve' is running
- Model not found → Try 'ollama pull qwen3:8b'
- Timeout errors → Model needs more time, increase timeout
- JSON errors → Fallback data provided automatically
- Port issues → Check firewall/antivirus blocking port 11434

The system now includes comprehensive analysis of:
- Traditional tech businesses
- Fusion opportunities (AI + Cybersecurity, Cloud + Fintech, etc.)
- AI automation impact on each job role
- Market saturation levels
- Cybersecurity as a core specialization
- Enhanced ranking tables for better decision making
"""