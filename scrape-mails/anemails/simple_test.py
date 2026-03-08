#!/usr/bin/env python3
"""Simple test for Quantum AI System"""

from enrich import QuantumLeadScorer, EnrichmentConfig

def test_quantum():
    config = EnrichmentConfig()
    scorer = QuantumLeadScorer(config)
    
    test_data = {
        'business_name': 'Test Corp',
        'website': 'https://example.com',
        'email_primary': 'test@example.com'
    }
    
    result = scorer.score_lead(test_data)
    print(f'Quantum Score: {result["score"]}')
    print(f'Confidence: {result["confidence"]}')
    print('✅ Quantum AI System Working!')

if __name__ == "__main__":
    test_quantum()
