const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'elf_data.json');
if (!fs.existsSync(dataPath)) {
  console.log('找不到 elf_data.json，請先建立此檔案。');
  process.exit(1);
}

const elfData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const targetFile = path.join(__dirname, '../src/data/defaultElves.ts');
let tsContent = fs.readFileSync(targetFile, 'utf8');

let updatedCount = 0;
for (const [elfName, data] of Object.entries(elfData)) {
  const { height, weight, gender, destinyRank } = data;
  
  // 1. 找到該精靈的定義區塊 (從 name: "精靈名稱", 到 baseStats: { 之間)
  const blockRegex = new RegExp(`(name:\\s*["']${elfName}["'],[\\s\\S]*?)(baseStats:)`, 'g');
  
  if (tsContent.match(blockRegex)) {
    tsContent = tsContent.replace(blockRegex, (match, before, after) => {
      // 2. 清除該區塊內舊有的 height, weight, gender, destinyRank 屬性
      let cleanBefore = before
        .replace(/\s*height:\s*\d+,?/g, '')
        .replace(/\s*weight:\s*\d+,?/g, '')
        .replace(/\s*gender:\s*["'][^"']*["'],?/g, '')
        .replace(/\s*destinyRank:\s*["'][^"']*["'],?/g, '');
        
      // 3. 準備要注入的新屬性
      let injections = [];
      if (height !== undefined) injections.push(`height: ${height}`);
      if (weight !== undefined) injections.push(`weight: ${weight}`);
      if (gender !== undefined) injections.push(`gender: "${gender}"`);
      if (destinyRank !== undefined) injections.push(`destinyRank: "${destinyRank}"`);
      
      const injectStr = injections.length > 0 ? '    ' + injections.join(',\n    ') + ',\n    ' : '    ';
      
      // 修剪 cleanBefore 結尾的多餘空行，保持排版整齊
      cleanBefore = cleanBefore.trimEnd() + '\n';
      
      return `${cleanBefore}${injectStr}${after}`;
    });
    updatedCount++;
    console.log(`成功更新精靈: ${elfName}`);
  }
}

fs.writeFileSync(targetFile, tsContent, 'utf8');
console.log(`更新完成！總共更新了 ${updatedCount} 隻精靈。`);
