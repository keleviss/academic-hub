import { BackLink } from './BackLink';

interface PageLayoutProps {
  title: string;
  subtitle: string | React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  backlink?: { href: string; text: string };
}

export function PageLayout({
  title,
  subtitle,
  children,
  actions,
  backlink,
}: PageLayoutProps): React.JSX.Element {
  return (
    <section id="page-layout" className="w-full grid gap-8">
      {backlink && <BackLink to={backlink.href}>{backlink.text}</BackLink>}
      <header id="page-layout-header" className="w-full flex justify-between">
        <div id="page-layout-header-content">
          <h1 className="text-[clamp(1.75rem,4vw,2rem)] font-bold text-hub-navy">
            {title}
          </h1>
          <p className="text-sm text-hub-muted">{subtitle}</p>
        </div>
        <div id="page-layout-header-actions">{actions}</div>
      </header>
      {children}
    </section>
  );
}
