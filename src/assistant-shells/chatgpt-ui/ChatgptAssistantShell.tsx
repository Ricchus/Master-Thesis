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
  const conversationKey = messages[0]?.id ?? 'empty-conversation';
  const replyPlayback = useAssistantReplyPlayback({
    conversationKey,
    messages
  });
  const revealBudgetMs = getExplainRevealBudgetMs();

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading, replyPlayback.phase]);

  useEffect(() => {
    if (isLoading || replyPlayback.phase !== 'awaiting_start') {
      return;
    }

    replyPlayback.startReveal(revealBudgetMs);
  }, [isLoading, replyPlayback, revealBudgetMs]);

  useEffect(() => {
    if (!replyPlayback.activeMessageId || replyPlayback.phase !== 'awaiting_settle') {
      return;
    }

    replyPlayback.completeActive(replyPlayback.activeMessageId);
  }, [replyPlayback]);

  function scrollToBottom() {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }

  function handleAssistantRevealComplete(messageId: string) {
    replyPlayback.markRevealComplete(messageId);
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
        {messages.map((message) => {
          const renderMode = message.role === 'assistant'
            ? replyPlayback.getMessageRenderMode(message.id)
            : 'static';

          if (renderMode === 'queued') {
            return null;
          }

          return (
            <div key={message.id} className={`assistantMsgRow ${message.role}`}>
              <div className={`assistantMsgBubble ${message.role} ${renderMode === 'revealing' ? 'revealing' : ''}`}>
                {renderMode === 'revealing' ? (
                  <AnimatedAssistantText
                    text={message.text}
                    animate
                    className="assistantMsgStructuredText"
                    durationMs={replyPlayback.revealDurationMs}
                    onRevealStep={scrollToBottom}
                    onRevealComplete={() => handleAssistantRevealComplete(message.id)}
                  />
                ) : (
                  <FormattedAssistantText className="assistantMsgStructuredText" text={message.text} />
                )}
              </div>
            </div>
          );
        })}
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
