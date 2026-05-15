'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { DbService } from '@/lib/db-service';

type ConversationPreview = {
  uid: string;
  fullName: string;
  username: string;
  chatId: string;
  lastMessage?: string;
  updatedAt?: string;
  lastSenderId?: string;
  unreadCount?: number;
  isMuted?: boolean;
};

function buildToastDescription(conversation: ConversationPreview) {
  const message = conversation.lastMessage?.trim();
  if (!message) return 'Sent you a new message';
  return message.length > 90 ? `${message.slice(0, 87)}...` : message;
}

export function IncomingMessageNotifier() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasHydratedRef = useRef(false);
  const lastSeenRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user) {
      hasHydratedRef.current = false;
      lastSeenRef.current.clear();
      return;
    }

    const activeChatUid = searchParams?.get('c') || searchParams?.get('chatWith');

    const unsubscribe = DbService.subscribeToUserConversations(user.id, (conversations) => {
      const nextSnapshot = new Map<string, string>();

      for (const conversation of conversations as ConversationPreview[]) {
        const signature = [
          conversation.updatedAt || '',
          conversation.lastMessage || '',
          conversation.lastSenderId || '',
          String(conversation.unreadCount || 0),
        ].join('|');

        nextSnapshot.set(conversation.chatId, signature);

        if (!hasHydratedRef.current) {
          continue;
        }

        const previousSignature = lastSeenRef.current.get(conversation.chatId);
        const isIncoming = conversation.lastSenderId && conversation.lastSenderId !== user.id;
        const hasUnread = (conversation.unreadCount || 0) > 0;
        const isViewingSameChat = pathname === '/chat' && activeChatUid === conversation.uid;

        if (
          previousSignature &&
          previousSignature !== signature &&
          isIncoming &&
          hasUnread &&
          !conversation.isMuted &&
          !isViewingSameChat
        ) {
          toast(conversation.fullName, {
            id: `incoming-message-${conversation.chatId}-${conversation.updatedAt || Date.now()}`,
            description: buildToastDescription(conversation),
            action: {
              label: 'Open',
              onClick: () => router.push(`/chat?c=${conversation.uid}`),
            },
          });
        }
      }

      lastSeenRef.current = nextSnapshot;
      hasHydratedRef.current = true;
    });

    return () => unsubscribe();
  }, [pathname, router, searchParams, user]);

  return null;
}
