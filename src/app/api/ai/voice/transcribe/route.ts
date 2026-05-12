import { NextRequest } from 'next/server';

const GROQ_TRANSCRIBE_MODEL = 'whisper-large-v3-turbo';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Groq API key is not configured.' }), { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const language = formData.get('language');

    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'Missing audio file.' }), { status: 400 });
    }

    const groqForm = new FormData();
    groqForm.append('file', file, file.name || 'voice.webm');
    groqForm.append('model', GROQ_TRANSCRIBE_MODEL);
    groqForm.append('response_format', 'json');
    groqForm.append('temperature', '0');
    if (typeof language === 'string' && language.trim()) {
      groqForm.append('language', language.trim().slice(0, 2).toLowerCase());
    }

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: groqForm,
    });

    const payload = await response.json();
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: payload?.error?.message || payload?.error || 'Transcription failed.' }),
        { status: response.status }
      );
    }

    return new Response(JSON.stringify({ text: payload?.text || '' }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Voice transcription failed.' }), { status: 500 });
  }
}
