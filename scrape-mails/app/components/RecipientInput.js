// src/components/RecipientInput.js
import { useState } from 'react';

export default function RecipientInput({ onRecipientsChange }) {
  const [inputMode, setInputMode] = useState('csv');
  const [manualInput, setManualInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState('');

  // Your exact required column names (case-insensitive)
  const REQUIRED_COLUMNS = [
    'place_id', 'business_name', 'address', 'phone_raw', 
    'whatsapp_number', 'email', 'website', 'rating', 
    'review_count', 'category', 'lead_quality', 'scraped_date'
  ];

  // Email column detection variants
  const EMAIL_COLUMN_NAMES = ['email', 'e-mail', 'email address', 'email_address'];

  // Parse manual emails
  const parseManualEmails = (text) => {
    if (!text.trim()) return { recipients: [], invalid: [] };
    
    const rawEmails = text
      .split(/[,;\n\r]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0);
    
    const uniqueEmails = [...new Set(rawEmails)];
    const valid = [];
    const invalid = [];
    
    uniqueEmails.forEach(email => {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        // Create recipient with your full schema + empty fields
        const recipient = { email };
        REQUIRED_COLUMNS.forEach(col => {
          if (col !== 'email') recipient[col] = '';
        });
        valid.push(recipient);
      } else {
        invalid.push(email);
      }
    });
    
    return { recipients: valid, invalid };
  };

  const processManualInput = () => {
    const { recipients, invalid } = parseManualEmails(manualInput);
    onRecipientsChange(recipients);
    
    let msg = `Loaded ${recipients.length} valid email(s)`;
    if (invalid.length) msg += `. Skipped ${invalid.length} invalid.`;
    setStatus(msg);
  };

  // Robust CSV parser (handles quoted fields with commas)
  const parseCSVLine = (line) => {
    const values = [];
    let inQuotes = false;
    let current = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && !inQuotes) inQuotes = true;
      else if (char === '"' && inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"' && inQuotes) inQuotes = false;
      else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    return values.map(v => v.trim().replace(/^"(.*)"$/, '$1'));
  };

  const processCSVFile = async (file) => {
    setStatus('Processing file...');
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
      
      if (lines.length < 2) {
        setStatus('Need headers + data rows');
        return;
      }

      const headers = parseCSVLine(lines[0]);
      let emailIdx = -1;

      // Find email column
      for (let i = 0; i < headers.length; i++) {
        if (EMAIL_COLUMN_NAMES.includes(headers[i].toLowerCase())) {
          emailIdx = i;
          break;
        }
      }
      if (emailIdx === -1) {
        setStatus('No email column found');
        return;
      }

      const recipients = [];
      const invalidEmails = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (!values.length) continue;
        while (values.length < headers.length) values.push('');

        const email = values[emailIdx].trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          if (email) invalidEmails.push(email);
          continue;
        }

        // Build recipient with ALL your required fields
        const recipient = { email }; // Always have email
        
        // Add all original fields
        headers.forEach((header, idx) => {
          recipient[header] = values[idx] || '';
        });

        // Normalize to your exact schema
        REQUIRED_COLUMNS.forEach(col => {
          if (!recipient.hasOwnProperty(col)) {
            // Try to find a close match (case-insensitive)
            const matchedHeader = headers.find(h => 
              h.toLowerCase().replace(/[^a-z0-9]/g, '') === col.replace(/[^a-z0-9]/g, '')
            );
            if (matchedHeader) {
              recipient[col] = recipient[matchedHeader] || '';
            } else {
              recipient[col] = ''; // Default empty
            }
          }
        });

        // Ensure business_name exists (critical fallback)
        if (!recipient.business_name) {
          const businessKeys = ['company', 'organization', 'business', 'name'];
          for (const key of businessKeys) {
            if (recipient[key]) {
              recipient.business_name = recipient[key];
              break;
            }
          }
        }

        recipients.push(recipient);
      }

      onRecipientsChange(recipients);
      setStatus(`Loaded ${recipients.length} valid contacts`);
    } catch (error) {
      console.error('CSV error:', error);
      setStatus('Error processing file');
    }
  };

  // Drag and drop handlers
  const handleDrop = async (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) await processCSVFile(e.dataTransfer.files[0]);
  };

  const handleFileInput = async (e) => {
    if (e.target.files?.[0]) await processCSVFile(e.target.files[0]);
  };

  return (
    <div>
      {/* Toggle between CSV upload and manual entry */}
      <div className="flex mb-4 bg-gray-100 p-1 rounded-lg">
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            inputMode === 'csv'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setInputMode('csv')}
        >
          Upload CSV
        </button>
        <button
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            inputMode === 'manual'
              ? 'bg-white text-primary shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={() => setInputMode('manual')}
        >
          Enter Emails Manually
        </button>
      </div>

      {/* Input Area */}
      {inputMode === 'csv' ? (
        <div
          className={`file-upload ${dragActive ? 'border-primary bg-blue-50' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
            id="csv-upload"
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto text-gray-400 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="font-medium text-gray-700">Drag & drop your CSV file here</p>
            <p className="text-gray-500 mt-1 text-sm">or click to browse</p>
            <p className="text-xs text-gray-500 mt-2">
              Must include: place_id, business_name, email, address, etc.
            </p>
          </label>
        </div>
      ) : (
        <div>
          <textarea
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="john@acme.com, jane@xyz.co&#10;bob@test.org"
            className="textarea min-h-[120px]"
          />
          <button
            onClick={processManualInput}
            className="btn btn-primary w-full mt-2"
          >
            Parse Emails
          </button>
        </div>
      )}

      {/* Status message */}
      {status && (
        <p
          className={`text-sm mt-2 ${
            status.includes('Error') || status.includes('No email')
              ? 'text-danger'
              : 'text-success'
          }`}
        >
          {status}
        </p>
      )}
    </div>
  );
}