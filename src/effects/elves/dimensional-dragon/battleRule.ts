// 次元龍「詩章」的全局規則（原寫在 BattleScreen／戰鬥引擎，2026-10-10 搬入）。
import { registerBattleRule } from '../../../engine/battleRules';
import { getMark, setMark as setMarkUtil, clearMark as clearMarkUtil, type Mark } from '../../../battle/marks';
import { checkElfDead } from '../../../battle/elfAlive';

const isDragon = (e: any) => !!e && String(e.name || '').includes('次元龍');
const POEM_DESCRIPTION = "紀錄持有者精靈的體力上限，當持有精靈死亡時，詩章將轉移給存活狀態的治癒.龍魂再臨 次元龍以增加其等量體力上限，治癒.龍魂再臨 次元龍若存在複數精靈則會同時轉移相同數量給予所有治癒.龍魂再臨 次元龍(每篇詩章獨立計算且無上限，下場後保留)";

registerBattleRule({
  id: 'dimensional-dragon:poem',
  // 場上（任一方隊伍）有次元龍時，每回合開始所有存活精靈各記錄一篇詩章。
  roundStart(api, cur) {
    if (![...cur.p1Team, ...cur.p2Team].some(isDragon)) return;
    for (const side of ["p1", "p2"] as const) {
      const team = side === "p1" ? cur.p1Team : cur.p2Team;
      const activeIdx = side === "p1" ? cur.p1ActiveIndex : cur.p2ActiveIndex;
      team.forEach((elf: any, idx: number) => {
        if (!elf || checkElfDead(elf)) return; // 死亡精靈不再累積
        elf.marks = elf.marks || [];
        const existingSnapshots = getMark(elf.marks, "poem_chapter")?.effects?.poemHpSnapshots || [];
        const nextSnapshots = [...existingSnapshots, elf.maxHp];
        const newMark: Mark = { id: "poem_chapter", displayChar: "詩", count: nextSnapshots.length, name: "詩章",
          description: POEM_DESCRIPTION, source: elf.name, effects: { poemHpSnapshots: nextSnapshots } };
        elf.marks = setMarkUtil(elf.marks, newMark);
        if (idx === activeIdx) {
          const marksKey = `${side}Marks` as "p1Marks" | "p2Marks";
          cur[marksKey] = elf.marks;
          api.dispatch({ type: 'SET_MARKS', side, marks: elf.marks });
        }
      });
    }
  },
  // 持有詩章的精靈陣亡：詩章轉移給存活的次元龍（增加等量體力上限）。
  faint(api, mid) {
    for (const side of ["p1", "p2"] as const) {
      const team = side === "p1" ? mid.p1Team : mid.p2Team;
      const activeIdx = side === "p1" ? mid.p1ActiveIndex : mid.p2ActiveIndex;
      team.forEach((elf: any, idx: number) => {
        if (!elf || !checkElfDead(elf)) return; // 只處理死亡精靈
        elf.marks = elf.marks || [];
        const poemMark = getMark(elf.marks, "poem_chapter");
        if (!poemMark?.effects?.poemHpSnapshots?.length) return;
        const total = poemMark.effects.poemHpSnapshots.reduce((a: number, b: number) => a + b, 0);
        [...mid.p1Team, ...mid.p2Team].filter((e: any) => isDragon(e) && e.currentHp > 0).forEach((d: any) => { d.maxHp += total; });
        elf.marks = clearMarkUtil(elf.marks, "poem_chapter");
        if (idx === activeIdx) {
          const marksKey = `${side}Marks` as "p1Marks" | "p2Marks";
          mid[marksKey] = clearMarkUtil(mid[marksKey], "poem_chapter");
          api.dispatch({ type: 'SET_MARKS', side, marks: mid[marksKey] });
        }
      });
    }
  },
  // 詩章 8 篇：攻擊技能不受攻擊無效影響、無視攻擊免疫。
  actionFlags(state, side, skill) {
    const marks = side === "p1" ? state.p1Marks : state.p2Marks;
    const mk = getMark(marks || [], "poem_chapter");
    const count = getMark(marks || [], "poem_chapter")?.count || 0;
    const chapters = Math.max(count, mk?.effects?.poemHpSnapshots?.length || 0);
    return {
      ignoreAttackInvalidation: count >= 8 && skill?.category !== "屬性",
      ignoreAttackImmunitySource: chapters >= 8 ? "詩章8" : null,
    };
  },
});
