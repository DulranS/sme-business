// src/app/api/submit/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { BUSINESS_CONFIG } from '@/app/config/business-config';
import { Lead } from '@/app/types/lead';

// ✅ Do NOT initialize client at the top level
// Move it inside the handler

export async function POST(request: NextRequest) {
  // 🔐 Initialize Supabase client inside the request handler
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Validate env vars early (optional but helpful)
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      return Response.json(
        { message: 'Server misconfiguration.' },
        { status: 500 }
      );
    }

    const formData = await request.json();

    if (!formData.name || !formData.phone || !formData.address) {
      return Response.json(
        { message: 'Please fill in all required fields.' },
        { status: 400 }
      );
    }

    const leadData: Lead = {
      business_type: BUSINESS_CONFIG.type,
      name: formData.name,
      phone: formData.phone,
      email: formData.email || null,
      address: formData.address,
      issue: formData.issue || null,
      urgency: formData.urgency || null,
      safety: formData.safety || null,
      system_type: formData['system-type'] || null,
      roof_type: formData['roof-type'] || null,
    };

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

    console.log('Lead saved to Supabase:', data);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Unexpected error in form submission:', error);
    return Response.json(
      { message: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}