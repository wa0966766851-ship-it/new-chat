import { Elf, Skill, SoulMark, BaseStats } from "../types";

/**
 * 完整、高容錯性地解析原始精靈文本，不省略任何條件與文字。
 * 支援多種版面格式解析：
 * 【精靈名稱】 / 名稱：精靈名字
 * 【精靈屬性】 / 屬性：精靈屬性系
 * 【基礎種族值】 / 種族值 / 六圍屬性：體力 150 攻擊 100 ...
 * 【魂印 / 專屬特性】 / 魂印 - 特性名稱
 * 【核心技能組】
 */
export function parseFullElfData(rawText: string): Partial<Elf> {
  const elf: Partial<Elf> = {
    rawPrompt: rawText,
    skills: [],
    baseStats: { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 }
  };

  // 1. 名稱解析 (支援 【精靈名稱】：XXX 或 名稱：XXX 等多種格式)
  const nameMatch = rawText.match(/【精靈名稱】\s*[:：]?\s*(.*)/) || rawText.match(/名稱\s*[:：]?\s*(.*)/);
  if (nameMatch) {
    elf.name = nameMatch[1].trim();
  } else {
    // 降級找第一行
    const firstLine = rawText.split('\n')[0];
    if (firstLine && firstLine.length < 20 && !firstLine.includes('【')) {
      elf.name = firstLine.trim();
    }
  }

  // 2. 屬性解析 (支援 【精靈屬性】：XXX系 或 屬性：XXX 或 雙屬性 聖靈.神秘)
  const typeMatch = rawText.match(/【精靈屬性】\s*[:：]?\s*(.*?)(?:系|$|\n)/) || rawText.match(/屬性\s*[:：]?\s*(.*?)(?:系|$|\n)/);
  if (typeMatch) {
    elf.type = typeMatch[1].trim();
  }

  // 3. 基礎種族值解析 (極致容錯)
  const baseStats = { hp: 100, atk: 100, def: 100, spatk: 100, spdef: 100, speed: 100 };
  let statsParsed = false;

  // 嘗試單獨提取
  const hpMatch = rawText.match(/體力\s*[:：]?\s*(\d+)/);
  const atkMatch = rawText.match(/攻擊\s*[:：]?\s*(\d+)/);
  const defMatch = rawText.match(/防禦\s*[:：]?\s*(\d+)/);
  const spatkMatch = rawText.match(/特攻\s*[:：]?\s*(\d+)/);
  const spdefMatch = rawText.match(/特防\s*[:：]?\s*(\d+)/);
  const speedMatch = rawText.match(/速度\s*[:：]?\s*(\d+)/);

  if (hpMatch) { baseStats.hp = parseInt(hpMatch[1], 10); statsParsed = true; }
  if (atkMatch) { baseStats.atk = parseInt(atkMatch[1], 10); statsParsed = true; }
  if (defMatch) { baseStats.def = parseInt(defMatch[1], 10); statsParsed = true; }
  if (spatkMatch) { baseStats.spatk = parseInt(spatkMatch[1], 10); statsParsed = true; }
  if (spdefMatch) { baseStats.spdef = parseInt(spdefMatch[1], 10); statsParsed = true; }
  if (speedMatch) { baseStats.speed = parseInt(speedMatch[1], 10); statsParsed = true; }

  // 如果單獨提取不全，嘗試經典一條龍正則
  if (!statsParsed || Object.values(baseStats).every(v => v === 100)) {
    const statsMatch = rawText.match(/體力\s*(\d+).*?攻擊\s*(\d+).*?防禦\s*(\d+).*?特攻\s*(\d+).*?特防\s*(\d+).*?速度\s*(\d+)/);
    if (statsMatch) {
      baseStats.hp = parseInt(statsMatch[1], 10);
      baseStats.atk = parseInt(statsMatch[2], 10);
      baseStats.def = parseInt(statsMatch[3], 10);
      baseStats.spatk = parseInt(statsMatch[4], 10);
      baseStats.spdef = parseInt(statsMatch[5], 10);
      baseStats.speed = parseInt(statsMatch[6], 10);
    }
  }
  elf.baseStats = baseStats;

  // 4. 魂印解析 (支援 【魂印 / 專屬特性】 - 名稱 \n 內容 或 【魂印】：名稱 \n 內容)
  const soulMarkBlock = rawText.match(/【(?:魂印|專屬特性|魂印 \/ 專屬特性)】\s*(?:-\s*|[:：]?\s*)?(.*?)\n([\s\S]*?)(?=\n\n|\n【核心技能組】|\n\[|$)/);
  if (soulMarkBlock) {
    elf.soulMark = {
      name: soulMarkBlock[1].trim(),
      description: soulMarkBlock[2].trim(),
      effectType: 'custom',
      effectValue: 0
    };
  } else {
    // 嘗試最寬鬆的提取：魂印名稱、魂印效果
    const looseSoulMark = rawText.match(/(?:魂印|專屬特性)\s*[:：]?\s*([^\n]+)\n([\s\S]*?)(?=\n\n|\n【核心技能組】|\n\[|$)/);
    if (looseSoulMark && !looseSoulMark[1].includes('【') && !looseSoulMark[1].includes('[')) {
      elf.soulMark = {
        name: looseSoulMark[1].trim(),
        description: looseSoulMark[2].trim(),
        effectType: 'custom',
        effectValue: 0
      };
    }
  }

  // 5. 核心技能組解析
  const skillsBlockMatch = rawText.match(/(?:【核心技能組】|核心技能組)([\s\S]*)$/);
  const skillsText = skillsBlockMatch ? skillsBlockMatch[1] : rawText;

  if (skillsText) {
    // 依據 [技能名] 切割每個技能區塊
    const skillParts = skillsText.split(/\[(?=[^\]]+\])/);
    
    skillParts.forEach(part => {
      const trimmedPart = part.trim();
      if (!trimmedPart) return;

      const nameEndIndex = trimmedPart.indexOf(']');
      if (nameEndIndex === -1) return;

      const skillName = trimmedPart.substring(0, nameEndIndex).trim();
      const remainingText = trimmedPart.substring(nameEndIndex + 1).trim();

      // 解析第一行（屬性、類別、第五技能）
      const lines = remainingText.split('\n');
      const firstLine = lines[0] || '';

      let skillType = '無屬性';
      let category: '物理' | '特殊' | '屬性' = '屬性';
      let isFifth = firstLine.includes('第五') || skillName.includes('第五');

      // 提取屬性與類別
      if (firstLine.includes('物理')) category = '物理';
      else if (firstLine.includes('特殊')) category = '特殊';
      else if (firstLine.includes('屬性')) category = '屬性';

      // 匹配屬性系（如 聖靈系, 聖靈, 水.暗影系 等）
      const typeExtract = firstLine.match(/([^\s]+?)系?(?:\s|$)/);
      if (typeExtract) {
        const potentialType = typeExtract[1].replace('技能', '').replace('物理', '').replace('特殊', '').replace('屬性', '').trim();
        if (potentialType && potentialType !== '物理' && potentialType !== '特殊' && potentialType !== '屬性') {
          skillType = potentialType;
        }
      }

      // 威力與 PP 提取
      let power = 0;
      let pp = 10;
      
      const powerMatch = remainingText.match(/威力\s*[:：]?\s*(\d+)/);
      if (powerMatch) power = parseInt(powerMatch[1], 10);

      const ppMatch = remainingText.match(/PP\s*[:：]?\s*(\d+)/);
      if (ppMatch) pp = parseInt(ppMatch[1], 10);

      // 效果描述提取：取得威力/PP 之後的全部内容，或效果：開頭的內容
      let skillDesc = '';
      const effectIndex = remainingText.indexOf('效果：') !== -1 ? remainingText.indexOf('效果：') + 3 : remainingText.indexOf('效果:') !== -1 ? remainingText.indexOf('效果:') + 3 : -1;
      if (effectIndex !== -1) {
        skillDesc = remainingText.substring(effectIndex).trim();
      } else {
        // 沒有"效果："關鍵字，跳過第一行、威力PP行，剩下當作描述
        skillDesc = lines.slice(1).filter(l => !l.includes('威力') && !l.includes('PP')).join('\n').trim();
      }

      if (power >= 160) {
        isFifth = true;
      }

      const skill: Skill = {
        name: skillName,
        type: skillType,
        category,
        power,
        pp,
        description: skillDesc,
        isFifthSkill: isFifth,
        priority: 0,
        accuracy: 100,
        effectType: 'none',
        effectDetail: ''
      };

      // 提取先制等級與必中屬性
      if (skillDesc.includes('先制+')) {
        const pMatch = skillDesc.match(/先制\+(\d+)/);
        if (pMatch) skill.priority = parseInt(pMatch[1], 10);
      } else if (skillDesc.includes('先制-')) {
        const pMatch = skillDesc.match(/先制-(\d+)/);
        if (pMatch) skill.priority = -parseInt(pMatch[1], 10);
      }

      if (skillDesc.includes('必中')) {
        skill.isSureHit = true;
      }

      elf.skills!.push(skill);
    });
  }

  // 確保精靈有名字
  if (!elf.name && elf.skills && elf.skills.length > 0) {
    elf.name = "自訂精靈";
  }

  return elf;
}
