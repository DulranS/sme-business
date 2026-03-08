#!/usr/bin/env python3
"""Test script for Quantum AI Lead Intelligence System"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from enrich import QuantumLeadScorer, EnrichmentConfig, QUANTUM_SCORER

def test_quantum_ai():
    """Test the quantum AI enhancement system"""
    print("🚀 Testing Quantum AI Lead Intelligence System...")
    
    # Initialize configuration and scorer
    config = EnrichmentConfig()
    scorer = QuantumLeadScorer(config)
    
    # Test data with various signals
    test_cases = [
        {
            'name': 'Basic Test',
            'data': {
                'business_name': 'Test Corp',
                'website': 'https://example.com',
                'email_primary': 'test@example.com',
                'phone_primary': '+1234567890',
                'linkedin_company': 'https://linkedin.com/company/test-corp',
                'decision_maker_found': 'Yes',
                'tech_stack_detected': 'FW: react | MKT: hubspot | Spend: $500/mo',
                'company_size_indicator': 'medium',
                'intent_keywords_found': ['hiring', 'growth']
            }
        },
        {
            'name': 'Enterprise Test',
            'data': {
                'business_name': 'Enterprise Solutions Inc',
                'website': 'https://enterprise.com',
                'email_primary': 'ceo@enterprise.com',
                'phone_primary': '+1234567890',
                'linkedin_company': 'https://linkedin.com/company/enterprise',
                'linkedin_ceo': 'https://linkedin.com/in/ceo-enterprise',
                'decision_maker_found': 'Yes',
                'tech_stack_detected': 'FW: react | MKT: salesforce,marketo | Spend: $1500/mo',
                'company_size_indicator': 'enterprise',
                'intent_keywords_found': ['funding', 'expansion', 'acquisition']
            }
        },
        {
            'name': 'Minimal Test',
            'data': {
                'business_name': 'Small Startup',
                'website': 'https://startup.com',
                'email_primary': 'contact@startup.com',
                'tech_stack_detected': 'FW: react | MKT: google_analytics | Spend: $50/mo',
                'company_size_indicator': 'startup'
            }
        }
    ]
    
    print(f"\n📊 Running {len(test_cases)} test cases...\n")
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"--- Test Case {i}: {test_case['name']} ---")
        
        try:
            # Score the lead
            result = scorer.score_lead(test_case['data'])
            
            # Display results
            print(f"✅ Quantum Score: {result['score']}/100")
            print(f"🎯 Confidence: {result['confidence']}")
            print(f"📈 Completeness: {result.get('completeness', 'N/A')}")
            print(f"💡 Next Action: {result.get('next_best_action', 'N/A')}")
            
            # Show top recommendations
            if result.get('recommendations'):
                print("🧠 AI Insights:")
                for rec in result['recommendations'][:3]:
                    print(f"   • {rec}")
            
            # Show predictive insights
            if result.get('predictive_insights'):
                pred = result['predictive_insights']
                print(f"🔮 Conversion Probability: {pred.get('conversion_probability', 0)}%")
            
            # Show behavioral analysis
            if result.get('behavioral_analysis'):
                behav = result['behavioral_analysis']
                print(f"📊 Engagement Score: {behav.get('engagement_score', 0)}")
                print(f"🎯 Recommended Strategy: {behav.get('recommended_strategy', 'N/A')}")
            
            print()
            
        except Exception as e:
            print(f"❌ Error: {type(e).__name__}: {str(e)}")
            print()
    
    print("🎉 Quantum AI testing completed successfully!")

if __name__ == "__main__":
    test_quantum_ai()
