/**
 * Lector del texto del contrato.
 *
 * El servidor entrega el contrato como Markdown sencillo (el mismo en los cinco
 * idiomas): `# Título`, `**Subtítulo**`, cláusulas `### 1. Nombre` y, dentro de
 * ellas, párrafos y viñetas `- Etiqueta: texto`. Este lector lo convierte en
 * cláusulas con estructura para pintarlas bien (número, título, términos con su
 * etiqueta) en lugar de mostrar texto plano.
 */

export interface ContractItem {
  kind: 'paragraph' | 'term';
  /** Solo en `term`: «Fecha de Inicio», «Derechos ARCO»… */
  label?: string;
  text: string;
}

export interface ContractClause {
  /** «1», «2»… tal como figura en el texto. */
  number: string;
  title: string;
  items: ContractItem[];
}

export interface ParsedContract {
  title: string;
  subtitle: string;
  /** Texto previo a la primera cláusula, si lo hay. */
  intro: string[];
  clauses: ContractClause[];
}

// «Fecha de Inicio: …» en español/inglés/portugués/italiano y «Date de début : …» en francés.
// La etiqueta es corta y no lleva punto: así una frase con «:» en medio no se parte por error.
const TERM = /^([^:.]{2,70}?)\s?:\s+(\S[\s\S]*)$/;
const CLAUSE = /^###\s+(?:(\d+)\.\s*)?(.+)$/;

export function parseContract(content: string): ParsedContract {
  const parsed: ParsedContract = { title: '', subtitle: '', intro: [], clauses: [] };
  let current: ContractClause | null = null;

  for (const rawLine of String(content ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('# ')) {
      parsed.title = line.slice(2).trim();
      continue;
    }

    const bold = line.match(/^\*\*(.+)\*\*$/);
    if (bold && !current) {
      parsed.subtitle = bold[1].trim();
      continue;
    }

    const clause = line.match(CLAUSE);
    if (clause) {
      current = { number: clause[1] ?? String(parsed.clauses.length + 1), title: clause[2].trim(), items: [] };
      parsed.clauses.push(current);
      continue;
    }

    if (line.startsWith('- ')) {
      const body = line.slice(2).trim();
      const term = body.match(TERM);
      const item: ContractItem = term
        ? { kind: 'term', label: term[1].trim(), text: term[2].trim() }
        : { kind: 'paragraph', text: body };
      (current ? current.items : null)?.push(item);
      if (!current) parsed.intro.push(body);
      continue;
    }

    if (current) current.items.push({ kind: 'paragraph', text: line });
    else parsed.intro.push(line);
  }

  return parsed;
}
