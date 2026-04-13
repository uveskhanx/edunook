import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Send, ArrowLeft, User } from 'lucide-react';

export const Route = createFileRoute('/chat')({
  head: () => ({
    meta: [{ title: 'Chat — EduNook' }],
  }),
  component: ChatPage,
});

type ChatUser = {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  last_message?: string;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  created_at: string;
};

function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: '/login' }); return; }
    loadChatUsers();
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!selectedUser || !user) return;
    loadMessages();

    const channel = supabase
      .channel(`chat-${user.id}-${selectedUser.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chats',
        filter: `receiver_id=eq.${user.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === selectedUser.user_id) {
          setMessages(prev => [...prev, msg]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedUser, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadChatUsers() {
    if (!user) return;
    // Get unique users from chats
    const { data: chats } = await supabase
      .from('chats')
      .select('sender_id, receiver_id, message, created_at')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    const userIds = new Set<string>();
    const lastMessages: Record<string, string> = {};
    (chats || []).forEach(c => {
      const otherId = c.sender_id === user.id ? c.receiver_id : c.sender_id;
      if (!userIds.has(otherId)) {
        userIds.add(otherId);
        lastMessages[otherId] = c.message;
      }
    });

    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('user_id', Array.from(userIds));

      setChatUsers((profiles || []).map(p => ({ ...p, last_message: lastMessages[p.user_id] })));
    }
    setLoading(false);
  }

  async function loadMessages() {
    if (!user || !selectedUser) return;
    const { data } = await supabase
      .from('chats')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.user_id}),and(sender_id.eq.${selectedUser.user_id},receiver_id.eq.${user.id})`)
      .order('created_at');
    setMessages(data || []);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !selectedUser || !newMessage.trim()) return;
    setSending(true);

    const msg = {
      sender_id: user.id,
      receiver_id: selectedUser.user_id,
      message: newMessage.trim(),
    };

    const { data } = await supabase.from('chats').insert(msg).select().single();
    if (data) {
      setMessages(prev => [...prev, data]);
      setNewMessage('');
    }
    setSending(false);
  }

  if (authLoading || loading) return <Layout><LoadingSpinner className="py-20" /></Layout>;

  return (
    <Layout>
      <div className="flex h-[calc(100vh-5rem)] md:h-screen">
        {/* User List */}
        <div className={`${selectedUser ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-72 border-r border-border`}>
          <div className="p-4 border-b border-border">
            <h2 className="font-bold text-foreground">Messages</h2>
          </div>
          {chatUsers.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-sm text-muted-foreground text-center">No conversations yet. Search for users to start chatting!</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {chatUsers.map(cu => (
                <button
                  key={cu.user_id}
                  onClick={() => setSelectedUser(cu)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-all ${selectedUser?.user_id === cu.user_id ? 'bg-muted' : 'hover:bg-muted/50'}`}
                >
                  <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                    {cu.avatar_url ? (
                      <img src={cu.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5 text-muted-foreground" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{cu.full_name || cu.username}</p>
                    {cu.last_message && <p className="text-xs text-muted-foreground truncate">{cu.last_message}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Chat Area */}
        {selectedUser ? (
          <div className="flex-1 flex flex-col">
            <div className="p-3 border-b border-border flex items-center gap-2">
              <button onClick={() => setSelectedUser(null)} className="md:hidden p-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="w-5 h-5" /></button>
              <div className="w-8 h-8 rounded-full bg-muted overflow-hidden">
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {selectedUser.username.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="text-sm font-medium text-foreground">{selectedUser.full_name || selectedUser.username}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] px-3 py-2 rounded-xl text-sm ${
                    m.sender_id === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-card-foreground'
                  }`}>
                    {m.message}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={sendMessage} className="p-3 border-t border-border flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-input border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              />
              <button type="submit" disabled={sending || !newMessage.trim()}
                className="p-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 disabled:opacity-50 transition-all">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center">
            <p className="text-muted-foreground">Select a conversation</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
