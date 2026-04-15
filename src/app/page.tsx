import ChatWidget from "@/components/ChatWidget";

export default function Home() {
  return (
    <main
      className="flex-1 flex flex-col items-center justify-center px-4"
      style={{ background: "var(--background)" }}
    >
      <div className="text-center max-w-2xl">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
          style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
        >
          <span className="text-white text-3xl font-bold">C</span>
        </div>
        <h1 className="text-4xl font-bold mb-4" style={{ color: "var(--primary)" }}>
          Casino.si Podpora
        </h1>
        <p className="text-lg mb-8" style={{ color: "var(--foreground)", opacity: 0.7 }}>
          Virtualni pomočnik za vsa vaša vprašanja. Kliknite na ikono v spodnjem
          desnem kotu za začetek pogovora.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {[
            "Registracija",
            "Račun",
            "Pologi",
            "Dvigi",
            "Igre",
            "Odgovorno igranje",
          ].map((topic) => (
            <div
              key={topic}
              className="px-4 py-3 rounded-xl"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }}
            >
              {topic}
            </div>
          ))}
        </div>
      </div>

      <ChatWidget />
    </main>
  );
}
