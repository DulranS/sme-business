// src/app/api/submit/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { BUSINESS_CONFIG } from '@/app/config/business-config';
import { Lead } from '@/app/types/lead';

// Initialize Supabase server client (using service role for full access)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ Server-side only!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.json();

    // Basic validation
    if (!formData.name || !formData.phone || !formData.address) {
      return Response.json(
        { message: 'Please fill in all required fields.' },
        { status: 400 }
      );
    }

    // Prepare data for Supabase
    // Only include fields that exist in your table
    const leadData : Lead = {
      business_type: BUSINESS_CONFIG.type,
      name: formData.name,
      phone: formData.phone,
      email: formData.email || null,
      address: formData.address,
      // Service-specific fields (only include if they exist)
      issue: formData.issue || null,
      urgency: formData.urgency || null,
      safety: formData.safety || null,
      system_type: formData['system-type'] || null, // note: form uses 'system-type'
      roof_type: formData['roof-type'] || null,
      // Add more as needed based on your form-config.ts
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from('leads')
      .insert(leadData)
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return Response.json(
        { message: 'Failed to save your request. Please try again.' },
        { status: 500 }
      );
    }

    // ✅ Success! Lead saved.
    console.log('Lead saved to Supabase:', data);

    // Optional: Trigger email notification, webhook, etc. here

    return Response.json({ success: true });
  } catch (error) {
    console.error('Unexpected error in form submission:', error);
    return Response.json(
      { message: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}