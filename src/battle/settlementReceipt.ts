/** 名目值、結算值、實際HP變化不可混用（吸血讀結算值；扣血成功讀hpLost）。 */
export interface SettlementReceipt {
  operation: 'damage' | 'heal';
  targetBattleId: string;
  damageType?: string;
  requestedAmount: number;
  settledAmount: number;
  hpBefore: number;
  hpAfter: number;
  hpLost: number;
  hpGained: number;
  shieldAbsorbed: number;
  barrierAbsorbed: number;
  resistedFatal: boolean;
  blocked: boolean;
}
export type SettlementCallback = (result: SettlementReceipt) => void;
export type SettlementOptions = { onSettled?: SettlementCallback; isPotion?: boolean; presentationPotion?: boolean };
export function combineSettlementCallbacks(...callbacks: (SettlementCallback | undefined)[]): SettlementCallback {
  return receipt => { for (const callback of callbacks) notifySettlement({ onSettled: callback }, receipt); };
}
export function settlementReceipt(
  input: Pick<SettlementReceipt, 'operation' | 'targetBattleId' | 'requestedAmount' | 'settledAmount' | 'hpBefore' | 'hpAfter'> & Partial<SettlementReceipt>,
): SettlementReceipt {
  return Object.freeze({ shieldAbsorbed: 0, barrierAbsorbed: 0, resistedFatal: false, blocked: false,
    ...input, hpLost: Math.max(0, input.hpBefore - input.hpAfter), hpGained: Math.max(0, input.hpAfter - input.hpBefore) });
}
export function notifySettlement(data: SettlementOptions, receipt: SettlementReceipt): void {
  try { data.onSettled?.(receipt); } catch (error) { console.error('[settlement callback]', error); }
}
