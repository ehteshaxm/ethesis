export default function PulseTab() {
  return (
    <ComingSoon
      title="Pulse"
      blurb="Reverse-chronological feed of every verified, disputed, and silence attestation the agent has posted. Lands in the next session."
    />
  );
}

function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-2/50 p-10 text-center max-w-2xl mx-auto">
      <h2 className="text-lg font-medium text-ink">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted leading-relaxed">{blurb}</p>
    </div>
  );
}
