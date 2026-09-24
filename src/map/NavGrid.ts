/**
 * Grade de navegação: terra/água, contagem de bloqueios (construções, árvores, jazidas, penhascos)
 * e relevo de um nível: `elev` = 0 no chão e 1 no topo dos planaltos. Só se troca de nível
 * pelas rampas (pares de tiles marcados em `ramp`).
 */
export class NavGrid {
  readonly blocked: Uint8Array;
  readonly elev: Uint8Array;
  readonly ramp: Uint8Array;
  version = 0;

  constructor(
    readonly w: number,
    readonly h: number,
    readonly land: Uint8Array,
  ) {
    this.blocked = new Uint8Array(w * h);
    this.elev = new Uint8Array(w * h);
    this.ramp = new Uint8Array(w * h);
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

  /** Nível do tile (0 chão, 1 planalto); fora do mapa conta como chão. */
  level(tx: number, ty: number): number {
    return this.inBounds(tx, ty) ? this.elev[ty * this.w + tx] : 0;
  }

  levelAt(px: number, py: number, tile = 64): number {
    return this.level(Math.floor(px / tile), Math.floor(py / tile));
  }

  isRamp(tx: number, ty: number): boolean {
    return this.inBounds(tx, ty) && this.ramp[ty * this.w + tx] === 1;
  }

  /**
   * Dá para ir do tile a ao tile b (vizinhos, inclusive na diagonal)? Mesmo nível sempre;
   * entre níveis só dentro da rampa. Diagonais não trocam de nível nem cortam cantos.
   */
  canStep(ax: number, ay: number, bx: number, by: number): boolean {
    if (!this.walkable(bx, by)) return false;
    const la = this.level(ax, ay);
    const lb = this.level(bx, by);
    const diagonal = ax !== bx && ay !== by;
    if (diagonal) {
      return (
        la === lb &&
        this.walkable(ax, by) &&
        this.walkable(bx, ay) &&
        this.level(ax, by) === la &&
        this.level(bx, ay) === la
      );
    }
    return la === lb || (this.isRamp(ax, ay) && this.isRamp(bx, by));
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

  /** O retângulo está inteiro num só nível e longe das rampas (para construir)? */
  rectOneLevel(tx: number, ty: number, w: number, h: number): boolean {
    const lv = this.level(tx, ty);
    for (let y = ty - 1; y <= ty + h; y++)
      for (let x = tx - 1; x <= tx + w; x++) {
        if (this.isRamp(x, y)) return false;
        const inside = x >= tx && x < tx + w && y >= ty && y < ty + h;
        if (inside && this.level(x, y) !== lv) return false;
      }
    return true;
  }
}
