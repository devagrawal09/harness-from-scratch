export interface ParsedFrontmatter {
  name: string;
  description: string;
  content: string;
  location: string;
  directory: string;
}

export function parseFrontmatter(
  text: string,
  location: string,
  directory: string,
): ParsedFrontmatter | null {
  if (!text.startsWith("---\n")) return null;

  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return null;

  let name = "";
  let description = "";
  for (const line of text.slice(4, end).split("\n")) {
    const separator = line.indexOf(": ");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 2).trim();
    if (key === "name") name = value;
    if (key === "description") description = value;
  }

  if (!name) return null;
  return {
    name,
    description,
    content: text.slice(end + 5),
    location,
    directory,
  };
}
