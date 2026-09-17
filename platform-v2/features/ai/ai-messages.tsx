"use client";

import * as React from "react";
import { AlertTriangle, Database } from "lucide-react";
import { GenerativeMessage } from "./generative-ui";
import { SqlResult, DatasetsResult } from "./ai-tool-step";
import type { Msg } from "./use-ai";

function Avatar({ role }: { role: "user" | "assistant" }) {
  if (role === "user") {
    return null; // user has no avatar in this layout — right-aligned bubble
  }
  return (
    <div className="bot-ava" aria-hidden>
      AI
    </div>
  );
}

function Thinking() {
  return (
    <div className="think-body">
      <span className="dots"><i /><i /><i /></span>
      <span>Atlas sedang menganalisis data…</span>
    </div>
  );
}

function BotTurn({ m }: { m: Msg }) {
  const showThinking = m.streaming && !m.content;
  return (
    <div className="turn fade-up">
      <div className="msg-bot">
        <Avatar role="assistant" />
        <div className="bot-body">
          <div className="bot-name">
            <b>Atlas</b>
            <span className="tag">ai</span>
          </div>

          {m.sql || m.runError ? <SqlResult step={m} /> : null}
          {m.datasets?.length ? <DatasetsResult step={m} /> : null}

          {showThinking ? (
            <Thinking />
          ) : m.content ? (
            <GenerativeMessage content={m.content} streaming={!!m.streaming} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UserTurn({ m }: { m: Msg }) {
  return (
    <div className="turn fade-up">
      <div className="msg-user">
        <div className="bubble">{m.content}</div>
        <div className="msg-meta">
          <span className="chan-dot" style={{ background: "var(--brand-sky)" }} />
          <span>You</span>
        </div>
      </div>
    </div>
  );
}

export function AiMessages({
  messages, busy, error,
}: {
  messages: Msg[];
  busy: boolean;
  error?: string | null;
}) {
  const endRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  return (
    <div className="transcript">
      {error ? (
        <div className="err-banner fade-up">
          <AlertTriangle />
          <span>{error}</span>
        </div>
      ) : null}
      {messages.map((m, i) =>
        m.role === "user" ? (
          <UserTurn key={i} m={m} />
        ) : (
          <BotTurn key={i} m={m} />
        ),
      )}
      {busy && messages[messages.length - 1]?.role !== "assistant" ? (
        <div className="turn fade-up">
          <div className="msg-bot">
            <Avatar role="assistant" />
            <div className="bot-body">
              <div className="bot-name"><b>Atlas</b><span className="tag">ai</span></div>
              <Thinking />
            </div>
          </div>
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
