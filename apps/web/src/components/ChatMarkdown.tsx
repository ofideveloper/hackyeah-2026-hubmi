/**
 * Markdown w odpowiedzi opiekuna. Ładowany tylko w przeglądarce (next/dynamic, ssr: false),
 * bo react-markdown jest ESM-only i wywala SSR w Pages Routerze.
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="chat-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
