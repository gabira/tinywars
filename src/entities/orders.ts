/** Ordens que uma unidade executa (uma ativa + fila com Shift). */
export type Order =
  | { type: 'move'; x: number; y: number }
  | { type: 'attackMove'; x: number; y: number }
  | { type: 'attack'; targetId: number; auto?: boolean }
  | { type: 'gather'; nodeId: number }
  | { type: 'returnCargo' }
  | { type: 'build'; buildingId: number }
  | { type: 'hold' };
