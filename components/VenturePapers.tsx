import { paperById, paperUrl } from "@/lib/brain-corpus";

interface Props {
  paperIds: string[];
}

export function VenturePapers({ paperIds }: Props) {
  const papers = paperIds
    .map((id) => paperById(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (!papers.length) return null;

  return (
    <ul className="rounded-lg border border-border bg-surface divide-y divide-border-soft">
      {papers.map((p) => (
        <li key={p.id} className="px-4 py-3.5">
          <a
            href={paperUrl(p)}
            target="_blank"
            rel="noreferrer noopener"
            className="block group"
          >
            <span className="block text-[14px] text-ink leading-snug group-hover:text-accent">
              {p.title}
            </span>
            <span className="mt-1 block font-mono text-[11px] text-ink-muted">
              {p.authors} · {p.venue} · {p.year}
            </span>
            <span className="mt-2 block text-[13px] text-ink-soft leading-relaxed">
              {p.blurb}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
