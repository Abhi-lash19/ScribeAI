// src/components/chat/chat-input.ts

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { cn } from "../../lib/utils";
import { ArrowRight, Square, X } from "lucide-react";
import { WritingPromptsToolbar } from "./writing-prompts-toolbar";

export interface ChatInputProps {
  className?: string;
  sendMessage: (message: { text: string }) => Promise<void> | void;
  isGenerating?: boolean;
  onStopGenerating?: () => void;
  placeholder?: string;
  value: string;
  onValueChange: (text: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  showPromptToolbar?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = (props) => {
  const {
    className,
    sendMessage,
    isGenerating,
    onStopGenerating,
    placeholder = "Ask me to write something, or paste text to improve...",
    value,
    onValueChange,
    textareaRef: externalTextareaRef,
    showPromptToolbar,
  } = props;

  const shouldShowPromptToolbar = !!showPromptToolbar;

  const [isLoading, setIsLoading] = useState(false);
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef || internalTextareaRef;

  const handlePromptSelect = (prompt: string) => {
    onValueChange(value ? `${value.trim()} ${prompt}` : prompt);
    textareaRef.current?.focus();
  };

  const updateTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120; // ~6 lines
      const textareaHeight = Math.min(scrollHeight, maxHeight);
      textarea.style.height = `${textareaHeight}px`;
    }
  }, [textareaRef]);

  useEffect(() => {
    updateTextareaHeight();
  }, [value, updateTextareaHeight]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || isLoading || isGenerating || !sendMessage) return;

    setIsLoading(true);
    try {
      await sendMessage({
        text: value.trim(),
      });
      onValueChange("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit(e as unknown as FormEvent);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-background",
        shouldShowPromptToolbar && "border-t border-border/50"
      )}
    >
      {shouldShowPromptToolbar && (
        <WritingPromptsToolbar onPromptSelect={handlePromptSelect} />
      )}
      <div className={cn("p-4", className)}>
        <form onSubmit={handleSubmit}>
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className={cn(
                "min-h-[44px] max-h-[120px] resize-none py-3 pl-4 pr-20 text-sm",
                "border-input focus:border-primary/50 rounded-lg",
                "transition-colors duration-200 bg-background"
              )}
              disabled={isLoading || isGenerating}
            />

            {/* Clear button */}
            {value.trim() && !isLoading && !isGenerating && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onValueChange("")}
                className="absolute right-12 bottom-2 h-8 w-8 rounded-md text-muted-foreground hover:text-foreground"
                title="Clear text"
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            {/* Send/Stop Button inside textarea */}
            {isGenerating ? (
              <Button
                type="button"
                onClick={onStopGenerating}
                className="absolute right-2 bottom-2 h-8 w-8 rounded-md flex-shrink-0 p-0"
                variant="destructive"
                title="Stop generating"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!value.trim() || isLoading || isGenerating}
                className={cn(
                  "absolute right-2 bottom-2 h-8 w-8 rounded-md flex-shrink-0 p-0",
                  "transition-all duration-200",
                  "disabled:opacity-30 disabled:cursor-not-allowed",
                  !value.trim() ? "bg-muted hover:bg-muted" : ""
                )}
                variant={value.trim() ? "default" : "ghost"}
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
