import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMarkdownProps = {
  content: string;
  variant?: "caretaker" | "user" | "error";
};

/**
 * Render odpowiedzi AI zgodnie z zaleceniami w
 * `apps/api/app/llm/prompts/caretaker_system.md` (Markdown: bold, listy, ###, linki).
 */
export function ChatMarkdown({ content, variant = "caretaker" }: ChatMarkdownProps) {
  const onAccent = variant === "user";

  return (
    <div className={`chat-md ${onAccent ? "chat-md-on-accent" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="chat-md-p">{children}</p>,
          strong: ({ children }) => <strong className="chat-md-strong">{children}</strong>,
          em: ({ children }) => <em className="chat-md-em">{children}</em>,
          ul: ({ children }) => <ul className="chat-md-ul">{children}</ul>,
          ol: ({ children }) => <ol className="chat-md-ol">{children}</ol>,
          li: ({ children }) => <li className="chat-md-li">{children}</li>,
          h1: ({ children }) => <h3 className="chat-md-h">{children}</h3>,
          h2: ({ children }) => <h3 className="chat-md-h">{children}</h3>,
          h3: ({ children }) => <h3 className="chat-md-h">{children}</h3>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="chat-md-a"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          code: ({ children }) => <code className="chat-md-code">{children}</code>,
          pre: ({ children }) => <pre className="chat-md-pre">{children}</pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
