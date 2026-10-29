import type { KitEntry } from '../effects/effectSystem.schema';
import extraSoulText from './finalExtraSoulText.json';
const declaration=(raw:string,values:Record<string,number|boolean>,order:number):KitEntry=>({
  codeId:'effect_sequence',node:'passive_always',source:'mechanic',role:'innate',order,customText:raw,
  params:{clause:{raw,trig:'passive',parsed:true,body:[{acts:Object.entries(values).map(([key,value])=>({op:'advanced_mechanic',p:{key,value},label:raw}))}]}}
});
const WARRIOR='【無我】每次受到異常狀態時立即轉化為平靜，若轉化的異常中帶有狂暴則轉化觸發後令自身平靜異常回合數翻倍。\n【戰士】戰鬥中始終被視為異能精靈；自身戰鬥開始時與每次登場時獲得隱匿；自身下場後若己方隱匿精靈不超過3個，則恢復下隻出戰精靈所有技能PP值並附加隱匿印記；自身造成攻擊傷害時計算傷害始終以弱點傷害計算，計算弱點時若對方每存在1點護盾、1%傷害減少時弱點傷害則計算傷害時對手剩餘雙防值60%效果額外降低1%，最低降低至1；自身攻擊克制倍數取技能擁有的屬性中攻擊對手的最優克制系別計算傷害；自身攻擊無視對手攻擊免疫效果、傷害限制效果、免疫、抵擋、轉化傷害效果與護盾承傷效果。';
const CASTER='【修復】\n己方其他精靈受到任意衍化類異常時，當回合戰鬥階段時會立即衍化並恢復自身與該精靈所有技能1點PP值與250點體力\n\n【咒術師】\n>戰鬥中被視為異能精靈\n每次登場時:\n>召喚與自身能力值相等的賽博怨靈作為額外精靈加入己方(特防始終與無序·蝕言經過專屬特性調整過後的特防保持一致)\n>自身下場後則怨靈死亡並消逝\n常駐效果:\n>賽博怨靈存在時自身詛咒類異常回合數不會減少\n自身選擇技能時:\n>若自身處於任一種詛咒類狀態則選擇技能時消耗該技能1點PP值\n>>賽博怨靈於行動階段發動1次魔咒(進行1次額外行動，以機械.暗影、機械、暗影系中克制倍數最高的屬性直接造成所選技能威力值+n點傷害並附加自身等同於傷害值的護盾與護罩(n=自身當前詛咒回合數)同時恢復自身等量體力值，同時隨機令敵方場下其中1隻精靈受到n乘以50%的真實傷害)\n>若戰鬥階段結束時若未選擇使用技能則改為賽博怨靈於該階段發動1次滅靈魔咒(進行1次額外行動，以機械.暗影、機械、暗影系中克制倍數最高的屬性直接造成技能中威力最高者的威力值+n點傷害並附加自身等同於傷害值的護盾與護罩(n=自身當前詛咒回合數)同時恢復自身等量體力值，同時隨機令敵方場下其中1隻精靈受到n乘以50%的真實傷害)\n>自身死亡時\n>>若存在怨靈會代替自身死亡以保留無序·蝕言20%體力(每次登場僅觸發1次)\n>>此後賽博怨靈執行上述效果中額外行動時對敵方場下造成真實傷害比例翻倍';
const THROWER='【豪邁】自身攻擊時忽略對手50%雙防值。\n【投石者】戰鬥中被視為異能精靈；技能位可攜帶4種不同屬性的技能石且使用任意技能石時轉化為使用同屬系的SS級技能石，威力變為240(無法裝備重複屬性)；若自身攜帶4個技能石技能則在戰鬥中擁有神話(免疫異常狀態、能力下降狀態、PP值無限)且造成攻擊傷害提升50%，受到攻擊傷害降低50%且戰鬥階段結束時恢復自身最大體力25%；裝備的技能石擁有本系加乘且PP值上限+10；若該技能石為完美技能石則機率效果觸發概率提升為100%；每次使用技能石時令對手背包內所有精靈受到傷害值25%*該技能石對受到傷害精靈當前克制倍數的真實傷害；遭受致死傷害時保留1點體力。';
export const MIGRATED_FINAL_EXTRA_TRAIT_KITS=[{
  kind:'trait' as const,elfIds:['5022'],name:'無我 / 戰士',description:WARRIOR,kit:[
    declaration('每次受到異常狀態時立即轉化為平靜',{convertStatusToSerenity:true},0),
    declaration('轉化的異常帶有狂暴則平靜回合數翻倍',{doubleSerenityTurnsIfFurious:true},1),
    declaration('戰鬥中始終被視為異能精靈',{alwaysAlienElf:true},2),
    declaration('戰鬥開始時與每次登場時獲得隱匿',{enterGainConceal:true},3),
    declaration('下場後己方隱匿精靈不超過3個則恢復下隻PP並附加隱匿',{switchOutInheritConceal:true},4),
    declaration('攻擊傷害以弱點傷害計算',{alwaysWeaknessDamage:true},5),
    declaration('每1點護盾、1%傷害減少額外降低弱點雙防1%，最低1',{weaknessShieldReductionPercent:1},6),
    declaration('攻擊屬性取最佳克制系別',{bestElementAdvantage:true},7),
    declaration('攻擊無視免疫、傷害限制、抵擋、轉化、護盾承傷',{ignoreImmuneShieldEffects:true},8),
  ]
},{
  kind:'trait' as const,elfIds:['5023'],name:'修復 / 咒術師',description:CASTER,kit:[
    declaration('其他隊員受到衍化類異常立即衍化、雙方恢復1PP與250HP',{repairOnOtherDeriveStatus:true,repairHealAmount:250,repairPpRestore:1},0),
    declaration('戰鬥中被視為異能精靈',{alwaysAlienElf:true},1),
    declaration('登場召喚同能力值怨靈',{cyberWraithSummon:true},2),
    declaration('自身下場後怨靈死亡消逝',{cyberWraithVanishOnSwitch:true},3),
    declaration('怨靈存在時詛咒回合數不減少',{wraithExistCurseNoReduce:true},4),
    declaration('選擇技能時處於詛咒則消耗該技能1PP',{cursePpTax:1},5),
    declaration('行動階段怨靈發動魔咒',{wraithActionSpell:true},6),
    declaration('戰鬥階段結束未選擇技能發動滅靈魔咒',{wraithEndSpellIfNoSkill:true},7),
    declaration('每次登場怨靈代死一次保留20%體力',{wraithSubstituteDeathOnce:true,wraithSubstituteDeathHpRatio:.2},8),
    declaration('替死後對敵方場下真實傷害比例翻倍',{wraithSpellDamageDoubleAfterSub:true},9),
  ]
},{
  kind:'trait' as const,elfIds:['5026'],name:'豪邁 / 投石者',description:THROWER,kit:[
    declaration('攻擊忽略對手50%雙防',{ignoreDefPercent:.5},0),
    declaration('戰鬥中被視為異能精靈',{alwaysAlienElf:true},1),
    declaration('可攜四種不同技能石、轉化同系SS級威力240',{isStoneThrower:true,forceSSSkillStonePower:240},2),
    declaration('攜四個技能石獲得神話',{mythologyWith4Stones:true},3),
    declaration('攜四個技能石攻擊傷害提升50%',{damageBoost4Stones:.5},4),
    declaration('攜四個技能石受到攻擊傷害降低50%',{damageReduce4Stones:.5},5),
    declaration('攜四個技能石戰鬥階段結束恢復25%體力',{turnEndHeal4Stones:.25},6),
    declaration('技能石具有本系加乘且PP上限+10',{stoneTypeMatchBoost:true},7),
    declaration('完美技能石機率效果提升至100%',{perfectStoneRate100:true},8),
    declaration('使用技能石對敵方場下造成傷害25%乘當前克制的真實傷害',{stoneUseOfffieldTrueDamagePercent:.25},9),
    declaration('遭受致死傷害保留1體力',{firstFatalSurviveAt1Hp:true},10),
  ]
}];
const soulEntry=(node:KitEntry['node'],trig:string,raw:string,body:any[],order:number):KitEntry=>({
  codeId:'effect_sequence',source:'soulmark',role:'innate',node,order,customText:raw,params:{clause:{raw,trig,parsed:true,body}},
});
const exchange=(when:string)=>({op:'entry_hp_exchange',p:{key:'entry_health_exchange',selfRatio:1/6,oppRatio:1/6,maxHpMultiple:6,healPrevious:true,when},label:'依真實扣血交換體力上限'});
export const MIGRATED_FINAL_EXTRA_SOUL_KITS=[{
  kind:'soul' as const,elfIds:['5023'],name:'蝕言',
  description: extraSoulText.shiyanSoul,
  kit:[
    soulEntry('round_start','round_start','若自身不處於詛咒則敵我雙方詛咒3回合',[
      {cond:[{c:'has_status',p:{side:'self',status:'詛咒',neg:true},label:'自身不處於詛咒'}],acts:[
        {op:'status',p:{side:'self',status:'詛咒',turns:3,chance:100},label:'自身詛咒'},
        {op:'status',p:{side:'opp',status:'詛咒',turns:3,chance:100},label:'對手詛咒'},
      ]}
    ],0),
    soulEntry('battle_phase_end','phase_end','將自身異常轉化為詛咒且詛咒回合翻倍',[
      {acts:[{op:'status_convert_scale',p:{status:'詛咒',mult:2,defaultTurns:3,fromClass:'non_auxiliary'},label:'轉化詛咒後回合翻倍'}]}
    ],1),
    soulEntry('passive_always','passive','存活時將自身與場下隊員特防調整至自身原特防十分之一、無條件進位',[
      {acts:[{op:'team_stat_anchor',p:{stat:'spdef',divisor:10,rounding:'ceil',scope:'self_and_bench'},label:'隊伍特防錨定'}]}
    ],2),
    soulEntry('passive_always','passive','存活時對手特殊攻擊以特攻面板計算，再按自身最終特防每點減少1%；死亡解除',[
      {acts:[{op:'special_attack_panel_formula',p:{panel:'spatk',defense:'spdef',reductionPerPoint:.01},label:'替換特殊攻擊公式'}]}
    ],3),
  ]
},{
  kind:'soul' as const,elfIds:['5022'],name:'專屬特性',
  description: extraSoulText.liurenSoul,
  kit:[
    soulEntry('on_entered','entrance','每次出戰時紀錄原始體力上限，恢復體力不得超過該值',[
      {acts:[{op:'entry_hp_snapshot',p:{key:'entry_health_exchange'},label:'記錄出戰原始上限與恢復上限'}]}
    ],0),
    soulEntry('on_entered','entrance','雙方受到各自最大體力⅙真傷，上一位恢復實際總和並轉為6倍臨時上限',[
      {acts:[exchange('entrance')]}
    ],1),
    soulEntry('opponent_entered','team_entrance','對手主動或死亡切換時再次出戰衝擊並將原臨時額度永久化',[
      {acts:[exchange('opponent_entry')]}
    ],2),
    soulEntry('on_status_received','status_received','自身進入異常狀態再次觸發出戰衝擊並將原臨時額度永久化',[
      {acts:[exchange('status')]}
    ],3),
    soulEntry('on_switch_out','switch_out','自身下場後移除尚未永久化的臨時體力上限',[
      {acts:[{op:'entry_hp_release',p:{key:'entry_health_exchange'},label:'撤回當次臨時上限'}]}
    ],4),
    soulEntry('before_damage','outgoing','非真傷提升120%；每降低0.1%體力另提升120%，低於½翻倍',[
      {acts:[{op:'missing_hp_damage_boost',p:{baseBoost:1.2,step:.001,stepBoost:1.2,doubleBelow:.5},label:'按本次體力計算增傷'}]}
    ],5),
    soulEntry('on_damaged','damaged_true','受到真傷後2回合抵擋技能、固傷與百分比上限60，直到下回合結束前不受體力限制',[
      {acts:[{op:'damage_survival_guard',p:{guardTurns:2,deathImmuneTurns:3,fixedPercentCap:60,preserveOffField:true},label:'建立有限期非正體力存活'}]}
    ],6),
    soulEntry('on_skill_use','self_skill','使用技能恢復自身最大體力⅙並造成等量百分比傷害',[
      {acts:[{op:'heal_then',p:{side:'self',ratio:1/6,body:[{acts:[{op:'dmg_from_last',p:{ratio:1,type:'百分比'},label:'等同實際恢復量百分比傷害'}]}]},label:'恢復結算後造成等量傷害'}]}
    ],7),
  ]
}];
