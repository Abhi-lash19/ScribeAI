import { useEffect, useState } from "react";
import { StreamChat } from "stream-chat";
import {
  Chat,
  Channel,
  Window,
  ChannelHeader,
  MessageList,
  MessageInput,
  LoadingIndicator,
} from "stream-chat-react";

import "stream-chat-react/dist/css/v2/index.css";
import "./App.css";

const apiKey = import.meta.env.VITE_STREAM_API_KEY as string;
const backendUrl = import.meta.env.VITE_BACKEND_URL as string;

function App() {
  const [chatClient, setChatClient] = useState<StreamChat | null>(null);
  const [username, setUsername] = useState("");
  const [channelId] = useState("ai-writing");
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (chatClient) {
        chatClient.disconnectUser();
      }
    };
  }, [chatClient]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;
    if (!apiKey) {
      setError("Missing VITE_STREAM_API_KEY in frontend .env");
      return;
    }
    if (!backendUrl) {
      setError("Missing VITE_BACKEND_URL in frontend .env");
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // ⬇️ This expects a backend route that returns { token, user }
      const res = await fetch(`${backendUrl}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: username }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Backend /token failed: ${res.status} ${body}`);
      }

      const data = await res.json();

      const client = StreamChat.getInstance(apiKey);
      await client.connectUser(
        {
          id: data.user.id,
          name: data.user.name ?? data.user.id,
        },
        data.token
      );

      const channel = client.channel("messaging", channelId, {
        name: "AI Writing Assistant",
      });
      await channel.watch();

      setChatClient(client);
    } catch (err: any) {
      console.error("Error connecting:", err);
      setError(err.message ?? "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  };

  // ⬇️ Login / username screen
  if (!chatClient) {
    return (
      <div className="app-root">
        <div className="login-card">
          <h1>AI Writing Assistant</h1>
          <p>Enter a username to start chatting.</p>

          <form onSubmit={handleConnect} className="login-form">
            <input
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <button type="submit" disabled={isConnecting || !username}>
              {isConnecting ? "Connecting..." : "Start Chat"}
            </button>
          </form>

          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    );
  }

  // ⬇️ Main chat UI
  return (
    <div className="app-root">
      <Chat client={chatClient} theme="str-chat__theme-light">
        <Channel>
          <Window>
            <ChannelHeader />
            <MessageList />
            <MessageInput focus />
          </Window>
        </Channel>
      </Chat>
    </div>
  );
}

export default App;
