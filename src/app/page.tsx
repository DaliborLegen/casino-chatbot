import ChatWidget from "@/components/ChatWidget";
import gameImages from "@/data/game-images.json";

const CDN = "https://cnsicdn.kubdev.com";
const IMG = (path: string, w?: number, h?: number) =>
  `${CDN}/cdn-cgi/image/fit=scale-down,width=${w || "auto"},height=${h || "auto"},format=auto/${path}`;

const heroSlides = [
  `${CDN}/cdn-cgi/image/fit=cover,width=450,height=192,,format=auto/gaming-content/slider/slider-welcome-sl.png`,
  `${CDN}/cdn-cgi/image/fit=cover,width=450,height=192,,format=auto/gaming-content/slider/hero-banner-homepage-tournament-kaoslegend-playngo.png`,
  `${CDN}/cdn-cgi/image/fit=cover,width=450,height=192,,format=auto/gaming-content/slider/signup-home.png`,
  `${CDN}/cdn-cgi/image/fit=cover,width=450,height=192,,format=auto/gaming-content/slider/licenca1_si.png`,
  `${CDN}/cdn-cgi/image/fit=cover,width=450,height=192,,format=auto/gaming-content/slider/birthday-home.png`,
  `${CDN}/cdn-cgi/image/fit=cover,width=450,height=192,,format=auto/gaming-content/slider/referafriend-home.png`,
];

const categoryIcons = [
  { icon: "casino", label: "Casino", active: true },
  { icon: "most-played", label: "Najbolj igrane" },
  { icon: "jackpot", label: "Jackpot" },
  { icon: "new-bang", label: "Novosti" },
  { icon: "roulette", label: "Ruleta" },
  { icon: "baccarat", label: "Baccarat" },
  { icon: "recommended", label: "Priporočamo" },
  { icon: "cherry", label: "Klasične" },
  { icon: "mythology", label: "Mitologija" },
  { icon: "adventure", label: "Pustolovščine" },
  { icon: "animals", label: "Živali" },
  { icon: "coins", label: "Kovanci" },
];

const providerLogos = [
  { name: "Greentube", img: "greentube" },
  { name: "EGT Digital", img: "egtdigital2" },
  { name: "Amusnet", img: "amusnet" },
  { name: "Play'N GO", img: "playngo" },
  { name: "ELK Studios", img: "elk" },
  { name: "BF Games", img: "bfgames" },
  { name: "Wazdan", img: "wazdan" },
];

const paymentLogos = [
  "clik", "visa", "skrill", "neteller", "paysafecard", "mastercard",
  "apple-pay", "googlepay", "revolut", "bitcoin", "ethereum", "tether",
];

const socialLinks = [
  { name: "Facebook", icon: "cn-fb" },
  { name: "X", icon: "cn-x" },
  { name: "Instagram", icon: "cn-ig" },
  { name: "TikTok", icon: "cn-tt" },
  { name: "Snapchat", icon: "cn-sc" },
];

// Pick games for sections
const allGames = gameImages as { name: string; image: string; provider: string }[];
const tournamentGames = allGames.filter(g =>
  ["Book of Dead", "Reactoonz", "Rise of Olympus", "Fire Joker", "Pirots 3", "Pirots 2", "Legacy of Dead", "Nitropolis 5"].includes(g.name)
).slice(0, 8);
const popularGames = allGames.filter(g =>
  ["Burning Hot", "Shining Crown", "Sizzling Hot Deluxe", "Book of Ra Deluxe", "Lucky Lady's Charm Deluxe", "40 Super Hot", "20 Super Hot", "Dolphin's Pearl Deluxe", "Flaming Hot", "Super Hot"].includes(g.name)
).slice(0, 10);
const newGames = allGames.filter(g =>
  ["Pirots X", "Tropicool 3", "9 Coins Grand Platinum", "Hot Slot Great Book of Magic", "Book of Fallen", "Stunning Crown", "777 Golden Hits", "Crown Hot"].includes(g.name)
).slice(0, 8);
// Fill with remaining games if needed
const allSectionGames = [...tournamentGames, ...popularGames, ...newGames];
const remainingGames = allGames.filter(g => !allSectionGames.includes(g)).slice(0, 20);

function GameCard({ game }: { game: { name: string; image: string; provider: string } }) {
  return (
    <div className="group rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-[1.04] hover:z-10" style={{ background: "#323232" }}>
      <div className="relative overflow-hidden aspect-[4/3]">
        <img src={game.image} alt={game.name} className="w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div className="text-center">
            <div className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: "#ff0000" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>
            </div>
            <span className="text-xs text-white/80">Igraj na casino.si</span>
          </div>
        </div>
      </div>
      <div className="px-2.5 py-2">
        <div className="text-[13px] font-medium truncate text-white">{game.name}</div>
        <div className="text-[11px]" style={{ color: "#848383" }}>{game.provider}</div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, color }: { icon: string; title: string; color?: string }) {
  return (
    <h2 className="text-base font-bold mb-4 flex items-center gap-2">
      <img src={`${CDN}/common-content/game-icons/${icon}.svg`} alt="" className="w-6 h-6" />
      <span style={{ color: color || "white" }}>{title}</span>
    </h2>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#222" }}>
      {/* Top bar */}
      <div className="text-[13px] py-1.5 px-6 flex justify-between items-center" style={{ background: "#1c1d1e" }}>
        <div className="flex gap-5">
          <span style={{ color: "#ffe22e" }} className="font-medium cursor-pointer">Igralnica</span>
          <span style={{ color: "#cfd0d1" }} className="cursor-pointer hover:text-white transition-colors">Promocije</span>
          <span style={{ color: "#cfd0d1" }} className="cursor-pointer hover:text-white transition-colors">Pomoč in vprašanja</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: "#848383" }}>
          <img src={IMG("common-content/footer/si-flag.svg")} alt="SI" className="w-5 h-3.5" />
          <span className="text-xs">SL</span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex items-center justify-between px-6 h-[60px]" style={{ background: "linear-gradient(90deg, #aa0000 0%, #ff0000 50%, #aa0000 100%)" }}>
        <img src={`${CDN}/common-content/brand/app-logo--desktop.svg`} alt="Casino.si" className="h-9" />
        <div className="flex items-center gap-3">
          <div className="mr-2 cursor-pointer opacity-80 hover:opacity-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          </div>
          <button className="px-5 py-2 text-[15px] font-medium rounded-[5px] cursor-pointer hover:bg-white/10 transition-colors" style={{ border: "1px solid #ffe22e", color: "white", background: "transparent" }}>
            Prijava
          </button>
          <button className="px-5 py-2 text-[15px] font-medium rounded-[5px] cursor-pointer hover:brightness-110 transition-all" style={{ background: "#ff0000", border: "1px solid #ff0000", color: "white" }}>
            Registracija
          </button>
        </div>
      </nav>

      {/* Hero banner slider */}
      <div style={{ background: "#1c1d1e" }}>
        <div className="max-w-[1440px] mx-auto flex gap-3 px-4 py-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {heroSlides.map((src, i) => (
            <div key={i} className="shrink-0 rounded-xl overflow-hidden cursor-pointer hover:brightness-110 transition-all" style={{ width: "330px" }}>
              <img src={src} alt="" className="w-full h-[180px] object-cover" />
            </div>
          ))}
        </div>
      </div>

      {/* Game categories */}
      <div className="max-w-[1440px] mx-auto w-full px-4 py-3" style={{ borderBottom: "1px solid #3c3c3c" }}>
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {categoryIcons.map((cat) => (
            <button
              key={cat.label}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              style={
                cat.active
                  ? { background: "rgba(255,0,0,0.12)", color: "#ff0000", borderBottom: "2px solid #e42314" }
                  : { color: "#848383" }
              }
            >
              <img
                src={`${CDN}/common-content/game-icons/${cat.icon}.svg`}
                alt=""
                className="w-6 h-6"
                style={cat.active ? {} : { filter: "brightness(0) invert(0.5)" }}
              />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Provider strip */}
      <div className="max-w-[1440px] mx-auto w-full px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <span className="text-[11px] shrink-0 mr-1" style={{ color: "#848383" }}>Ponudniki iger</span>
          {providerLogos.map((p) => (
            <div key={p.name} className="shrink-0 px-3 py-1.5 rounded cursor-pointer hover:bg-[#3c3c3c] transition-colors" style={{ background: "#2a2a2a" }}>
              <img src={IMG(`common-content/footer/providers/${p.img}-color.svg`)} alt={p.name} className="h-4 object-contain" />
            </div>
          ))}
        </div>
      </div>

      {/* Tournament section */}
      <div className="max-w-[1440px] mx-auto w-full px-4 py-4">
        <div className="rounded-xl overflow-hidden" style={{ background: `url('${CDN}/cdn-cgi/image/fit=cover,width=1920,height=540,,format=auto/gaming-content/jackpots/category/hero-banner-background-tournament-kaoslegend-playngo.png') center/cover` }}>
          <div className="px-6 py-5" style={{ background: "rgba(0,0,0,0.6)" }}>
            <SectionTitle icon="tournament" title="Turnir - Kaos Legend" color="#ffe22e" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {tournamentGames.map((game) => (
                <GameCard key={game.name} game={game} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Popular games */}
      <div className="max-w-[1440px] mx-auto w-full px-4 py-4">
        <SectionTitle icon="most-played" title="Najbolj igrane" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
          {popularGames.map((game) => (
            <GameCard key={game.name} game={game} />
          ))}
        </div>
      </div>

      {/* New games */}
      <div className="max-w-[1440px] mx-auto w-full px-4 py-4">
        <SectionTitle icon="new-bang" title="Novosti" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {newGames.map((game) => (
            <GameCard key={game.name} game={game} />
          ))}
        </div>
      </div>

      {/* All games grid */}
      <div className="max-w-[1440px] mx-auto w-full px-4 py-4">
        <SectionTitle icon="all-games" title="Vse igre" />
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2.5">
          {remainingGames.map((game) => (
            <GameCard key={game.name} game={game} />
          ))}
        </div>
        <div className="text-center mt-6">
          <a
            href="https://casino.si"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-8 py-3 rounded-[5px] text-sm font-medium cursor-pointer hover:brightness-110 transition-all"
            style={{ background: "#ff0000", color: "white" }}
          >
            Vse igre na casino.si →
          </a>
        </div>
      </div>

      {/* Jackpot section */}
      <div className="max-w-[1440px] mx-auto w-full px-4 py-6">
        <SectionTitle icon="jackpot" title="Jackpoti" color="#ffe22e" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: "Bell Link", img: "bell-link", color: "#1a3a5c" },
            { name: "Jackpot Cards", img: "jackpot-cards", color: "#2a1a3a" },
            { name: "Clover Chance", img: "clover-chance", color: "#1a3a2a" },
            { name: "Golden Coins", img: "golden-coins", color: "#3a2a0a" },
          ].map((jp) => (
            <div
              key={jp.name}
              className="rounded-xl overflow-hidden p-6 text-center cursor-pointer hover:brightness-110 transition-all"
              style={{ background: `linear-gradient(135deg, ${jp.color}, #111)`, border: "1px solid #3c3c3c" }}
            >
              <img
                src={IMG(`common-content/jackpots/${jp.img}-overlay.svg`)}
                alt={jp.name}
                className="h-12 mx-auto mb-3 object-contain"
              />
              <div className="text-sm font-bold text-white">{jp.name}</div>
              <div className="text-xs mt-1" style={{ color: "#ffe22e" }}>Igraj na casino.si</div>
            </div>
          ))}
        </div>
      </div>

      {/* Info cards */}
      <div className="max-w-[1440px] mx-auto w-full px-4 py-6">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="p-5 rounded-xl" style={{ background: "#323232", border: "1px solid #3c3c3c" }}>
            <div className="text-2xl mb-2">🛡️</div>
            <h3 className="font-bold text-sm mb-1">Licenciran casino</h3>
            <p className="text-xs leading-relaxed" style={{ color: "#cfd0d1" }}>
              Casino.si upravlja Casino Portorož d.d. z uradno koncesijo
              Republike Slovenije za prirejanje spletnih iger na srečo.
            </p>
          </div>
          <div className="p-5 rounded-xl" style={{ background: "#323232", border: "1px solid #3c3c3c" }}>
            <div className="text-2xl mb-2">💬</div>
            <h3 className="font-bold text-sm mb-1">24/7 AI Podpora</h3>
            <p className="text-xs leading-relaxed" style={{ color: "#cfd0d1" }}>
              Naš AI pomočnik vam je vedno na voljo. Kliknite na ikono
              v spodnjem desnem kotu za takojšnjo pomoč.
            </p>
          </div>
          <div className="p-5 rounded-xl" style={{ background: "#323232", border: "1px solid #3c3c3c" }}>
            <div className="text-2xl mb-2">🎮</div>
            <h3 className="font-bold text-sm mb-1">262+ iger</h3>
            <p className="text-xs leading-relaxed" style={{ color: "#cfd0d1" }}>
              Izbirajte med sloti, ruletami, blackjackom in drugimi igrami
              od 7 vodilnih svetovnih ponudnikov.
            </p>
          </div>
        </div>
      </div>

      {/* Responsible gambling */}
      <div className="max-w-[1440px] mx-auto w-full px-4 py-4">
        <div className="rounded-xl p-6 flex items-center gap-6" style={{ background: "#1c1d1e", border: "1px solid #3c3c3c" }}>
          <img src={IMG("common-content/footer/igrajodgovorno18-color.svg")} alt="18+" className="h-14 shrink-0" />
          <div>
            <h3 className="font-bold text-sm mb-1">Odgovorno igranje</h3>
            <p className="text-xs" style={{ color: "#cfd0d1" }}>
              Igre na srečo so namenjene zabavi. Igrajte odgovorno.
              Če potrebujete pomoč, pokličite SRIF: <span className="font-bold" style={{ color: "#ffe22e" }}>090 68 02</span>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 pt-8 pb-4 px-6" style={{ backgroundImage: `url(${CDN}/common-content/brand/footer-background.jpg)`, backgroundSize: "cover", backgroundPosition: "center" }}>
        <div className="max-w-[1440px] mx-auto">
          {/* Payment methods */}
          <div className="mb-6">
            <h4 className="text-[10px] font-bold mb-2 uppercase tracking-widest" style={{ color: "#666" }}>Plačilne metode</h4>
            <div className="flex flex-wrap gap-2">
              {paymentLogos.map((p) => (
                <div key={p} className="h-7 px-2 flex items-center rounded" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <img src={IMG(`common-content/footer/payments/${p}-color.svg`, undefined, 24)} alt={p} className="h-5 object-contain" />
                </div>
              ))}
            </div>
          </div>

          {/* Provider logos */}
          <div className="mb-6">
            <h4 className="text-[10px] font-bold mb-2 uppercase tracking-widest" style={{ color: "#666" }}>Ponudniki iger</h4>
            <div className="flex flex-wrap gap-2">
              {providerLogos.map((p) => (
                <div key={p.name} className="h-7 px-3 flex items-center rounded" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <img src={IMG(`common-content/footer/providers/${p.img}-color.svg`)} alt={p.name} className="h-4 object-contain" />
                </div>
              ))}
            </div>
          </div>

          {/* Links */}
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <div>
              <h4 className="font-bold mb-2 text-xs">O podjetju</h4>
              <div className="space-y-1 text-xs" style={{ color: "#cfd0d1" }}>
                <p>Casino Portorož d.d.</p>
                <p>Koncesionar spletnih iger na srečo</p>
                <p>Republika Slovenija</p>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-2 text-xs">Kontakt</h4>
              <div className="space-y-1 text-xs" style={{ color: "#cfd0d1" }}>
                <p>📧 online@casino.si</p>
                <p className="text-xl font-bold text-white">030 777 888</p>
                <p>Live chat na casino.si</p>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-2 text-xs">Povezave</h4>
              <div className="space-y-1 text-xs" style={{ color: "#cfd0d1" }}>
                <p><a href="https://casino.si" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">casino.si</a></p>
                <p>Splošni pogoji</p>
                <p>Politika zasebnosti</p>
              </div>
            </div>
          </div>

          {/* Social */}
          <div className="flex justify-center gap-3 mb-6">
            {socialLinks.map((s) => (
              <div key={s.name} className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity" style={{ background: "rgba(255,255,255,0.1)" }}>
                <img src={`${CDN}/common-content/social/${s.icon}.svg`} alt={s.name} className="w-4 h-4" />
              </div>
            ))}
          </div>

          {/* Footer logo */}
          <div className="flex justify-center mb-4">
            <img src={`${CDN}/common-content/brand/app-logo-footer.svg`} alt="Casino.si" className="h-7 opacity-50" />
          </div>

          <div className="border-t mb-3" style={{ borderColor: "rgba(255,255,255,0.08)" }} />

          {/* Powered by */}
          <div className="text-center">
            <a
              href="https://aiprosolutions.si"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline"
              style={{ color: "#848383" }}
            >
              Powered by: <span className="font-bold" style={{ color: "#ff0000" }}>AIPROSOLUTIONS.SI</span>
            </a>
          </div>
        </div>
      </footer>

      <ChatWidget />
    </div>
  );
}
