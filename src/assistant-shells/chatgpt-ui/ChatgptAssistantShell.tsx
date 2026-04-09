import { useEffect, useRef, useState } from 'react';
import {
  AnimatedAssistantText,
  FormattedAssistantText
} from '../shared/assistantMessageContent';
import { getExplainRevealBudgetMs, useAssistantReplyPlayback } from '../shared/useAssistantReplyPlayback';
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
  const replyPlayback = useAssistantReplyPlayback({
    messages,
    isLoading,
    canStartReveal: !isLoading,
    maxRevealDurationMs: getExplainRevealBudgetMs()
  });

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, replyPlayback.phase]);

  function scrollToBottom() {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }

  function handleAssistantRevealComplete(messageId: string) {
    replyPlayback.markRevealComplete(messageId);
    replyPlayback.completeSession(messageId);
  }

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
            <div className={`assistantMsgBubble ${message.role} ${replyPlayback.isAnimatingMessage(message.id) ? 'revealing' : ''}`}>
              {replyPlayback.isAnimatingMessage(message.id) ? (
                <AnimatedAssistantText
                  text={message.text}
                  animate
                  durationMs={replyPlayback.revealDurationMs}
                  onRevealStep={scrollToBottom}
                  onRevealComplete={() => handleAssistantRevealComplete(message.id)}
                />
              ) : (
                <FormattedAssistantText className="assistantMsgStructuredText" text={message.text} />
              )}
            </div>
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
