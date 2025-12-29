export default async function handler(req, res) {
  const { business, callId } = req.query;
  const { Digits } = req.body;

  console.log(`🎛️ Interactive IVR for ${business} - Digits: ${Digits || 'initial'}`);

  let twiml;

  if (!Digits) {
    // Initial greeting
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="/api/interactive-voice?business=${encodeURIComponent(business || 'your business')}&callId=${callId}" numDigits="1" timeout="10">
    <Say voice="Polly.Joanna" language="en-US">
      Hi! This is Dulran from Syndicate Solutions.
      I'm a freelancer from Sri Lanka offering digital services including web design, AI automation, and content creation.
    </Say>
    <Pause length="1"/>
    <Say voice="Polly.Joanna" language="en-US">
      Press 1 to hear more about our services.
      Press 2 to schedule a callback.
      Press 3 if you're not interested.
    </Say>
  </Gather>
  <Say voice="Polly.Joanna" language="en-US">We didn't receive any input. Goodbye!</Say>
  <Hangup/>
</Response>`;
  } else if (Digits === '1') {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    Great! We offer three main services: 
    Custom web development, AI automation for business processes, and white-label solutions for agencies.
    Most clients start with a 500 dollar test project.
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">
    Visit syndicate solutions dot vercel dot app for my portfolio,
    or call me on WhatsApp at zero seven four one, one four three, three two three.
    You can also book a 15-minute call at cal dot com slash syndicate dash solutions.
    Thank you!
  </Say>
  <Hangup/>
</Response>`;
  } else if (Digits === '2') {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    Perfect! Please visit cal dot com slash syndicate dash solutions to book a time, 
    or text me on WhatsApp at zero seven four one, one four three, three two three.
    I'll also send you an email. Thank you!
  </Say>
  <Hangup/>
</Response>`;
  } else if (Digits === '3') {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    Understood. You'll be removed from our calling list. Have a great day!
  </Say>
  <Hangup/>
</Response>`;
  } else {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    Sorry, that wasn't a valid option. Goodbye!
  </Say>
  <Hangup/>
</Response>`;
  }

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml);
}