// backend/src/agents/groq/GroqAgent.ts

import type { Channel, DefaultGenerics, Event, StreamChat } from "stream-chat";
import Groq from "groq-sdk";

import type { AIAgent } from "../types";
import { DEFAULT_SYSTEM_PROMPT } from "./prompts";
import { GroqResponseHandler } from "./GroqResponseHandler";
import { config } from "../../config";

export class GroqAgent implements AIAgent {
  private groq: Groq;
  private lastInteractionTs = Date.now();
  private handlers: GroqResponseHandler[] = [];

  constructor(
    readonly chatClient: StreamChat,
    readonly channel: Channel
  ) {
    this.groq = new Groq({
      apiKey: config.groqApiKey!,
    });
  }

  get user() {
    return this.chatClient.user;
  }

  getLastInteraction = () => this.lastInteractionTs;

  init = async () => {
    this.chatClient.on("message.new", this.handleMessage);
  };

  dispose = async () => {
    this.chatClient.off("message.new", this.handleMessage);

    this.handlers.forEach((h) => h.dispose());
    this.handlers = [];

    await this.chatClient.disconnectUser();
  };

  // ---------------------------
  // Core message handler
  // ---------------------------
  private handleMessage = async (e: Event<DefaultGenerics>) => {
    if (!e.message || e.message.user?.id === this.user?.id) return;

    if (
        !e.message ||
        e.message.user?.id === this.user?.id
    ) {
        return;
    }



    const userText = e.message.text;
    if (!userText) return;

    this.lastInteractionTs = Date.now();

    // 1️⃣ Create empty AI message in Stream
    const { message: aiMessage } = await this.channel.sendMessage({
      text: "",
      ai_generated: true,
    });

    await this.channel.sendEvent({
      type: "ai_indicator.update",
      ai_state: "AI_STATE_THINKING",
      cid: aiMessage.cid,
      message_id: aiMessage.id,
    });

    // 2️⃣ Build conversation context
    const messages = await this.buildConversationContext(userText);

    // 3️⃣ Start Groq streaming
    const abortController = new AbortController();

    const handler = new GroqResponseHandler(
      abortController,
      this.chatClient,
      this.channel,
      aiMessage,
      () => this.removeHandler(handler)
    );

    this.handlers.push(handler);

    try {
      const stream = await this.groq.chat.completions.create(
        {
          model: "llama-3.1-70b-versatile",
          messages,
          temperature: 0.7,
          stream: true,
        },
        { signal: abortController.signal }
      );

      await this.channel.sendEvent({
        type: "ai_indicator.update",
        ai_state: "AI_STATE_GENERATING",
        cid: aiMessage.cid,
        message_id: aiMessage.id,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          await handler.handleChunk(delta);
        }
      }

      await handler.finalize();
    } catch (err) {
      if (abortController.signal.aborted) {
        console.log("Groq stream aborted");
        return;
      }

      console.error("Groq generation error:", err);

      await this.channel.sendEvent({
        type: "ai_indicator.update",
        ai_state: "AI_STATE_ERROR",
        cid: aiMessage.cid,
        message_id: aiMessage.id,
      });

      await this.chatClient.partialUpdateMessage(aiMessage.id, {
        set: {
          text: "Error generating response",
        },
      });
    }
  };

  // ---------------------------
  // Memory builder (last N msgs)
  // ---------------------------
  private async buildConversationContext(userText: string) {
    const history = await this.channel.query({
      messages: { limit: 10 },
    });

    const messages: { role: "system" | "user" | "assistant"; content: string }[] =
      [
        {
          role: "system",
          content: DEFAULT_SYSTEM_PROMPT,
        },
      ];

    for (const msg of history.messages.reverse()) {
      if (!msg.text) continue;

      messages.push({
        role: msg.ai_generated ? "assistant" : "user",
        content: msg.text,
      });
    }

    return messages;
  }

  private removeHandler(handler: GroqResponseHandler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }
}
