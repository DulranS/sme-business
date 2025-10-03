"use server";
import { ElevenLabsClient, ElevenLabs } from "elevenlabs";
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const { textPrompt, voiceId } = await req.json();
    
    const client = new ElevenLabsClient({ apiKey: process.env.ELEVEN_LABS_API_KEY });
    
    const audio = await client.textToSpeech.convert(voiceId, {
      optimize_streaming_latency: ElevenLabs.OptimizeStreamingLatency.Zero,
      output_format: ElevenLabs.OutputFormat.Mp3_22050_32,
      text: textPrompt,
      voice_settings: {
        stability: 0.1,
        similarity_boost: 0.3,
        style: 0.2
      }
    });

    // Convert the audio buffer to a Uint8Array
    const audioArray = new Uint8Array(audio);

    // Return the audio as a response with appropriate headers
    return new NextResponse(audioArray, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioArray.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error in text-to-speech conversion:', error);
    return NextResponse.json({ error: 'Failed to convert text to speech' }, { status: 500 });
  }
}