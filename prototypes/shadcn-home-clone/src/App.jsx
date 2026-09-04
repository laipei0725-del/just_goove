import { useEffect, useRef, useState } from "react";

const navItems = ["Home", "Docs", "Components", "Blocks", "Charts", "Directory", "Typeset", "Create"];
const sectionItems = ["Introduction", "Components", "Installation", "Theming", "CLI", "RTL", "Skills", "MCP Server", "Registry", "Forms", "Changelog"];
const componentItems = ["Accordion", "Alert", "Alert Dialog", "Aspect Ratio", "Attachment", "Avatar", "Badge", "Breadcrumb", "Button", "Calendar", "Card", "Carousel", "Checkbox", "Dialog", "Drawer", "Dropdown Menu", "Input", "Popover", "Progress", "Select", "Slider", "Switch", "Table", "Tabs", "Toast", "Tooltip"];

function Icon({ src, alt = "", className = "" }) {
  return <img className={`icon ${className}`} src={src} alt={alt} />;
}

function SearchDialog({ onClose }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const rows = navItems.filter((item) => item.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-layer search-layer" role="presentation" onMouseDown={onClose}>
      <section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search documentation" onMouseDown={(event) => event.stopPropagation()}>
        <label className="search-input-wrap">
          <Icon src="/assets/search.svg" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documentation..." />
        </label>
        <div className="search-label">Pages</div>
        <div className="search-results">
          {rows.map((item, index) => (
            <button className={index === 0 ? "search-row active" : "search-row"} key={item} onClick={onClose}>
              <span>→</span>{item}
            </button>
          ))}
          {rows.length === 0 && <p className="empty-results">No results found.</p>}
        </div>
        <div className="search-hint"><kbd>↵</kbd> Go to Page</div>
      </section>
    </div>
  );
}

function AlertDialog({ onClose }) {
  return (
    <div className="modal-layer alert-layer" role="presentation" onMouseDown={onClose}>
      <section className="alert-dialog" role="alertdialog" aria-modal="true" aria-labelledby="alert-title" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="alert-title">Allow accessory to connect?</h2>
        <p>Do you want to allow the USB accessory to connect to this device and your data?</p>
        <div className="alert-actions">
          <button className="button outline" onClick={onClose}>Don't allow</button>
          <button className="button primary" onClick={onClose}>Allow</button>
        </div>
      </section>
    </div>
  );
}

function MobileMenu({ onClose }) {
  return (
    <aside className="mobile-menu" aria-label="Mobile navigation">
      <button className="menu-trigger open" onClick={onClose} aria-label="Close menu"><span>×</span> Menu</button>
      <p className="menu-heading">Menu</p>
      <nav>{navItems.map((item) => <a href={`#${item.toLowerCase()}`} key={item}>{item}</a>)}</nav>
      <p className="menu-heading">Sections</p>
      <nav>{sectionItems.map((item) => <a href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>{item}</a>)}</nav>
      <p className="menu-heading">Components</p>
      <nav>{componentItems.map((item) => <a href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>{item}</a>)}</nav>
    </aside>
  );
}

function RightRail() {
  return (
    <div className="right-rail" aria-label="Dashboard examples">
      <section className="showcase-card qr-card">
        <img src="/assets/qr.svg" alt="Connect device QR code" />
        <h3>Scan to connect your mobile device</h3>
        <p>Open the Ledger mobile app and<br />scan this code to link your device.</p>
      </section>

      <section className="showcase-card chat-card">
        <header><div><h3>New Chat</h3><p>How can I help you today?</p></div><button aria-label="Reset conversation">↻</button></header>
        <div className="chat-empty">
          <div className="chat-mark">◌</div>
          <h3>Morning, shadcn!</h3>
          <p>What are we working on today? Press<br />send to start a new conversation</p>
        </div>
        <div className="chat-composer">
          <p>I'm building a chat for our app and the scroll behavior is driving me nuts. Every time the AI...</p>
          <button className="composer-add">+</button><button className="composer-send">↑</button>
        </div>
      </section>

      <section className="showcase-card payments-card">
        <div className="breadcrumbs"><span>Home</span><span>›</span><span>•••</span><span>›</span><strong>Payments</strong></div>
        {[
          ["⚙", "Change transfer limit", "Adjust how much you can send from your balance."],
          ["▣", "Scheduled transfers", "Set up a transfer to send at a later date."],
          ["◌", "Recurring card payments", "Manage your repeated card transactions."],
        ].map(([symbol, title, copy], index) => (
          <a className={index === 2 ? "payment-row disabled" : "payment-row"} href="#payments" key={title}>
            <span className="payment-icon" aria-hidden="true">{symbol}</span>
            <span><strong>{title}</strong><small>{copy}</small></span><span>›</span>
          </a>
        ))}
      </section>
    </div>
  );
}

export function App() {
  const [dark, setDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    document.body.style.overflow = menuOpen || searchOpen || alertOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen, searchOpen, alertOpen]);

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="mobile-nav">
          <button className="menu-trigger" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen}><span>☰</span> Menu</button>
        </div>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navItems.map((item) => <a href={`#${item.toLowerCase()}`} key={item}>{item}</a>)}
        </nav>
        <div className="header-actions">
          <button className="search-trigger" onClick={() => setSearchOpen(true)}><span>Search documentation...</span></button>
          <span className="header-divider desktop-only" />
          <a className="github-link" href="https://github.com/shadcn-ui/ui" target="_blank" rel="noreferrer"><Icon src="/assets/github.svg" alt="GitHub" /><span>123k</span></a>
          <span className="header-divider" />
          <button className="icon-button theme-button" aria-label="Toggle theme" onClick={() => setDark((value) => !value)}><Icon src="/assets/theme.svg" /></button>
          <span className="header-divider desktop-only" />
          <a className="new-button" href="https://ui.shadcn.com/create" target="_blank" rel="noreferrer"><Icon src="/assets/plus.svg" /> New</a>
        </div>
      </header>

      <main>
        <section className="hero">
          <a className="announcement" href="https://ui.shadcn.com/docs/changelog" target="_blank" rel="noreferrer">New Questionnaire component <Icon src="/assets/arrow-right.svg" /></a>
          <h1>The Foundation for your Design System</h1>
          <p>Composable, accessible components with thoughtful defaults. Build your own component library with code you can customize, extend, and make your own.</p>
          <div className="hero-actions">
            <a className="button primary" href="https://ui.shadcn.com/docs/installation" target="_blank" rel="noreferrer">Get Started</a>
            <a className="button secondary" href="https://ui.shadcn.com/docs/components" target="_blank" rel="noreferrer">View Components</a>
          </div>
        </section>

        <section className="dashboard-stage" aria-label="Component showcase">
          <picture className="dashboard-picture">
            <img className="dashboard-art light-art" src="/assets/dashboard-light.webp" alt="Dashboard component showcase" />
            <img className="dashboard-art dark-art" src="/assets/dashboard-dark.webp" alt="" aria-hidden="true" />
          </picture>
          <button className="alert-hotspot" aria-label="Alert Dialog" onClick={() => setAlertOpen(true)} />
          <RightRail />
          <div className="dashboard-fade" />
        </section>
      </main>

      <footer>Built by <a href="https://twitter.com/shadcn">shadcn</a> at <a href="https://vercel.com">Vercel</a>. The source code is available on <a href="https://github.com/shadcn-ui/ui">GitHub</a>.</footer>

      {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} />}
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
      {alertOpen && <AlertDialog onClose={() => setAlertOpen(false)} />}
    </div>
  );
}
