import ChatWidget from "@/components/ChatWidget";

const CDN = "https://cnsicdn.kubdev.com";
const IMG = (path: string, w?: number, h?: number) =>
  `${CDN}/cdn-cgi/image/fit=scale-down,width=${w || "auto"},height=${h || "auto"},format=auto/${path}`;

const heroSlides = [
  { img: `${CDN}/gaming-content/slider/slider-welcome-sl.png`, alt: "Dobrodošlica" },
  { img: `${CDN}/gaming-content/slider/hero-banner-homepage-tournament-kaoslegend-playngo.png`, alt: "Turnir" },
  { img: `${CDN}/gaming-content/slider/signup-home.png`, alt: "Registracija" },
  { img: `${CDN}/gaming-content/slider/licenca1_si.png`, alt: "Licenca" },
];

const categoryIcons = [
  { icon: `${CDN}/common-content/game-icons/casino.svg`, label: "Casino", active: true },
  { icon: `${CDN}/common-content/game-icons/most-played.svg`, label: "Najbolj igrane" },
  { icon: `${CDN}/common-content/game-icons/roulette.svg`, label: "Ruleta" },
  { icon: `${CDN}/common-content/game-icons/baccarat.svg`, label: "Baccarat" },
  { icon: `${CDN}/common-content/game-icons/jackpot.svg`, label: "Jackpot" },
  { icon: `${CDN}/common-content/game-icons/new-bang.svg`, label: "Novosti" },
];

const providerLogos = [
  { name: "Greentube", img: IMG("common-content/footer/providers/greentube-color.svg") },
  { name: "EGT Digital", img: IMG("common-content/footer/providers/egtdigital2-color.svg") },
  { name: "Amusnet", img: IMG("common-content/footer/providers/amusnet-color.svg") },
  { name: "Play'N GO", img: IMG("common-content/footer/providers/playngo-color.svg") },
  { name: "ELK Studios", img: IMG("common-content/footer/providers/elk-color.svg") },
  { name: "BF Games", img: IMG("common-content/footer/providers/bfgames-color.svg") },
  { name: "Wazdan", img: IMG("common-content/footer/providers/wazdan-color.svg") },
];

const paymentLogos = [
  "clik", "visa", "skrill", "neteller", "paysafecard", "mastercard",
  "apple-pay", "googlepay", "revolut", "bitcoin", "ethereum",
];

const popularGames = [
  { name: "Book of Ra Deluxe", provider: "Greentube", img: IMG("gaming-content/game-banners/regular/provider-5/book-of-ra-deluxe.jpg", 210) },
  { name: "Burning Hot", provider: "Amusnet", img: IMG("gaming-content/game-banners/regular/provider-2/burning-hot.jpg", 210) },
  { name: "Book of Dead", provider: "Play'N GO", img: IMG("gaming-content/game-banners/regular/provider-39/book-of-dead.jpg", 210) },
  { name: "Sizzling Hot Deluxe", provider: "Greentube", img: IMG("gaming-content/game-banners/regular/provider-5/sizzling-hot-deluxe.jpg", 210) },
  { name: "Shining Crown", provider: "EGT Digital", img: IMG("gaming-content/game-banners/regular/provider-1/shining-crown.jpg", 210) },
  { name: "Lucky Lady Charm Dlx", provider: "Greentube", img: IMG("gaming-content/game-banners/regular/provider-5/lucky-ladys-charm-deluxe.jpg", 210) },
  { name: "Rise of Olympus", provider: "Play'N GO", img: IMG("gaming-content/game-banners/regular/provider-39/rise-of-olympus.jpg", 210) },
  { name: "Fire Joker", provider: "Play'N GO", img: IMG("gaming-content/game-banners/regular/provider-39/fire-joker.jpg", 210) },
  { name: "Reactoonz", provider: "Play'N GO", img: IMG("gaming-content/game-banners/regular/provider-39/reactoonz.jpg", 210) },
  { name: "Dolphin Pearl Deluxe", provider: "Greentube", img: IMG("gaming-content/game-banners/regular/provider-5/dolphins-pearl-deluxe.jpg", 210) },
];

const socialLinks = [
  { name: "Facebook", img: `${CDN}/common-content/social/cn-fb.svg` },
  { name: "X", img: `${CDN}/common-content/social/cn-x.svg` },
  { name: "Instagram", img: `${CDN}/common-content/social/cn-ig.svg` },
  { name: "TikTok", img: `${CDN}/common-content/social/cn-tt.svg` },
  { name: "Snapchat", img: `${CDN}/common-content/social/cn-sc.svg` },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#222" }}>
      {/* Top bar */}
      <div className="text-sm py-2 px-6 flex justify-between items-center" style={{ background: "#1c1d1e" }}>
        <div className="flex gap-6">
          <span style={{ color: "#ffe22e" }} className="font-medium cursor-pointer">Igralnica</span>
          <span style={{ color: "#cfd0d1" }} className="cursor-pointer hover:text-white">Promocije</span>
          <span style={{ color: "#cfd0d1" }} className="cursor-pointer hover:text-white">Pomoč in vprašanja</span>
        </div>
        <div className="flex items-center gap-2" style={{ color: "#848383" }}>
          <img src={`${CDN}/common-content/footer/si-flag.svg`} alt="SI" className="w-5 h-4" />
          <span>SL</span>
        </div>
      </div>

      {/* Main nav */}
      <nav
        className="flex items-center justify-between px-6 h-[60px]"
        style={{ background: "linear-gradient(90deg, #aa0000 0%, #ff0000 50%, #aa0000 100%)" }}
      >
        <img
          src={`${CDN}/common-content/brand/app-logo--desktop.svg`}
          alt="Casino.si"
          className="h-9"
        />
        <div className="flex items-center gap-3">
          <button
            className="px-5 py-2 text-[15px] font-medium rounded-[5px] cursor-pointer"
            style={{ border: "1px solid #ffe22e", color: "white", background: "transparent" }}
          >
            Prijava
          </button>
          <button
            className="px-5 py-2 text-[15px] font-medium rounded-[5px] cursor-pointer"
            style={{ background: "#ff0000", border: "1px solid #ff0000", color: "white" }}
          >
            Registracija
          </button>
        </div>
      </nav>

      {/* Hero banner carousel */}
      <div className="w-full overflow-hidden" style={{ background: "#1c1d1e" }}>
        <div className="max-w-[1440px] mx-auto flex gap-3 px-4 py-4 overflow-x-auto">
          {heroSlides.map((slide) => (
            <div key={slide.alt} className="shrink-0 rounded-xl overflow-hidden" style={{ width: "340px" }}>
              <img src={slide.img} alt={slide.alt} className="w-full h-[192px] object-cover" />
            </div>
          ))}
          <div
            className="shrink-0 rounded-xl overflow-hidden flex items-center justify-center px-8"
            style={{ width: "340px", height: "192px", background: "linear-gradient(135deg, #1a1a1a, #2a2a2a)", border: "1px solid #3c3c3c" }}
          >
            <div className="text-center">
              <p className="text-xl font-bold leading-tight">EDINI LEGALNI</p>
              <p className="text-xl font-bold leading-tight" style={{ color: "#ff0000" }}>SPLETNI CASINO</p>
              <p className="text-xl font-bold leading-tight">V SLOVENIJI</p>
              <p className="text-xs mt-2" style={{ color: "#848383" }}>Licenciran s strani RS</p>
            </div>
          </div>
        </div>
      </div>

      {/* Game categories */}
      <div className="max-w-[1440px] mx-auto w-full px-6 py-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categoryIcons.map((cat) => (
            <button
              key={cat.label}
              className="flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
              style={
                cat.active
                  ? { background: "rgba(255,0,0,0.15)", color: "#ff0000", borderBottom: "2px solid #e42314" }
                  : { color: "#cfd0d1" }
              }
            >
              <img src={cat.icon} alt={cat.label} className="w-7 h-7" style={cat.active ? {} : { filter: "brightness(0) invert(0.7)" }} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Provider logos strip */}
      <div className="max-w-[1440px] mx-auto w-full px-6 pb-4">
        <div className="flex items-center gap-1 text-xs overflow-x-auto">
          <span className="mr-2 shrink-0" style={{ color: "#848383" }}>Ponudniki iger:</span>
          {providerLogos.map((p) => (
            <div key={p.name} className="shrink-0 px-3 py-2 rounded" style={{ background: "#323232" }}>
              <img src={p.img} alt={p.name} className="h-5 object-contain" />
            </div>
          ))}
        </div>
      </div>

      {/* Popular games */}
      <div className="max-w-[1440px] mx-auto w-full px-6 py-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <img src={`${CDN}/common-content/game-icons/most-played.svg`} alt="" className="w-6 h-6" />
          Popularne igre
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {popularGames.map((game) => (
            <div
              key={game.name}
              className="group rounded-xl overflow-hidden cursor-pointer transition-transform hover:scale-[1.03]"
              style={{ background: "#323232" }}
            >
              <div className="relative overflow-hidden">
                <img
                  src={game.img}
                  alt={game.name}
                  className="w-full h-[140px] object-cover"
                />
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.6)" }}
                >
                  <span className="text-sm font-medium text-white">Več info</span>
                </div>
              </div>
              <div className="p-2.5">
                <div className="text-sm font-medium truncate">{game.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "#848383" }}>{game.provider}</div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center mt-6 text-sm" style={{ color: "#848383" }}>
          Za igranje obiščite{" "}
          <a href="https://casino.si" target="_blank" rel="noopener noreferrer" style={{ color: "#ff0000" }} className="font-medium underline hover:no-underline">
            casino.si
          </a>
        </p>
      </div>

      {/* Info cards */}
      <div className="max-w-[1440px] mx-auto w-full px-6 py-8">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-6 rounded-xl" style={{ background: "#323232", border: "1px solid #3c3c3c" }}>
            <div className="text-2xl mb-3">🛡️</div>
            <h3 className="font-bold mb-2">Licenciran casino</h3>
            <p className="text-sm" style={{ color: "#cfd0d1" }}>
              Casino.si upravlja Casino Portorož d.d. z uradno koncesijo
              Republike Slovenije za prirejanje spletnih iger na srečo.
            </p>
          </div>
          <div className="p-6 rounded-xl" style={{ background: "#323232", border: "1px solid #3c3c3c" }}>
            <div className="text-2xl mb-3">💬</div>
            <h3 className="font-bold mb-2">24/7 AI Podpora</h3>
            <p className="text-sm" style={{ color: "#cfd0d1" }}>
              Naš AI pomočnik vam je vedno na voljo. Kliknite na ikono v
              spodnjem desnem kotu za takojšnjo pomoč.
            </p>
          </div>
          <div className="p-6 rounded-xl" style={{ background: "#323232", border: "1px solid #3c3c3c" }}>
            <div className="text-2xl mb-3">🎮</div>
            <h3 className="font-bold mb-2">262+ iger</h3>
            <p className="text-sm" style={{ color: "#cfd0d1" }}>
              Izbirajte med sloti, ruletami, blackjackom in drugimi igrami
              od 7 vodilnih svetovnih ponudnikov.
            </p>
          </div>
        </div>
      </div>

      {/* Responsible gambling */}
      <div className="max-w-[1440px] mx-auto w-full px-6 py-6">
        <div className="rounded-xl p-8 text-center" style={{ background: "#1c1d1e", border: "1px solid #3c3c3c" }}>
          <img src={IMG("common-content/footer/igrajodgovorno18-color.svg")} alt="18+" className="h-10 mx-auto mb-4" />
          <h3 className="font-bold text-lg mb-2">Odgovorno igranje</h3>
          <p className="text-sm mb-3" style={{ color: "#cfd0d1" }}>
            Igre na srečo so namenjene zabavi. Igrajte odgovorno.
            Če potrebujete pomoč, pokličite SRIF na številko{" "}
            <span className="font-bold" style={{ color: "#ffe22e" }}>090 68 02</span>
          </p>
          <div className="flex justify-center gap-6 text-sm" style={{ color: "#848383" }}>
            <span>18+</span><span>•</span><span>SRIF</span><span>•</span><span>Igraj odgovorno</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="mt-auto pt-10 pb-6 px-6"
        style={{
          backgroundImage: `url(${CDN}/common-content/brand/footer-background.jpg)`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-[1440px] mx-auto">
          {/* Payment methods */}
          <div className="mb-8">
            <h4 className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: "#848383" }}>Plačilne metode</h4>
            <div className="flex flex-wrap gap-3">
              {paymentLogos.map((p) => (
                <div key={p} className="h-8 px-2 flex items-center" style={{ background: "rgba(255,255,255,0.05)", borderRadius: "4px" }}>
                  <img src={IMG(`common-content/footer/payments/${p}-color.svg`, undefined, 28)} alt={p} className="h-6 object-contain" />
                </div>
              ))}
            </div>
          </div>

          {/* Provider logos */}
          <div className="mb-8">
            <h4 className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: "#848383" }}>Ponudniki iger</h4>
            <div className="flex flex-wrap gap-3">
              {providerLogos.map((p) => (
                <div key={p.name} className="h-8 px-3 flex items-center" style={{ background: "rgba(255,255,255,0.05)", borderRadius: "4px" }}>
                  <img src={p.img} alt={p.name} className="h-5 object-contain" />
                </div>
              ))}
            </div>
          </div>

          {/* Footer links */}
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-3 text-sm">O podjetju</h4>
              <div className="space-y-1.5 text-sm" style={{ color: "#cfd0d1" }}>
                <p>Casino Portorož d.d.</p>
                <p>Koncesionar spletnih iger na srečo</p>
                <p>Republika Slovenija</p>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-3 text-sm">Kontakt</h4>
              <div className="space-y-1.5 text-sm" style={{ color: "#cfd0d1" }}>
                <p>📧 podpora@casino.si</p>
                <p className="text-2xl font-bold" style={{ color: "white" }}>030 777 888</p>
                <p>Live chat na casino.si</p>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-3 text-sm">Povezave</h4>
              <div className="space-y-1.5 text-sm" style={{ color: "#cfd0d1" }}>
                <p><a href="https://casino.si" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">casino.si</a></p>
                <p>Splošni pogoji</p>
                <p>Politika zasebnosti</p>
                <p>Odgovorno igranje</p>
              </div>
            </div>
          </div>

          {/* Social links */}
          <div className="flex justify-center gap-4 mb-8">
            {socialLinks.map((s) => (
              <div key={s.name} className="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80" style={{ background: "rgba(255,255,255,0.1)" }}>
                <img src={s.img} alt={s.name} className="w-5 h-5" />
              </div>
            ))}
          </div>

          {/* Bottom logo */}
          <div className="flex justify-center mb-6">
            <img src={`${CDN}/common-content/brand/app-logo-footer.svg`} alt="Casino.si" className="h-8 opacity-60" />
          </div>

          {/* Separator */}
          <div className="border-t mb-4" style={{ borderColor: "rgba(255,255,255,0.1)" }} />

          {/* Powered by */}
          <div className="text-center">
            <p className="text-sm" style={{ color: "#848383" }}>
              Powered by:{" "}
              <a
                href="https://aiprosolutions.si"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold hover:underline"
                style={{ color: "#ff0000" }}
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
