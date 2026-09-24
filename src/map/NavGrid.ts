/** Grade de navegação: terra/água + contagem de bloqueios (construções, árvores, minas). */
export class NavGrid {
  readonly blocked: Uint8Array;
  version = 0;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly land: Uint8Array,
  ) {
    this.blocked = new Uint8Array(w * h);
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }

  isLand(tx: number, ty: number): boolean {
    return this.inBounds(tx, ty) && this.land[ty * this.w + tx] === 1;
  }

  walkable(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return false;
    const i = ty * this.w + tx;
    return this.land[i] === 1 && this.blocked[i] === 0;
  }

  walkableIdx(i: number): boolean {
    return this.land[i] === 1 && this.blocked[i] === 0;
  }

  blockRect(tx: number, ty: number, w: number, h: number): void {
    for (let y = ty; y < ty + h; y++)
      for (let x = tx; x < tx + w; x++) if (this.inBounds(x, y)) this.blocked[y * this.w + x]++;
    this.version++;
  }

  unblockRect(tx: number, ty: number, w: number, h: number): void {
    for (let y = ty; y < ty + h; y++)
      for (let x = tx; x < tx + w; x++) {
        if (!this.inBounds(x, y)) continue;
        const i = y * this.w + x;
        if (this.blocked[i] > 0) this.blocked[i]--;
      }
    this.version++;
  }

  /** Todos os tiles do retângulo estão livres (terra, sem bloqueio)? */
  rectFree(tx: number, ty: number, w: number, h: number): boolean {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (!this.walkable(x, y)) return false;
    return true;
  }
}
