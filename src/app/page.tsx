import ChatWidget from "@/components/ChatWidget";

const providers = [
  "Greentube", "EGT Digital", "Amusnet", "Play'N GO", "ELK Studios", "BF Games", "Wazdan"
];

const categories = [
  { icon: "🎰", label: "Casino" },
  { icon: "🔄", label: "Spin" },
  { icon: "🎯", label: "Ruleta" },
  { icon: "🃏", label: "Igre na mizo" },
  { icon: "♠️", label: "Blackjack" },
  { icon: "🎲", label: "Baccarat" },
];

const popularGames = [
  { name: "Book of Ra Deluxe", provider: "Greentube" },
  { name: "Burning Hot", provider: "Amusnet" },
  { name: "Book of Dead", provider: "Play'N GO" },
  { name: "Reactoonz", provider: "Play'N GO" },
  { name: "Sizzling Hot", provider: "Greentube" },
  { name: "Rise of Olympus", provider: "Play'N GO" },
  { name: "Lucky Lady's Charm", provider: "Greentube" },
  { name: "Shining Crown", provider: "EGT Digital" },
  { name: "Fire Joker", provider: "Play'N GO" },
  { name: "Pirots 3", provider: "ELK Studios" },
];

const stats = [
  { value: "262+", label: "Iger" },
  { value: "7", label: "Ponudnikov" },
  { value: "24/7", label: "Podpora" },
  { value: "100%", label: "Legalno" },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      {/* Top bar */}
      <div className="text-sm py-2 px-6 flex justify-between items-center" style={{ background: "var(--surface-dark)" }}>
        <div className="flex gap-6">
          <span style={{ color: "var(--accent-yellow)" }} className="font-medium">Igralnica</span>
          <span style={{ color: "var(--text-muted)" }}>Promocije</span>
          <span style={{ color: "var(--text-muted)" }}>Pomoč in vprašanja</span>
        </div>
        <div style={{ color: "var(--text-dim)" }}>🇸🇮 SL</div>
      </div>

      {/* Main nav */}
      <nav
        className="flex items-center justify-between px-6 h-[60px]"
        style={{ background: "linear-gradient(90deg, #aa0000 0%, #ff0000 50%, #aa0000 100%)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-2xl tracking-tight">
            CASINÖ.SI
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 text-sm font-medium rounded-[5px]"
            style={{ border: "1px solid var(--accent-yellow)", color: "white", background: "transparent" }}
          >
            Prijava
          </button>
          <button
            className="px-4 py-2 text-sm font-medium rounded-[5px]"
            style={{ background: "#ff0000", border: "1px solid #ff0000", color: "white" }}
          >
            Registracija
          </button>
        </div>
      </nav>

      {/* Hero banner */}
      <div
        className="relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a0000 0%, #330000 50%, #1c1d1e 100%)" }}
      >
        <div className="max-w-[1440px] mx-auto px-6 py-16 flex items-center">
          <div className="flex-1">
            <h1 className="text-5xl font-bold mb-4 leading-tight">
              EDINI <span style={{ color: "var(--primary)" }}>LEGALNI</span><br />
              SPLETNI CASINO<br />
              V SLOVENIJI
            </h1>
            <p className="text-lg mb-6" style={{ color: "var(--text-muted)" }}>
              Uživajte v 262+ igrah od najboljših ponudnikov.<br />
              Licenciran s strani Republike Slovenije.
            </p>
            <div className="flex gap-4">
              <button
                className="px-8 py-3 text-base font-semibold rounded-[5px]"
                style={{ background: "#ff0000", color: "white" }}
              >
                Registriraj se
              </button>
              <button
                className="px-8 py-3 text-base font-semibold rounded-[5px]"
                style={{ border: "1px solid var(--accent-yellow)", color: "var(--accent-yellow)", background: "transparent" }}
              >
                Prijava
              </button>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="grid grid-cols-2 gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="text-center px-8 py-6 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div className="text-3xl font-bold" style={{ color: "var(--primary)" }}>
                    {stat.value}
                  </div>
                  <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Game categories */}
      <div className="max-w-[1440px] mx-auto w-full px-6 py-6">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {categories.map((cat, i) => (
            <button
              key={cat.label}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0"
              style={
                i === 0
                  ? { background: "var(--primary)", color: "white" }
                  : { background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)" }
              }
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Provider logos */}
      <div className="max-w-[1440px] mx-auto w-full px-6 pb-4">
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-dim)" }}>
          <span className="mr-2">Ponudniki iger:</span>
          {providers.map((p) => (
            <span key={p} className="px-3 py-1.5 rounded text-xs" style={{ background: "var(--surface)", color: "var(--text-muted)" }}>
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* Popular games showcase */}
      <div className="max-w-[1440px] mx-auto w-full px-6 py-8">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          🏆 <span>Popularne igre</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {popularGames.map((game) => (
            <div
              key={game.name}
              className="group rounded-xl overflow-hidden"
              style={{ background: "var(--surface)" }}
            >
              <div
                className="h-32 flex items-center justify-center text-4xl"
                style={{
                  background: `linear-gradient(135deg, hsl(${(game.name.length * 37) % 360}, 70%, 25%), hsl(${(game.name.length * 37 + 40) % 360}, 60%, 15%))`,
                }}
              >
                🎰
              </div>
              <div className="p-3">
                <div className="text-sm font-medium truncate">{game.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-dim)" }}>
                  {game.provider}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center mt-6 text-sm" style={{ color: "var(--text-dim)" }}>
          Za igranje se registrirajte na{" "}
          <a href="https://casino.si" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }} className="underline">
            casino.si
          </a>
        </p>
      </div>

      {/* Info sections */}
      <div className="max-w-[1440px] mx-auto w-full px-6 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-2xl mb-3">🛡️</div>
            <h3 className="font-bold text-lg mb-2">Licenciran casino</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Casino.si upravlja Casino Portorož d.d. z uradno koncesijo
              Republike Slovenije za prirejanje spletnih iger na srečo.
            </p>
          </div>
          <div className="p-6 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-2xl mb-3">💬</div>
            <h3 className="font-bold text-lg mb-2">24/7 Podpora</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Naš AI pomočnik je vedno na voljo za pomoč pri registraciji,
              vprašanjih o igrah, pologih, dvigih in še več. Kliknite na
              ikono spodaj desno.
            </p>
          </div>
          <div className="p-6 rounded-xl" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="text-2xl mb-3">🎮</div>
            <h3 className="font-bold text-lg mb-2">262+ iger</h3>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Izbirajte med sloti, ruletami, blackjackom in drugimi igrami
              od 7 vodilnih ponudnikov — Greentube, Play&apos;N GO, ELK Studios
              in več.
            </p>
          </div>
        </div>
      </div>

      {/* Responsible gambling */}
      <div className="max-w-[1440px] mx-auto w-full px-6 py-8">
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "var(--surface-dark)", border: "1px solid var(--border)" }}
        >
          <h3 className="font-bold text-lg mb-3">Odgovorno igranje</h3>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            Igre na srečo so namenjene zabavi. Igrajte odgovorno.
            Če potrebujete pomoč, pokličite SRIF na številko{" "}
            <span className="font-bold" style={{ color: "var(--accent-yellow)" }}>090 68 02</span>.
          </p>
          <div className="flex justify-center gap-6 text-sm" style={{ color: "var(--text-dim)" }}>
            <span>18+</span>
            <span>•</span>
            <span>SRIF</span>
            <span>•</span>
            <span>Igraj odgovorno</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="mt-auto py-10 px-6"
        style={{ background: "linear-gradient(180deg, var(--surface-dark) 0%, #111111 100%)" }}
      >
        <div className="max-w-[1440px] mx-auto">
          {/* Footer links */}
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-3 text-sm">O podjetju</h4>
              <div className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
                <p>Casino Portorož d.d.</p>
                <p>Koncesionar spletnih iger na srečo</p>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-3 text-sm">Kontakt</h4>
              <div className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
                <p>E-pošta: podpora@casino.si</p>
                <p>Telefon: 030 777 888</p>
                <p>Live chat na casino.si</p>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-3 text-sm">Povezave</h4>
              <div className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
                <p>
                  <a href="https://casino.si" target="_blank" rel="noopener noreferrer" className="underline">
                    casino.si
                  </a>
                </p>
                <p>Splošni pogoji</p>
                <p>Politika zasebnosti</p>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t mb-6" style={{ borderColor: "var(--border)" }} />

          {/* Powered by */}
          <div className="text-center">
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Powered by:{" "}
              <a
                href="https://aiprosolutions.si"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline hover:no-underline"
                style={{ color: "var(--primary)" }}
              >
                AIPROSOLUTIONS.SI
              </a>
            </p>
          </div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
