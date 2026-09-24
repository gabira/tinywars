/** Grade espacial simples para consultas de vizinhança (unidades). */
export interface Positioned {
  id: number;
  x: number;
  y: number;
}

export class SpatialHash<T extends Positioned> {
  private cells = new Map<number, T[]>();

  constructor(private cellSize: number) {}

  private key(cx: number, cy: number): number {
    return (cy + 1024) * 4096 + (cx + 1024);
  }

  clear(): void {
    this.cells.clear();
  }

  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    let list = this.cells.get(k);
    if (!list) {
      list = [];
      this.cells.set(k, list);
    }
    list.push(item);
  }

  /** Itens com centro dentro do raio (aproximado pela grade, filtrado por distância). */
  query(x: number, y: number, radius: number, out: T[] = []): T[] {
    out.length = 0;
    const cs = this.cellSize;
    const x0 = Math.floor((x - radius) / cs);
    const x1 = Math.floor((x + radius) / cs);
    const y0 = Math.floor((y - radius) / cs);
    const y1 = Math.floor((y + radius) / cs);
    const r2 = radius * radius;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.cells.get(this.key(cx, cy));
        if (!list) continue;
        for (const it of list) {
          const dx = it.x - x;
          const dy = it.y - y;
          if (dx * dx + dy * dy <= r2) out.push(it);
        }
      }
    }
    return out;
  }
}
