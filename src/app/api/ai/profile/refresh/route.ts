import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';
import { adminDb } from '@/lib/server/admin';

const MAX_CHATS_TO_SCAN = 8;
const MAX_MESSAGES_PER_CHAT = 30;
const GROQ_SUMMARY_MODEL = 'llama-3.1-8b-instant';

type AiProfileRefreshResult = {
  preferredLanguage: string | null;
  chatStyle: 'short' | 'balanced' | 'detailed';
  tone: 'calm' | 'casual' | 'playful' | 'formal';
  vibe: 'cool' | 'aesthetic' | 'dark' | 'bright' | 'minimal';
  emojiStyle: 'low' | 'medium' | 'high';
  responseEnergy: 'low' | 'medium' | 'high';
  favoriteTopics: string[];
  summary: string;
};

function detectPreferredLanguageFromText(text: string) {
  if (!text.trim()) return null;
  if (/[\u0600-\u06FF]/.test(text)) return 'Urdu';
  if (/[\u0900-\u097F]/.test(text)) return 'Hindi';
  if (/[a-z]/i.test(text)) return 'English';
  return null;
}

function inferChatStyle(text: string): AiProfileRefreshResult['chatStyle'] {
  const clean = text.trim();
  if (clean.length <= 35) return 'short';
  if (clean.length >= 220) return 'detailed';
  return 'balanced';
}

function inferTone(text: string): AiProfileRefreshResult['tone'] {
  if (/\b(sir|please|kindly|regards|thank you)\b/i.test(text)) return 'formal';
  if (/(😂|🤣|lol|lmao|bro|bruh|yaar|hehe|haha)/i.test(text)) return 'playful';
  if (/[!?]{2,}/.test(text)) return 'casual';
  return 'calm';
}

function inferVibe(text: string, darkMode?: boolean | null): AiProfileRefreshResult['vibe'] {
  const lower = text.toLowerCase();
  if (/\baesthetic\b/.test(lower)) return 'aesthetic';
  if (/\bcool\b/.test(lower)) return 'cool';
  if (/\bminimal\b/.test(lower)) return 'minimal';
  if (darkMode === true) return 'dark';
  if (darkMode === false) return 'bright';
  return 'cool';
}

function inferEmojiStyle(text: string): AiProfileRefreshResult['emojiStyle'] {
  const emojiCount = Array.from(text).filter((char) => /\p{Extended_Pictographic}/u.test(char)).length;
  if (emojiCount >= 3) return 'high';
  if (emojiCount >= 1) return 'medium';
  return 'low';
}

function inferResponseEnergy(text: string): AiProfileRefreshResult['responseEnergy'] {
  if (/[!?]{2,}|all caps|omg|wow/i.test(text)) return 'high';
  if (text.length < 25) return 'low';
  return 'medium';
}

function inferFavoriteTopics(texts: string[]) {
  const joined = texts.join(' ').toLowerCase();
  const topicMatchers: Record<string, RegExp> = {
    study: /\b(study|exam|test|school|college|university|homework|learning)\b/g,
    coding: /\b(code|coding|programming|developer|bug|api|website|app)\b/g,
    design: /\b(design|ui|ux|aesthetic|theme|color|style)\b/g,
    editing: /\b(image|photo|edit|background|video|thumbnail)\b/g,
    life: /\b(friend|family|love|life|mood|feeling|sad|happy)\b/g,
  };

  return Object.entries(topicMatchers)
    .filter(([, regex]) => (joined.match(regex) || []).length >= 2)
    .map(([topic]) => topic)
    .slice(0, 5);
}

function buildFallbackProfile(texts: string[], darkMode?: boolean | null): AiProfileRefreshResult {
  const joined = texts.join(' ').trim();
  const preferredLanguage = detectPreferredLanguageFromText(joined) || 'English';
  const chatStyle = inferChatStyle(joined);
  const tone = inferTone(joined);
  const vibe = inferVibe(joined, darkMode);
  const emojiStyle = inferEmojiStyle(joined);
  const responseEnergy = inferResponseEnergy(joined);
  const favoriteTopics = inferFavoriteTopics(texts);
  const summaryParts = [
    `Usually chats in ${preferredLanguage}`,
    `prefers ${chatStyle} replies`,
    `overall tone is ${tone}`,
    `vibe leans ${vibe}`,
  ];

  if (favoriteTopics.length) {
    summaryParts.push(`often talks about ${favoriteTopics.join(', ')}`);
  }

  return {
    preferredLanguage,
    chatStyle,
    tone,
    vibe,
    emojiStyle,
    responseEnergy,
    favoriteTopics,
    summary: summaryParts.join('; ') + '.',
  };
}

function safeParseJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

async function buildGroqProfile(texts: string[], darkMode?: boolean | null): Promise<AiProfileRefreshResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || texts.length === 0) return null;

  const groq = new Groq({ apiKey });
  const sample = texts.slice(-60).join('\n');

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_SUMMARY_MODEL,
      temperature: 0.2,
      max_completion_tokens: 260,
      messages: [
        {
          role: 'system',
          content:
            'Analyze the user messages and return only valid JSON with keys: preferredLanguage, chatStyle, tone, vibe, emojiStyle, responseEnergy, favoriteTopics, summary. ' +
            'chatStyle must be one of short, balanced, detailed. tone must be one of calm, casual, playful, formal. vibe must be one of cool, aesthetic, dark, bright, minimal. ' +
            'emojiStyle must be one of low, medium, high. responseEnergy must be one of low, medium, high. ' +
            'favoriteTopics must be an array of up to 5 short strings. summary must be one short paragraph. Keep it concise and practical.',
        },
        {
          role: 'user',
          content: `Dark mode preference: ${darkMode === null ? 'unknown' : darkMode ? 'dark' : 'light'}\n\nUser messages:\n${sample}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '';
    const parsed = safeParseJsonObject(raw) as Partial<AiProfileRefreshResult> | null;
    if (!parsed) return null;

    return {
      preferredLanguage: parsed.preferredLanguage || 'English',
      chatStyle: parsed.chatStyle === 'short' || parsed.chatStyle === 'detailed' ? parsed.chatStyle : 'balanced',
      tone: parsed.tone === 'casual' || parsed.tone === 'playful' || parsed.tone === 'formal' ? parsed.tone : 'calm',
      vibe: parsed.vibe === 'aesthetic' || parsed.vibe === 'dark' || parsed.vibe === 'bright' || parsed.vibe === 'minimal' ? parsed.vibe : 'cool',
      emojiStyle: parsed.emojiStyle === 'medium' || parsed.emojiStyle === 'high' ? parsed.emojiStyle : 'low',
      responseEnergy: parsed.responseEnergy === 'low' || parsed.responseEnergy === 'high' ? parsed.responseEnergy : 'medium',
      favoriteTopics: Array.isArray(parsed.favoriteTopics) ? parsed.favoriteTopics.map(String).slice(0, 5) : [],
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : buildFallbackProfile(texts, darkMode).summary,
    };
  } catch (error) {
    console.warn('Groq AI profile refresh failed.', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400 });
    }

    const [userChatsSnap, settingsSnap] = await Promise.all([
      adminDb.ref(`user_chats/${userId}`).get(),
      adminDb.ref(`user_settings/${userId}`).get(),
    ]);

    const userChats = userChatsSnap.exists() ? Object.keys(userChatsSnap.val() || {}) : [];
    const darkMode = typeof settingsSnap.val()?.preferences?.app?.darkMode === 'boolean'
      ? settingsSnap.val().preferences.app.darkMode
      : null;
    const existingProfile = settingsSnap.val()?.ai_profile || {};

    const chatMeta = await Promise.all(
      userChats.map(async (chatId) => {
        const snap = await adminDb.ref(`chats/${chatId}`).get();
        return snap.exists() ? { chatId, ...(snap.val() || {}) } : null;
      })
    );

    const recentChats = chatMeta
      .filter(Boolean)
      .sort((a: any, b: any) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, MAX_CHATS_TO_SCAN);

    const messageSnaps = await Promise.all(
      recentChats.map((chat: any) =>
        adminDb.ref(`messages/${chat.chatId}`).orderByChild('createdAt').limitToLast(MAX_MESSAGES_PER_CHAT).get()
      )
    );

    const userTexts = messageSnaps.flatMap((snap) => {
      if (!snap.exists()) return [] as string[];
      const items: string[] = [];
      snap.forEach((child) => {
        const value = child.val();
        if (value?.senderId === userId && typeof value?.text === 'string' && value.text.trim()) {
          items.push(value.text.trim());
        }
      });
      return items;
    });

    const fallback = buildFallbackProfile(userTexts, darkMode);
    const groqProfile = await buildGroqProfile(userTexts, darkMode);
    const nextProfile: AiProfileRefreshResult = groqProfile || fallback;

    const merged = {
      ...existingProfile,
      preferredLanguage: nextProfile.preferredLanguage,
      chatStyle: nextProfile.chatStyle,
      tone: nextProfile.tone,
      vibe: nextProfile.vibe,
      emojiStyle: nextProfile.emojiStyle,
      responseEnergy: nextProfile.responseEnergy,
      favoriteTopics: nextProfile.favoriteTopics,
      summary: nextProfile.summary,
      lastUpdatedAt: new Date().toISOString(),
    };

    await adminDb.ref(`user_settings/${userId}/ai_profile`).update(merged);

    return new Response(JSON.stringify({ success: true, aiProfile: merged, scannedMessages: userTexts.length }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Refresh failed' }), { status: 500 });
  }
}
