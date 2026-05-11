import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/server/admin';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are EduNook AI, the supreme intelligent assistant.

━━━━━━━━━━━━━━━━━━━━
IMAGE GENERATION PROTOCOL (STRICT)
━━━━━━━━━━━━━━━━━━━━
- To generate an image, ONLY use this syntax: [DRAW: detailed prompt]
- DO NOT output status messages like "[Visual output is being generated...]" or "[Visual displayed]".
- DO NOT use any other bracketed text.
- Example: "Here is your diagram: [DRAW: human eye anatomy, 3d medical render, 8k]"

━━━━━━━━━━━━━━━━━━━━
IDENTITY & FORMATTING
━━━━━━━━━━━━━━━━━━━━
- Identity: EduNook AI.
- Formatting: # 🚀 Headings, ## 🔹 Section Headers, 💎 Bullets.`;

async function generateImage(prompt: string): Promise<string | null> {
  const cleanPrompt = prompt.replace(/[^\w\s,.-]/gi, '').substring(0, 400).trim();
  // Ensure we have a valid prompt
  if (!cleanPrompt || cleanPrompt.length < 3) return null;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?nologo=true&private=true&enhance=true&width=1024&height=1024&model=flux`;
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

    // --- UNIVERSAL IMAGE & STATUS CATCHER ---
    let genMedia = null;
    
    // 1. Extract the BEST prompt from any bracketed text
    // Looks for DRAW, Diagram, Visual, or Generated content
    const universalRegex = /\[[^\]]*?(?:DRAW|DIAGRAM|VISUAL|GENERATED)[\s\S]*?[:\-]*\s*([\s\S]*?)\]/i;
    const match = aiResponse.match(universalRegex);
    if (match) {
      const prompt = match[1].trim();
      if (prompt && prompt.length > 3) {
        genMedia = await generateImage(prompt);
      }
    }

    // 2. TOTAL WIPEOUT: Remove ALL bracketed text from the response
    // This cleans up status messages, tags, and AI improvisation
    aiResponse = aiResponse.replace(/\[[\s\S]*?\]/gi, '').trim();

    if (!aiResponse && !genMedia) aiResponse = "I am ready to assist you! 🚀";

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
