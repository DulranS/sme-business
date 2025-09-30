import requests
import json
import pandas as pd
from datetime import datetime, timedelta
import time
import os
from typing import Dict, List, Optional, Tuple
import logging
from collections import deque
import threading
import numpy as np
from pathlib import Path
import sqlite3
import hashlib
from dataclasses import dataclass
import re

# Try to import additional packages for RAG functionality
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("sentence-transformers not available. Install with: pip install sentence-transformers")

try:
    import chromadb
    from chromadb.config import Settings
    CHROMADB_AVAILABLE = True
except ImportError:
    CHROMADB_AVAILABLE = False
    print("chromadb not available. Install with: pip install chromadb")

# Try to import dotenv, but don't fail if it's not available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    print("python-dotenv not installed. Please set environment variables manually if needed.")

@dataclass
class LandParcel:
    """Data class for land parcel information"""
    location: str
    district: str
    province: str
    area_acres: float
    price_per_acre: float
    total_price: float
    proximity_to_attractions: List[str]
    accessibility: str
    zoning: str
    utilities: List[str]
    strategic_advantages: List[str]
    coordinates: Optional[Tuple[float, float]] = None
    elevation: Optional[float] = None
    soil_type: Optional[str] = None
    water_access: Optional[str] = None
    legal_status: str = "clear"
    development_potential: int = 0  # 1-10 score

class RateLimiter:
    """
    Rate limiter for API calls (keeping for potential future API integrations)
    """
    def __init__(self, requests_per_minute: int = 60, requests_per_day: int = 1000):
        self.requests_per_minute = requests_per_minute
        self.requests_per_day = requests_per_day
        self.minute_requests = deque()
        self.daily_requests = deque()
        self.lock = threading.Lock()
        
    def wait_if_needed(self):
        """Wait if necessary to respect rate limits"""
        with self.lock:
            now = datetime.now()
            
            # Clean old requests from tracking
            minute_ago = now - timedelta(minutes=1)
            while self.minute_requests and self.minute_requests[0] < minute_ago:
                self.minute_requests.popleft()
                
            day_ago = now - timedelta(days=1)
            while self.daily_requests and self.daily_requests[0] < day_ago:
                self.daily_requests.popleft()
            
            # Check daily limit
            if len(self.daily_requests) >= self.requests_per_day:
                raise Exception(f"Daily API limit reached ({self.requests_per_day} requests). Please try again tomorrow.")
            
            # Check minute limit and wait if needed
            if len(self.minute_requests) >= self.requests_per_minute:
                # Need to wait until oldest request is > 1 minute old
                oldest_request = self.minute_requests[0]
                wait_until = oldest_request + timedelta(minutes=1, seconds=1)
                wait_time = (wait_until - now).total_seconds()
                
                if wait_time > 0:
                    print(f"Rate limit reached. Waiting {wait_time:.1f} seconds...")
                    time.sleep(wait_time)
            
            # Record this request
            self.minute_requests.append(now)
            self.daily_requests.append(now)

class LandDatabase:
    """
    SQLite database for storing and managing land parcel data
    """
    def __init__(self, db_path: str = "sri_lanka_lands.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize the SQLite database with land parcels table"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS land_parcels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location TEXT NOT NULL,
            district TEXT NOT NULL,
            province TEXT NOT NULL,
            area_acres REAL NOT NULL,
            price_per_acre REAL NOT NULL,
            total_price REAL NOT NULL,
            proximity_to_attractions TEXT,
            accessibility TEXT,
            zoning TEXT,
            utilities TEXT,
            strategic_advantages TEXT,
            coordinates_lat REAL,
            coordinates_lng REAL,
            elevation REAL,
            soil_type TEXT,
            water_access TEXT,
            legal_status TEXT,
            development_potential INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS land_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            land_parcel_id INTEGER,
            analysis_type TEXT,
            analysis_content TEXT,
            embedding_hash TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (land_parcel_id) REFERENCES land_parcels (id)
        )
        ''')
        
        conn.commit()
        conn.close()
    
    def insert_land_parcel(self, parcel: LandParcel) -> int:
        """Insert a new land parcel into the database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
        INSERT INTO land_parcels (
            location, district, province, area_acres, price_per_acre, total_price,
            proximity_to_attractions, accessibility, zoning, utilities, strategic_advantages,
            coordinates_lat, coordinates_lng, elevation, soil_type, water_access,
            legal_status, development_potential
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            parcel.location, parcel.district, parcel.province, parcel.area_acres,
            parcel.price_per_acre, parcel.total_price, json.dumps(parcel.proximity_to_attractions),
            parcel.accessibility, parcel.zoning, json.dumps(parcel.utilities),
            json.dumps(parcel.strategic_advantages),
            parcel.coordinates[0] if parcel.coordinates else None,
            parcel.coordinates[1] if parcel.coordinates else None,
            parcel.elevation, parcel.soil_type, parcel.water_access,
            parcel.legal_status, parcel.development_potential
        ))
        
        land_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return land_id
    
    def get_all_parcels(self) -> List[LandParcel]:
        """Retrieve all land parcels from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM land_parcels')
        rows = cursor.fetchall()
        
        parcels = []
        for row in rows:
            coordinates = None
            if row[12] is not None and row[13] is not None:
                coordinates = (row[12], row[13])
            
            parcel = LandParcel(
                location=row[1],
                district=row[2],
                province=row[3],
                area_acres=row[4],
                price_per_acre=row[5],
                total_price=row[6],
                proximity_to_attractions=json.loads(row[7]) if row[7] else [],
                accessibility=row[8],
                zoning=row[9],
                utilities=json.loads(row[10]) if row[10] else [],
                strategic_advantages=json.loads(row[11]) if row[11] else [],
                coordinates=coordinates,
                elevation=row[14],
                soil_type=row[15],
                water_access=row[16],
                legal_status=row[17],
                development_potential=row[18]
            )
            parcels.append(parcel)
        
        conn.close()
        return parcels
    
    def search_parcels(self, filters: Dict) -> List[LandParcel]:
        """Search land parcels with filters"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = "SELECT * FROM land_parcels WHERE 1=1"
        params = []
        
        if "max_price" in filters:
            query += " AND total_price <= ?"
            params.append(filters["max_price"])
        
        if "min_area" in filters:
            query += " AND area_acres >= ?"
            params.append(filters["min_area"])
        
        if "district" in filters:
            query += " AND district = ?"
            params.append(filters["district"])
        
        if "min_development_potential" in filters:
            query += " AND development_potential >= ?"
            params.append(filters["min_development_potential"])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Convert rows to LandParcel objects (similar to get_all_parcels)
        parcels = []
        for row in rows:
            coordinates = None
            if row[12] is not None and row[13] is not None:
                coordinates = (row[12], row[13])
            
            parcel = LandParcel(
                location=row[1],
                district=row[2],
                province=row[3],
                area_acres=row[4],
                price_per_acre=row[5],
                total_price=row[6],
                proximity_to_attractions=json.loads(row[7]) if row[7] else [],
                accessibility=row[8],
                zoning=row[9],
                utilities=json.loads(row[10]) if row[10] else [],
                strategic_advantages=json.loads(row[11]) if row[11] else [],
                coordinates=coordinates,
                elevation=row[14],
                soil_type=row[15],
                water_access=row[16],
                legal_status=row[17],
                development_potential=row[18]
            )
            parcels.append(parcel)
        
        conn.close()
        return parcels

class RAGSystem:
    """
    RAG (Retrieval-Augmented Generation) system for land and real estate knowledge
    """
    def __init__(self, vector_db_path: str = "./rag_db", embedding_model: str = "all-MiniLM-L6-v2"):
        self.vector_db_path = vector_db_path
        self.embedding_model_name = embedding_model
        
        # Initialize embedding model
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self.embedding_model = SentenceTransformer(embedding_model)
                print(f"✅ Loaded embedding model: {embedding_model}")
            except Exception as e:
                print(f"❌ Failed to load embedding model: {e}")
                self.embedding_model = None
        else:
            self.embedding_model = None
            print("⚠️  Sentence transformers not available - RAG features will be limited")
        
        # Initialize vector database
        if CHROMADB_AVAILABLE and self.embedding_model:
            try:
                self.client = chromadb.PersistentClient(path=vector_db_path)
                self.collection = self.client.get_or_create_collection(
                    name="sri_lanka_real_estate",
                    metadata={"hnsw:space": "cosine"}
                )
                print(f"✅ Vector database initialized at: {vector_db_path}")
            except Exception as e:
                print(f"❌ Failed to initialize vector database: {e}")
                self.client = None
                self.collection = None
        else:
            self.client = None
            self.collection = None
    
    def add_document(self, doc_id: str, text: str, metadata: Dict = None):
        """Add a document to the RAG system"""
        if not self.collection or not self.embedding_model:
            return False
        
        try:
            embedding = self.embedding_model.encode([text])[0].tolist()
            self.collection.add(
                ids=[doc_id],
                embeddings=[embedding],
                documents=[text],
                metadatas=[metadata or {}]
            )
            return True
        except Exception as e:
            print(f"Error adding document: {e}")
            return False
    
    def search_similar(self, query: str, n_results: int = 5) -> List[Dict]:
        """Search for similar documents"""
        if not self.collection or not self.embedding_model:
            return []
        
        try:
            query_embedding = self.embedding_model.encode([query])[0].tolist()
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results
            )
            
            similar_docs = []
            for i, doc in enumerate(results['documents'][0]):
                similar_docs.append({
                    'id': results['ids'][0][i],
                    'document': doc,
                    'distance': results['distances'][0][i] if 'distances' in results else 0.0,
                    'metadata': results['metadatas'][0][i] if results['metadatas'][0] else {}
                })
            
            return similar_docs
        except Exception as e:
            print(f"Error searching documents: {e}")
            return []
    
    def populate_knowledge_base(self):
        """Populate the knowledge base with Sri Lanka real estate information"""
        knowledge_documents = [
            {
                "id": "location_ella_strategic",
                "text": "Ella is a strategic location for real estate development due to its position on the Badulla-Kandy railway line, proximity to Nine Arch Bridge (major tourist attraction), elevation of 1,041m providing cool climate, and excellent accessibility via A23 highway. Land prices range from $15,000-25,000 per acre. Strategic advantages include: tourism hub status, railway connectivity, mountain views, established infrastructure, and growing backpacker market. Best suited for eco-lodges, boutique hotels, and mountain retreats.",
                "metadata": {"location": "Ella", "type": "strategic_analysis", "category": "tourism_real_estate"}
            },
            {
                "id": "location_sigiriya_investment",
                "text": "Sigiriya offers exceptional real estate investment opportunities due to its UNESCO World Heritage status, positioning as the 'Lion Rock' cultural triangle hub, and strategic location between Dambulla and Habarana. Land prices: $10,000-18,000 per acre. Strategic advantages: international tourist destination, archaeological significance, government tourism development zone, excellent road connectivity via A6 highway, proximity to Minneriya National Park. Ideal for cultural tourism accommodations, heritage hotels, and safari lodges.",
                "metadata": {"location": "Sigiriya", "type": "investment_analysis", "category": "cultural_tourism"}
            },
            {
                "id": "location_arugam_bay_surf",
                "text": "Arugam Bay is strategically positioned as South Asia's premier surf destination with year-round waves, international surf competitions, and growing digital nomad community. Land prices: $8,000-15,000 per acre. Strategic advantages: world-class surf breaks, beachfront access, international airport development plans for nearby Mattala, A4 highway connectivity, surfing season overlap with European winter. Perfect for surf resorts, beach hostels, and co-working spaces.",
                "metadata": {"location": "Arugam Bay", "type": "surf_tourism", "category": "beach_real_estate"}
            },
            {
                "id": "kandy_cultural_capital",
                "text": "Kandy, the cultural capital, offers premium real estate opportunities due to its UNESCO status, Temple of the Tooth, central location, and excellent connectivity. Land prices: $20,000-35,000 per acre in prime areas. Strategic advantages: year-round tourism, cultural significance, transportation hub, established luxury market, mountain setting, Lake Kandy waterfront. Suitable for luxury hotels, cultural centers, and heritage properties.",
                "metadata": {"location": "Kandy", "type": "cultural_capital", "category": "luxury_real_estate"}
            },
            {
                "id": "galle_fort_colonial",
                "text": "Galle Fort area represents premium colonial real estate with UNESCO World Heritage protection, strategic southern coast position, and established luxury tourism market. Land prices: $25,000-50,000 per acre within fort vicinity. Strategic advantages: colonial architecture preservation, boutique hotel market, international cuisine scene, art galleries, cricket stadium proximity, highway connectivity to Colombo. Ideal for heritage hotels, luxury villas, and cultural properties.",
                "metadata": {"location": "Galle", "type": "heritage_luxury", "category": "colonial_real_estate"}
            },
            {
                "id": "nuwara_eliya_hill_country",
                "text": "Nuwara Eliya offers unique hill country real estate opportunities with British colonial heritage, tea plantation landscape, and cool climate appeal. Land prices: $12,000-22,000 per acre. Strategic advantages: year-round pleasant climate, tea tourism, colonial architecture, horton plains proximity, vegetable farming potential, weekend getaway market from Colombo. Perfect for tea bungalows, hill country resorts, and agro-tourism ventures.",
                "metadata": {"location": "Nuwara Eliya", "type": "hill_country", "category": "plantation_tourism"}
            },
            {
                "id": "trincomalee_eastern_coast",
                "text": "Trincomalee offers emerging real estate opportunities on Sri Lanka's pristine eastern coast with natural harbor, whale watching, diving sites, and underdeveloped beach tourism. Land prices: $6,000-12,000 per acre. Strategic advantages: natural deep harbor, pristine beaches, whale migration route, cultural diversity, lower competition, government development focus, A6 highway access. Suitable for beach resorts, diving centers, and eco-tourism projects.",
                "metadata": {"location": "Trincomalee", "type": "emerging_destination", "category": "marine_tourism"}
            },
            {
                "id": "negombo_airport_proximity",
                "text": "Negombo provides strategic real estate investment due to its proximity to Bandaranaike International Airport, making it the first stop for most tourists. Land prices: $18,000-30,000 per acre near beach. Strategic advantages: airport accessibility, beach tourism, fishing culture, established hotel market, transit hub status, A3 highway connectivity. Ideal for transit hotels, beach resorts, and airport-related commercial developments.",
                "metadata": {"location": "Negombo", "type": "airport_gateway", "category": "transit_tourism"}
            },
            {
                "id": "legal_land_acquisition_srilanka",
                "text": "Sri Lanka land acquisition for foreigners requires incorporation of a local company with majority Sri Lankan ownership (51% minimum). Freehold land ownership by foreigners is restricted, but long-term leases (99 years) are possible. Legal requirements: BOI approval for tourism projects, environmental clearances, local council approvals, utility connections, and proper title verification. Legal costs typically 2-3% of property value. Always engage local legal counsel for due diligence.",
                "metadata": {"type": "legal_framework", "category": "foreign_investment"}
            },
            {
                "id": "tourism_infrastructure_development",
                "text": "Sri Lanka's tourism infrastructure is rapidly developing with government backing: new airports planned (Jaffna, expansion of Mattala), highway network expansion (Central Expressway, Ruwanpura Expressway), port developments, and tourism promotion zones. Investment incentives include tax holidays for tourism projects, BOI facilitation, infrastructure development grants, and fast-track approvals for qualified projects. Focus areas: sustainable tourism, cultural heritage preservation, and eco-tourism development.",
                "metadata": {"type": "infrastructure", "category": "government_development"}
            }
        ]
        
        if not self.collection:
            print("⚠️  Vector database not available - storing in memory only")
            return knowledge_documents
        
        for doc in knowledge_documents:
            success = self.add_document(doc["id"], doc["text"], doc["metadata"])
            if success:
                print(f"✅ Added: {doc['id']}")
            else:
                print(f"❌ Failed to add: {doc['id']}")
        
        return knowledge_documents
    
    def get_context_for_query(self, query: str, max_context_length: int = 2000) -> str:
        """Get relevant context for a query"""
        similar_docs = self.search_similar(query, n_results=3)
        
        if not similar_docs:
            return "No specific context found in knowledge base."
        
        context_parts = []
        current_length = 0
        
        for doc in similar_docs:
            doc_text = doc['document']
            if current_length + len(doc_text) > max_context_length:
                remaining_space = max_context_length - current_length
                if remaining_space > 100:  # Only add if there's meaningful space
                    context_parts.append(doc_text[:remaining_space] + "...")
                break
            context_parts.append(doc_text)
            current_length += len(doc_text)
        
        return "\n\n".join(context_parts)

class SriLankaRealEstateRAGAgent:
    """
    Enhanced AI Agent for Sri Lanka real estate analysis with RAG capabilities
    Uses local Ollama with Llama3:8b for AI processing
    """
    
    def __init__(self, 
                 ollama_base_url: str = "http://localhost:11434",
                 ollama_model: str = "llama3:8b",
                 db_path: str = "sri_lanka_real_estate.db",
                 vector_db_path: str = "./rag_db"):
        
        # Initialize components
        self.ollama_base_url = ollama_base_url
        self.ollama_model = ollama_model
        self.rate_limiter = RateLimiter()  # Keep for potential future use
        
        # Initialize database and RAG system
        self.land_db = LandDatabase(db_path)
        self.rag_system = RAGSystem(vector_db_path)
        
        # Test Ollama connection
        self._test_ollama_connection()
        
        # Setup logging
        logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
        self.logger = logging.getLogger(__name__)
        
        # Initialize knowledge base
        print("🔄 Initializing RAG knowledge base...")
        self.rag_system.populate_knowledge_base()
        
        # Load sample land data if database is empty
        self._initialize_sample_land_data()
        
        print("✅ Sri Lanka Real Estate RAG Agent initialized successfully!")
    
    def _test_ollama_connection(self):
        """Test connection to Ollama"""
        try:
            response = requests.get(f"{self.ollama_base_url}/api/tags", timeout=10)
            if response.status_code == 200:
                models = response.json().get('models', [])
                model_names = [model['name'] for model in models]
                if self.ollama_model in model_names:
                    print(f"✅ Connected to Ollama - Model {self.ollama_model} available")
                else:
                    print(f"⚠️  Model {self.ollama_model} not found. Available models: {model_names}")
                    print(f"Run: ollama pull {self.ollama_model}")
            else:
                raise Exception(f"Ollama responded with status: {response.status_code}")
        except Exception as e:
            print(f"❌ Failed to connect to Ollama: {e}")
            print("Make sure Ollama is running: ollama serve")
            print(f"And model is pulled: ollama pull {self.ollama_model}")
    
    def _initialize_sample_land_data(self):
        """Initialize sample land data if database is empty"""
        existing_parcels = self.land_db.get_all_parcels()
        if len(existing_parcels) > 0:
            print(f"📊 Database already contains {len(existing_parcels)} land parcels")
            return
        
        print("🔄 Initializing sample land data...")
        
        sample_lands = [
            LandParcel(
                location="Ella - Nine Arch Bridge Area",
                district="Badulla",
                province="Uva",
                area_acres=2.5,
                price_per_acre=20000,
                total_price=50000,
                proximity_to_attractions=["Nine Arch Bridge", "Little Adam's Peak", "Ella Rock"],
                accessibility="A23 Highway, Railway Station 1km",
                zoning="Tourism Development Zone",
                utilities=["Electricity", "Water", "Internet"],
                strategic_advantages=["Prime tourism location", "Railway connectivity", "Mountain views", "Cool climate"],
                coordinates=(6.8721, 81.0464),
                elevation=1041,
                soil_type="Red earth, well-drained",
                water_access="Natural springs, municipal supply",
                development_potential=9
            ),
            LandParcel(
                location="Sigiriya - Cultural Triangle",
                district="Matale",
                province="Central",
                area_acres=5.0,
                price_per_acre=15000,
                total_price=75000,
                proximity_to_attractions=["Sigiriya Rock", "Dambulla Cave Temple", "Minneriya National Park"],
                accessibility="A6 Highway, 3km from main road",
                zoning="Archaeological Heritage Zone",
                utilities=["Electricity", "Well water", "Mobile coverage"],
                strategic_advantages=["UNESCO proximity", "Safari tourism", "Cultural significance", "Government development zone"],
                coordinates=(7.9568, 80.7597),
                elevation=200,
                soil_type="Alluvial, fertile",
                water_access="Bore well, seasonal tank",
                development_potential=8
            ),
            LandParcel(
                location="Arugam Bay - Surf Point",
                district="Ampara",
                province="Eastern",
                area_acres=1.8,
                price_per_acre=12000,
                total_price=21600,
                proximity_to_attractions=["Main Point surf break", "Elephant Rock", "Kumana National Park"],
                accessibility="A4 Highway coastal road",
                zoning="Coastal Tourism Zone",
                utilities=["Solar power potential", "Bore well water", "4G coverage"],
                strategic_advantages=["World-class surfing", "Beachfront potential", "International surf community", "Growing nomad hub"],
                coordinates=(6.8402, 81.8344),
                elevation=5,
                soil_type="Sandy coastal, drainage good",
                water_access="Bore well, rainwater harvesting potential",
                development_potential=9
            ),
            LandParcel(
                location="Kandy Hills - Peradeniya",
                district="Kandy",
                province="Central",
                area_acres=3.2,
                price_per_acre=28000,
                total_price=89600,
                proximity_to_attractions=["Kandy City", "Botanical Gardens", "Temple of Tooth", "University"],
                accessibility="A1 Highway, city bus routes",
                zoning="Residential/Commercial Mixed",
                utilities=["Full utilities", "High-speed internet", "Gas supply"],
                strategic_advantages=["Cultural capital proximity", "University town", "Established luxury market", "Year-round tourism"],
                coordinates=(7.2496, 80.5906),
                elevation=465,
                soil_type="Hill country, terraced potential",
                water_access="Municipal supply, natural streams",
                development_potential=8
            ),
            LandParcel(
                location="Galle Fort Vicinity",
                district="Galle",
                province="Southern",
                area_acres=1.0,
                price_per_acre=45000,
                total_price=45000,
                proximity_to_attractions=["Galle Fort", "Unawatuna Beach", "Jungle Beach", "Cricket Stadium"],
                accessibility="Southern Expressway, A2 coastal road",
                zoning="Heritage Tourism Zone",
                utilities=["Full utilities", "High-speed fiber", "Premium services"],
                strategic_advantages=["UNESCO heritage", "Boutique hotel market", "International connectivity", "Established luxury tourism"],
                coordinates=(6.0329, 80.2168),
                elevation=15,
                soil_type="Coastal red earth",
                water_access="Municipal supply, well backup",
                development_potential=10
            ),
            LandParcel(
                location="Trincomalee - Uppuveli Beach",
                district="Trincomalee",
                province="Eastern",
                area_acres=4.5,
                price_per_acre=8000,
                total_price=36000,
                proximity_to_attractions=["Uppuveli Beach", "Koneswaram Temple", "Whale watching", "Hot Wells"],
                accessibility="A6 Highway, coastal access",
                zoning="Coastal Development Zone",
                utilities=["Electricity expanding", "Bore well", "Mobile coverage"],
                strategic_advantages=["Pristine beaches", "Emerging destination", "Low competition", "Whale watching hub", "Cultural diversity"],
                coordinates=(8.5874, 81.2152),
                elevation=10,
                soil_type="Sandy loam, coastal",
                water_access="Bore well, rainwater potential",
                development_potential=7
            )
        ]
        
        for parcel in sample_lands:
            parcel_id = self.land_db.insert_land_parcel(parcel)
            print(f"✅ Added land parcel: {parcel.location} (ID: {parcel_id})")
        
        print(f"📊 Initialized {len(sample_lands)} sample land parcels")
    
    def query_ollama(self, prompt: str, max_tokens: int = 2000) -> str:
        """
        Query Ollama local AI with a given prompt
        """
        try:
            data = {
                "model": self.ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "num_ctx": 4096,
                    "temperature": 0.7,
                    "num_predict": max_tokens
                }
            }
            
            response = requests.post(
                f"{self.ollama_base_url}/api/generate",
                json=data,
                timeout=120  # Longer timeout for local processing
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get('response', 'No response generated')
            else:
                self.logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                return f"Error: {response.status_code} - {response.text}"
                
        except Exception as e:
            self.logger.error(f"Error querying Ollama: {str(e)}")
            return f"Error: {str(e)}"
    
    def analyze_land_with_rag(self, location: str, investment_budget: float = None) -> Dict:
        """
        Analyze land potential using RAG-enhanced context
        """
        # Get relevant context from RAG system
        query = f"real estate investment opportunities strategic location {location} Sri Lanka tourism development"
        context = self.rag_system.get_context_for_query(query)
        
        # Search for matching land parcels in database
        parcels = self.land_db.search_parcels({"district": location.split()[0]}) if " " in location else []
        if not parcels:
            # Search by location name
            all_parcels = self.land_db.get_all_parcels()
            parcels = [p for p in all_parcels if location.lower() in p.location.lower()]
        
        parcel_info = ""
        if parcels:
            parcel_info = f"\n\nAvailable Land Parcels in {location}:\n"
            for i, parcel in enumerate(parcels[:3], 1):
                parcel_info += f"{i}. {parcel.location}: {parcel.area_acres} acres at ${parcel.price_per_acre:,}/acre (Total: ${parcel.total_price:,})\n"
                parcel_info += f"   Strategic advantages: {', '.join(parcel.strategic_advantages[:3])}\n"
                parcel_info += f"   Development potential: {parcel.development_potential}/10\n"
        
        budget_info = f"\nInvestment Budget: ${investment_budget:,}" if investment_budget else ""
        
        prompt = f"""
        As a Sri Lanka real estate investment expert, analyze the strategic potential of {location} for tourism-related real estate development.

        CONTEXT FROM KNOWLEDGE BASE:
        {context}

        AVAILABLE LAND DATA:
        {parcel_info}
        
        {budget_info}

        Please provide a comprehensive analysis covering:

        1. STRATEGIC LOCATION ADVANTAGES:
           - Why this location is strategically important
           - Tourism appeal and visitor demographics
           - Transportation and accessibility
           - Government development plans

        2. REAL ESTATE INVESTMENT POTENTIAL:
           - Current market conditions
           - Price trends and appreciation potential
           - Competition analysis
           - Market gaps and opportunities

        3. DEVELOPMENT RECOMMENDATIONS:
           - Best property types for this location
           - Target market segments
           - Recommended amenities and features
           - Optimal size and scale

        4. FINANCIAL PROJECTIONS:
           - Estimated development costs
           - Revenue potential
           - ROI timeline
           - Risk assessment

        5. IMPLEMENTATION STRATEGY:
           - Legal requirements and procedures
           - Timeline for development
           - Key partnerships needed
           - Marketing and positioning strategy

        Be specific with numbers, provide actionable insights, and highlight the strategic advantages that make this location compelling for real estate investment.
        """
        
        response = self.query_ollama(prompt)
        
        return {
            "location": location,
            "timestamp": datetime.now().isoformat(),
            "analysis_type": "rag_enhanced_land_analysis",
            "available_parcels": len(parcels),
            "context_used": len(context) > 100,
            "investment_budget": investment_budget,
            "data": response
        }
    
    def find_strategic_lands(self, criteria: Dict) -> Dict:
        """
        Find strategic lands based on specific criteria using RAG and database
        """
        # Build search query for RAG
        search_terms = []
        if "investment_type" in criteria:
            search_terms.append(criteria["investment_type"])
        if "target_tourism" in criteria:
            search_terms.append(criteria["target_tourism"])
        if "location_preference" in criteria:
            search_terms.append(criteria["location_preference"])
        
        rag_query = f"strategic land {' '.join(search_terms)} Sri Lanka real estate investment"
        context = self.rag_system.get_context_for_query(rag_query)
        
        # Search database with filters
        db_filters = {}
        if "max_budget" in criteria:
            db_filters["max_price"] = criteria["max_budget"]
        if "min_area" in criteria:
            db_filters["min_area"] = criteria["min_area"]
        if "min_development_potential" in criteria:
            db_filters["min_development_potential"] = criteria["min_development_potential"]
        
        matching_parcels = self.land_db.search_parcels(db_filters)
        
        # Prepare parcel information
        parcel_details = ""
        if matching_parcels:
            parcel_details = f"\n\nMATCHING LAND PARCELS ({len(matching_parcels)} found):\n"
            for i, parcel in enumerate(matching_parcels[:5], 1):
                parcel_details += f"\n{i}. {parcel.location} ({parcel.district})\n"
                parcel_details += f"   • Area: {parcel.area_acres} acres | Price: ${parcel.total_price:,} (${parcel.price_per_acre:,}/acre)\n"
                parcel_details += f"   • Strategic advantages: {', '.join(parcel.strategic_advantages)}\n"
                parcel_details += f"   • Proximity: {', '.join(parcel.proximity_to_attractions[:3])}\n"
                parcel_details += f"   • Development potential: {parcel.development_potential}/10\n"
                parcel_details += f"   • Accessibility: {parcel.accessibility}\n"
        
        criteria_text = json.dumps(criteria, indent=2)
        
        prompt = f"""
        As a Sri Lanka real estate investment expert, find and recommend the most strategic lands based on these criteria:

        INVESTMENT CRITERIA:
        {criteria_text}

        RELEVANT MARKET CONTEXT:
        {context}

        AVAILABLE LAND OPTIONS:
        {parcel_details}

        Please provide:

        1. TOP STRATEGIC LAND RECOMMENDATIONS:
           - Rank the best 3-5 options from the available parcels
           - Explain why each location is strategically advantageous
           - Match criteria to land characteristics

        2. STRATEGIC LOCATION ANALYSIS:
           - Tourism potential and visitor flow
           - Infrastructure and accessibility
           - Competition and market positioning
           - Government development plans

        3. INVESTMENT VIABILITY:
           - Cost-benefit analysis for each recommended parcel
           - ROI projections and timeline
           - Risk assessment and mitigation
           - Financing and legal considerations

        4. DEVELOPMENT STRATEGY:
           - Optimal development approach for each parcel
           - Target market and positioning
           - Phased development recommendations
           - Partnership and operational strategies

        5. MARKET TIMING:
           - Current market conditions
           - Optimal timing for acquisition and development
           - Seasonal considerations
           - Economic and tourism trends

        Focus on actionable recommendations with specific reasoning for why each location offers strategic advantages for the intended investment type.
        """
        
        response = self.query_ollama(prompt)
        
        return {
            "criteria": criteria,
            "timestamp": datetime.now().isoformat(),
            "analysis_type": "strategic_land_search",
            "matching_parcels_count": len(matching_parcels),
            "context_sources": len(context) > 100,
            "data": response,
            "raw_parcels": [
                {
                    "location": p.location,
                    "district": p.district,
                    "area_acres": p.area_acres,
                    "total_price": p.total_price,
                    "development_potential": p.development_potential,
                    "strategic_advantages": p.strategic_advantages
                } for p in matching_parcels[:10]
            ]
        }
    
    def comparative_land_analysis(self, locations: List[str]) -> Dict:
        """
        Compare multiple locations using RAG-enhanced analysis
        """
        # Get context for comparison
        locations_str = ", ".join(locations)
        context = self.rag_system.get_context_for_query(f"compare {locations_str} Sri Lanka tourism real estate investment")
        
        # Get land parcels for each location
        location_parcels = {}
        for location in locations:
            all_parcels = self.land_db.get_all_parcels()
            parcels = [p for p in all_parcels if location.lower() in p.location.lower()]
            location_parcels[location] = parcels
        
        # Prepare comparison data
        comparison_data = f"\n\nLAND PARCEL DATA FOR COMPARISON:\n"
        for location, parcels in location_parcels.items():
            comparison_data += f"\n{location.upper()}:\n"
            if parcels:
                avg_price = sum(p.price_per_acre for p in parcels) / len(parcels)
                avg_potential = sum(p.development_potential for p in parcels) / len(parcels)
                comparison_data += f"  • Available parcels: {len(parcels)}\n"
                comparison_data += f"  • Average price per acre: ${avg_price:,.0f}\n"
                comparison_data += f"  • Average development potential: {avg_potential:.1f}/10\n"
                comparison_data += f"  • Best parcel: {parcels[0].location} - {parcels[0].area_acres} acres at ${parcels[0].total_price:,}\n"
            else:
                comparison_data += f"  • No specific parcels in database\n"
        
        prompt = f"""
        Compare these Sri Lankan locations for strategic real estate investment: {locations_str}

        MARKET INTELLIGENCE:
        {context}

        LAND AVAILABILITY DATA:
        {comparison_data}

        Provide a comprehensive comparative analysis:

        1. STRATEGIC POSITIONING COMPARISON:
           - Rank locations by strategic importance (1st, 2nd, 3rd...)
           - Tourism appeal and market positioning
           - Infrastructure and accessibility comparison
           - Unique selling propositions for each

        2. INVESTMENT METRICS COMPARISON:
           Location | Investment Score | Price Range | ROI Potential | Risk Level
           [Create a comparison table]

        3. MARKET OPPORTUNITIES:
           - Best market segments for each location
           - Competition levels and market saturation
           - Growth potential and development pipeline
           - Seasonal performance variations

        4. DEVELOPMENT RECOMMENDATIONS:
           - Optimal property types for each location
           - Investment scale recommendations
           - Timeline for development
           - Target market positioning

        5. FINAL RECOMMENDATION:
           - Top choice with detailed justification
           - Second choice with conditions
           - Locations to avoid and reasons
           - Portfolio approach recommendations

        6. RISK ASSESSMENT:
           - Political and economic risks by location
           - Market risks and mitigation strategies
           - Operational challenges specific to each area
           - Long-term sustainability factors

        Conclude with specific actionable recommendations for investors considering these locations.
        """
        
        response = self.query_ollama(prompt)
        
        return {
            "locations": locations,
            "timestamp": datetime.now().isoformat(),
            "analysis_type": "comparative_land_analysis",
            "parcels_data": location_parcels,
            "context_enhanced": len(context) > 100,
            "data": response
        }
    
    def generate_investment_report(self, investment_profile: Dict) -> Dict:
        """
        Generate comprehensive investment report using RAG and data
        """
        # Extract profile information
        budget = investment_profile.get("budget", 100000)
        investment_type = investment_profile.get("type", "tourism_accommodation")
        preferences = investment_profile.get("preferences", {})
        
        # Get relevant context
        context = self.rag_system.get_context_for_query(f"{investment_type} Sri Lanka real estate investment {budget}")
        
        # Find suitable parcels based on budget
        suitable_parcels = self.land_db.search_parcels({
            "max_price": budget * 0.8,  # Leave room for development costs
            "min_development_potential": 6
        })
        
        # Prepare investment options
        investment_options = ""
        if suitable_parcels:
            investment_options = f"\n\nSUITABLE INVESTMENT OPTIONS (within 80% of budget):\n"
            for i, parcel in enumerate(suitable_parcels[:5], 1):
                remaining_budget = budget - parcel.total_price
                investment_options += f"\n{i}. {parcel.location}\n"
                investment_options += f"   • Land cost: ${parcel.total_price:,} ({parcel.area_acres} acres)\n"
                investment_options += f"   • Remaining budget for development: ${remaining_budget:,}\n"
                investment_options += f"   • Strategic advantages: {', '.join(parcel.strategic_advantages[:2])}\n"
                investment_options += f"   • Development potential: {parcel.development_potential}/10\n"
        
        profile_text = json.dumps(investment_profile, indent=2)
        
        prompt = f"""
        Generate a comprehensive real estate investment report for Sri Lanka based on this investment profile:

        INVESTOR PROFILE:
        {profile_text}

        MARKET INTELLIGENCE:
        {context}

        AVAILABLE INVESTMENT OPTIONS:
        {investment_options}

        Create a detailed investment report with:

        1. EXECUTIVE SUMMARY:
           - Investment recommendation overview
           - Key opportunities identified
           - Expected returns and timeline
           - Risk assessment summary

        2. MARKET ANALYSIS:
           - Sri Lanka tourism market trends
           - Real estate market conditions
           - Target segment analysis
           - Competitive landscape

        3. STRATEGIC LAND RECOMMENDATIONS:
           - Top 3 recommended parcels with justification
           - Strategic advantages of each location
           - Development potential analysis
           - Risk-return profile for each

        4. FINANCIAL PROJECTIONS:
           - Initial investment breakdown
           - Development cost estimates
           - Revenue projections (Year 1-5)
           - ROI calculations and break-even analysis
           - Sensitivity analysis for key variables

        5. DEVELOPMENT STRATEGY:
           - Recommended property type and scale
           - Phased development approach
           - Design and amenity recommendations
           - Operational strategy

        6. LEGAL AND REGULATORY:
           - Legal structure for foreign investment
           - Required approvals and licenses
           - Tax implications and incentives
           - Compliance requirements

        7. RISK MANAGEMENT:
           - Identified risks and mitigation strategies
           - Insurance requirements
           - Exit strategy options
           - Portfolio diversification recommendations

        8. IMPLEMENTATION ROADMAP:
           - 12-month action plan
           - Key milestones and timelines
           - Required partnerships
           - Success metrics and monitoring

        Make recommendations specific, actionable, and backed by data. Include specific numbers for costs, returns, and timelines.
        """
        
        response = self.query_ollama(prompt)
        
        return {
            "investment_profile": investment_profile,
            "timestamp": datetime.now().isoformat(),
            "analysis_type": "comprehensive_investment_report",
            "suitable_parcels_found": len(suitable_parcels),
            "budget_range": f"${budget:,}",
            "data": response
        }
    
    def run_comprehensive_rag_analysis(self, focus_areas: List[str] = None, budget_range: Tuple[float, float] = None) -> Dict:
        """
        Run comprehensive RAG-enhanced analysis
        """
        focus_areas = focus_areas or ["Ella", "Sigiriya", "Arugam Bay", "Kandy", "Galle"]
        self.logger.info(f"Starting comprehensive RAG analysis for {len(focus_areas)} focus areas...")
        
        results = {
            "analysis_timestamp": datetime.now().isoformat(),
            "focus_areas": focus_areas,
            "budget_range": budget_range,
            "reports": {},
            "summary_metrics": {}
        }
        
        try:
            # 1. Strategic land search for each focus area
            self.logger.info("1. Analyzing strategic lands by area...")
            results["reports"]["area_analyses"] = {}
            
            for area in focus_areas:
                budget = budget_range[1] if budget_range else None
                analysis = self.analyze_land_with_rag(area, budget)
                results["reports"]["area_analyses"][area] = analysis
                self.logger.info(f"✅ Completed analysis for {area}")
            
            # 2. Comparative analysis
            self.logger.info("2. Running comparative analysis...")
            results["reports"]["comparative_analysis"] = self.comparative_land_analysis(focus_areas)
            
            # 3. Strategic land search with criteria
            self.logger.info("3. Finding strategic lands with optimal criteria...")
            search_criteria = {
                "investment_type": "tourism_accommodation",
                "target_tourism": "sustainable eco-tourism",
                "min_development_potential": 7,
                "max_budget": budget_range[1] if budget_range else 200000
            }
            results["reports"]["strategic_search"] = self.find_strategic_lands(search_criteria)
            
            # 4. Investment report for different profiles
            self.logger.info("4. Generating investment reports for different profiles...")
            
            investment_profiles = [
                {
                    "profile_name": "Budget Eco-Lodge",
                    "budget": budget_range[0] if budget_range else 50000,
                    "type": "eco_tourism_accommodation",
                    "preferences": {"sustainability": True, "nature_focus": True, "small_scale": True}
                },
                {
                    "profile_name": "Premium Resort",
                    "budget": budget_range[1] if budget_range else 200000,
                    "type": "luxury_tourism_resort",
                    "preferences": {"luxury": True, "full_service": True, "large_scale": True}
                }
            ]
            
            results["reports"]["investment_profiles"] = {}
            for profile in investment_profiles:
                report = self.generate_investment_report(profile)
                results["reports"]["investment_profiles"][profile["profile_name"]] = report
            
            # 5. Generate summary metrics
            all_parcels = self.land_db.get_all_parcels()
            results["summary_metrics"] = {
                "total_parcels_analyzed": len(all_parcels),
                "average_price_per_acre": sum(p.price_per_acre for p in all_parcels) / len(all_parcels) if all_parcels else 0,
                "average_development_potential": sum(p.development_potential for p in all_parcels) / len(all_parcels) if all_parcels else 0,
                "top_districts": list(set(p.district for p in all_parcels)),
                "price_range": {
                    "min_total": min(p.total_price for p in all_parcels) if all_parcels else 0,
                    "max_total": max(p.total_price for p in all_parcels) if all_parcels else 0
                }
            }
            
            self.logger.info("✅ Comprehensive RAG analysis completed successfully!")
            
        except Exception as e:
            self.logger.error(f"Error during comprehensive analysis: {str(e)}")
            results["error"] = str(e)
        
        return results
    
    def export_rag_analysis(self, results: Dict, base_filename: str = None) -> Dict[str, str]:
        """
        Export RAG analysis results to multiple formats
        """
        if not base_filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_filename = f"sri_lanka_rag_real_estate_analysis_{timestamp}"
        
        saved_files = {}
        
        # 1. Save detailed TXT report
        try:
            txt_filename = f"{base_filename}.txt"
            with open(txt_filename, 'w', encoding='utf-8') as f:
                f.write("=" * 80 + "\n")
                f.write("SRI LANKA REAL ESTATE RAG-ENHANCED ANALYSIS REPORT\n")
                f.write("=" * 80 + "\n\n")
                
                f.write(f"Report Generated: {results.get('analysis_timestamp', 'N/A')}\n")
                f.write(f"Focus Areas: {', '.join(results.get('focus_areas', []))}\n")
                f.write(f"Budget Range: ${results.get('budget_range', ['N/A'])[0]:,} - ${results.get('budget_range', ['N/A', 'N/A'])[1]:,}\n" if results.get('budget_range') else "Budget Range: Not specified\n")
                f.write(f"Analysis Type: RAG-Enhanced with Local Knowledge Base\n\n")
                
                # Write summary metrics
                if "summary_metrics" in results:
                    f.write("SUMMARY METRICS\n")
                    f.write("=" * 40 + "\n")
                    metrics = results["summary_metrics"]
                    f.write(f"Total Land Parcels Analyzed: {metrics.get('total_parcels_analyzed', 0)}\n")
                    f.write(f"Average Price per Acre: ${metrics.get('average_price_per_acre', 0):,.0f}\n")
                    f.write(f"Average Development Potential: {metrics.get('average_development_potential', 0):.1f}/10\n")
                    f.write(f"Districts Covered: {', '.join(metrics.get('top_districts', []))}\n")
                    price_range = metrics.get('price_range', {})
                    f.write(f"Price Range: ${price_range.get('min_total', 0):,} - ${price_range.get('max_total', 0):,}\n\n")
                
                # Write each report section
                reports = results.get("reports", {})
                for report_type, report_data in reports.items():
                    f.write("=" * 60 + "\n")
                    f.write(f"{report_type.upper().replace('_', ' ')}\n")
                    f.write("=" * 60 + "\n\n")
                    
                    if isinstance(report_data, dict):
                        if "data" in report_data:
                            f.write(str(report_data["data"]))
                            f.write("\n\n")
                        
                        # Handle nested reports (like area analyses)
                        for key, value in report_data.items():
                            if key != "data" and isinstance(value, dict) and "data" in value:
                                f.write(f"\n--- {key.upper()} ---\n")
                                f.write(str(value["data"]))
                                f.write("\n\n")
                    
                    f.write("\n" + "-" * 40 + "\n\n")
                
                f.write("=" * 80 + "\n")
                f.write("END OF RAG-ENHANCED ANALYSIS REPORT\n")
                f.write("=" * 80 + "\n")
            
            saved_files["txt"] = txt_filename
            self.logger.info(f"TXT report saved: {txt_filename}")
            
        except Exception as e:
            self.logger.error(f"Error saving TXT report: {e}")
        
        # 2. Save JSON with full data
        try:
            json_filename = f"{base_filename}.json"
            with open(json_filename, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False, default=str)
            
            saved_files["json"] = json_filename
            self.logger.info(f"JSON report saved: {json_filename}")
            
        except Exception as e:
            self.logger.error(f"Error saving JSON report: {e}")
        
        # 3. Save Excel with structured data
        try:
            excel_filename = f"{base_filename}.xlsx"
            with pd.ExcelWriter(excel_filename, engine='openpyxl') as writer:
                # Summary sheet
                summary_data = {
                    "Metric": ["Analysis Date", "Focus Areas", "Total Reports", "Land Parcels", "Avg Price/Acre", "Avg Development Score"],
                    "Value": [
                        results.get("analysis_timestamp", ""),
                        ", ".join(results.get("focus_areas", [])),
                        len(results.get("reports", {})),
                        results.get("summary_metrics", {}).get("total_parcels_analyzed", 0),
                        f"${results.get('summary_metrics', {}).get('average_price_per_acre', 0):,.0f}",
                        f"{results.get('summary_metrics', {}).get('average_development_potential', 0):.1f}/10"
                    ]
                }
                pd.DataFrame(summary_data).to_excel(writer, sheet_name="Summary", index=False)
                
                # Land parcels data if available
                if "strategic_search" in results.get("reports", {}) and "raw_parcels" in results["reports"]["strategic_search"]:
                    parcels_data = []
                    for parcel in results["reports"]["strategic_search"]["raw_parcels"]:
                        parcels_data.append({
                            "Location": parcel["location"],
                            "District": parcel["district"],
                            "Area (Acres)": parcel["area_acres"],
                            "Total Price": parcel["total_price"],
                            "Price per Acre": parcel["total_price"] / parcel["area_acres"],
                            "Development Potential": parcel["development_potential"],
                            "Strategic Advantages": ", ".join(parcel["strategic_advantages"][:3])
                        })
                    
                    if parcels_data:
                        pd.DataFrame(parcels_data).to_excel(writer, sheet_name="Land Parcels", index=False)
            
            saved_files["excel"] = excel_filename
            self.logger.info(f"Excel report saved: {excel_filename}")
            
        except Exception as e:
            self.logger.error(f"Error saving Excel report: {e}")
        
        return saved_files
    
    def get_system_status(self) -> Dict:
        """Get comprehensive system status"""
        land_count = len(self.land_db.get_all_parcels())
        
        # Test RAG system
        rag_status = "operational" if self.rag_system.collection else "limited"
        
        # Test Ollama connection
        ollama_status = "connected"
        try:
            test_response = self.query_ollama("Test connection")
            if "error" in test_response.lower():
                ollama_status = "error"
        except:
            ollama_status = "disconnected"
        
        return {
            "timestamp": datetime.now().isoformat(),
            "land_database": {
                "status": "operational",
                "parcel_count": land_count
            },
            "rag_system": {
                "status": rag_status,
                "embedding_model": self.rag_system.embedding_model_name if self.rag_system.embedding_model else "not_loaded",
                "vector_db": "chromadb" if CHROMADB_AVAILABLE else "unavailable"
            },
            "ollama_ai": {
                "status": ollama_status,
                "model": self.ollama_model,
                "base_url": self.ollama_base_url
            },
            "dependencies": {
                "sentence_transformers": SENTENCE_TRANSFORMERS_AVAILABLE,
                "chromadb": CHROMADB_AVAILABLE
            }
        }

# Usage Example and Main Execution
def main():
    """
    Enhanced main function demonstrating RAG-powered real estate analysis
    """
    print("🏡 Sri Lanka Real Estate RAG-Enhanced Analysis Agent")
    print("=" * 60)
    
    try:
        # Initialize the RAG-enhanced agent
        agent = SriLankaRealEstateRAGAgent()
        
        # Check system status
        status = agent.get_system_status()
        print(f"\n📊 System Status:")
        print(f"  🗄️  Land Database: {status['land_database']['parcel_count']} parcels loaded")
        print(f"  🧠 RAG System: {status['rag_system']['status']}")
        print(f"  🤖 Ollama AI: {status['ollama_ai']['status']} ({status['ollama_ai']['model']})")
        
        # Check if core systems are operational
        if status['ollama_ai']['status'] != 'connected':
            print("\n❌ Ollama not connected. Please ensure:")
            print("   1. Ollama is running: ollama serve")
            print("   2. Llama3:8b is installed: ollama pull llama3:8b")
            return None
        
        print("\n🚀 Starting comprehensive RAG-enhanced analysis...")
        
        # Example 1: Analyze specific location with RAG
        print("\n1. RAG-Enhanced Location Analysis...")
        ella_analysis = agent.analyze_land_with_rag("Ella", investment_budget=75000)
        print(f"✅ Ella analysis completed: {len(ella_analysis['data'])} characters")
        
        # Example 2: Find strategic lands
        print("\n2. Strategic Land Search...")
        strategic_criteria = {
            "investment_type": "eco_tourism_resort",
            "target_tourism": "sustainable adventure tourism",
            "min_development_potential": 8,
            "max_budget": 100000,
            "location_preference": "mountain or coastal"
        }
        strategic_lands = agent.find_strategic_lands(strategic_criteria)
        print(f"✅ Strategic search completed: {strategic_lands['matching_parcels_count']} parcels found")
        
        # Example 3: Comparative analysis
        print("\n3. Comparative Location Analysis...")
        comparison_locations = ["Ella", "Sigiriya", "Arugam Bay"]
        comparison = agent.comparative_land_analysis(comparison_locations)
        print(f"✅ Comparative analysis completed for {len(comparison_locations)} locations")
        
        # Example 4: Investment report generation
        print("\n4. Investment Report Generation...")
        investment_profile = {
            "budget": 80000,
            "type": "boutique_eco_lodge",
            "preferences": {
                "sustainability": True,
                "authentic_experience": True,
                "small_scale": True,
                "nature_integration": True
            },
            "target_market": "conscious travelers, digital nomads",
            "timeline": "12-18 months"
        }
        investment_report = agent.generate_investment_report(investment_profile)
        print(f"✅ Investment report generated for ${investment_profile['budget']:,} budget")
        
        # Example 5: Comprehensive analysis
        print("\n5. Comprehensive RAG Analysis...")
        focus_areas = ["Ella", "Kandy", "Arugam Bay", "Sigiriya"]
        budget_range = (50000, 150000)
        
        comprehensive_results = agent.run_comprehensive_rag_analysis(focus_areas, budget_range)
        
        if "error" not in comprehensive_results:
            print("✅ Comprehensive analysis completed!")
            
            # Export results
            print("\n6. Exporting Results...")
            saved_files = agent.export_rag_analysis(comprehensive_results)
            
            print(f"\n📁 Analysis Results Exported:")
            for format_type, filepath in saved_files.items():
                print(f"   {format_type.upper()}: {filepath}")
            
            # Display summary
            metrics = comprehensive_results.get("summary_metrics", {})
            print(f"\n📊 Analysis Summary:")
            print(f"   • Land parcels analyzed: {metrics.get('total_parcels_analyzed', 0)}")
            print(f"   • Average price per acre: ${metrics.get('average_price_per_acre', 0):,.0f}")
            print(f"   • Average development potential: {metrics.get('average_development_potential', 0):.1f}/10")
            print(f"   • Districts covered: {', '.join(metrics.get('top_districts', []))}")
            
            return comprehensive_results
        else:
            print(f"❌ Comprehensive analysis failed: {comprehensive_results.get('error')}")
            return None
            
    except Exception as e:
        print(f"❌ Error running RAG analysis: {str(e)}")
        print("\nTroubleshooting:")
        print("1. Ensure Ollama is running: ollama serve")
        print("2. Verify Llama3:8b model: ollama pull llama3:8b")
        print("3. Install required packages: pip install sentence-transformers chromadb")
        return None

def setup_requirements():
    """
    Display setup requirements and installation instructions
    """
    print("🔧 Sri Lanka Real Estate RAG Agent - Setup Requirements")
    print("=" * 60)
    
    requirements = {
        "Core Requirements": [
            "ollama (with llama3:8b model)",
            "python 3.8+",
            "sqlite3 (included with Python)"
        ],
        "Python Packages": [
            "requests",
            "pandas", 
            "numpy",
            "openpyxl",
            "sentence-transformers",
            "chromadb",
            "python-dotenv (optional)"
        ],
        "Ollama Setup": [
            "1. Install Ollama: https://ollama.ai/download",
            "2. Start Ollama server: ollama serve",
            "3. Pull Llama3:8b model: ollama pull llama3:8b",
            "4. Verify installation: ollama list"
        ],
        "Installation Commands": [
            "pip install requests pandas numpy openpyxl",
            "pip install sentence-transformers chromadb",
            "pip install python-dotenv  # optional"
        ]
    }
    
    for section, items in requirements.items():
        print(f"\n{section}:")
        print("-" * len(section))
        for item in items:
            print(f"  • {item}")
    
    print(f"\n💡 Features:")
    print(f"  • RAG-enhanced analysis using local knowledge base")
    print(f"  • Strategic land identification with specific criteria")
    print(f"  • Real-time market intelligence integration")
    print(f"  • Investment-grade financial projections")
    print(f"  • Multi-format reporting (TXT, JSON, Excel)")
    print(f"  • Local AI processing (no external API costs)")
    print(f"  • Comprehensive land database with 6+ sample locations")

def quick_demo():
    """
    Quick demo function to test basic functionality
    """
    print("🚀 Quick Demo - Sri Lanka Real Estate RAG Agent")
    print("=" * 50)
    
    try:
        agent = SriLankaRealEstateRAGAgent()
        status = agent.get_system_status()
        
        if status['ollama_ai']['status'] != 'connected':
            print("❌ Ollama not available - cannot run demo")
            return
        
        print("\n🔍 Testing RAG-enhanced location analysis...")
        
        # Quick analysis of Ella
        result = agent.analyze_land_with_rag("Ella", 60000)
        
        print(f"✅ Analysis completed!")
        print(f"📊 Generated {len(result['data'])} characters of analysis")
        print(f"🏡 Available parcels in area: {result['available_parcels']}")
        print(f"🧠 RAG context used: {result['context_used']}")
        
        # Show a sample of the analysis
        sample_text = result['data'][:500] + "..." if len(result['data']) > 500 else result['data']
        print(f"\n📝 Sample Analysis Output:")
        print("-" * 40)
        print(sample_text)
        print("-" * 40)
        
        return result
        
    except Exception as e:
        print(f"❌ Demo failed: {e}")
        return None

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "setup":
            setup_requirements()
        elif sys.argv[1] == "demo":
            quick_demo()
        elif sys.argv[1] == "status":
            try:
                agent = SriLankaRealEstateRAGAgent()
                status = agent.get_system_status()
                print("System Status:")
                print(json.dumps(status, indent=2, default=str))
            except Exception as e:
                print(f"Status check failed: {e}")
        else:
            print("Available commands: setup, demo, status")
    else:
        # Run full analysis
        print("🏡 Starting Full Sri Lanka Real Estate RAG Analysis...")
        print("💡 Tip: Use 'python script.py demo' for quick test")
        print("💡 Tip: Use 'python script.py setup' for requirements")
        print()
        
        results = main()
        
        if results:
            print("\n" + "="*60)
            print("✅ SUCCESS: RAG-Enhanced Real Estate Analysis Complete!")
            print("📁 Check generated files for detailed reports")
            print("🧠 Analysis powered by local Llama3:8b with RAG")
            print("💰 No external API costs - fully local processing")
        else:
            print("\n" + "="*60)
            print("❌ ANALYSIS FAILED")
            print("🔧 Run 'python script.py setup' for requirements")
            print("🚀 Run 'python script.py demo' for quick test")