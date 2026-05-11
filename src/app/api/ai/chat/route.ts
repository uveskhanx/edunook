import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/server/admin';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';

const SYSTEM_PROMPT = `You are EduNook AI, the supreme assistant.

━━━━━━━━━━━━━━━━━━━━
IMAGE GENERATION PROTOCOL
━━━━━━━━━━━━━━━━━━━━
- To generate an image, ONLY use: [DRAW: detailed prompt]
- Example: [DRAW: human eye anatomy, 3d render, 8k]

━━━━━━━━━━━━━━━━━━━━
IDENTITY & FORMATTING
━━━━━━━━━━━━━━━━━━━━
- Identity: EduNook AI.
- Formatting: # 🚀 Headings, ## 🔹 Section Headers, 💎 Bullets.`;

async function uploadToCloudinary(buffer: ArrayBuffer, prompt: string): Promise<string | null> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('Cloudinary credentials missing');
    return null;
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'edunook/ai-gen';
    
    // Create signature
    const strToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(strToSign).digest('hex');

    const formData = new FormData();
    const blob = new Blob([buffer]);
    formData.append('file', blob);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', folder);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      return data.secure_url;
    }
    return null;
  } catch (e) {
    console.error('Cloudinary Upload Failed:', e);
    return null;
  }
}

async function generateImage(prompt: string): Promise<string | null> {
  const cleanPrompt = prompt.replace(/[^\w\s,.:()\-]/gi, ' ').substring(0, 1000).trim();
  if (!cleanPrompt || cleanPrompt.length < 3) return null;

  try {
    const pollinationsUrl = `https://pollinations.ai/p/${encodeURIComponent(cleanPrompt)}?width=1024&height=1024&model=flux&seed=${Math.floor(Math.random() * 100000)}`;
    const res = await fetch(pollinationsUrl, { signal: AbortSignal.timeout(20000) });
    
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > 1000) {
        return await uploadToCloudinary(buffer, cleanPrompt);
      }
    }
  } catch (e) {}

  // Backup: Cloudflare Workers AI
  const cfId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  if (cfId && cfToken) {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`,
        {
          headers: { Authorization: `Bearer ${cfToken}`, "Content-Type": "application/json" },
          method: "POST",
          body: JSON.stringify({ prompt: cleanPrompt }),
          signal: AbortSignal.timeout(15000)
        }
      );
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 1000) {
          return await uploadToCloudinary(buffer, cleanPrompt);
        }
      }
    } catch (e) {}
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { chatId, userId, text, mediaUrl, mediaType } = await request.json();
    if (!chatId || !userId) return new Response(JSON.stringify({ error: 'Missing' }), { status: 400 });

    const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
    const messagesRef = adminDb.ref(`messages/${chatId}`);
    const snapshot = await messagesRef.orderByChild('createdAt').limitToLast(12).once('value');
    const messages: any[] = [];
    if (snapshot.exists()) snapshot.forEach((child) => { messages.push(child.val()); });

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

    if (mediaUrl && mediaType === 'image') {
      hasImages = true;
      rawHistory.push({ role: 'user', text: text || '', imageObj: await fetchImageAsBase64(mediaUrl) });
    } else {
      rawHistory.push({ role: 'user', text: text || '', imageObj: null });
    }

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

    // --- UNIVERSAL PARSER ---
    let genMedia = null;
    const universalRegex = /\[[^\]]*?(?:DRAW|DIAGRAM|VISUAL|GENERATED)[\s\S]*?[:\-]*\s*([\s\S]*?)\]/i;
    const match = aiResponse.match(universalRegex);
    
    if (match) {
      const prompt = match[1].trim();
      if (prompt && prompt.length > 3) {
        genMedia = await generateImage(prompt);
      }
    }

    aiResponse = aiResponse.replace(/\[[\s\S]*?\]/gi, '').trim();

    if (!aiResponse && !genMedia) aiResponse = "I'm ready! 🚀";

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
