import { computeSplits, SplitError } from '@/lib/splits/compute';

type Named = { id: number; name: string };

function match<T extends Named>(query: string, items: T[]): T[] {
  const q = query.trim().toLowerCase();
  const exact = items.filter((x) => x.name.toLowerCase() === q);
  return exact.length ? exact : items.filter((x) => x.name.toLowerCase().includes(q));
}

export function resolveClient<T extends Named>(name: string, clients: T[]): { ok: true; client: T } | { ok: false; error: string } {
  const hits = match(name, clients);
  if (hits.length === 1) return { ok: true, client: hits[0] };
  if (hits.length === 0) return { ok: false, error: `No client matches "${name}". Clients: ${clients.map((c) => c.name).join(', ')}` };
  return { ok: false, error: `"${name}" matches several clients: ${hits.map((c) => c.name).join(', ')}. Which one?` };
}

export function parseSplitInput(
  s: { collaboratorName: string; percent: number }[],
  collabs: Named[],
): { ok: true; splits: { collaboratorId: number; percent: number }[] } | { ok: false; error: string } {
  const splits: { collaboratorId: number; percent: number }[] = [];
  for (const x of s) {
    const hits = match(x.collaboratorName, collabs);
    if (hits.length !== 1) {
      return { ok: false, error: `Unknown collaborator "${x.collaboratorName}". Collaborators: ${collabs.map((c) => c.name).join(', ')}` };
    }
    splits.push({ collaboratorId: hits[0].id, percent: x.percent });
  }
  try {
    computeSplits(100, splits);
  } catch (e) {
    if (e instanceof SplitError) return { ok: false, error: e.message };
    throw e;
  }
  return { ok: true, splits };
}
