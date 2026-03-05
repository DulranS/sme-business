// app/api/email-templates/route.js
import { NextResponse } from 'next/server';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// 3-Template Email System
const DEFAULT_TEMPLATES = {
  email1: {
    name: 'Email1 - Introduction',
    subject: 'Quick question about {{company_name}}',
    body: `Hi {{first_name}},

{{personalization_observation}}

{{personalization_impact}}

Worth a quick 10-min chat next week to discuss how we help {{industry}} companies with {{pain_point}}?

Book here: {{booking_link}}

Best regards,
{{sender_name}}

P.S. I'm in {{timezone}} - happy to work around your schedule.`,
    wordCount: 85,
    variables: ['first_name', 'company_name', 'personalization_observation', 'personalization_impact', 'industry', 'pain_point', 'booking_link', 'sender_name', 'timezone'],
    sequenceStep: 1,
    daysDelay: 0
  },
  email2: {
    name: 'Email2 - Social Proof',
    subject: 'Re: {{company_name}}',
    body: `Hi {{first_name}},

Following up on my previous email.

{{social_proof_company}} (similar {{industry}} company) was struggling with {{pain_point}} until they implemented our solution. They achieved {{result_metric}} within {{timeframe}}.

Thought you might find this relevant given {{trigger_event}} at {{company_name}}.

Still open for that 10-min chat? {{booking_link}}

Best regards,
{{sender_name}}`,
    wordCount: 78,
    variables: ['first_name', 'company_name', 'social_proof_company', 'industry', 'pain_point', 'result_metric', 'timeframe', 'trigger_event', 'booking_link', 'sender_name'],
    sequenceStep: 2,
    daysDelay: 3
  },
  breakup: {
    name: 'Break-up Email',
    subject: 'Closing the loop',
    body: `Hi {{first_name}},

I've reached out a couple times about helping {{company_name}} with {{pain_point}} but haven't heard back.

Assuming this isn't a priority right now, I'll close your file.

If things change or you'd like to revisit in the future, feel free to reach out.

Best regards,
{{sender_name}}`,
    wordCount: 47,
    variables: ['first_name', 'company_name', 'pain_point', 'sender_name'],
    sequenceStep: 3,
    daysDelay: 7
  }
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const templateName = searchParams.get('template');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    if (templateName) {
      // Get specific template
      const docRef = doc(db, 'email_templates', `${userId}_${templateName}`);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return NextResponse.json({ success: true, template: docSnap.data() });
      } else if (DEFAULT_TEMPLATES[templateName]) {
        return NextResponse.json({ success: true, template: DEFAULT_TEMPLATES[templateName] });
      } else {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
    } else {
      // Get all templates for user
      const q = query(collection(db, 'email_templates'), where('userId', '==', userId));
      const querySnapshot = await getDocs(q);
      
      const templates = {};
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        templates[data.name] = data;
      });

      // Merge with defaults if user hasn't customized
      Object.keys(DEFAULT_TEMPLATES).forEach(key => {
        if (!templates[key]) {
          templates[key] = { ...DEFAULT_TEMPLATES[key], isDefault: true };
        }
      });

      return NextResponse.json({ success: true, templates: templates });
    }
  } catch (error) {
    console.error('Get email templates error:', error);
    return NextResponse.json({ error: 'Failed to get email templates' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { userId, templateName, template } = await request.json();
    
    if (!userId || !templateName || !template) {
      return NextResponse.json({ error: 'User ID, template name, and template data required' }, { status: 400 });
    }

    // Validate template
    const validation = validateTemplate(template);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Save template
    const docRef = doc(db, 'email_templates', `${userId}_${templateName}`);
    await setDoc(docRef, {
      ...template,
      userId: userId,
      name: templateName,
      updatedAt: new Date().toISOString(),
      isDefault: false
    });

    return NextResponse.json({ 
      success: true, 
      message: `Template ${templateName} saved successfully`,
      validation: validation
    });
  } catch (error) {
    console.error('Save email template error:', error);
    return NextResponse.json({ error: 'Failed to save email template' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { userId, templateName, updates } = await request.json();
    
    if (!userId || !templateName || !updates) {
      return NextResponse.json({ error: 'User ID, template name, and updates required' }, { status: 400 });
    }

    const docRef = doc(db, 'email_templates', `${userId}_${templateName}`);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Validate updated template
    const updatedTemplate = { ...docSnap.data(), ...updates };
    const validation = validateTemplate(updatedTemplate);
    
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    return NextResponse.json({ 
      success: true, 
      message: `Template ${templateName} updated successfully`,
      validation: validation
    });
  } catch (error) {
    console.error('Update email template error:', error);
    return NextResponse.json({ error: 'Failed to update email template' }, { status: 500 });
  }
}

function validateTemplate(template) {
  const required = ['subject', 'body', 'variables'];
  
  for (const field of required) {
    if (!template[field]) {
      return { isValid: false, error: `${field} is required` };
    }
  }

  // Check word count (should be < 120 words)
  const wordCount = template.body.split(/\s+/).length;
  if (wordCount > 120) {
    return { isValid: false, error: `Template body must be less than 120 words (currently ${wordCount})` };
  }

  // Check for booking link placeholder
  if (!template.body.includes('{{booking_link}}')) {
    return { isValid: false, error: 'Template must include {{booking_link}} placeholder' };
  }

  // Check for timezone note
  if (!template.body.includes('{{timezone}}')) {
    return { isValid: false, error: 'Template must include {{timezone}} placeholder for scheduling note' };
  }

  // Validate variables in body
  const bodyVariables = extractVariables(template.body);
  const subjectVariables = extractVariables(template.subject);
  const allVariables = [...bodyVariables, ...subjectVariables];
  
  // Check if all variables in content are defined in template.variables
  const undefinedVars = allVariables.filter(v => !template.variables.includes(v));
  if (undefinedVars.length > 0) {
    return { isValid: false, error: `Undefined variables in template: ${undefinedVars.join(', ')}` };
  }

  return { isValid: true, wordCount: wordCount };
}

function extractVariables(text) {
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map(m => m.replace(/\{\{|\}\}/g, '').trim());
}

// Personalization engine
export async function POST(request) {
  try {
    const { userId, companyName, decisionMaker, research, templateName } = await request.json();
    
    if (!userId || !companyName || !decisionMaker || !research || !templateName) {
      return NextResponse.json({ error: 'Missing required fields for personalization' }, { status: 400 });
    }

    // Get template
    const templateResponse = await GET(new URL(`http://localhost:3000/api/email-templates?userId=${userId}&template=${templateName}`));
    const templateData = await templateResponse.json();
    
    if (!templateData.success) {
      return NextResponse.json({ error: 'Failed to get template' }, { status: 400 });
    }

    const template = templateData.template;

    // Generate personalization
    const personalization = generatePersonalization(decisionMaker, research, template);

    // Render template with personalization
    const renderedEmail = renderTemplate(template, {
      first_name: decisionMaker.name.split(' ')[0],
      company_name: companyName,
      sender_name: 'Your Name', // Get from user profile
      timezone: 'EST', // Get from user profile
      booking_link: 'https://calendly.com/your-link', // Get from user profile
      ...personalization
    });

    return NextResponse.json({
      success: true,
      personalizedEmail: renderedEmail,
      personalization: personalization,
      template: templateName
    });
  } catch (error) {
    console.error('Email personalization error:', error);
    return NextResponse.json({ error: 'Email personalization failed' }, { status: 500 });
  }
}

function generatePersonalization(decisionMaker, research, template) {
  const personalization = {};

  // Generate observation (1 factual observation)
  if (research.recentTriggers && research.recentTriggers.length > 0) {
    const trigger = research.recentTriggers[0];
    personalization.personalization_observation = `Saw that ${research.companyName} recently ${trigger.description}`;
  } else {
    personalization.personalization_observation = `Noticed ${research.companyName} is in the ${research.industry} space`;
  }

  // Generate impact (1 business impact)
  if (research.painPoints && research.painPoints.length > 0) {
    const painPoint = research.painPoints[0];
    personalization.personalization_impact = `Companies in your space typically see 30% improvement in ${painPoint.type} when addressing this early.`;
  } else {
    personalization.personalization_impact = `This is usually a priority for ${research.industry} companies at your stage.`;
  }

  // Add template-specific variables
  if (template.name.includes('Social Proof')) {
    personalization.social_proof_company = 'Similar Company Inc';
    personalization.result_metric = '40% increase in leads';
    personalization.timeframe = '3 months';
    personalization.trigger_event = research.recentTriggers[0]?.type || 'recent developments';
  }

  personalization.industry = research.industry || 'your industry';
  personalization.pain_point = research.painPoints[0]?.type || 'growth challenges';

  return personalization;
}

function renderTemplate(template, variables) {
  let rendered = {
    subject: template.subject,
    body: template.body
  };

  // Replace variables in subject and body
  Object.keys(variables).forEach(key => {
    const placeholder = `{{${key}}}`;
    rendered.subject = rendered.subject.replace(new RegExp(placeholder, 'g'), variables[key]);
    rendered.body = rendered.body.replace(new RegExp(placeholder, 'g'), variables[key]);
  });

  return rendered;
}
