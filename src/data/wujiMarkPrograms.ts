// 無極聖武相關印記的共用圖紙（2026-11-22）。
// 威怯是「回合型」印記：魂印（砥礪失敗、⑤）與技能（亂武天傀）附加同一個識別碼，
// 聖武·虛極拓世「對手每剩1回合威怯…」讀的就是這個印記的剩餘回合。

export const WEIYUE_PROGRAM = {
  id: 'arena.weiyue', name: '威怯', side: 'opp', mode: 'set', count: 1, maxCount: 1, scope: 'elf', persistsOffField: true,
  turns: 3, displayChar: '怯', unit: '回合', description: '3回合內持有者造成的非真實傷害額外減少60%',
  rules: [{ raw: '造成的非真實傷害減少60%', trig: 'outgoing', parsed: true, body: [{ acts: [{ op: 'dmg_mod', p: { dir: 'out_reduce', kind: '非真實', reduce: .6 }, label: 'dmg_mod' }] }] }],
};

/** 亮節：3 回合；持有者 ≤50% 機率的異常附加效果歸 0；每回合結束為對手 PP 為 0 的技能恢復 5 點 PP。 */
export const LIANGJIE_PROGRAM = {
  id: 'arena.liangjie', name: '亮節', side: 'opp', mode: 'set', count: 1, maxCount: 1, scope: 'elf', persistsOffField: true,
  turns: 3, displayChar: '節', unit: '回合', statusChanceZeroAtMost50: true,
  description: '3回合內自身機率不高於50%的異常狀態附加效果機率下降至0；每回合結束時，為對手PP值為0的技能恢復5點PP值',
  rules: [{ raw: '每回合結束時為對手PP值為0的技能恢復5點PP值', trig: 'round_end', parsed: true,
    body: [{ acts: [{ op: 'pp_op', p: { side: 'opp', mode: 'add', amount: 5, onlyEmpty: true }, label: 'pp_op' }] }] }],
};
