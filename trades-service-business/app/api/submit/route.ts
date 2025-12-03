// src/app/api/submit/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { BUSINESS_CONFIG } from '@/app/config/business-config';
import { Lead } from '@/app/types/lead';

// Email service configuration (using Resend - 3,000 free emails/month)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BUSINESS_EMAIL = process.env.BUSINESS_EMAIL || 'your-business@example.com';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Cost-efficient email templates
function generateCustomerEmail(lead: Lead): EmailTemplate {
  const urgencyText = lead.urgency === 'emergency' 
    ? 'We understand this is urgent and will prioritize your request.'
    : lead.urgency === 'soon'
    ? 'We\'ll reach out within 24 hours to schedule your service.'
    : 'We\'ll contact you within 1-2 business days.';

  return {
    subject: `Thank you for contacting ${BUSINESS_CONFIG.name}!`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { background: #f9fafb; padding: 30px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; 
                     text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .details { background: white; padding: 15px; border-left: 4px solid #2563eb; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${BUSINESS_CONFIG.name}</h1>
              <p>Your Request Has Been Received</p>
            </div>
            <div class="content">
              <p>Hi ${lead.name},</p>
              <p>Thank you for reaching out to us! We've received your service request and our team is reviewing it.</p>
              
              <div class="details">
                <strong>Your Request Details:</strong><br>
                <strong>Issue:</strong> ${lead.issue || 'General inquiry'}<br>
                <strong>Location:</strong> ${lead.address}<br>
                ${lead.system_type ? `<strong>System Type:</strong> ${lead.system_type}<br>` : ''}
                ${lead.roof_type ? `<strong>Roof Type:</strong> ${lead.roof_type}<br>` : ''}
              </div>

              <p>${urgencyText}</p>
              
              <p><strong>What happens next?</strong></p>
              <ol>
                <li>Our expert will contact you to discuss your needs</li>
                <li>We'll schedule a convenient time for service/inspection</li>
                <li>You'll receive a detailed quote before any work begins</li>
              </ol>

              <p>In the meantime, feel free to call us at <strong>${BUSINESS_CONFIG.phone || '(555) 123-4567'}</strong> 
              if you have any urgent questions.</p>

              <p>Best regards,<br>
              <strong>The ${BUSINESS_CONFIG.name} Team</strong></p>
            </div>
            <div class="footer">
              <p>This is an automated confirmation email. Please do not reply.</p>
              <p>${BUSINESS_CONFIG.name} | ${BUSINESS_CONFIG.serviceArea || 'Your Service Area'}</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${lead.name},\n\nThank you for contacting ${BUSINESS_CONFIG.name}!\n\nWe've received your request for: ${lead.issue || 'General inquiry'}\nLocation: ${lead.address}\n\n${urgencyText}\n\nOur team will contact you shortly to discuss your needs.\n\nBest regards,\nThe ${BUSINESS_CONFIG.name} Team`
  };
}

function generateBusinessNotification(lead: Lead): EmailTemplate {
  const priorityFlag = lead.urgency === 'emergency' ? '🚨 EMERGENCY' : 
                       lead.urgency === 'soon' ? '⚡ URGENT' : '📋';

  return {
    subject: `${priorityFlag} New Lead: ${lead.name} - ${lead.issue || 'Service Request'}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .alert { background: ${lead.urgency === 'emergency' ? '#ef4444' : '#f59e0b'}; 
                    color: white; padding: 15px; text-align: center; font-weight: bold; }
            .lead-info { background: #f9fafb; padding: 20px; margin: 20px 0; }
            .field { padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            .label { font-weight: bold; color: #6b7280; }
            .value { margin-top: 5px; }
            .action { background: #10b981; color: white; padding: 15px; text-align: center; 
                     border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            ${lead.urgency === 'emergency' || lead.urgency === 'soon' ? 
              `<div class="alert">${priorityFlag} ${lead.urgency === 'emergency' ? 'EMERGENCY' : 'URGENT'} LEAD - RESPOND IMMEDIATELY</div>` 
              : ''}
            
            <h2>New ${BUSINESS_CONFIG.type} Lead</h2>
            
            <div class="lead-info">
              <div class="field">
                <div class="label">Customer Name</div>
                <div class="value">${lead.name}</div>
              </div>
              
              <div class="field">
                <div class="label">Phone</div>
                <div class="value"><a href="tel:${lead.phone}">${lead.phone}</a></div>
              </div>
              
              ${lead.email ? `
              <div class="field">
                <div class="label">Email</div>
                <div class="value"><a href="mailto:${lead.email}">${lead.email}</a></div>
              </div>` : ''}
              
              <div class="field">
                <div class="label">Address</div>
                <div class="value">${lead.address}</div>
              </div>
              
              <div class="field">
                <div class="label">Issue/Service Needed</div>
                <div class="value">${lead.issue || 'Not specified'}</div>
              </div>
              
              <div class="field">
                <div class="label">Urgency Level</div>
                <div class="value">${lead.urgency || 'Not specified'}</div>
              </div>
              
              ${lead.safety ? `
              <div class="field">
                <div class="label">Safety Concern</div>
                <div class="value">${lead.safety}</div>
              </div>` : ''}
              
              ${lead.system_type ? `
              <div class="field">
                <div class="label">System Type</div>
                <div class="value">${lead.system_type}</div>
              </div>` : ''}
              
              ${lead.roof_type ? `
              <div class="field">
                <div class="label">Roof Type</div>
                <div class="value">${lead.roof_type}</div>
              </div>` : ''}
            </div>

            <div class="action">
              ✅ Customer has received automatic confirmation email<br>
              🎯 Follow up within ${lead.urgency === 'emergency' ? '1 hour' : lead.urgency === 'soon' ? '4 hours' : '24 hours'}
            </div>
          </div>
        </body>
      </html>
    `,
    text: `${priorityFlag} NEW LEAD\n\nName: ${lead.name}\nPhone: ${lead.phone}\n${lead.email ? `Email: ${lead.email}\n` : ''}Address: ${lead.address}\nIssue: ${lead.issue || 'Not specified'}\nUrgency: ${lead.urgency || 'Not specified'}\n\nCustomer has received confirmation email.`
  };
}

// Cost-efficient email sender using Resend API
async function sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured - skipping email');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${BUSINESS_CONFIG.name} <onboarding@resend.dev>`, // Use your verified domain
        to: [to],
        subject: template.subject,
        html: template.html,
        text: template.text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Email send failed:', error);
      return false;
    }

    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
}

// Alternative: Free email via SMTP (Gmail, etc.)
async function sendEmailSMTP(to: string, template: EmailTemplate): Promise<boolean> {
  // For production, use nodemailer with Gmail SMTP or other provider
  // This is a placeholder showing the structure
  console.log(`SMTP email would be sent to: ${to}`);
  console.log(`Subject: ${template.subject}`);
  return true;
}

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Validate env vars
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase environment variables');
      return Response.json(
        { message: 'Server misconfiguration.' },
        { status: 500 }
      );
    }

    const formData = await request.json();

    // Validation
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

    // Save to database
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

    // Send emails asynchronously (don't block response)
    Promise.all([
      // Send confirmation to customer (if email provided)
      leadData.email ? sendEmail(leadData.email, generateCustomerEmail(leadData)) : Promise.resolve(false),
      // Send notification to business
      sendEmail(BUSINESS_EMAIL, generateBusinessNotification(leadData)),
    ]).catch(err => {
      // Log but don't fail the request if emails fail
      console.error('Email sending error:', err);
    });

    return Response.json({ 
      success: true,
      message: leadData.email ? 'Request submitted! Check your email for confirmation.' : 'Request submitted successfully!'
    });

  } catch (error) {
    console.error('Unexpected error in form submission:', error);
    return Response.json(
      { message: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

// Optional: Follow-up email campaign endpoint
export async function GET(request: NextRequest) {
  // This could be triggered by a cron job for follow-up campaigns
  const { searchParams } = new URL(request.url);
  const cronSecret = searchParams.get('secret');

  if (cronSecret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Find leads from 24 hours ago that haven't been contacted
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .eq('contacted', false)
      .lt('created_at', yesterday)
      .limit(50); // Process in batches

    if (leads && leads.length > 0) {
      console.log(`Sending follow-up emails to ${leads.length} leads`);
      
      for (const lead of leads) {
        if (lead.email) {
          const followUpEmail: EmailTemplate = {
            subject: `Following up on your ${BUSINESS_CONFIG.type} request`,
            html: `<p>Hi ${lead.name},</p><p>Just checking in on your recent service request. Have you had a chance to speak with our team?</p><p>If you still need assistance, please don't hesitate to reach out!</p>`,
            text: `Hi ${lead.name},\n\nJust checking in on your recent service request. Have you had a chance to speak with our team?\n\nIf you still need assistance, please don't hesitate to reach out!`
          };
          
          await sendEmail(lead.email, followUpEmail);
        }
      }
    }

    return Response.json({ processed: leads?.length || 0 });
  } catch (error) {
    console.error('Follow-up campaign error:', error);
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}