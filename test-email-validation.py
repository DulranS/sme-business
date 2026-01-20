#!/usr/bin/env python3
"""
Email Validation Tester
Simulates the exact validation logic from your API to debug why emails are being rejected
"""

import sys
import re

def is_valid_email(email):
    """Exact copy of the API's isValidEmail function"""
    if not email or not isinstance(email, str):
        return False
    
    # Aggressive cleanup
    cleaned = email.strip().lower()
    cleaned = re.sub(r'^["\'`]+', '', cleaned)
    cleaned = re.sub(r'["\'`]+$', '', cleaned)
    cleaned = re.sub(r'\s+', '', cleaned)
    cleaned = re.sub(r'[<>]', '', cleaned)
    
    if len(cleaned) < 5:
        return False
    if cleaned in ['undefined', 'null', 'na', 'n/a']:
        return False
    if cleaned.startswith('[') or 'missing' in cleaned:
        return False
    
    # Must have exactly one @ symbol
    at_count = len(re.findall(r'@', cleaned))
    if at_count != 1:
        return False
    
    parts = cleaned.split('@')
    local_part, domain_part = parts[0], parts[1]
    
    # Local part checks
    if not local_part or len(local_part) < 1:
        return False
    if local_part.startswith('.') or local_part.endswith('.'):
        return False
    if local_part.startswith('-') or local_part.endswith('-'):
        return False
    
    # Domain part checks
    if not domain_part or len(domain_part) < 3:
        return False
    if '.' not in domain_part:
        return False
    if domain_part.startswith('.') or domain_part.endswith('.'):
        return False
    
    domain_bits = domain_part.split('.')
    tld = domain_bits[-1]
    
    # TLD must be 2-6 characters and letters only
    if not tld or len(tld) < 2 or len(tld) > 6:
        return False
    if not re.match(r'^[a-z]+$', tld):
        return False
    
    return True

def get_failure_reasons(email):
    """Detailed failure reasons - matches API function"""
    reasons = []
    
    if not email or not isinstance(email, str):
        reasons.append('Not a string or empty')
        return reasons
    
    if len(email) < 5:
        reasons.append(f'Too short ({len(email)} chars)')
    if email in ['undefined', 'null', 'na', 'n/a']:
        reasons.append('Placeholder value')
    if email.startswith('[') or 'missing' in email:
        reasons.append('Contains [MISSING] marker')
    
    at_count = len(re.findall(r'@', email))
    if at_count != 1:
        reasons.append(f'Wrong @ count: {at_count}')
    
    if at_count == 1:
        parts = email.split('@')
        local_part = parts[0]
        domain_part = parts[1]
        
        if not local_part or len(local_part) < 1:
            reasons.append('Empty local part')
        if local_part.startswith('.') or local_part.endswith('.'):
            reasons.append('Local part starts/ends with dot')
        
        if not domain_part or len(domain_part) < 3:
            reasons.append(f'Domain too short: "{domain_part}"')
        if '.' not in domain_part:
            reasons.append('Domain has no dot')
        if domain_part.startswith('.') or domain_part.endswith('.'):
            reasons.append('Domain starts/ends with dot')
        
        if domain_part and '.' in domain_part:
            domain_bits = domain_part.split('.')
            tld = domain_bits[-1]
            
            if not tld or len(tld) < 2 or len(tld) > 6:
                reasons.append(f'Invalid TLD: "{tld}" (len={len(tld) if tld else 0})')
            if tld and not re.match(r'^[a-z]+$', tld):
                reasons.append(f'TLD has non-letters: "{tld}"')
    
    return reasons if reasons else ['Unknown']

def test_emails(email_list):
    """Test a list of emails"""
    print("\n" + "=" * 100)
    print("EMAIL VALIDATION TEST")
    print("=" * 100 + "\n")
    
    valid_count = 0
    invalid_count = 0
    
    for email in email_list:
        cleaned = email.strip().lower()
        is_valid = is_valid_email(cleaned)
        status = "✅ VALID" if is_valid else "❌ INVALID"
        
        print(f"{status:12} | {email:50} | {cleaned}")
        
        if is_valid:
            valid_count += 1
        else:
            invalid_count += 1
            reasons = get_failure_reasons(cleaned)
            for reason in reasons:
                print(f"             → {reason}")
        print()
    
    print("=" * 100)
    print(f"Results: {valid_count} valid, {invalid_count} invalid")
    print("=" * 100 + "\n")

def main():
    # Test cases
    test_emails_list = [
        # Valid
        "service@realtyassist.com.au",
        "hello@wrea.com.au",
        "contact@azrea.com.au",
        "john.doe@example.com",
        "user+tag@example.co.uk",
        
        # Invalid - TLD issues
        "user@example.c",           # TLD too short
        "user@example.c0m",         # Numbers in TLD
        "user@example.toolong",     # TLD too long
        
        # Invalid - Format issues
        "@example.com",             # No local part
        "userexample.com",          # Missing @
        "user@@example.com",        # Double @
        "user@",                    # No domain
        "user@example",             # No TLD
        "user@.com",                # No domain name
        
        # Invalid - Placeholder/Empty
        "",                         # Empty
        "[MISSING: email]",         # Template placeholder
        "undefined",                # Placeholder value
        "n/a",                      # Placeholder value
        
        # Whitespace/Quote issues
        ' service@example.com ',    # Whitespace (should be cleaned)
        '"test@example.com"',       # Quotes (should be cleaned)
    ]
    
    test_emails(test_emails_list)
    
    print("💡 TIP: If you have a specific email that's failing, run:")
    print("   python test-email-validation.py <email>\n")

if __name__ == '__main__':
    if len(sys.argv) > 1:
        # Test single email from command line
        email = sys.argv[1]
        is_valid = is_valid_email(email)
        status = "✅ VALID" if is_valid else "❌ INVALID"
        print(f"\n{status}: {email}")
        if not is_valid:
            reasons = get_failure_reasons(email)
            for reason in reasons:
                print(f"  → {reason}")
        print()
    else:
        # Run full test suite
        main()
