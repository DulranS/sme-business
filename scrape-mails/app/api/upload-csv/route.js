// app/api/upload-csv/route.js
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Only CSV files are allowed' },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Convert file to text
    const csvContent = await file.text();
    
    // Basic CSV validation
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file must contain at least a header row and one data row' },
        { status: 400 }
      );
    }

    // Parse headers to validate structure
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Check for required columns (at least email or business name)
    const hasEmail = headers.some(h => h.toLowerCase().includes('email'));
    const hasBusinessName = headers.some(h => 
      h.toLowerCase().includes('business') || h.toLowerCase().includes('name')
    );
    
    if (!hasEmail && !hasBusinessName) {
      return NextResponse.json(
        { 
          error: 'CSV must contain either an email column or a business name column',
          headers: headers
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `CSV file uploaded successfully`,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        totalRows: lines.length - 1,
        headers: headers,
        hasEmailColumn: hasEmail,
        hasBusinessNameColumn: hasBusinessName
      },
      csvContent: csvContent
    });

  } catch (error) {
    console.error('Upload CSV error:', error);
    return NextResponse.json(
      { error: 'Failed to process CSV file: ' + error.message },
      { status: 500 }
    );
  }
}