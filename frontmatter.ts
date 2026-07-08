export interface ParsedFrontmatter {
  name: string;
  description: string;
  content: string;
  location: string;
  directory: string;
}

export function parseFrontmatter(text: string, location: string, directory: string): ParsedFrontmatter | null {
  if (!text.startsWith("---\n")) return null;
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;
  const raw = text.slice(4, end);
  const rest = text.slice(end + 5);
  let name = "";
  let description = "";
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(": ");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 2).trim();
    if (key === "name") name = val;
    if (key === "description") description = val;
  }
  if (!name) return null;
  return { name, description, content: rest, location, directory };
}
