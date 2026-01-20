#!/usr/bin/env python3
"""
CSV Email Validation Tool
Analyzes your CSV files to find which ones have valid emails for sending campaigns
"""

import os
import csv
import sys
from pathlib import Path

def validate_email(email):
    """Basic email validation"""
    if not email or not isinstance(email, str):
        return False
    
    cleaned = email.strip().lower()
    if not cleaned or '@' not in cleaned or '.' not in cleaned:
        return False
    if len(cleaned) < 5:
        return False
    if cleaned in ['undefined', 'null', 'na', 'n/a']:
        return False
    if cleaned.startswith('[') or 'missing' in cleaned:
        return False
    
    parts = cleaned.split('@')
    if len(parts) != 2:
        return False
    
    local, domain = parts
    if not local or not domain or len(domain) < 3:
        return False
    if '.' not in domain:
        return False
    
    domain_parts = domain.split('.')
    tld = domain_parts[-1]
    
    if len(tld) < 2 or len(tld) > 6:
        return False
    
    return True


def analyze_csv(filepath):
    """Analyze a CSV file for valid emails"""
    try:
        total = 0
        valid = 0
        empty = 0
        invalid = 0
        sample_emails = []
        
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            reader = csv.DictReader(f)
            
            if not reader.fieldnames or 'email' not in reader.fieldnames:
                return None, "No 'email' column found"
            
            for row in reader:
                total += 1
                email = (row.get('email') or '').strip()
                
                if not email:
                    empty += 1
                elif validate_email(email):
                    valid += 1
                    if len(sample_emails) < 3:
                        sample_emails.append(email)
                else:
                    invalid += 1
        
        if total == 0:
            return None, "File is empty"
        
        result = {
            'total': total,
            'valid': valid,
            'empty': empty,
            'invalid': invalid,
            'percentage': round(valid / total * 100, 1) if total > 0 else 0,
            'samples': sample_emails
        }
        
        return result, None
        
    except Exception as e:
        return None, str(e)


def main():
    """Main analysis function"""
    csv_dir = r'c:\Users\dulra\Downloads\sme-business'
    csv_files = sorted([f for f in os.listdir(csv_dir) if f.endswith('.csv')])
    
    if not csv_files:
        print(f"No CSV files found in {csv_dir}")
        return
    
    print("\n" + "=" * 90)
    print("CSV EMAIL ANALYSIS REPORT")
    print("=" * 90)
    print(f"Location: {csv_dir}\n")
    
    total_rows = 0
    total_valid = 0
    usable_files = []
    
    print(f"{'Filename':<45} {'Total':>6} {'Valid':>6} {'Empty':>6} {'Invalid':>6} {'%':>6}")
    print("-" * 90)
    
    for csv_file in csv_files:
        filepath = os.path.join(csv_dir, csv_file)
        result, error = analyze_csv(filepath)
        
        if error:
            print(f"{csv_file:<45} ERROR: {error}")
        else:
            total_rows += result['total']
            total_valid += result['valid']
            
            status = "✓ USABLE" if result['valid'] > 0 else "✗ NO EMAILS"
            print(f"{csv_file:<45} {result['total']:>6} {result['valid']:>6} {result['empty']:>6} {result['invalid']:>6} {result['percentage']:>5}% {status}")
            
            if result['valid'] > 0:
                usable_files.append(csv_file)
    
    print("-" * 90)
    print(f"{'TOTALS':<45} {total_rows:>6} {total_valid:>6} {' ':>6} {' ':>6}")
    print("=" * 90)
    
    print(f"\n✓ USABLE FILES ({len(usable_files)} of {len(csv_files)}):")
    for f in usable_files[:10]:
        print(f"  • {f}")
    
    if len(usable_files) > 10:
        print(f"  ... and {len(usable_files) - 10} more")
    
    print(f"\n✗ UNUSABLE FILES (no valid emails):")
    for f in csv_files:
        result, error = analyze_csv(os.path.join(csv_dir, f))
        if result and result['valid'] == 0:
            print(f"  • {f} ({result['total']} rows, {result['empty']} empty)")
    
    print(f"\n📊 SUMMARY:")
    print(f"  Total CSV files: {len(csv_files)}")
    print(f"  Total rows: {total_rows}")
    print(f"  Valid emails: {total_valid} ({round(total_valid/total_rows*100, 1) if total_rows > 0 else 0}%)")
    print(f"  Usable files: {len(usable_files)}")
    print("\n💡 TIP: Upload only files from the 'USABLE FILES' list above.")
    print("=" * 90 + "\n")


if __name__ == '__main__':
    main()
