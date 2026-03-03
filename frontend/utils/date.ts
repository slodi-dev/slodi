export function formatIcelandicDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("is-IS", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
