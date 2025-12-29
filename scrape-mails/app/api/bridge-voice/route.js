export default async function handler(req, res) {
  const { target, business, callId } = req.query;

  console.log(`🌉 Bridge call to ${business} at ${target}`);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    Hello Dulran, connecting you to ${business || 'the business'} now. Please hold.
  </Say>
  <Pause length="1"/>
  <Dial callerId="${process.env.TWILIO_PHONE_NUMBER}" timeout="45" record="record-from-answer">
    <Number>${decodeURIComponent(target)}</Number>
  </Dial>
  <Say voice="Polly.Joanna" language="en-US">
    The call has ended. Have a great day!
  </Say>
</Response>`;

  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml);
}
