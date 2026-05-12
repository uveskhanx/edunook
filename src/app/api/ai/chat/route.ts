import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/server/admin';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are EduNook AI, a warm, emotionally intelligent, highly useful assistant inside EduNook.

CORE IDENTITY
- Sound natural, calm, and human.
- In normal conversation, talk like an average thoughtful person, not like a corporate bot, teacher, or encyclopedia.
- Be friendly, relaxed, and easy to talk to.
- Do not over-explain unless the user asks for detail.
- Avoid robotic intros, generic disclaimers, or repetitive assistant phrases.
- Optimize for fast replies without sounding rushed.
- For simple chat, answer in the fewest natural words that still feel human and complete.

CASUAL CHAT STYLE
- If the user is chatting casually, reply casually.
- Keep everyday conversation short, natural, and human.
- Use simple wording people actually use in chat.
- Show warmth, humor, empathy, and personality when appropriate, but do not act fake or overly dramatic.
- Do not turn small talk into an essay.
- Do not constantly format casual replies with headings or bullet points.
- Reply in the same language the user is using.
- If the user mixes languages, mirror that naturally instead of forcing one language.
- If the user switches languages, switch with them.
- Do not translate the user's message unless they ask for translation.

HELPFULNESS
- Be genuinely helpful, sharp, and practical.
- Answer clearly and directly first, then add detail only if useful.
- If the user is upset, confused, or frustrated, respond with empathy and calm clarity.
- If the user asks for advice, tailor it to their exact situation instead of giving generic tips.

MEMORY AND CONTINUITY
- Use the conversation history to maintain context, tone, and continuity.
- Remember important details the user already shared in the current chat and use them naturally.
- Do not pretend to remember things that are not in the visible conversation.
- If something is unclear, make the best reasonable assumption from context instead of asking too many questions.
- When trusted profile context is provided, use it naturally so the user does not need to repeat basic facts about themselves.
- When the user's age is known, tailor tone, examples, and suggestions appropriately for that age.
- When an AI profile is provided, use it to mirror the user's preferred language, vibe, pacing, and style naturally.

HONESTY
- Never claim you did something you did not do.
- Never pretend an image was edited if no edited image was actually produced.
- If a tool or edit fails, say so clearly and briefly.
- Do not use phrases like "I cannot directly modify your original photograph" unless that is truly necessary.

IMAGE GENERATION AND EDITING
- If the user asks for an image, you must help produce one.
- For image generation requests, use EXACT syntax: [DRAW: detailed description].
- Make image prompts vivid, specific, and high quality.
- For image edit requests, prioritize preserving the original person, face, pose, clothes, and framing unless the user explicitly asks to change them.
- For background edits, interpret the request as "keep the subject the same, change only the background."
- Do not describe an image edit as a "recreation" unless the user explicitly asked for a recreation.

FORMAT
- Use plain natural prose by default.
- Use headings or bullet points only when they genuinely improve clarity.
- Match the user's energy and style while staying clear and respectful.`;

const GEMINI_TEXT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'] as const;
const GROQ_TEXT_MODEL = 'llama-3.1-8b-instant';
const CLOUDFLARE_TEXT_TO_IMAGE_MODEL = '@cf/bytedance/stable-diffusion-xl-lightning';
const CLOUDFLARE_IMAGE_TO_IMAGE_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';
const USER_CONTEXT_TIMEZONE = 'Asia/Kolkata';
const CHAT_HISTORY_LIMIT = 16;
const USER_CONTEXT_CACHE_TTL_MS = 2 * 60 * 1000;

type RuntimeUserContext = {
  fullName?: string;
  username?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  dob?: string | null;
  age?: number | null;
  role?: string;
  language?: string | null;
  subscriptionPlan?: string | null;
  preferences?: Record<string, unknown> | null;
  achievements?: Array<{ title?: string; earnedAt?: string }>;
  highlights?: Array<{ title?: string; type?: string; coverImage?: string }>;
  aiProfile?: AiProfileMemory | null;
};

type AiProfileMemory = {
  preferredName?: string | null;
  preferredLanguage?: string | null;
  chatStyle?: 'short' | 'balanced' | 'detailed' | null;
  tone?: 'calm' | 'casual' | 'playful' | 'formal' | null;
  vibe?: 'cool' | 'aesthetic' | 'dark' | 'bright' | 'minimal' | null;
  emojiStyle?: 'low' | 'medium' | 'high' | null;
  responseEnergy?: 'low' | 'medium' | 'high' | null;
  favoriteTopics?: string[];
  summary?: string | null;
  manualNotes?: string | null;
  lastUpdatedAt?: string;
};

const runtimeUserContextCache = new Map<string, { value: RuntimeUserContext; expiresAt: number }>();

function calculateAgeFromDob(dob?: string | null) {
  if (!dob) return null;

  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDelta = now.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function formatCurrentDateTimeContext() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: USER_CONTEXT_TIMEZONE,
    dateStyle: 'full',
    timeStyle: 'long',
  });

  return `${formatter.format(now)} (${USER_CONTEXT_TIMEZONE})`;
}

function buildRuntimeUserContextPrompt(context: RuntimeUserContext) {
  const lines = [
    'TRUSTED USER CONTEXT',
    `Current date and time: ${formatCurrentDateTimeContext()}`,
  ];

  if (context.fullName) lines.push(`Full name: ${context.fullName}`);
  if (context.aiProfile?.preferredName) lines.push(`Preferred name: ${context.aiProfile.preferredName}`);
  if (context.username) lines.push(`Username: @${context.username}`);
  if (context.age !== null && context.age !== undefined) lines.push(`Age: ${context.age}`);
  if (context.dob) lines.push(`Date of birth: ${context.dob}`);
  if (context.role) lines.push(`Role: ${context.role}`);
  if (context.language) lines.push(`Preferred language: ${context.language}`);
  if (context.bio) lines.push(`Bio: ${context.bio}`);
  if (context.avatarUrl) lines.push(`Profile photo URL: ${context.avatarUrl}`);
  if (context.subscriptionPlan) lines.push(`Subscription plan: ${context.subscriptionPlan}`);

  if (context.achievements?.length) {
    lines.push(`Achievements: ${context.achievements.map((item) => item.title).filter(Boolean).join(', ')}`);
  }

  if (context.highlights?.length) {
    lines.push(`Highlights: ${context.highlights.map((item) => item.title).filter(Boolean).join(', ')}`);
  }

  if (context.preferences && Object.keys(context.preferences).length > 0) {
    lines.push(`Preferences JSON: ${JSON.stringify(context.preferences)}`);
  }

  if (context.aiProfile) {
    lines.push(`AI profile JSON: ${JSON.stringify(context.aiProfile)}`);
    if (context.aiProfile.summary) lines.push(`AI memory summary: ${context.aiProfile.summary}`);
    if (context.aiProfile.manualNotes) lines.push(`AI manual notes: ${context.aiProfile.manualNotes}`);
  }

  lines.push('Use this context naturally. Do not dump it back to the user unless relevant.');
  return lines.join('\n');
}

function detectPreferredLanguageFromText(text: string) {
  if (!text.trim()) return null;
  if (/[\u0600-\u06FF]/.test(text)) return 'Urdu';
  if (/[\u0900-\u097F]/.test(text)) return 'Hindi';
  if (/[a-z]/i.test(text)) return 'English';
  return null;
}

function inferChatStyle(text: string): NonNullable<AiProfileMemory['chatStyle']> {
  const clean = text.trim();
  if (clean.length <= 35) return 'short';
  if (clean.length >= 220) return 'detailed';
  return 'balanced';
}

function inferTone(text: string): NonNullable<AiProfileMemory['tone']> {
  if (/\b(sir|please|kindly|regards|thank you)\b/i.test(text)) return 'formal';
  if (/(😂|🤣|lol|lmao|bro|bruh|yaa?r|hehe|haha)/i.test(text)) return 'playful';
  if (/[!?]{2,}/.test(text)) return 'casual';
  return 'calm';
}

function inferVibe(text: string, preferences?: Record<string, unknown> | null): NonNullable<AiProfileMemory['vibe']> {
  const lower = text.toLowerCase();
  const appPrefs = preferences?.app as Record<string, unknown> | undefined;
  const darkMode = typeof appPrefs?.darkMode === 'boolean' ? appPrefs.darkMode : null;
  if (/\baesthetic\b/.test(lower)) return 'aesthetic';
  if (/\bcool\b/.test(lower)) return 'cool';
  if (/\bminimal\b/.test(lower)) return 'minimal';
  if (darkMode === true) return 'dark';
  if (darkMode === false) return 'bright';
  return 'cool';
}

function inferEmojiStyle(text: string): NonNullable<AiProfileMemory['emojiStyle']> {
  const emojiCount = Array.from(text).filter((char) => /\p{Extended_Pictographic}/u.test(char)).length;
  if (emojiCount >= 3) return 'high';
  if (emojiCount >= 1) return 'medium';
  return 'low';
}

function inferResponseEnergy(text: string): NonNullable<AiProfileMemory['responseEnergy']> {
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

function buildHeuristicSummary(
  existingProfile: AiProfileMemory | null,
  currentText: string,
  recentUserTexts: string[],
  preferences?: Record<string, unknown> | null
) {
  const topics = inferFavoriteTopics(recentUserTexts);
  const language = detectPreferredLanguageFromText(currentText) || existingProfile?.preferredLanguage || 'English';
  const style = inferChatStyle(currentText);
  const tone = inferTone(currentText);
  const vibe = inferVibe(currentText, preferences);
  const summaryParts = [
    `Usually chats in ${language}`,
    `prefers ${style} replies`,
    `overall tone is ${tone}`,
    `vibe leans ${vibe}`,
  ];

  if (topics.length) {
    summaryParts.push(`often talks about ${topics.join(', ')}`);
  }

  return summaryParts.join('; ') + '.';
}

function mergeAiProfiles(existing: AiProfileMemory | null, next: AiProfileMemory): AiProfileMemory {
  return {
    preferredName: next.preferredName || existing?.preferredName || null,
    preferredLanguage: next.preferredLanguage || existing?.preferredLanguage || null,
    chatStyle: next.chatStyle || existing?.chatStyle || 'balanced',
    tone: next.tone || existing?.tone || 'calm',
    vibe: next.vibe || existing?.vibe || 'cool',
    emojiStyle: next.emojiStyle || existing?.emojiStyle || 'low',
    responseEnergy: next.responseEnergy || existing?.responseEnergy || 'medium',
    favoriteTopics: next.favoriteTopics?.length ? next.favoriteTopics : existing?.favoriteTopics || [],
    summary: next.summary || existing?.summary || null,
    manualNotes: next.manualNotes || existing?.manualNotes || null,
    lastUpdatedAt: new Date().toISOString(),
  };
}

async function updateAiProfileMemory(
  userId: string,
  currentText: string,
  recentUserTexts: string[],
  existingProfile: AiProfileMemory | null,
  preferences?: Record<string, unknown> | null
) {
  const nextProfile = mergeAiProfiles(existingProfile, {
    preferredName: existingProfile?.preferredName || null,
    preferredLanguage: detectPreferredLanguageFromText(currentText) || existingProfile?.preferredLanguage || null,
    chatStyle: inferChatStyle(currentText),
    tone: inferTone(currentText),
    vibe: inferVibe(currentText, preferences),
    emojiStyle: inferEmojiStyle(currentText),
    responseEnergy: inferResponseEnergy(currentText),
    favoriteTopics: inferFavoriteTopics(recentUserTexts),
    summary: buildHeuristicSummary(existingProfile, currentText, recentUserTexts, preferences),
    manualNotes: existingProfile?.manualNotes || null,
  });

  await adminDb.ref(`user_settings/${userId}/ai_profile`).update(nextProfile);
  const cached = runtimeUserContextCache.get(userId);
  if (cached) {
    runtimeUserContextCache.set(userId, {
      value: {
        ...cached.value,
        aiProfile: nextProfile,
      },
      expiresAt: Date.now() + USER_CONTEXT_CACHE_TTL_MS,
    });
  }
  return nextProfile;
}

async function getRuntimeUserContext(userId: string): Promise<RuntimeUserContext> {
  const cached = runtimeUserContextCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const [profileSnap, userSnap, settingsSnap, achievementsSnap, userAchievementsSnap, highlightsSnap, userHighlightsSnap] = await Promise.all([
    adminDb.ref(`profiles/${userId}`).get(),
    adminDb.ref(`users/${userId}`).get(),
    adminDb.ref(`user_settings/${userId}`).get(),
    adminDb.ref(`profiles/${userId}/achievements`).get(),
    adminDb.ref(`users/${userId}/achievements`).get(),
    adminDb.ref(`profiles/${userId}/highlights`).get(),
    adminDb.ref(`users/${userId}/highlights`).get(),
  ]);

  const profileData = profileSnap.exists() ? profileSnap.val() : {};
  const userData = userSnap.exists() ? userSnap.val() : {};
  const settingsData = settingsSnap.exists() ? settingsSnap.val() : {};
  const merged = {
    ...userData,
    ...profileData,
    preferences: settingsData.preferences || userData.preferences || profileData.preferences || null,
  };
  const aiProfile = (settingsData.ai_profile || null) as AiProfileMemory | null;

  const achievementSource = achievementsSnap.exists() ? achievementsSnap.val() : userAchievementsSnap.exists() ? userAchievementsSnap.val() : {};
  const highlightSource = highlightsSnap.exists() ? highlightsSnap.val() : userHighlightsSnap.exists() ? userHighlightsSnap.val() : {};

  const achievements = Object.values(achievementSource || {}).slice(-8) as Array<{ title?: string; earnedAt?: string }>;
  const highlights = Object.values(highlightSource || {}).slice(-8) as Array<{ title?: string; type?: string; coverImage?: string }>;

  const context = {
    fullName: merged.fullName || merged.name || null,
    username: merged.username || null,
    avatarUrl: merged.avatarUrl || null,
    bio: merged.bio || null,
    dob: merged.dob || null,
    age: calculateAgeFromDob(merged.dob),
    role: merged.role || null,
    language: merged.preferences?.learning?.language || merged.language || null,
    subscriptionPlan: merged.subscription?.planId || null,
    preferences: merged.preferences || null,
    achievements,
    highlights,
    aiProfile,
  };

  runtimeUserContextCache.set(userId, {
    value: context,
    expiresAt: Date.now() + USER_CONTEXT_CACHE_TTL_MS,
  });

  return context;
}

function isImageRequest(text: string) {
  return /\b(draw|image|picture|photo|illustration|artwork|logo|poster|wallpaper|generate an image|create an image|make an image)\b/i.test(text);
}

function isImageEditRequest(text: string, mediaType?: string | null) {
  if (mediaType !== 'image') {
    return false;
  }

  return /\b(edit|change|modify|transform|restyle|redesign|remove|replace|swap|turn this into|make this|convert this|retouch|enhance|clean up)\b/i.test(text);
}

function looksLikeImageEditRequest(text: string) {
  return /\b(edit|change|modify|transform|restyle|redesign|remove|replace|swap|turn this into|make this|convert this|retouch|enhance|clean up)\b/i.test(text);
}

function isBackgroundEditRequest(text: string) {
  return /\bbackground\b/i.test(text) || /\b(place|put|set)\b.*\b(in|into|against)\b/i.test(text);
}

function getBackgroundDescription(text: string) {
  return text
    .replace(/\b(change|edit|modify|replace|swap)\b/gi, '')
    .replace(/\b(my|the|our|this)\s+background\b/gi, '')
    .replace(/\bbackground\b/gi, '')
    .replace(/\bto\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,.\s-]+|[,.\s-]+$/g, '');
}

function normalizeImagePrompt(prompt: string) {
  return prompt
    .replace(/\[draw:\s*/gi, '')
    .replace(/\]\s*$/g, '')
    .replace(/^(please\s+)?(generate|create|make|draw)\s+(me\s+)?(an?\s+)?(image|picture|photo|illustration|artwork)\s+(of|for)?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getImagePrompt(aiResponse: string, userText: string) {
  const drawMatch = aiResponse.match(/\[DRAW:\s*([\s\S]*?)\]/i);
  const aiPrompt = normalizeImagePrompt(drawMatch?.[1] || '');
  const cleanedResponse = aiResponse.replace(/\[DRAW:[\s\S]*?\]/gi, '').trim();

  if (aiPrompt.length >= 8) {
    return { prompt: aiPrompt, cleanedResponse };
  }

  if (isImageRequest(userText)) {
    const fallbackPrompt = normalizeImagePrompt(userText);
    if (fallbackPrompt.length >= 3) {
      return {
        prompt: `${fallbackPrompt}, highly detailed, cinematic lighting, professional digital art`,
        cleanedResponse,
      };
    }
  }

  return { prompt: null, cleanedResponse };
}

function hasImageSignature(bytes: Buffer, contentType: string) {
  if (contentType.includes('png')) {
    return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType.includes('jpeg') || contentType.includes('jpg')) {
    return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType.includes('webp')) {
    return bytes.length > 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  if (contentType.includes('gif')) {
    return bytes.length > 6 && (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a');
  }

  return bytes.length > 1024;
}

async function fetchVerifiedImage(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'image/*',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Image provider returned HTTP ${response.status}`);
  }

  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  const bytes = Buffer.from(await response.arrayBuffer());

  if (!contentType.startsWith('image/')) {
    const preview = bytes.toString('utf8').slice(0, 200);
    throw new Error(`Expected image response, got ${contentType || 'unknown'} instead: ${preview}`);
  }

  if (bytes.length < 1024 || !hasImageSignature(bytes, contentType)) {
    throw new Error(`Provider returned an invalid image payload (${bytes.length} bytes, ${contentType})`);
  }

  return { contentType, bytes };
}

async function runCloudflareImageModel(model: string, body: BodyInit, contentType: string) {
  const cfId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!cfId || !cfToken) {
    throw new Error('Cloudflare Workers AI image generation is not configured.');
  }

  return fetchVerifiedImage(
    `https://api.cloudflare.com/client/v4/accounts/${cfId}/ai/run/${model}`,
    {
      headers: {
        Authorization: `Bearer ${cfToken}`,
        'Content-Type': contentType,
      },
      method: 'POST',
      body,
    }
  );
}

async function generateImage(prompt: string): Promise<string | null> {
  const safePrompt = normalizeImagePrompt(prompt);

  if (!safePrompt) {
    return null;
  }

  try {
    const { contentType, bytes } = await runCloudflareImageModel(
      CLOUDFLARE_TEXT_TO_IMAGE_MODEL,
      JSON.stringify({ prompt: safePrompt }),
      'application/json'
    );
    return `data:${contentType};base64,${bytes.toString('base64')}`;
  } catch (error) {
    console.warn('Cloudflare image generation failed, falling back to Pollinations.', error);
  }

  const seed = Math.floor(Math.random() * 1_000_000_000);
  const pollinationsUrls = [
    `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?nologo=true&private=true&enhance=true&width=1024&height=1024&model=flux&seed=${seed}`,
    `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?nologo=true&private=true&enhance=true&width=1024&height=1024&seed=${seed}`,
    `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?nologo=true&seed=${seed}`,
  ];

  for (const pollinationsUrl of pollinationsUrls) {
    try {
      await fetchVerifiedImage(pollinationsUrl);
      return pollinationsUrl;
    } catch (error) {
      console.warn('Pollinations candidate failed validation.', error);
    }
  }

  return null;
}

function buildEditPrompt(userText: string, isBackgroundOnly: boolean) {
  const normalized = normalizeImagePrompt(userText);

  if (isBackgroundOnly) {
    return [
      normalized,
      'preserve the exact same person',
      'preserve the same face identity, skin tone, hairstyle, age, body shape, pose, hands, and clothing',
      'change only the background and surrounding environment',
      'keep the original framing and camera angle',
      'realistic photo edit, not an illustration, not a new person',
    ].join(', ');
  }

  return [
    normalized,
    'preserve the same person identity and facial features',
    'keep the result photorealistic and faithful to the source image',
    'avoid changing the subject unless explicitly requested',
  ].join(', ');
}

function buildCloudinaryBackgroundReplaceUrl(sourceUrl: string, prompt: string) {
  if (!sourceUrl.includes('/upload/')) {
    return null;
  }

  const encodedPrompt = encodeURIComponent(prompt.trim());
  if (!encodedPrompt) {
    return null;
  }

  const [prefix, suffix] = sourceUrl.split('/upload/');
  if (!prefix || !suffix) {
    return null;
  }

  return `${prefix}/upload/e_gen_background_replace:prompt_${encodedPrompt}/f_auto/q_auto/${suffix}`;
}

async function generateCloudinaryBackgroundEdit(sourceUrl: string, prompt: string): Promise<string | null> {
  const transformedUrl = buildCloudinaryBackgroundReplaceUrl(sourceUrl, prompt);
  if (!transformedUrl) {
    return null;
  }

  try {
    await fetchVerifiedImage(transformedUrl);
    return transformedUrl;
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('HTTP 420') || message.includes('HTTP 423')) {
      // Cloudinary can return pending/locked while preparing the derived asset.
      return transformedUrl;
    }

    console.warn('Cloudinary background replace failed.', error);
    return null;
  }
}

async function editImage(
  prompt: string,
  sourceImage: { base64: string; mimeType: string } | null,
  options?: { strength?: number; guidance?: number; negativePrompt?: string }
): Promise<string | null> {
  if (!sourceImage?.base64) {
    return null;
  }

  const safePrompt = normalizeImagePrompt(prompt);
  if (!safePrompt) {
    return null;
  }

  try {
    const { contentType, bytes } = await runCloudflareImageModel(
      CLOUDFLARE_IMAGE_TO_IMAGE_MODEL,
      JSON.stringify({
        prompt: safePrompt,
        image_b64: sourceImage.base64,
        negative_prompt: options?.negativePrompt || 'different person, different face, extra fingers, extra limbs, cartoon, anime, illustration, blurry, deformed hands, distorted face',
        strength: options?.strength ?? 0.8,
        guidance: options?.guidance ?? 7.5,
        num_steps: 20,
      }),
      'application/json'
    );
    return `data:${contentType};base64,${bytes.toString('base64')}`;
  } catch (error) {
    console.warn('Cloudflare image-to-image failed.', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { chatId, userId, text, mediaUrl, mediaType } = await request.json();
    if (!chatId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing' }), { status: 400 });
    }

    const runtimeUserContext = await getRuntimeUserContext(userId);

    const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
    const messagesRef = adminDb.ref(`messages/${chatId}`);
    const snapshot = await messagesRef.orderByChild('createdAt').limitToLast(CHAT_HISTORY_LIMIT).once('value');
    const messages: any[] = [];

    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        messages.push(child.val());
      });
    }

    async function fetchImageAsBase64(url: string) {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const ab = await res.arrayBuffer();
        return {
          base64: Buffer.from(ab).toString('base64'),
          mimeType: res.headers.get('content-type') || 'image/jpeg',
        };
      } catch {
        return null;
      }
    }

    let hasImages = false;
    let latestHistoryImageUrl: string | null = null;
    let latestHistoryImageObj: { base64: string; mimeType: string } | null = null;
    const rawHistory = await Promise.all(
      messages.map(async (msg) => {
        const isAI = msg.senderId === 'edunook-ai';
        let img = null;

        if (msg.mediaUrl && msg.mediaType === 'image' && !isAI && !msg.mediaUrl.startsWith('data:')) {
          latestHistoryImageUrl = msg.mediaUrl;
          img = await fetchImageAsBase64(msg.mediaUrl);
          if (img) {
            hasImages = true;
            latestHistoryImageObj = img;
          }
        }

        return { role: isAI ? 'assistant' : 'user', text: msg.text || '', imageObj: img };
      })
    );

    let currentImageObj = null;
    let currentImageUrl: string | null = null;
    if (mediaUrl && mediaType === 'image') {
      hasImages = true;
      currentImageUrl = mediaUrl;
      currentImageObj = await fetchImageAsBase64(mediaUrl);
    }

    rawHistory.push({ role: 'user', text: text || '', imageObj: currentImageObj });

    const recentUserTexts = rawHistory
      .filter((message) => message.role === 'user' && typeof message.text === 'string' && message.text.trim())
      .map((message) => message.text.trim())
      .slice(-12);

    const nextAiProfilePromise = updateAiProfileMemory(
      userId,
      text || '',
      recentUserTexts,
      runtimeUserContext.aiProfile || null,
      runtimeUserContext.preferences || null
    ).catch((error) => {
      console.warn('AI profile memory update failed.', error);
      return runtimeUserContext.aiProfile || null;
    });

    runtimeUserContext.aiProfile = await Promise.race([
      nextAiProfilePromise,
      new Promise<AiProfileMemory | null>((resolve) => setTimeout(() => resolve(runtimeUserContext.aiProfile || null), 120)),
    ]);

    const runtimeSystemPrompt = `${SYSTEM_PROMPT}\n\n${buildRuntimeUserContextPrompt(runtimeUserContext)}`;

    let aiResponse = '';
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    if (groq && !hasImages) {
      try {
        const groqMessages = [{ role: 'system', content: runtimeSystemPrompt }];
        rawHistory.forEach((message) => {
          if (message.text && message.text.trim()) {
            groqMessages.push({ role: message.role, content: message.text });
          }
        });

        const chatCompletion = await groq.chat.completions.create({
          messages: groqMessages as any[],
          model: GROQ_TEXT_MODEL,
          temperature: 0.7,
          max_completion_tokens: 220,
        });

        aiResponse = chatCompletion.choices[0]?.message?.content || '';
      } catch (groqErr) {
        console.warn('Groq primary failed, falling back to Gemini:', groqErr);
      }
    }

    if (!aiResponse) {
      const contents = rawHistory
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [
            ...(message.text ? [{ text: message.text }] : []),
            ...(message.imageObj
              ? [{ inlineData: { data: message.imageObj.base64, mimeType: message.imageObj.mimeType } }]
              : []),
          ],
        }))
        .filter((message) => message.parts.length > 0) as any[];

      let lastGeminiError: unknown = null;
      for (const modelName of GEMINI_TEXT_MODELS) {
        try {
          const model = genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: runtimeSystemPrompt,
          });

          const result = await model.generateContent({ contents });
          aiResponse = result.response.text() || '';

          if (aiResponse) {
            break;
          }
        } catch (geminiErr) {
          lastGeminiError = geminiErr;
          console.warn(`Gemini model ${modelName} failed:`, geminiErr);
        }
      }

      if (!aiResponse) {
        const message = lastGeminiError instanceof Error ? lastGeminiError.message : 'Gemini request failed';
        return new Response(JSON.stringify({ error: message }), { status: 500 });
      }
    }

    let genMedia = null;
    const requestedImageEdit = looksLikeImageEditRequest(text || '');
    const isBackgroundOnlyEdit = isBackgroundEditRequest(text || '');
    const editSourceImage = currentImageObj || latestHistoryImageObj;
    const editSourceImageUrl = currentImageUrl || latestHistoryImageUrl;
    const isEditingCurrentImage = isImageEditRequest(text || '', mediaType);
    const canEditFromContext = requestedImageEdit && !!editSourceImage;

    if (canEditFromContext) {
      if (isBackgroundOnlyEdit && editSourceImageUrl?.includes('res.cloudinary.com')) {
        const backgroundDescription = getBackgroundDescription(text || '') || 'the Swiss Alps';
        genMedia = await generateCloudinaryBackgroundEdit(editSourceImageUrl, backgroundDescription);
      }

      if (!genMedia) {
        const editPrompt = buildEditPrompt(text || '', isBackgroundOnlyEdit);
        genMedia = await editImage(editPrompt, editSourceImage, {
          strength: isBackgroundOnlyEdit ? 0.35 : 0.55,
          guidance: 8,
        });
      }

      aiResponse = genMedia
        ? 'Here is your edited image.'
        : 'I could not complete that image edit right now. Please try sending the image again, and I will retry the background change.';
    } else {
      const imageDecision = getImagePrompt(aiResponse, text || '');
      if (imageDecision.prompt) {
        genMedia = await generateImage(imageDecision.prompt);
        aiResponse = imageDecision.cleanedResponse;
      }
    }

    if (!aiResponse) {
      aiResponse = genMedia ? (canEditFromContext ? 'Here is your edited image.' : 'Here is your generated image.') : "I'm ready!";
    }

    if (requestedImageEdit && !editSourceImage && !genMedia) {
      aiResponse = 'Send the image you want me to edit in this chat, and I can change its background for you.';
    }

    const newMsgRef = messagesRef.push();
    const now = new Date().toISOString();

    await newMsgRef.set({
      id: newMsgRef.key,
      senderId: 'edunook-ai',
      text: aiResponse,
      mediaUrl: genMedia,
      mediaType: genMedia ? 'image' : null,
      createdAt: now,
      seen: false,
    });

    await adminDb.ref(`chats/${chatId}`).update({
      lastMessage: genMedia ? 'Visual generated' : aiResponse,
      updatedAt: now,
      lastSenderId: 'edunook-ai',
      users: {
        [userId]: true,
        'edunook-ai': true,
      },
    });

    await adminDb.ref(`chats/${chatId}/unreadCounts/${userId}`).transaction((count: any) => (count || 0) + 1);

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack,
        details: error.response?.data || error.response || 'No additional details',
      }),
      { status: 500 }
    );
  }
}
