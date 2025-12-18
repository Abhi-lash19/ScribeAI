// backend/src/agents/groq/GroqResponseHandler.ts

import type { Channel, Event, MessageResponse, StreamChat } from "stream-chat";

export class GroqResponseHandler {
  private accumulatedText = "";
  private isDone = false;
  private lastUpdateTs = 0;

  private isFinalized = false;
  private isDisposed = false;

  constructor(
    private readonly abortController: AbortController,
    private readonly chatClient: StreamChat,
    private readonly channel: Channel,
    private readonly message: MessageResponse,
    private readonly onDispose: () => void
  ) {
    this.chatClient.on("ai_indicator.stop", this.handleStop);
  }

  handleChunk = async (delta: string) => {
    if (this.isDone) return;

    this.accumulatedText += delta;

    const now = Date.now();
    if (now - this.lastUpdateTs > 800) {
      await this.chatClient.partialUpdateMessage(this.message.id, {
        set: { text: this.accumulatedText },
      });
      this.lastUpdateTs = now;
    }
  };

  finalize = async () => {
    if (this.isDone) return;
    this.isDone = true;

    await this.chatClient.partialUpdateMessage(this.message.id, {
      set: { text: this.accumulatedText },
    });

    await this.channel.sendEvent({
      type: "ai_indicator.clear",
      cid: this.message.cid,
      message_id: this.message.id,
    });

    await this.dispose();
  };

  private handleStop = async (event: Event) => {
    if (this.isDone || event.message_id !== this.message.id) return;

    console.log("🛑 Groq generation stopped:", this.message.id);
    this.abortController.abort();

    await this.channel.sendEvent({
      type: "ai_indicator.clear",
      cid: this.message.cid,
      message_id: this.message.id,
    });

    await this.dispose();
  };

  dispose = async () => {
    this.chatClient.off("ai_indicator.stop", this.handleStop);
    this.onDispose();
  };
}
