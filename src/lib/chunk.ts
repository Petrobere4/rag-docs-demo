export type ChunkOptions = {
  chunkSize?: number;      
  overlap?: number;        
  minChunkSize?: number;   
};

export function chunkText(text: string, opts: ChunkOptions = {}) {
  const chunkSize = opts.chunkSize ?? 800;
  const overlap = opts.overlap ?? 120;
  const minChunkSize = opts.minChunkSize ?? 200;

  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];

  const blocks = clean
    .split(/\n{2,}/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const t = current.trim();
    if (t.length >= minChunkSize) chunks.push(t);
    current = "";
  };

  for (const block of blocks) {
    
    if (block.length > chunkSize) {
      pushCurrent();

      let i = 0;
      while (i < block.length) {
        const end = Math.min(i + chunkSize, block.length);
        const slice = block.slice(i, end).trim();
        if (slice.length >= minChunkSize) chunks.push(slice);
        if (end === block.length) break;
        i = Math.max(0, end - overlap);
      }
      continue;
    }

  
    if (!current) {
      current = block;
      continue;
    }

    if ((current + "\n\n" + block).length <= chunkSize) {
      current = current + "\n\n" + block;
    } else {
      pushCurrent();
      current = block;
    }
  }

  pushCurrent();

  
  if (overlap > 0 && chunks.length > 1) {
    const out: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const prevTail =
        i === 0 ? "" : chunks[i - 1].slice(Math.max(0, chunks[i - 1].length - overlap));
      const merged = (prevTail ? prevTail + "\n\n" : "") + chunks[i];
      out.push(merged.trim());
    }
    return out;
  }

  return chunks;
}
