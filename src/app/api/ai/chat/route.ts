import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/server/admin';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are EduNook AI, the supreme intelligent assistant of EduNook.

━━━━━━━━━━━━━━━━━━━━
IMAGE GENERATION PROTOCOL (MANDATORY)
━━━━━━━━━━━━━━━━━━━━
- Whenever the user asks to "draw", "generate", "create an image", or "show a visual", you MUST respond with the [DRAW: prompt] tag.
- Use EXACT syntax: [DRAW: detailed description]
- Example: "Here is your drawing: [DRAW: a futuristic library, 8k]"

━━━━━━━━━━━━━━━━━━━━
IDENTITY & FORMATTING
━━━━━━━━━━━━━━━━━━━━
- Identity: EduNook AI.
- Formatting: # 🚀 Headings, ## 🔹 Section Headers, 💎 Bullets.`;

async function generateImage(prompt: string): Promise<string | null> {
  // Clean and Truncate Prompt for URL Safety
  const cleanPrompt = prompt.replace(/[^\w\s,.-]/gi, '').substring(0, 500).trim();
  
  try {
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?nologo=true&private=true&enhance=true&width=1024&height=1024&model=flux`;
    const check = await fetch(pollinationsUrl, { method: 'HEAD' });
    if (check.ok) return pollinationsUrl;
  } catch (e) {}

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
        }
      );
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
      }
    } catch (e) {}
  }
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?nologo=true`;
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

    // --- TOTAL WIPEOUT TAG PARSING ---
    let genMedia = null;
    let finalPrompt = '';

    // Pass 1: Extraction
    const extractRegex = /\[\s*DRAW\s*[:\-]*\s*([\s\S]*?)\]/i;
    const match = aiResponse.match(extractRegex);
    if (match) {
      finalPrompt = match[1].trim();
      genMedia = await generateImage(finalPrompt);
    }

    // Pass 2: The "Total Wipeout" (Universal Stripping)
    // This removes ANYTHING inside brackets that contains the word DRAW
    aiResponse = aiResponse.replace(/\[[^\]]*?DRAW[\s\S]*?\]/gi, '');
    aiResponse = aiResponse.replace(/\*\*\[[^\]]*?DRAW[\s\S]*?\]\*\*/gi, '');
    aiResponse = aiResponse.trim();

    if (!aiResponse && !genMedia) aiResponse = "Visualizing now... 🚀";

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
