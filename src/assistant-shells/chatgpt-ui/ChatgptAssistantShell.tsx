import { useEffect, useRef, useState } from 'react';
import type { ConversationMessage } from '../../lib/types';

type Props = {
  messages: ConversationMessage[];
  isLoading: boolean;
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
};

export function ChatgptAssistantShell({ messages, isLoading, onSend, disabled }: Props) {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading || disabled) return;
    setInput('');
    await onSend(text);
  }

  return (
    <div className="assistantShell assistantChatgpt">
      <div className="assistantTopline">ChatGPT-style assistant</div>
      <div className="assistantMessageList" ref={listRef}>
        {messages.map((message) => (
          <div key={message.id} className={`assistantMsgRow ${message.role}`}>
            <div className={`assistantMsgBubble ${message.role}`}>{message.text}</div>
          </div>
        ))}
        {isLoading && (
          <div className="assistantMsgRow assistant">
            <div className="assistantMsgBubble assistant">Thinking…</div>
          </div>
        )}
      </div>
      <form className="assistantComposer" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={disabled ? 'Assistant unavailable right now.' : 'Ask for drafting help, a summary, or grounded bullet points…'}
          rows={3}
          disabled={disabled}
        />
        <button type="submit" disabled={disabled || isLoading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
