'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { DbService, Profile, Message } from '@/lib/db-service';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { 
  User as UserIcon, Loader2, MessageSquare, ArrowLeft, 
  MoreVertical, Info, ShieldCheck, Search, X, Trash2, Settings, MoreHorizontal, ShieldAlert, Ghost
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { VerificationTick } from '@/components/VerificationTick';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { toast } from 'sonner';
import { ReportModal } from '@/components/ReportModal';
import { ConfirmDialog } from '@/components/ConfirmDialog';

type CapturedFrame = {
  facing: 'user' | 'environment';
  dataUrl: string;
};

export default function ChatClient() {
  const searchParams = useSearchParams();
  const { user, dbUser, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<{ profile: Profile; chatId: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<Profile[]>([]);
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [recipientPresence, setRecipientPresence] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [confirmClearChatOpen, setConfirmClearChatOpen] = useState(false);
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const [voiceAssistantSpeaking, setVoiceAssistantSpeaking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number, address?: string} | null>(null);
  const [vanishMode, setVanishMode] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStartPromiseRef = useRef<Promise<boolean> | null>(null);
  const cameraIdleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const [aiLoadingState, setAiLoadingState] = useState<string | null>(null);
  const lastSpokenAiMessageRef = useRef<string | null>(null);
  const CAMERA_BOOT_TIMEOUT_MS = 2500;
  const CAMERA_RETRY_ATTEMPTS = 4;

  const normalizeVisionText = useCallback((rawText: string) => {
    return rawText
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  // Security Verification
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Request Location Tracking (with Instant IP Fallback)
  useEffect(() => {
    let hasHighAccuracy = false;

    const fetchIpLocation = async () => {
      // Try multiple HTTPS-safe IP geolocation APIs as fallback
      const apis = [
        { url: 'https://ipapi.co/json/', parse: (d: any) => d.latitude && d.longitude ? { lat: d.latitude, lng: d.longitude, address: `${d.city}, ${d.country_name}` } : null },
        { url: 'https://ipwho.is/', parse: (d: any) => d.success !== false && d.latitude && d.longitude ? { lat: d.latitude, lng: d.longitude, address: `${d.city}, ${d.country}` } : null },
      ];
      for (const api of apis) {
        try {
          const res = await fetch(api.url);
          const data = await res.json();
          const loc = api.parse(data);
          if (loc && !hasHighAccuracy) {
            setCurrentLocation(prev => prev ? prev : loc);
            return;
          }
        } catch { /* try next */ }
      }
    };

    // Immediately fire the IP fallback so the AI has location data instantly
    fetchIpLocation();

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      if (navigator.permissions) {
        navigator.permissions.query({ name: 'geolocation' }).then(result => {
          if (result.state === 'denied') {
            toast.warning("Hardware GPS is blocked! Click the lock icon in your URL bar to allow location access for exact coordinates.", { duration: 8000 });
          }
        }).catch(() => {});
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          hasHighAccuracy = true;
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          try {
            const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng);
            const data = await res.json();
            const address = data.address?.city || data.address?.town || data.address?.village || data.address?.state || 'Unknown Location';
            setCurrentLocation({ lat, lng, address: (address + ', ' + (data.address?.country || '')).replace(/, $/, '').trim() });
          } catch {
            setCurrentLocation({ lat, lng });
          }
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED && !hasHighAccuracy) {
            toast.warning('Exact device location is blocked. Allow location access in your browser if you want hardware GPS.', {
              duration: 7000,
            });
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            toast.warning('Your device could not determine a hardware location, so IP-based location is being used instead.', {
              duration: 7000,
            });
          } else if (error.code === error.TIMEOUT) {
            toast.warning('Hardware location timed out, so IP-based location is being used instead.', {
              duration: 7000,
            });
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }
      );
    }
  }, []);

  // Presence Heartbeat & Conversations Subscription
  useEffect(() => {
    if (user) {
      DbService.updatePresence(user.id);
      heartbeatRef.current = setInterval(() => DbService.updatePresence(user.id), 60000);

      const unsubscribe = DbService.subscribeToUserConversations(user.id, (convs) => {
        setConversations(convs);
        setLoading(false);
      });

      return () => {
        unsubscribe();
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      };
    }
  }, [user]);

  // Handle Mark as Read
  useEffect(() => {
     if (activeChat && user) {
        DbService.markAsRead(activeChat.chatId, user.id);
     }
  }, [activeChat, user, messages.length]);

  // Global Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setGlobalResults([]);
      setIsSearchingGlobal(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingGlobal(true);
      try {
        const results = await DbService.searchProfiles(searchQuery);
        const currentUids = new Set(conversations.map(c => c.uid));
        setGlobalResults(results.filter(r => !currentUids.has(r.uid) && r.uid !== user?.id));
      } catch (err) {
        console.error("Global search failed", err);
      } finally {
        setIsSearchingGlobal(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, conversations, user?.id]);

  // Background Garbage Collector for expired chats
  useEffect(() => {
    if (user) {
      DbService.runGarbageCollector(user.id);
    }
  }, [user]);

  // Sync Active Chat from URL
  useEffect(() => {
    async function initDirectChat() {
      const targetUid = searchParams.get('c') || searchParams.get('chatWith');
      if (targetUid && user && !loading) {
        try {
          const chatId = await DbService.getOrCreateChat(user.id, targetUid);
          const profile = await DbService.getProfile(targetUid);
          
          if (profile && (!activeChat || activeChat.profile.uid !== profile.uid)) {
            setActiveChat({ profile, chatId });
          }
        } catch (err) {
          console.error("Could not init direct chat", err);
          toast.error("Security Channel initialization failed.");
        }
        
        if (searchParams.get('chatWith')) {
           router.replace(`/chat?c=${targetUid}`);
        }
      } else if (!targetUid && activeChat) {
         setActiveChat(null);
      }
    }
    initDirectChat();
  }, [searchParams, user, loading, activeChat, router]);

  // Active Chat Real-time Subscriptions
  useEffect(() => {
    if (activeChat && user) {
      const unsubs: (() => void)[] = [];

      const setupSubs = async () => {
        const chatSnapshot = await DbService.getChatMetadata(activeChat.chatId);
        if (chatSnapshot?.users && !chatSnapshot.users[user.id]) {
           router.push('/home');
           return;
        }

        unsubs.push(DbService.subscribeToMessages(activeChat.chatId, user.id, setMessages));
        unsubs.push(DbService.subscribeToTyping(activeChat.chatId, setTypingUsers));
        unsubs.push(DbService.subscribeToPresence(activeChat.profile.uid, setRecipientPresence));
        unsubs.push(DbService.subscribeToVanishMode(activeChat.chatId, setVanishMode));
        DbService.updateChatPresence(activeChat.chatId, user.id, true);
      };

      setupSubs();
      return () => {
        unsubs.forEach(u => u());
        if (activeChat && user) {
          DbService.updateChatPresence(activeChat.chatId, user.id, false);
        }
      };
    }
  }, [activeChat, user, router]);

  const handleTyping = useCallback(() => {
     if (!user || !activeChat) return;
     DbService.setTypingStatus(activeChat.chatId, user.id, true);
     if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
     typingTimeoutRef.current = setTimeout(() => {
        DbService.setTypingStatus(activeChat.chatId, user.id, false);
     }, 3000);
  }, [user, activeChat]);

  const shouldUseCameraForText = useCallback((rawText: string) => {
    const text = normalizeVisionText(rawText);
    if (!text) return false;

    const directVisualPatterns = [
      /\bwhat do you see\b/,
      /\bcan you see\b/,
      /\blook at\b/,
      /\blook closely\b/,
      /\btake a look\b/,
      /\bcheck this out\b/,
      /\bsee me\b/,
      /\bhow do i look\b/,
      /\bhow am i looking\b/,
      /\bhow does my\b/,
      /\bwhat am i wearing\b/,
      /\bwhat color am i wearing\b/,
      /\bhow is my outfit\b/,
      /\bhow is my face\b/,
      /\bhow is my hair\b/,
      /\bhow is my skin\b/,
      /\bam i looking\b/,
      /\bdo i look\b/,
      /\bdoes my face look\b/,
      /\bdoes my outfit look\b/,
      /\bwhat is behind me\b/,
      /\bwhat'?s behind me\b/,
      /\bwhat is in my background\b/,
      /\bwhat'?s in my background\b/,
      /\bwhat is shown in my background\b/,
      /\bwhat'?s shown in my background\b/,
      /\bwhat do you see in my background\b/,
      /\bwhat is around me\b/,
      /\bwhat'?s around me\b/,
      /\bwhat am i holding\b/,
      /\bwhat is in my hand\b/,
      /\bwhat'?s in my hand\b/,
      /\bwhat am i doing\b/,
      /\bwhat'?m i doing\b/,
      /\bwhat i am doing\b/,
      /\bwhat i am currently doing\b/,
      /\bwhat am i currently doing\b/,
      /\bwhat am i doing right now\b/,
      /\bam i sitting\b/,
      /\bam i standing\b/,
      /\bam i smiling\b/,
      /\bwhat am i looking at\b/,
      /\bwhat is this\b/,
      /\bwhat'?s this\b/,
      /\bwhat is on my screen\b/,
      /\bwhat'?s on my screen\b/,
      /\bread this\b/,
      /\bscan this\b/,
      /\bsolve this from camera\b/,
      /\bidentify this\b/,
      /\brecognize this\b/,
      /\bdescribe what you see\b/,
      /\bdescribe (me|my outfit|my room|my background|this)\b/,
      /\bdoes this look\b/,
      /\bwhich outfit\b/,
      /\bwhich shirt\b/,
      /\bwhich dress\b/,
      /\bwhich side\b/,
      /\bwhich one looks better\b/,
      /\bwhich color suits\b/,
      /\bmatch this\b/,
      /\bcompare these\b/,
      /\bshowing you\b/,
      /\bsee this\b/,
      /\bwatch this\b/,
      /\bjudge my\b/,
      /\brate my\b/,
    ];

    const appearanceTargets = /\b(i|me|my|myself)\b.*\b(wear|wearing|outfit|shirt|dress|pant|pants|clothes|face|hair|skin|beard|makeup|look|style)\b|\b(wear|wearing|outfit|shirt|dress|pant|pants|clothes|face|hair|skin|beard|makeup|look|style)\b.*\b(i|me|my|myself)\b/;
    const activityTargets = /\b(i|me|my|myself)\b.*\b(do|doing|sitting|standing|smiling|walking|studying|reading|writing|working|typing|holding|using|looking|pointing|eating|drinking|talking|sleeping)\b|\b(do|doing|sitting|standing|smiling|walking|studying|reading|writing|working|typing|holding|using|looking|pointing|eating|drinking|talking|sleeping)\b.*\b(i|me|my|myself)\b/;
    const sceneTargets = /\b(background|behind|around|surroundings|room|desk|screen|monitor|display|object|item|thing|book|paper|document|note|homework|equation|problem|hand|holding)\b/;
    const visionActionWords = /\b(look|see|watch|describe|identify|recognize|check|analyze|analyse|rate|compare|judge|read|scan|solve|inspect|show|shown|visible|tell|say|guess|notice|spot|doing)\b/;
    const deicticWords = /\b(this|that|here|there|right now|currently)\b/;
    const askPatterns = /\b(what|which|who|where|how|does|do|can|could|would|is|are)\b/;
    const informalVisionWords = /\b(kya|kaisa|kaisi|kaise|mera|meri|mere|mujhe|main|mai|peeche|piche|samne|idhar|udhar|yeh|ye|isko|isme|dikhta|dikh raha|pehna|pahna|chashma)\b|[\u0900-\u097f\u0600-\u06ff]/u;
    const informalSceneHints = /\b(now|abhi|right now|currently|mere paas|mere piche|mere peeche|my side|mere samne)\b/;

    return (
      directVisualPatterns.some((pattern) => pattern.test(text)) ||
      (visionActionWords.test(text) && (appearanceTargets.test(text) || activityTargets.test(text) || sceneTargets.test(text))) ||
      (askPatterns.test(text) && appearanceTargets.test(text)) ||
      (askPatterns.test(text) && activityTargets.test(text)) ||
      (askPatterns.test(text) && sceneTargets.test(text) && (visionActionWords.test(text) || deicticWords.test(text))) ||
      (informalVisionWords.test(text) && (appearanceTargets.test(text) || activityTargets.test(text) || sceneTargets.test(text) || informalSceneHints.test(text))) ||
      (deicticWords.test(text) && /(me|my|i|this|that|yeh|ye|isko|idhar|udhar|abhi)/.test(text))
    );
  }, [normalizeVisionText]);

  const getPreferredCameraFacingForText = useCallback((rawText: string): 'user' | 'environment' => {
    const text = normalizeVisionText(rawText);
    if (!text) return 'user';

    const frontCameraPatterns = [
      /\bhow do i look\b/,
      /\bhow am i looking\b/,
      /\bwhat am i wearing\b/,
      /\bwhat color am i wearing\b/,
      /\bhow is my outfit\b/,
      /\bhow is my face\b/,
      /\bhow is my hair\b/,
      /\bhow is my skin\b/,
      /\bam i looking\b/,
      /\bdo i look\b/,
      /\bdoes my face look\b/,
      /\bdoes my outfit look\b/,
      /\bmy background\b/,
      /\bin my background\b/,
      /\bbehind me\b/,
      /\bwhich outfit\b/,
      /\bwhich shirt\b/,
      /\bwhich dress\b/,
      /\bwhich color suits\b/,
      /\bjudge my\b/,
      /\brate my\b/,
      /\bselfie\b/,
      /\bmy face\b/,
      /\bmy look\b/,
      /\bwhat am i doing\b/,
      /\bwhat i am doing\b/,
      /\bcurrently doing\b/,
      /\bam i sitting\b/,
      /\bam i standing\b/,
      /\bam i smiling\b/,
    ];

    const rearCameraPatterns = [
      /\bwhat do you see\b/,
      /\blook at this\b/,
      /\blook closely\b/,
      /\btake a look\b/,
      /\bcheck this out\b/,
      /\bsee this\b/,
      /\bshowing you\b/,
      /\bwhat is this\b/,
      /\bwhat'?s this\b/,
      /\bread this\b/,
      /\bscan this\b/,
      /\bsolve this\b/,
      /\bidentify this\b/,
      /\brecognize this\b/,
      /\bwhat is around me\b/,
      /\bwhat'?s around me\b/,
      /\bwhat is behind me\b/,
      /\bwhat'?s behind me\b/,
      /\bwhat am i holding\b/,
      /\bwhat is in my hand\b/,
      /\bwhat'?s in my hand\b/,
      /\bmy room\b/,
      /\bmy desk\b/,
      /\bmy screen\b/,
      /\bon my screen\b/,
      /\bmonitor\b/,
      /\bdisplay\b/,
      /\bobject\b/,
      /\bitem\b/,
      /\bbook\b/,
      /\bpaper\b/,
      /\bdocument\b/,
      /\bnote\b/,
      /\bhomework\b/,
      /\bequation\b/,
      /\bproblem\b/,
    ];

    const frontHints = /\b(my background|behind me|around me|what am i wearing|my outfit|my face|my hair|my skin|do i look|how do i look|selfie|my look|what am i doing|am i sitting|am i standing|am i smiling|mera|meri|mere|main|mai|peeche|piche|samne|chashma|pehna|pahna)\b/;
    const rearHints = /\b(this|that)\b.*\b(read|scan|solve|identify|recognize|look|check|inspect)\b|\b(on my screen|my screen|monitor|display|book|paper|document|note|homework|equation|problem|object|item|isko|isme)\b/;

    if (frontCameraPatterns.some((pattern) => pattern.test(text))) return 'user';
    if (rearCameraPatterns.some((pattern) => pattern.test(text))) return 'environment';
    if (frontHints.test(text)) return 'user';
    if (rearHints.test(text)) return 'environment';
    return 'user';
  }, [normalizeVisionText]);

  const clearCameraIdleTimeout = useCallback(() => {
    if (cameraIdleTimeoutRef.current) {
      clearTimeout(cameraIdleTimeoutRef.current);
      cameraIdleTimeoutRef.current = null;
    }
  }, []);

  const waitForCameraReady = useCallback(async (timeoutMs = 700) => {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const video = cameraVideoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 35));
    }

    return false;
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = cameraVideoRef.current;
    const hasLiveTrack = !!cameraStreamRef.current?.getVideoTracks().some((track) => track.readyState === 'live');
    if (!video || !hasLiveTrack || video.readyState < 2) {
      console.warn('[Camera] Capture skipped:', { video: !!video, hasLiveTrack, readyState: video?.readyState });
      return null;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      console.log('[Camera] Frame captured, length:', dataUrl.length);
      return dataUrl;
    } catch (err) {
      console.error('[Camera] Capture failed:', err);
      return null;
    }
  }, []);

  const captureLiveFrameForInquiry = useCallback(async () => {
    const initiallyReady = await waitForCameraReady(CAMERA_BOOT_TIMEOUT_MS);
    if (!initiallyReady) {
      return null;
    }

    for (let attempt = 0; attempt < CAMERA_RETRY_ATTEMPTS; attempt += 1) {
      const frame = captureFrame();
      if (frame) {
        return frame;
      }

      const retryDelay = 120 + attempt * 80;
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      await waitForCameraReady(500);
    }

    return null;
  }, [captureFrame, waitForCameraReady, CAMERA_BOOT_TIMEOUT_MS, CAMERA_RETRY_ATTEMPTS]);

  const startCamera = useCallback(async (facing: 'user' | 'environment' = 'user', options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    clearCameraIdleTimeout();
    const activeStream = cameraStreamRef.current;
    const hasLiveTrack = !!activeStream?.getVideoTracks().some((track) => track.readyState === 'live');
    if (hasLiveTrack) {
      const currentFacing = cameraFacing;
      if (currentFacing === facing) {
        if (!cameraActive) setCameraActive(true);
        return true;
      }
      activeStream?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null;
      }
      setCameraActive(false);
    }

    if (cameraStartPromiseRef.current) {
      return cameraStartPromiseRef.current;
    }

    if (!window.isSecureContext) {
      if (!silent) {
        toast.error('Camera requires a secure (HTTPS) connection. Please check your URL.');
      }
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      if (!silent) {
        toast.error('This browser does not expose camera access here. Try HTTPS in Chrome or Edge and check site permissions.');
      }
      return false;
    }

    const startPromise = (async () => {
      try {
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach(t => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
        setCameraActive(true);
        setCameraFacing(facing);
        console.log('[Camera] Started successfully');
        return true;
      } catch (err: any) {
        console.error('Camera access failed:', err);
        const errName = err.name || 'UnknownError';
        if ((errName === 'NotAllowedError' || errName === 'PermissionDeniedError') && !silent) {
          toast.error(`Camera is blocked! 1. Click the lock icon in your URL bar and set Camera to "Allow". 2. If on mobile, check your PHONE SETTINGS > APPS > CHROME > PERMISSIONS and allow Camera there.`, { duration: 10000 });
        } else if (errName === 'SecurityError' && !silent) {
          toast.error('Camera access was blocked by browser security or site policy. Refresh after checking site permissions and HTTPS.');
        } else if ((errName === 'NotFoundError' || errName === 'DevicesNotFoundError') && !silent) {
          toast.error('No camera found on this device.');
        } else if ((errName === 'NotReadableError' || errName === 'TrackStartError') && !silent) {
          toast.error('Your camera is busy in another app. Close other camera apps and try again.');
        } else if (!silent) {
          toast.error(`Could not start camera: ${errName} - ${err.message}`);
        }
        return false;
      } finally {
        cameraStartPromiseRef.current = null;
      }
    })();

    cameraStartPromiseRef.current = startPromise;
    return startPromise;
  }, [cameraActive, cameraFacing, clearCameraIdleTimeout]);

  const stopCamera = useCallback(() => {
    clearCameraIdleTimeout();
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    cameraStartPromiseRef.current = null;
    setCameraActive(false);
  }, [clearCameraIdleTimeout]);

  const captureLiveFramesForInquiry = useCallback(async (preferredFacing: 'user' | 'environment'): Promise<CapturedFrame[]> => {
    const frames: CapturedFrame[] = [];
    const captureOrder: Array<'user' | 'environment'> = preferredFacing === 'user'
      ? ['user', 'environment']
      : ['environment', 'user'];

    for (const facing of captureOrder) {
      const started = await startCamera(facing, { silent: facing !== preferredFacing });
      if (!started) {
        continue;
      }

      const frame = await captureLiveFrameForInquiry();
      if (frame) {
        frames.push({ facing, dataUrl: frame });
      }
    }

    stopCamera();
    return frames;
  }, [captureLiveFrameForInquiry, startCamera, stopCamera]);

  const scheduleCameraIdleStop = useCallback((delayMs = 1200) => {
    clearCameraIdleTimeout();
    cameraIdleTimeoutRef.current = setTimeout(() => {
      stopCamera();
    }, delayMs);
  }, [clearCameraIdleTimeout, stopCamera]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      clearCameraIdleTimeout();
      if (cameraStreamRef.current) cameraStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [clearCameraIdleTimeout]);

  const handleSendMessage = useCallback(async (text: string, media?: { url: string, type: 'image' | 'video' | 'file' }) => {
    if (!user || !activeChat || sending) return;
    setSending(true);
    try {
      const outgoingText = replyingTo
        ? `Replying to: "${(replyingTo.text?.trim() || replyingTo.mediaType || 'message').slice(0, 100)}"\n${text}`.trim()
        : text;
      const txt = text.toLowerCase();
      const isVisualInquiry = shouldUseCameraForText(text);
      const preferredFacing = getPreferredCameraFacingForText(text);
      let liveFrames: CapturedFrame[] = [];

      if (activeChat.profile.uid === 'edunook-ai') {
        let state = 'Thinking...';
        
        if (media?.type === 'image') state = 'Analyzing image...';
        else if (txt.includes('search') || txt.includes('find') || txt.includes('look for')) state = 'Searching database...';
        else if (txt.includes('calculate') || txt.includes('math') || txt.includes('solve')) state = 'Calculating...';
        
        if (isVisualInquiry) {
          liveFrames = await captureLiveFramesForInquiry(preferredFacing);
          if (liveFrames.length === 0) {
            toast.warning('I could not capture a camera frame for that question. Please allow camera access and keep yourself in view, then try again.', {
              duration: 7000,
            });
          }
        }
        if (liveFrames.length > 0) state = liveFrames.length > 1 ? 'Observing both sides...' : 'Observing...';
        setAiLoadingState(state);
      }

      await DbService.sendMessage(activeChat.chatId, user.id, outgoingText, media);
      setReplyingTo(null);

      if (activeChat.profile.uid === 'edunook-ai') {
        fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chatId: activeChat.chatId, 
            userId: user.id, 
            text: outgoingText,
            mediaUrl: media?.url,
            mediaType: media?.type,
            location: currentLocation,
            liveFrame: liveFrames[0]?.dataUrl || null,
            liveFrames
          })
        }).then(async res => {
          if (!res.ok) {
            const body = await res.json();
            console.error('AI API Error Detail:', body);
            toast.error(`AI failed: ${body.error || 'Unknown error'}`);
          }
        }).catch(err => console.error('AI Network Error:', err)).finally(() => setAiLoadingState(null));
      }
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error("Transmission failed. Check network stability.");
    } finally {
      setSending(false);
    }
  }, [activeChat, captureLiveFramesForInquiry, currentLocation, getPreferredCameraFacingForText, sending, shouldUseCameraForText, user]);

  useEffect(() => {
    setReplyingTo(null);
  }, [activeChat?.chatId]);

  const handleDraftTextChange = useCallback((draft: string) => {
    if (!activeChat || activeChat.profile.uid !== 'edunook-ai') return;
    if (!shouldUseCameraForText(draft) && cameraActive) {
      scheduleCameraIdleStop(250);
    }
  }, [activeChat, cameraActive, scheduleCameraIdleStop, shouldUseCameraForText]);

  const handleUploadMedia = async (file: File) => {
    if (!user) throw new Error("Auth required");
    return await DbService.uploadChatMedia(user.id, file);
  };

  const filteredMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) return messages;
    return messages.filter(m => m.text?.toLowerCase().includes(chatSearchQuery.toLowerCase()));
  }, [messages, chatSearchQuery]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (!voiceModeEnabled || !activeChat || activeChat.profile.uid !== 'edunook-ai') return;
    if (messages.length === 0) return;

    const latestAiMessage = [...messages]
      .reverse()
      .find((message) => message.senderId === 'edunook-ai' && typeof message.text === 'string' && message.text.trim());

    if (!latestAiMessage || latestAiMessage.id === lastSpokenAiMessageRef.current) {
      return;
    }

    const spokenText = (latestAiMessage.text || '')
      .replace(/\[DRAW:[\s\S]*?\]/gi, '')
      .replace(/[#*_`>-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!spokenText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setVoiceAssistantSpeaking(true);
    utterance.onend = () => setVoiceAssistantSpeaking(false);
    utterance.onerror = () => setVoiceAssistantSpeaking(false);
    lastSpokenAiMessageRef.current = latestAiMessage.id;
    window.speechSynthesis.speak(utterance);

    return () => {
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
    };
  }, [activeChat, messages, voiceModeEnabled]);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="relative">
             <Loader2 className="w-16 h-16 animate-spin text-primary" />
             <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideMobileNav={!!activeChat} hideHeader={true}>
      <div className="flex-1 flex bg-background w-full overflow-hidden relative text-foreground h-[100dvh] max-h-[100dvh]">
        
        {/* Sidebar Layer */}
        <ChatSidebar 
          user={user}
          conversations={conversations}
          activeChatId={activeChat?.chatId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          globalResults={globalResults}
          isSearchingGlobal={isSearchingGlobal}
          onSelectChat={(uid: string) => router.push(`/chat?c=${uid}`)}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
        />

        {/* Main Viewbox Layer */}
        <main className={`flex-1 flex flex-col relative min-h-0 min-w-0 transition-all duration-700 ${vanishMode ? 'bg-black' : 'bg-background'} ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
          {vanishMode && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
               <div className="absolute top-0 left-1/4 w-full h-full bg-primary/5 blur-[120px] rounded-full animate-pulse" />
               <div className="absolute bottom-0 right-1/4 w-full h-full bg-purple-500/5 blur-[120px] rounded-full animate-pulse delay-700" />
            </div>
          )}
          {/* Hidden video element for camera capture */}
          <video ref={cameraVideoRef} playsInline muted autoPlay style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', zIndex: -1 }} />
          {activeChat ? (
            <>
              {/* Premium Header */}
              <header className={`p-4 md:p-7 flex items-center justify-between border-b z-20 transition-all duration-500 ${vanishMode ? 'bg-black/40 border-white/5 backdrop-blur-2xl' : 'chat-glass border-border'}`}>
                <div className="flex items-center gap-2 md:gap-5 min-w-0">
                  <button onClick={() => router.push('/chat')} className="md:hidden p-2.5 bg-foreground/5 rounded-2xl border border-border hover:bg-foreground/10 transition-all shrink-0">
                    <ArrowLeft className="w-5 h-5 text-foreground" />
                  </button>
                  <div className="flex items-center gap-3 group cursor-pointer min-w-0" onClick={() => router.push(`/${activeChat.profile.username}`)}>
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 md:w-14 md:h-14 rounded-[1.25rem] border-2 border-border overflow-hidden shadow-2xl group-hover:border-primary transition-all duration-500">
                         {activeChat.profile.avatarUrl ? (
                           <img src={activeChat.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-xl font-black italic uppercase">
                             {activeChat.profile.fullName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                           </div>
                         )}
                      </div>
                       {(recipientPresence?.status === 'online' || activeChat.profile.uid === 'edunook-ai') && (
                         <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-success rounded-full border-[3px] border-background shadow-[0_0_10px_var(--success)]" />
                       )}
                    </div>
                    <div className="flex flex-col min-w-0">
                       <div className="flex items-center gap-1.5">
                          <h2 className="text-sm md:text-lg font-black tracking-tight leading-none text-foreground truncate max-w-[100px] sm:max-w-xs">{activeChat.profile.fullName}</h2>
                          <VerificationTick planId={activeChat.profile.subscription?.planId} size={16} />
                       </div>
                       <span className="text-[9px] font-black uppercase tracking-[0.2em] mt-1.5 opacity-40 text-foreground">
                          {activeChat.profile.uid === 'edunook-ai'
                              ? 'Always Online'
                              : recipientPresence?.status === 'online' 
                                ? 'Active Now' 
                                : (recipientPresence?.lastSeen 
                                    ? `Active ${formatDistanceToNow(new Date(recipientPresence.lastSeen))} ago` 
                                    : 'Offline')}
                       </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                   <button 
                     onClick={() => setChatSearchOpen(!chatSearchOpen)}
                     className={`p-3 rounded-2xl border transition-all ${chatSearchOpen ? 'bg-primary text-white border-primary shadow-lg' : 'bg-foreground/5 text-foreground/40 border-border hover:text-foreground'}`}
                   >
                      <Search className="w-5 h-5" />
                   </button>
                   
                   <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                       <button className="p-3 bg-foreground/5 text-foreground/40 rounded-2xl border border-border hover:text-foreground transition-all">
                          <MoreVertical className="w-5 h-5" />
                       </button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end" side="bottom" sideOffset={12} className="w-56 bg-popover/90 border-border backdrop-blur-3xl rounded-2xl p-2 shadow-2xl z-[100]">
                       <DropdownMenuItem 
                         onClick={() => {
                             DbService.toggleVanishMode(activeChat.chatId, !vanishMode);
                             if (!vanishMode) {
                               toast.info("Vanish Mode Activated. Messages will disappear when you leave.", { icon: <Ghost className="w-4 h-4" /> });
                             }
                         }}
                         className={`cursor-pointer font-bold rounded-xl py-3 px-4 flex items-center justify-between ${vanishMode ? 'text-primary focus:bg-primary/10' : 'text-foreground/60 focus:bg-foreground/10'}`}
                       >
                         Vanish Mode
                         <Ghost className={`w-4 h-4 ${vanishMode ? 'animate-pulse text-primary' : 'opacity-40'}`} />
                       </DropdownMenuItem>
                       <DropdownMenuItem 
                         onClick={() => {
                            setConfirmClearChatOpen(true);
                         }}
                         className="cursor-pointer text-rose-500 font-bold focus:bg-rose-500/10 focus:text-rose-500 rounded-xl py-3 px-4 flex items-center justify-between"
                       >
                         Clear Conversation
                         <Trash2 className="w-4 h-4 opacity-80" />
                       </DropdownMenuItem>
                       <DropdownMenuItem 
                         onClick={() => setIsInfoOpen(true)}
                         className="cursor-pointer text-foreground font-medium focus:bg-foreground/10 focus:text-foreground rounded-xl py-3 px-4 flex items-center justify-between"
                       >
                         Conversation Info
                         <Info className="w-4 h-4 opacity-70" />
                       </DropdownMenuItem>
                       <DropdownMenuItem 
                         onClick={() => setIsReporting(true)}
                         className="cursor-pointer text-rose-500 font-bold focus:bg-rose-500/10 focus:text-rose-500 rounded-xl py-3 px-4 flex items-center justify-between"
                       >
                         Report Account
                         <ShieldAlert className="w-4 h-4 opacity-80" />
                       </DropdownMenuItem>
                     </DropdownMenuContent>
                   </DropdownMenu>
                </div>

                {/* Inline Search UI */}
                <AnimatePresence>
                  {chatSearchOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 p-4 bg-background/90 backdrop-blur-2xl border-b border-border z-10 flex items-center gap-4"
                    >
                       <input 
                         autoFocus
                         type="text" 
                         placeholder="Search in conversation..."
                         value={chatSearchQuery}
                         onChange={e => setChatSearchQuery(e.target.value)}
                         className="flex-1 bg-foreground/5 border border-border rounded-xl px-5 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-all"
                       />
                       <button onClick={() => { setChatSearchOpen(false); setChatSearchQuery(''); }} className="p-3 hover:bg-foreground/10 rounded-xl text-foreground/40"><X className="w-5 h-5" /></button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </header>

              {/* Message Thread */}
              <MessageList 
                messages={filteredMessages}
                currentUserId={user!.id}
                typingUsers={typingUsers}
                recipientProfile={activeChat.profile}
                chatId={activeChat.chatId}
                aiLoadingState={aiLoadingState}
                vanishMode={vanishMode}
                onReplyToMessage={setReplyingTo}
              />

              {/* Input Terminal */}
              <ChatInput
                onSendMessage={handleSendMessage}
                onTyping={handleTyping}
                sending={sending}
                onUploadMedia={handleUploadMedia}
                onTextChange={handleDraftTextChange}
                enableVoiceForAi={activeChat.profile.uid === 'edunook-ai'}
                voiceAssistantSpeaking={voiceAssistantSpeaking}
                onVoiceModeChange={setVoiceModeEnabled}
                vanishMode={vanishMode}
                replyPreview={replyingTo ? {
                  senderLabel: replyingTo.senderId === user?.id ? 'yourself' : activeChat.profile.fullName,
                  text: replyingTo.text,
                  mediaType: replyingTo.mediaType
                } : null}
                onCancelReply={() => setReplyingTo(null)}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
               <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-primary/5 rounded-full blur-[120px] opacity-20" />
               </div>
               
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 className="space-y-10 relative z-10"
               >
                  <div className="relative inline-block">
                     <div className="absolute -inset-8 bg-primary/10 blur-[60px] rounded-full animate-pulse" />
                     <div className="w-32 h-32 md:w-48 md:h-48 bg-gradient-to-br from-white/[0.05] to-transparent rounded-[4rem] border border-white/10 flex items-center justify-center shadow-3xl">
                        <MessageSquare className="w-16 h-16 md:w-24 md:h-24 text-white opacity-10" />
                     </div>
                  </div>
                  
                  <div className="space-y-4 max-w-sm mx-auto">
                     <h2 className="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-foreground leading-none">Intelligence Hub</h2>
                     <p className="text-foreground/30 text-xs md:text-sm font-bold uppercase tracking-widest leading-loose">Select a contact to start a private conversation.</p>
                  </div>

                  <button 
                    onClick={() => (document.querySelector('input[placeholder="Search messages..."]') as HTMLInputElement)?.focus()}
                    className="px-12 py-5 bg-primary text-white font-black text-xs uppercase tracking-[0.2em] rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_40px_rgba(59,130,246,0.3)] border border-border"
                  >
                    Establish Connection
                  </button>
               </motion.div>
            </div>
          )}
        </main>
      </div>

      <ReportModal 
        isOpen={isReporting}
        onClose={() => setIsReporting(false)}
        targetId={activeChat?.profile.uid || ''}
        targetType="user"
        targetName={activeChat?.profile.fullName || 'User'}
      />

      <ConfirmDialog
        open={confirmClearChatOpen}
        onOpenChange={setConfirmClearChatOpen}
        title="Clear this conversation?"
        description="This will remove the conversation from your side and cannot be undone."
        confirmLabel="Clear chat"
        destructive
        onConfirm={async () => {
          if (!user || !activeChat) return;
          await DbService.deleteChat(user.id, activeChat.chatId);
        }}
      />

      <AnimatePresence>
        {isInfoOpen && activeChat && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsInfoOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-card border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-8"
            >
               <div className="flex flex-col items-center text-center gap-6">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-[2.5rem] border-4 border-white/10 overflow-hidden shadow-2xl">
                      {activeChat.profile.avatarUrl ? (
                         <img src={activeChat.profile.avatarUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                         <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-4xl font-black italic">
                            {activeChat.profile.fullName[0]}
                         </div>
                      )}
                    </div>
                    {(recipientPresence?.status === 'online' || activeChat.profile.uid === 'edunook-ai') && (
                       <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-success rounded-full border-4 border-card shadow-lg" />
                     )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{activeChat.profile.fullName}</h2>
                      <VerificationTick planId={activeChat.profile.subscription?.planId} size={24} />
                    </div>
                    <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">@{activeChat.profile.username}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center space-y-1">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Joined</p>
                    <p className="text-sm font-bold text-white">
                      {activeChat.profile.createdAt ? format(new Date(activeChat.profile.createdAt), 'MMM yyyy') : 'Unknown'}
                    </p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center space-y-1">
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">Role</p>
                    <p className="text-sm font-bold text-white capitalize">{activeChat.profile.role || 'student'}</p>
                  </div>
               </div>

               <div className="space-y-3">
                  <button 
                    onClick={() => { setIsInfoOpen(false); router.push(`/${activeChat.profile.username}`); }}
                    className="w-full py-4 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                  >
                    View Intelligence Profile
                  </button>
                  <button 
                    onClick={() => setIsInfoOpen(false)}
                    className="w-full py-4 bg-white/5 text-white/60 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all border border-white/5"
                  >
                    Close Terminal
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
