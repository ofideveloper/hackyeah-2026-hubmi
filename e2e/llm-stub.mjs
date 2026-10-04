// Atrapa API zgodnego z OpenAI (`/chat/completions`) dla testów E2E.
// Czat i asystent kreatora wołają model przez HTTP (`ask_llm` w apps/api/app/routes/chat.py),
// więc podstawiamy lokalny serwer zamiast prawdziwego dostawcy — bez sieci i bez kosztów.
import { createServer } from "node:http";

const port = Number(process.argv[2] ?? 8150);

/** Odpowiedź opiekuna: steruje nią znacznik w wiadomości użytkownika. */
function caretakerReply(system, userText) {
  if (userText.includes("[e2e:match]")) {
    const first = /### (.+)\nID: ([0-9a-f-]{36})/i.exec(system);
    if (first) {
      return `**${first[1]}** — pasuje do opisanej potrzeby.\n[[hubmi-project:${first[2]}]]\n[[hubmi-status:match]]`;
    }
  }
  if (userText.includes("[e2e:no-match]")) {
    return [
      "W bazie nie ma wystarczająco trafnego rozwiązania.",
      "[[hubmi-new-project]]",
      "NAME: Szkic potrzeby z rozmowy",
      "DESCRIPTION: Potrzeba opisana przez użytkownika w rozmowie z interaktywnym asystentem.",
      "[[/hubmi-new-project]]",
      "[[hubmi-status:no-match]]",
    ].join("\n");
  }
  return "Kogo dotyczy sprawa i jakiego wsparcia brakuje?\n[[hubmi-status:clarify]]";
}

function complete(messages) {
  const system =
    messages.find((message) => message.role === "system")?.content ?? "";
  const userText =
    messages.findLast((message) => message.role === "user")?.content ?? "";
  if (system.includes("## KATALOG")) return caretakerReply(system, userText);
  return "Odpowiedź atrapy modelu: zacznij od rozmowy z trzema osobami z grupy docelowej.";
}

createServer((req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (req.method === "GET") return send(200, { status: "ok" });
  if (req.method !== "POST" || !req.url?.endsWith("/chat/completions")) {
    return send(404, { error: { message: "not found" } });
  }
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    try {
      const { messages = [] } = JSON.parse(raw);
      send(200, {
        choices: [
          { message: { role: "assistant", content: complete(messages) } },
        ],
      });
    } catch {
      send(400, { error: { message: "invalid JSON" } });
    }
  });
}).listen(port, "127.0.0.1");
