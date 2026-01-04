import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // твой клиент
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function ForumPage() {
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  const [newThreadContent, setNewThreadContent] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [replyTo, setReplyTo] = useState(null); // для ответа на конкретное сообщение
  const [loading, setLoading] = useState(true);

  const currentUser = supabase.auth.getUser(); // или твой способ получения юзера

  // Загрузка списка тем
  useEffect(() => {
    loadThreads();
  }, []);

  async function loadThreads() {
    const { data } = await supabase
      .from('threads')
      .select('id, title, content, user_id, created_at')
      .order('created_at', { ascending: false });
    setThreads(data || []);
    setLoading(false);
  }

  // Загрузка сообщений и подписка на real-time
  useEffect(() => {
    if (!selectedThread) return;

    loadMessages();

    const channel = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${selectedThread.id}` }, 
        (payload) => {
          setMessages(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [selectedThread]);

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('id, content, user_id, parent_id, created_at')
      .eq('thread_id', selectedThread.id)
      .order('created_at', { ascending: true });

    setMessages(buildMessageTree(data || []));
  }

  // Построение дерева сообщений (вложенные ответы)
  function buildMessageTree(messages) {
    const map = {};
    const roots = [];

    messages.forEach(msg => {
      msg.replies = [];
      map[msg.id] = msg;
    });

    messages.forEach(msg => {
      if (msg.parent_id === null) {
        roots.push(msg);
      } else {
        if (map[msg.parent_id]) {
          map[msg.parent_id].replies.push(msg);
        }
      }
    });

    return roots;
  }

  // Создание темы
  async function createThread() {
    if (!newThreadTitle.trim()) return;
    const { data: user } = await supabase.auth.getUser();
    await supabase.from('threads').insert({
      title: newThreadTitle,
      content: newThreadContent,
      user_id: user.user.id
    });
    setNewThreadTitle('');
    setNewThreadContent('');
    loadThreads();
  }

  // Отправка сообщения
  async function sendMessage() {
    if (!newMessage.trim()) return;
    const { data: user } = await supabase.auth.getUser();

    await supabase.from('messages').insert({
      thread_id: selectedThread.id,
      content: newMessage,
      user_id: user.user.id,
      parent_id: replyTo || null
    });

    setNewMessage('');
    setReplyTo(null);
  }

  // Рекурсивный компонент для отображения сообщений с ответами
  function MessageItem({ message, depth = 0 }) {
    return (
      <div className={`${depth > 0 ? 'ml-8 mt-4' : 'mt-6'}`}>
        <div className="flex gap-3">
          <Avatar>
            <AvatarFallback>{message.user_id?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="font-medium text-gray-900 dark:text-gray-100">User {message.user_id.slice(0,8)}</span>
              <span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ru })}</span>
            </div>
            <p className="mt-1 text-gray-800 dark:text-gray-200">{message.content}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setReplyTo(message.id)}
            >
              Ответить
            </Button>
            {replyTo === message.id && (
              <div className="mt-3 flex gap-2">
                <Textarea
                  placeholder="Ваш ответ..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <div className="flex flex-col gap-2">
                  <Button onClick={sendMessage}>Отправить</Button>
                  <Button variant="outline" onClick={() => {setReplyTo(null); setNewMessage('')}}>Отмена</Button>
                </div>
              </div>
            )}
            {message.replies.map(reply => (
              <MessageItem key={reply.id} message={reply} depth={depth + 1} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center">Загрузка...</div>;

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Форум</h1>

      {!selectedThread ? (
        <>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="mb-6">Создать новую тему</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новая тема</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Заголовок темы"
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                />
                <Textarea
                  placeholder="Описание (необязательно)"
                  value={newThreadContent}
                  onChange={(e) => setNewThreadContent(e.target.value)}
                />
                <Button onClick={createThread}>Создать</Button>
              </div>
            </DialogContent>
          </Dialog>

          <div className="grid gap-4">
            {threads.map(thread => (
              <Card key={thread.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedThread(thread)}>
                <CardHeader>
                  <CardTitle>{thread.title}</CardTitle>
                  <CardDescription>
                    {thread.content || 'Нет описания'} • Создано {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true, locale: ru })}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Button variant="ghost" onClick={() => setSelectedThread(null)} className="mb-4">
          ← Назад к списку тем
        </Button>
      )}

      {selectedThread && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedThread.title}</CardTitle>
            <CardDescription>{selectedThread.content}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96 pr-4">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500">Пока нет сообщений. Будьте первым!</p>
              ) : (
                messages.map(msg => <MessageItem key={msg.id} message={msg} />)
              )}
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Separator />
            <div className="w-full flex gap-3">
              <Textarea
                placeholder={replyTo ? "Ваш ответ..." : "Напишите сообщение..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <Button onClick={sendMessage}>Отправить</Button>
            </div>
            {replyTo && <Button variant="outline" onClick={() => {setReplyTo(null); setNewMessage('')}}>Отменить ответ</Button>}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}