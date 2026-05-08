export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface mt-auto">
      <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-ink-muted">
        <p className="font-mono">Verified research, funded onchain.</p>
        <ul className="flex items-center gap-5">
          <li>
            <a className="hover:text-ink transition-colors" href="#">
              Docs
            </a>
          </li>
          <li>
            <a className="hover:text-ink transition-colors" href="#">
              GitHub
            </a>
          </li>
          <li>
            <a className="hover:text-ink transition-colors" href="#">
              Apify Store
            </a>
          </li>
          <li>
            <a className="hover:text-ink transition-colors" href="#">
              Status
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
