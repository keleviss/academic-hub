const units = [
  {
    durationMs: 365 * 24 * 60 * 60 * 1000,
    singular: 'χρόνο',
    plural: 'χρόνια',
  },
  { durationMs: 30 * 24 * 60 * 60 * 1000, singular: 'μήνα', plural: 'μήνες' },
  {
    durationMs: 7 * 24 * 60 * 60 * 1000,
    singular: 'εβδομάδα',
    plural: 'εβδομάδες',
  },
  { durationMs: 24 * 60 * 60 * 1000, singular: 'ημέρα', plural: 'ημέρες' },
  { durationMs: 60 * 60 * 1000, singular: 'ώρα', plural: 'ώρες' },
  { durationMs: 60 * 1000, singular: 'λεπτό', plural: 'λεπτά' },
];

export function formatRelativeDateTime(
  dateText: string,
  now = new Date(),
): string {
  const timestamp = new Date(dateText).getTime();
  if (Number.isNaN(timestamp)) return dateText;

  const elapsedMs = now.getTime() - timestamp;
  if (elapsedMs < 60_000) return 'μόλις τώρα';

  const unit =
    units.find((item) => elapsedMs >= item.durationMs) ?? units.at(-1)!;
  const value = Math.floor(elapsedMs / unit.durationMs);
  const label = value === 1 ? unit.singular : unit.plural;

  return `${value} ${label} πριν`;
}
