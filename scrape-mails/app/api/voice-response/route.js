export default async function handler(req, res) {
  const { business, callId } = req.query;
  const { AnsweredBy } = req.body;

  console.log(`🎤 Voice response for ${business} - Answered by: ${AnsweredBy || 'unknown'}`);

  let twiml;

  // If voicemail detected
  if (AnsweredBy === 'machine_end_beep' || AnsweredBy === 'machine_end_silence' || AnsweredBy === 'machine_start') {
    console.log(`📞 Voicemail detected for ${business}`);
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="2"/>
  <Say voice="Polly.Joanna" language="en-US">
    Hi ${business || 'there'}, this is Dulran from Syndicate Solutions. 
    
    I'm a freelancer from Sri Lanka with a mini agency offering digital services including 
    content creation, web design, AI automation, and general online support.
    
    I'd love to discuss how I can help with reliable, fast, and high-quality digital work.
    
    You can reach me on WhatsApp at zero seven four one, one four three, three two three,
    or visit my portfolio at syndicate solutions dot vercel dot app.
    
    You can also book a 15-minute call at cal dot com slash syndicate dash solutions.
    
    Looking forward to connecting with you. Thank you!
  </Say>
  <Hangup/>
</Response>`;
  } else {
    // Human answered
    console.log(`👤 Human answered for ${business}`);
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    Hi ${business || 'there'}, it's a pleasure to meet you! This is Dulran from Syndicate Solutions.
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">
    I hope you're doing well. I'm a freelancer from Sri Lanka with a mini agency.
    I offer digital services including content creation, web design, AI automation, and online support.
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">
    If you need reliable, fast, and high-quality digital work, I'd be happy to help.
    
    You can check my portfolio at syndicate solutions dot vercel dot app,
    or connect with me on WhatsApp at zero seven four one, one four three, three two three.
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">
    I'll also send you a follow-up email with all my details. 
    Have a wonderful day, and I look forward to working with you!
  </Say>
  <Hangup/>
</Response>`;
  }

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml);
}