// src/components/chat/chat-interface.tsx

import React, { useRef, useState } from "react";
import {
  Bot,
  Briefcase,
  FileText,
  Lightbulb,
  Menu,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import {
  Channel,
  MessageList,
  useChannelStateContext,
  useChatContext,
  Window,
} from "stream-chat-react";

import { ChatInput } from "./chat-input";
import type { ChatInputProps } from "./chat-input";
import ChatMessage from "./chat-message";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

interface ChatInterfaceProps {
  onToggleSidebar: () => void;
  onNewChatMessage: (message: { text: string }) => Promise<void>;
}

const MessageListContent = () => {
  const { messages, thread } = useChannelStateContext();
  if (thread) return null;

  return (
    <div className="flex-1 min-h-0">
      {!messages?.length ? (
        <div className="h-full flex items-center justify-center">
          <p className="text-muted-foreground">
            Start the conversation to begin.
          </p>
        </div>
      ) : (
        <MessageList Message={ChatMessage} />
      )}
    </div>
  );
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onToggleSidebar,
  onNewChatMessage,
}) => {
  const { channel } = useChatContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inputText, setInputText] = useState("");

  const handleSendMessage = async ({ text }: { text: string }) => {
    if (!channel) return;
    await channel.sendMessage({ text });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          className="lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold">
            {(channel?.data as any)?.name || "New Writing Session"}
          </h2>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        {!channel ? (
          <ChatInput
            sendMessage={onNewChatMessage}
            value={inputText}
            onValueChange={setInputText}
            textareaRef={textareaRef}
            placeholder="Describe what you'd like to write..."
          />
        ) : (
          <Channel channel={channel}>
            <Window>
              <MessageListContent />
              <ChatInput
                sendMessage={handleSendMessage}
                value={inputText}
                onValueChange={setInputText}
                textareaRef={textareaRef}
              />
            </Window>
          </Channel>
        )}
      </div>
    </div>
  );
};
