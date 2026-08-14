// Test za retry + fallback v src/lib/chat.ts.
// Zažene lažen Anthropic strežnik in preusmeri SDK nanj prek ANTHROPIC_BASE_URL.
// Zagon: npx tsx test-fallback.mts
import http from "node:http";

type Mode = "ok" | "529-then-ok" | "always-529" | "400" | "empty";
let mode: Mode = "ok";
let calls = 0;

const server = http.createServer((req, res) => {
  calls++;
  const body = (payload: unknown, status = 200) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  };
  const okMessage = (text: string) =>
    body({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-4-6",
      content: text ? [{ type: "text", text }] : [],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5 },
    });

  req.resume();
  if (mode === "ok") return okMessage("Pravi odgovor bota.");
  if (mode === "empty") return okMessage("");
  if (mode === "400")
    return body({ type: "error", error: { type: "invalid_request_error", message: "bad" } }, 400);
  if (mode === "always-529")
    return body({ type: "error", error: { type: "overloaded_error", message: "overloaded" } }, 529);
  if (mode === "529-then-ok") {
    if (calls < 3)
      return body({ type: "error", error: { type: "overloaded_error", message: "overloaded" } }, 529);
    return okMessage("Odgovor po drugem poskusu.");
  }
});

await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
const port = (server.address() as { port: number }).port;

process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
process.env.ANTHROPIC_API_KEY = "sk-test";
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const { generateReply, fallbackReply } = await import("./src/lib/chat.ts");

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(
    `${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : `\n     dobil:      ${actual}\n     pricakoval: ${expected}`}`
  );
}

// 1. normalen odgovor
mode = "ok";
calls = 0;
check("normalen odgovor", await generateReply("t1", "zivjo", "casino"), "Pravi odgovor bota.");
check("brez odvecnih klicev", calls, 1);

// 2. prehodna 529 -> retry uspe
mode = "529-then-ok";
calls = 0;
const t0 = Date.now();
check("retry po 529", await generateReply("t2", "zivjo", "casino"), "Odgovor po drugem poskusu.");
check("trije poskusi", calls, 3);
console.log(`     (trajanje ${Date.now() - t0} ms, pricakovano ~2.4 s backoffa)`);

// 3. trajna 529 -> fallback, ne izjema
mode = "always-529";
calls = 0;
check("fallback ob trajni 529", await generateReply("t3", "zivjo", "casino"), fallbackReply("casino"));
check("nehal po MAX_ATTEMPTS", calls, 3);

// 4. neponovljiva napaka (400) -> takoj fallback, brez retryjev
mode = "400";
calls = 0;
check("fallback ob 400", await generateReply("t4", "zivjo", "supercasino"), fallbackReply("supercasino"));
check("brez retryja ob 400", calls, 1);

// 5. prazen odgovor modela -> fallback namesto tisine
mode = "empty";
calls = 0;
check("fallback ob praznem odgovoru", await generateReply("t5", "zivjo", "casino777"), fallbackReply("casino777"));

// 6. fallback vsebuje pravi email po tenantu
check("email casino", fallbackReply("casino").includes("online@casino.si"), true);
check("email supercasino", fallbackReply("supercasino").includes("online@supercasino.si"), true);
check("email 777", fallbackReply("casino777").includes("online@777casino.si"), true);

server.close();
console.log(failures === 0 ? "\nVSI TESTI OK" : `\n${failures} NEUSPESNIH`);
process.exit(failures === 0 ? 0 : 1);
