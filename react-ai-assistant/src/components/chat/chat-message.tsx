// src/components/chat/chat-message.tsx

import React, { useState } from "react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { Bot, Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  useChannelStateContext,
  useMessageContext,
  useMessageTextStreaming,
} from "stream-chat-react";

const ChatMessage: React.FC = () => {
  const { message } = useMessageContext();
  const { channel } = useChannelStateContext();

  const isUser = !message.user?.id?.startsWith("ai-bot");

  /**
   * Stream text ONLY for AI messages
   * Prevents unnecessary re-streaming on user messages
   */
  const { streamedMessageText } = useMessageTextStreaming({
    text: !isUser ? message.text ?? "" : "",
    renderingLetterCount: 12,
    streamingLetterIntervalMs: 35,
  });

  const finalText = !isUser
    ? streamedMessageText || message.text || ""
    : message.text || "";

  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!finalText) return;
    await navigator.clipboard.writeText(finalText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className={cn(
        "flex w-full mb-4 px-4 group",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "flex max-w-[70%] sm:max-w-[60%] lg:max-w-[50%]",
          isUser ? "flex-row-reverse" : "flex-row"
        )}
      >
        {/* Avatar */}
        {!isUser && (
          <div className="flex-shrink-0 mr-3 self-end">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted text-muted-foreground">
                <Bot className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </div>
        )}

        {/* Message Content */}
        <div className="flex flex-col space-y-1 w-full">
          {/* Bubble */}
          <div
            className={cn(
              "px-4 py-3 rounded-2xl text-sm leading-relaxed",
              isUser
                ? "str-chat__message-bubble str-chat__message-bubble--me rounded-br-md"
                : "str-chat__message-bubble rounded-bl-md"
            )}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
                ),
                code: ({ children, ...props }) => {
                  const isInline = !props.className?.includes("language-");
                  return isInline ? (
                    <code className="px-1 py-0.5 rounded text-xs font-mono bg-black/10 dark:bg-white/10">
                      {children}
                    </code>
                  ) : (
                    <pre className="p-3 rounded-md overflow-x-auto my-2 text-xs font-mono bg-black/5 dark:bg-white/5">
                      <code>{children}</code>
                    </pre>
                  );
                },
                ul: ({ children }) => (
                  <ul className="list-disc ml-4 mb-3 space-y-1">
                    {children}
                  </ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal ml-4 mb-3 space-y-1">
                    {children}
                  </ol>
                ),
              }}
            >
              {finalText}
            </ReactMarkdown>

            {/* Single, clean loading indicator */}
            {!isUser && !finalText && (
              <div className="text-xs opacity-60 mt-2">Generating…</div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground/70">
              {formatTime(message.created_at || new Date())}
            </span>

            {!isUser && finalText && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyToClipboard}
                  className="h-6 px-2 text-xs"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-600" />
                      <span className="text-green-600">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
