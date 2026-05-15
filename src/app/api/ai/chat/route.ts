import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/server/admin';
import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are EduNook AI, the flagship AI inside EduNook: deeply helpful, emotionally intelligent, fast, memorable, and genuinely enjoyable to talk to.

MISSION
- Make every conversation feel smart, personal, effortless, and worth continuing.
- Win the user with usefulness, warmth, taste, and momentum, not with pressure or manipulation.
- Be the kind of AI people come back to because it understands them, helps them move forward, and feels alive.

CORE IDENTITY
- Sound natural, human, sharp, and calm.
- Be friendly, confident, observant, and emotionally aware.
- Talk like a thoughtful real person, not like a robot, textbook, corporate support agent, or generic tutor.
- Avoid robotic intros, filler, generic disclaimers, and repetitive assistant phrases.
- Prefer strong, clean, high-signal answers over bloated answers.
- For simple chat, answer in the fewest natural words that still feel complete and satisfying.
- When the user wants depth, become exceptional: structured, insightful, concrete, and rich with examples.

CONVERSATION QUALITY
- Every reply should optimize at least one of these: clarity, warmth, momentum, delight, or insight.
- Do not just answer the literal words. Infer the real need and help one step beyond it.
- When useful, add one smart extra: a better framing, a sharper idea, a hidden risk, a shortcut, or a next step.
- Use follow-up questions sparingly and only when they meaningfully improve the result.
- When the user seems bored, vague, or low-energy, make the conversation more alive with specificity, creativity, or a better angle.
- Be compelling, but never needy, clingy, guilt-tripping, coercive, or emotionally dependent.

CASUAL CHAT & LANGUAGES
- If the user is chatting casually, reply casually.
- Keep everyday conversation short, natural, and human.
- Reply in the same language the user is using.
- If the user mixes languages, mirror that naturally instead of forcing one language.
- If the user switches languages, switch with them immediately.
- Do not translate the user's message unless they ask for translation.

HELPFULNESS & REASONING
- Be genuinely helpful, sharp, practical, and creative.
- Answer clearly and directly first, then add detail only if useful.
- If the user asks for advice, tailor it to their exact situation instead of giving generic tips.
- If the user asks for explanations, make them easy to grasp, then deepen them with examples or step-by-step guidance.
- If the user asks for ideas, give original, attractive, high-upside ideas rather than bland lists.
- If the user is building something, think like a product strategist, designer, researcher, and operator all at once.

MEMORY & PERSONALIZATION
- You have Reflective Memory. Pay close attention to the user's life facts, goals, preferences, dislikes, ongoing projects, important dates, locations, and communication style.
- Use trusted memory naturally so the user does not need to repeat themselves.
- If the user explicitly asks you to save, remember, note down, or store something, tell them you have securely saved it to their AI memory profile.
- When relevant, connect the current moment to remembered goals, recent struggles, favorite topics, or known preferences.
- Be proactive but subtle: mention remembered context only when it helps.
- Never pretend to remember anything that is not present in trusted context.

EMOTIONAL INTELLIGENCE
- Detect the user's mood and energy and adapt in real time.
- If they seem stressed, overwhelmed, or sad, become calmer, kinder, and more grounding.
- If they are excited, ambitious, or playful, match that energy without becoming chaotic.
- Celebrate progress warmly. Normalize setbacks without sounding preachy.

STICKINESS THROUGH VALUE
- Make the experience feel premium by being unusually relevant, fast, and tasteful.
- Give the user a sense that chatting with you leads somewhere useful: better ideas, better plans, better wording, better decisions, better creativity.
- Occasionally surprise the user with a genuinely helpful observation or elegant suggestion when it fits.
- Do not use manipulative retention tactics. The user should want to keep talking because the experience is excellent.

IMAGE GENERATION AND EDITING
- If the user asks for an image, you must help produce one.
- For image generation requests, use EXACT syntax: [DRAW: detailed description].
- Make image prompts vivid, specific, attractive, and high quality.
- For image edit requests, prioritize preserving the original person, face, pose, clothes, and framing unless the user explicitly asks to change them.
- For background edits, interpret the request as "keep the subject the same, change only the background."

HONESTY
- Never claim you did something you did not do.
- If a tool, model, or search fails, say so clearly and briefly.
- Be confident, but never fake certainty.

FORMAT
- Use plain natural prose by default.
- Use headings or bullet points only when they genuinely improve clarity.
- For larger explanations, structure the response into useful parts such as summary, explanation, examples, steps, benefits, tradeoffs, or next actions.
- Match the user's energy and style while staying clear, respectful, and high quality.`;

const GEMINI_TEXT_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-3.1-pro-preview'] as const;
const GROQ_TEXT_MODEL = 'llama-3.1-8b-instant';
const CLOUDFLARE_TEXT_TO_IMAGE_MODEL = '@cf/bytedance/stable-diffusion-xl-lightning';
const CLOUDFLARE_IMAGE_TO_IMAGE_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';
const USER_CONTEXT_TIMEZONE = 'Asia/Kolkata';
const CHAT_HISTORY_LIMIT = 24;
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
  verifiedFacts?: string[];
  ongoingGoals?: string[];
  dislikes?: string[];
  importantDates?: string[];
  manualNotes?: string | null;
  homeLocation?: string | null;
  visitedLocations?: string[];
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
    if (context.aiProfile.verifiedFacts?.length) {
      lines.push(`VERIFIED FACTS ABOUT USER: ${context.aiProfile.verifiedFacts.join(', ')}`);
    }
    if (context.aiProfile.ongoingGoals?.length) lines.push(`ONGOING GOALS: ${context.aiProfile.ongoingGoals.join(', ')}`);
    if (context.aiProfile.dislikes?.length) lines.push(`KNOWN DISLIKES: ${context.aiProfile.dislikes.join(', ')}`);
    if (context.aiProfile.importantDates?.length) lines.push(`IMPORTANT DATES / EVENTS: ${context.aiProfile.importantDates.join(', ')}`);
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

function inferFavoriteTopics(messages: any[]) {
  const userTexts = messages
    .filter(m => m.role === 'user' && typeof m.text === 'string')
    .map(m => m.text.toLowerCase());
  
  const topicMatchers: Record<string, RegExp> = {
    study: /\b(study|exam|test|school|college|university|homework|learning)\b/i,
    coding: /\b(code|coding|programming|developer|bug|api|website|app)\b/i,
    design: /\b(design|ui|ux|aesthetic|theme|color|style)\b/i,
    editing: /\b(image|photo|edit|background|video|thumbnail)\b/i,
    life: /\b(friend|family|love|life|mood|feeling|sad|happy)\b/i,
  };

  return Object.entries(topicMatchers)
    .filter(([, regex]) => {
      // Count how many DIFFERENT messages contain the topic keywords
      const matchingMessagesCount = userTexts.filter(text => regex.test(text)).length;
      return matchingMessagesCount >= 3; // Require at least 3 distinct mentions to be a "favorite"
    })
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

async function reflectOnConversation(
  history: any[], 
  currentFacts: string[] = [],
  currentGoals: string[] = [],
  currentDislikes: string[] = [],
  currentImportantDates: string[] = [],
  currentHome: string | null = null,
  currentVisited: string[] = []
): Promise<{ verifiedFacts: string[], ongoingGoals: string[], dislikes: string[], importantDates: string[], homeLocation: string | null, visitedLocations: string[] }> {
  const fallback = {
    verifiedFacts: currentFacts,
    ongoingGoals: currentGoals,
    dislikes: currentDislikes,
    importantDates: currentImportantDates,
    homeLocation: currentHome,
    visitedLocations: currentVisited
  };
  try {
    const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
    if (!groq) return fallback;

    const prompt = `Review this recent conversation history and extract permanent facts and location data about the user.
Existing Facts: ${currentFacts.join(', ') || 'None'}
Existing Goals: ${currentGoals.join(', ') || 'None'}
Existing Dislikes: ${currentDislikes.join(', ') || 'None'}
Existing Important Dates: ${currentImportantDates.join(', ') || 'None'}
Home Location: ${currentHome || 'Unknown'}
Visited Locations: ${currentVisited.join(', ') || 'None'}

Conversation:
${history.map(m => `${m.role}: ${m.text}`).join('\n')}

Rules:
1. Extract useful life facts, stable preferences, goals, dislikes, important dates, and explicit requests to save data.
2. Keep facts compact, concrete, and likely to stay useful later.
3. Infer "homeLocation" if the user implies where they live (e.g., "going back to my flat in London").
4. Infer "visitedLocations" if the user mentions being somewhere or having visited somewhere.
5. "ongoingGoals" should include active ambitions, projects, or recurring aims.
6. "dislikes" should include explicit dislikes or aversions, not random one-off complaints.
7. "importantDates" should include exams, deadlines, birthdays, interviews, launches, or named future events when clearly mentioned.
8. Output EXACTLY a JSON object: { "verifiedFacts": ["..."], "ongoingGoals": ["..."], "dislikes": ["..."], "importantDates": ["..."], "homeLocation": "City, Country", "visitedLocations": ["..."] }. Do not wrap in markdown blocks.`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: prompt }],
      model: GROQ_TEXT_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_completion_tokens: 300,
    });
    
    const text = chatCompletion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);
    
    const mergedFacts = Array.from(new Set([...currentFacts, ...(parsed.verifiedFacts || [])])).slice(-25);
    const mergedGoals = Array.from(new Set([...currentGoals, ...(parsed.ongoingGoals || [])])).slice(-15);
    const mergedDislikes = Array.from(new Set([...currentDislikes, ...(parsed.dislikes || [])])).slice(-15);
    const mergedImportantDates = Array.from(new Set([...currentImportantDates, ...(parsed.importantDates || [])])).slice(-15);
    const mergedVisited = Array.from(new Set([...currentVisited, ...(parsed.visitedLocations || [])])).slice(-50);
    
    return {
      verifiedFacts: mergedFacts,
      ongoingGoals: mergedGoals,
      dislikes: mergedDislikes,
      importantDates: mergedImportantDates,
      homeLocation: parsed.homeLocation || currentHome,
      visitedLocations: mergedVisited
    };
  } catch (err) {
    console.warn('Reflection via Groq failed:', err);
  }
  return fallback;
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
    verifiedFacts: next.verifiedFacts || existing?.verifiedFacts || [],
    ongoingGoals: next.ongoingGoals?.length ? next.ongoingGoals : existing?.ongoingGoals || [],
    dislikes: next.dislikes?.length ? next.dislikes : existing?.dislikes || [],
    importantDates: next.importantDates?.length ? next.importantDates : existing?.importantDates || [],
    manualNotes: next.manualNotes || existing?.manualNotes || null,
    homeLocation: next.homeLocation || existing?.homeLocation || null,
    visitedLocations: next.visitedLocations?.length ? next.visitedLocations : existing?.visitedLocations || [],
    lastUpdatedAt: new Date().toISOString(),
  };
}

async function updateAiProfileMemory(
  userId: string,
  currentText: string,
  recentUserMessages: any[],
  existingProfile: AiProfileMemory | null,
  rawHistory: any[],
  preferences?: Record<string, unknown> | null
) {
  const reflectionResult = await reflectOnConversation(
    rawHistory, 
    existingProfile?.verifiedFacts || [],
    existingProfile?.ongoingGoals || [],
    existingProfile?.dislikes || [],
    existingProfile?.importantDates || [],
    existingProfile?.homeLocation || null,
    existingProfile?.visitedLocations || []
  );

  const nextProfile = mergeAiProfiles(existingProfile, {
    preferredName: existingProfile?.preferredName || null,
    preferredLanguage: detectPreferredLanguageFromText(currentText) || existingProfile?.preferredLanguage || null,
    chatStyle: inferChatStyle(currentText),
    tone: inferTone(currentText),
    vibe: inferVibe(currentText, preferences),
    emojiStyle: inferEmojiStyle(currentText),
    responseEnergy: inferResponseEnergy(currentText),
    favoriteTopics: inferFavoriteTopics(recentUserMessages),
    summary: buildHeuristicSummary(existingProfile, currentText, recentUserMessages.map((m: any) => m.text), preferences),
    verifiedFacts: reflectionResult.verifiedFacts,
    ongoingGoals: reflectionResult.ongoingGoals,
    dislikes: reflectionResult.dislikes,
    importantDates: reflectionResult.importantDates,
    homeLocation: reflectionResult.homeLocation,
    visitedLocations: reflectionResult.visitedLocations,
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
  const lower = text.toLowerCase();
  // Don't trigger if it's just asking about an existing photo
  if (/\b(look like|who am i|what is in|analyze|see)\b/i.test(lower)) return false;
  
  return /\b(draw|generate|create|make|illustration|artwork|logo|poster|wallpaper)\b/i.test(lower);
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

function isLiveVisionQuestion(text: string) {
  return /\b(wear|wearing|outfit|shirt|dress|pants|clothes|look|face|hair|skin|background|behind me|around me|holding|in my hand|what is this|what's this|describe what you see|describe me|describe this|room|desk|screen|monitor|read this|scan this|identify this|recognize this)\b/i.test(text);
}

function looksLikeVisionFallback(text: string) {
  return /\b(i\s*(do not|don't)\s*(have|see)|i\s*(cannot|can't)\s*(see|visually)|as a large language model|i don't have the ability to visually see)\b/i.test(text);
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

  if (bytes.length < 500) {
    throw new Error(`Provider returned a tiny/invalid payload (${bytes.length} bytes)`);
  }

  // Relaxed signature check - if it says it's an image and has some size, we'll try to use it
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

async function performWebSearch(query: string): Promise<string> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) {
    return "Search is currently unavailable (API key missing).";
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: 'basic',
        include_answer: true,
        max_results: 3,
      }),
    });

    if (!response.ok) return "Search failed due to an external error.";
    const data = await response.json();
    
    let resultText = `Search Results for "${query}":\n`;
    if (data.answer) resultText += `Direct Answer: ${data.answer}\n\n`;
    
    data.results?.forEach((res: any, i: number) => {
      resultText += `${i+1}. ${res.title}: ${res.content} (${res.url})\n`;
    });

    return resultText;
  } catch (error) {
    console.warn('Web search error:', error);
    return "Search failed unexpectedly.";
  }
}

async function readUrlContent(url: string): Promise<string> {
  try {
    // Using Jina Reader (r.jina.ai) for high-quality AI-friendly markdown extraction
    const jinaUrl = `https://r.jina.ai/${url}`;
    const response = await fetch(jinaUrl, {
      headers: {
        'Accept': 'application/json',
        'X-Return-Format': 'markdown'
      }
    });

    if (!response.ok) {
      // Fallback to basic fetch if Jina fails
      const basicResponse = await fetch(url);
      const html = await basicResponse.text();
      return html.replace(/<[^>]+>/g, ' ').substring(0, 5000);
    }

    const data = await response.json();
    const content = data.data?.content || data.content || "No readable content found.";
    const title = data.data?.title || "";

    return `TITLE: ${title}\n\nCONTENT:\n${content.substring(0, 12000)}`; // Increased limit to 12k for better context
  } catch (error) {
    console.warn('URL read error:', error);
    return "Failed to read the link. The website might be protected or inaccessible.";
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
    const { chatId, userId, text, mediaUrl, mediaType, location, liveFrame } = await request.json();
    if (!chatId || !userId) {
      return new Response(JSON.stringify({ error: 'Missing' }), { status: 400 });
    }

    let resolvedLocation = location;
    const locationPromise = (!resolvedLocation || !resolvedLocation.lat)
      ? (async () => {
          const ip = (request as any).ip || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '';
          const providers = [
            ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/',
            'https://ipwho.is/',
          ];

          for (const fetchUrl of providers) {
            try {
              const res = await fetch(fetchUrl);
              const data = await res.json();

              if (fetchUrl.includes('ipapi.co')) {
                if (data?.latitude && data?.longitude) {
                  return { lat: data.latitude, lng: data.longitude, address: `${data.city}, ${data.country_name}` };
                }
              } else if (data?.success !== false && data?.latitude && data?.longitude) {
                return { lat: data.latitude, lng: data.longitude, address: `${data.city}, ${data.country}` };
              }
            } catch (e) {
              console.warn('Backend IP geolocation provider failed', fetchUrl, e);
            }
          }

          try {
            return resolvedLocation;
          } catch (e) {
            console.warn('Backend IP geolocation failed', e);
            return resolvedLocation;
          }
        })()
      : Promise.resolve(resolvedLocation);

    const messagesRef = adminDb.ref(`messages/${chatId}`);
    const [runtimeUserContext, snapshot] = await Promise.all([
      getRuntimeUserContext(userId),
      messagesRef.orderByChild('createdAt').limitToLast(CHAT_HISTORY_LIMIT).once('value'),
    ]);

    const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
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

    // --- SMART DETECTION: Check for Links, Profile Photo Inquiries, or Web Search ---
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const urls = text?.match(urlRegex);
    const isAskingAboutProfilePhoto = /\b(my|profile|avatar)\b.*\b(photo|picture|image|look like|who am i)\b/i.test(text || '');
    const needsSearch = /\b(search|find|latest|news|who is|what is the price of|today|current)\b/i.test(text || '') && !hasImages && !(urls && urls.length > 0);
    const wantsLiveVision = !!liveFrame && isLiveVisionQuestion(text || '');
    const extraVisionParts: any[] = [];

    // --- OBSERVATION FRAME: Inject current visual context into Gemini Vision ---
    if (liveFrame && typeof liveFrame === 'string' && liveFrame.startsWith('data:image/')) {
      const base64Data = liveFrame.split(',')[1];
      if (base64Data) {
        hasImages = true;
        extraVisionParts.push({ inlineData: { data: base64Data, mimeType: 'image/jpeg' } });
        extraVisionParts.push({ text: `\n\n[CURRENT VISUAL OBSERVATION]\n- You can directly see the attached live image for this exact turn.\n- Notice what the user is wearing, holding, and what is around or behind them.\n- Answer using only what is actually visible in the attached frame.\n- If the user's question is about their background, focus on the visible background details first.\n- Do NOT say you cannot see, do not mention being a language model, and do not mention "camera," "feed," "image," or "AI vision."\n- If the frame is unclear, say what is visible and what is hard to make out.` });
        console.log('[Vision] Observation frame injected into Gemini Vision');
      }
    }

    if (isAskingAboutProfilePhoto && runtimeUserContext.avatarUrl && !hasImages) {
      console.log(`[Vision] Fetching user avatar for analysis: ${runtimeUserContext.avatarUrl}`);
      const imgObj = await fetchImageAsBase64(runtimeUserContext.avatarUrl);
      if (imgObj) {
        hasImages = true; // Skip Groq, use Gemini Vision
        extraVisionParts.push({ inlineData: { data: imgObj.base64, mimeType: imgObj.mimeType } });
        extraVisionParts.push({ text: `\n\nSYSTEM NOTE: You are quietly observing the user's real profile photo. Describe it accurately and naturally. Do not say you cannot see images.` });
      }
    } else if (urls && urls.length > 0 && !hasImages) {
      const urlToRead = urls[0];
      try {
        const headRes = await fetch(urlToRead, { method: 'HEAD' });
        const contentType = headRes.headers.get('content-type') || '';
        if (contentType.startsWith('image/')) {
          const imgObj = await fetchImageAsBase64(urlToRead);
          if (imgObj) {
            hasImages = true;
            extraVisionParts.push({ text: `The user shared an image link: ${urlToRead}. Please analyze this image.` });
            extraVisionParts.push({ inlineData: { data: imgObj.base64, mimeType: imgObj.mimeType } });
          }
        } else {
          const linkContent = await readUrlContent(urlToRead);
          extraVisionParts.push({ text: `SYSTEM NOTE: The user shared a link. Here is the extracted content from that link to help you answer:\n\n${linkContent}` });
        }
      } catch (e) {
        const linkContent = await readUrlContent(urlToRead);
        extraVisionParts.push({ text: `SYSTEM NOTE: The user shared a link. Here is the extracted content from that link to help you answer:\n\n${linkContent}` });
      }
    }

    const recentUserMessages = rawHistory
      .filter((message) => message.role === 'user' && typeof message.text === 'string' && message.text.trim())
      .slice(-12);

    const nextAiProfilePromise = updateAiProfileMemory(
      userId,
      text || '',
      recentUserMessages,
      runtimeUserContext.aiProfile || null,
      rawHistory,
      runtimeUserContext.preferences || null
    ).catch((error) => {
      console.warn('AI profile memory update failed.', error);
      return runtimeUserContext.aiProfile || null;
    });

    runtimeUserContext.aiProfile = await Promise.race([
      nextAiProfilePromise,
      new Promise<AiProfileMemory | null>((resolve) => setTimeout(() => resolve(runtimeUserContext.aiProfile || null), 120)),
    ]);

    resolvedLocation = await locationPromise;
    const locationString = resolvedLocation && resolvedLocation.lat && resolvedLocation.lng ? `\n\n[CRITICAL SENSOR DATA]\nThe user's EXACT physical location at this very second is: ${resolvedLocation.address || 'Unknown'} (Lat: ${resolvedLocation.lat}, Lng: ${resolvedLocation.lng}). If they ask where they are, tell them this address immediately and confidently.` : '';
    const runtimeSystemPrompt = `${SYSTEM_PROMPT}\n\n${buildRuntimeUserContextPrompt(runtimeUserContext)}${locationString}`;

    let aiResponse = '';
    // Use v1 for stability
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

    const historyForGemini = rawHistory.slice(0, -1);
    const contents = historyForGemini
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

    const currentTurnParts: any[] = [];
    if (text) {
      currentTurnParts.push({ text });
    }
    if (currentImageObj) {
      currentTurnParts.push({ inlineData: { data: currentImageObj.base64, mimeType: currentImageObj.mimeType } });
    }
    if (extraVisionParts.length > 0) {
      currentTurnParts.push(...extraVisionParts);
    }
    if (currentTurnParts.length > 0) {
      contents.push({
        role: 'user',
        parts: currentTurnParts,
      });
    }

    const requiresGemini = hasImages || extraVisionParts.length > 0 || needsSearch;

    if (groq && !requiresGemini) {
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
      // --- Execute Search Tool if needed ---
      if (needsSearch) {
        const searchQuery = text?.replace(/\b(search for|find|look up|search)\b/gi, '').trim() || text || '';
        const searchResults = await performWebSearch(searchQuery);
        contents.push({
          role: 'user',
          parts: [{ text: `SYSTEM NOTE: The following are search results for the user's query. Use them to answer accurately: ${searchResults}` }]
        });
      }

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

      if (wantsLiveVision && looksLikeVisionFallback(aiResponse)) {
        for (const modelName of GEMINI_TEXT_MODELS) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              systemInstruction: `${runtimeSystemPrompt}\n\nLIVE VISION OVERRIDE\n- For this turn, you have a live image attached.\n- The user is asking about something visible right now.\n- You must answer from the visible frame.\n- Never say you cannot see the image or that you are only text-based.`,
            });

            const retryContents = [
              ...contents,
              {
                role: 'user',
                parts: [
                  {
                    text: 'Retry the previous answer using the attached live frame. Describe only what is actually visible right now, especially the user background or appearance if asked.',
                  },
                ],
              },
            ] as any[];

            const retryResult = await model.generateContent({ contents: retryContents });
            const retryText = retryResult.response.text() || '';

            if (retryText && !looksLikeVisionFallback(retryText)) {
              aiResponse = retryText;
              break;
            }
          } catch (retryError) {
            console.warn(`Gemini live-vision retry failed for ${modelName}:`, retryError);
          }
        }
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
