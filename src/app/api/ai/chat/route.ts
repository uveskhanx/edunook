import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/server/admin';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are EduNook AI, the supreme intelligent assistant of EduNook.

━━━━━━━━━━━━━━━━━━━━
IMAGE GENERATION PROTOCOL (STRICT)
━━━━━━━━━━━━━━━━━━━━
- You MUST generate a visual whenever the user asks for one.
- Use EXACT syntax: [DRAW: detailed description]
- Make prompts descriptive and high-quality.
- Example: "Here is your drawing: [DRAW: a futuristic library, cinematic lighting, 8k]"

━━━━━━━━━━━━━━━━━━━━
IDENTITY & FORMATTING
━━━━━━━━━━━━━━━━━━━━
- Identity: EduNook AI.
- Formatting: # 🚀 Headings, ## 🔹 Section Headers, 💎 Bullets.`;

async function generateImage(prompt: string): Promise<string | null> {
  // SHIELD 1: Pollinations (PRIMARY - Ultra Reliable)
  try {
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&private=true&enhance=true&width=1024&height=1024&model=flux`;
    const check = await fetch(pollinationsUrl, { method: 'HEAD' });
    if (check.ok) return pollinationsUrl;
  } catch (e) {
    console.warn('Pollinations failed, trying Cloudflare...', e);
  }

  // SHIELD 2: Cloudflare Workers AI (SECONDARY - Backup)
  const cfId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  
  if (cfId && cfToken) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
        {
          headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
          method: "POST",
          body: JSON.stringify({ prompt }),
        }
      );

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
      }
    } catch (e) {
      console.error('Cloudflare Backup Failed:', e);
    }
  }

  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true`;
}

export async function POST(request: NextRequest) {
  try {
    const { chatId, userId, text, mediaUrl, mediaType } = await request.json();
    if (!chatId || !userId) return new Response(JSON.stringify({ error: 'Missing' }), { status: 400 });

    const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
    const messagesRef = adminDb.ref(`messages/${chatId}`);
    const snapshot = await messagesRef.orderByChild('createdAt').limitToLast(12).once('value');
    const messages: any[] = [];
    if (snapshot.exists()) snapshot.forEach((child) => messages.push(child.val()));

    async function fetchImageAsBase64(url: string) {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        return { base64: Buffer.from(ab).toString('base64'), mimeType: res.headers.get('content-type') || 'image/jpeg' };
      } catch (e) { return null; }
    }

    let hasImages = false;
    const rawHistory = await Promise.all(messages.map(async (msg) => {
      const isAI = msg.senderId === 'edunook-ai';
      let img = null;
      if (msg.mediaUrl && msg.mediaType === 'image' && !isAI && !msg.mediaUrl.startsWith('data:')) {
        img = await fetchImageAsBase64(msg.mediaUrl);
        if (img) hasImages = true;
      }
      return { role: isAI ? 'assistant' : 'user', text: msg.text || '', imageObj: img };
    }));

    let currentImageObj = null;
    if (mediaUrl && mediaType === 'image') {
      hasImages = true;
      currentImageObj = await fetchImageAsBase64(mediaUrl);
    }
    rawHistory.push({ role: 'user', text: text || '', imageObj: currentImageObj });

    let aiResponse = '';
    try {
      if (hasImages) throw new Error("Vision");
      const chatCompletion = await groq!.chat.completions.create({
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...rawHistory.map(m => ({ role: m.role, content: m.text })) as any[]],
        model: 'llama-3.1-8b-instant',
      });
      aiResponse = chatCompletion.choices[0]?.message?.content || '';
    } catch (e) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction: SYSTEM_PROMPT });
      const result = await model.generateContent({
        contents: rawHistory.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [...(m.text ? [{ text: m.text }] : []), ...(m.imageObj ? [{ inlineData: { data: m.imageObj.base64, mimeType: m.imageObj.mimeType } }] : [])]
        })) as any[]
      });
      aiResponse = result.response.text() || '';
    }

    let genMedia = null;
    const drawMatch = aiResponse.match(/\[DRAW:\s*(.*?)\]/i);
    if (drawMatch) {
      genMedia = await generateImage(drawMatch[1]);
      aiResponse = aiResponse.replace(/\[DRAW:.*?\]/gi, '').trim();
    }

    if (!aiResponse) aiResponse = "I'm ready! 🚀";

    const newMsgRef = messagesRef.push();
    const now = new Date().toISOString();
    await newMsgRef.set({ id: newMsgRef.key, senderId: 'edunook-ai', text: aiResponse, mediaUrl: genMedia, mediaType: genMedia ? 'image' : null, createdAt: now, seen: false });
    await adminDb.ref(`chats/${chatId}`).update({ lastMessage: genMedia ? '🖼️ Visual generated' : aiResponse, updatedAt: now, lastSenderId: 'edunook-ai' });
    await adminDb.ref(`chats/${chatId}/unreadCounts/${userId}`).transaction((c: any) => (c || 0) + 1);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
