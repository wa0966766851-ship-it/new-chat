import type { KitEntry } from '../effects/effectSystem.schema';
import { action } from './reviewedSequenceSkillKits';
import { BAPHOMET_SOUL_KIT } from './baphometSoulKit';
import { MIGRATED_MARK_SOUL_KITS } from './migratedMarkSoulKits';
import { MIGRATED_RESOURCE_SOUL_KITS } from './migratedResourceSoulKits';
import { MIGRATED_DIXIN_SOUL_KIT } from './migratedDixinSoulKit';
import { MIGRATED_SOBIRAT_SOUL_KIT } from './migratedSobiratSoulKit';
// 5032/5033/5034 魂印 Kit（DSH 20261015 接線）：核（寰宇星幻）／格（思維固化）／邪（魂珠三態）
import { MIGRATED_ASTRAL_AESFIA_SOUL_KIT } from './migratedAstralAesfiaSoulKit';
import { MIGRATED_ASTRAL_AESFIG_SOUL_KIT } from './migratedAstralAesfigSoulKit';
import { MIGRATED_MOGOS_SOUL_KIT } from './migratedMogosSoulKit';
import { MIGRATED_STAGE_KIND_SOUL_KIT } from './migratedStageKindSoulKit';
import {MIGRATED_STONE_SOUL_KIT} from './migratedStoneSoulKit';
// 5012 冰魄·柯爾德 魂印「冰」（DSH 20261017 第七批；keldSoul 通用件）
import { MIGRATED_KELD_SOUL_KIT } from './migratedKeldSoulKit';
// 5013 柯爾霍德 魂印「凕」（DSH 20261017 第八批）
import { MIGRATED_KEERHODE_SOUL_KIT } from './migratedKeerhodeSoulKit';
// arena_13 龍錄天鋒 魂印（DSH 20261017 第九批）
import { MIGRATED_ARENA13_SOUL_KIT } from './migratedArena13SoulKit';
// 5002 帝皇之盾 魂印「盾」（DSH 20261018 第十一批·第一波）
import { MIGRATED_IMPERIAL_SHIELD_SOUL_KIT } from './migratedImperialShieldSoulKit';
// arena_15 命運龍輪 莫伊萊 專屬特性（DSH 20261018 第十二批）
import { MIGRATED_MOIRAI_SOUL_KIT } from './migratedMoiraiSoulKit';
// 5015 混沌·布萊克 魂印「夜」（DSH 20261018 第十一批·第一波；statusSovereignty 通用件）
import { MIGRATED_NIGHT_SOUL_KIT } from './migratedNightSoulKit';
// 5025 恐懼的化身·咤克斯 魂印「懼」（DSH 20261018 第十三批·第一波；fearSeed 通用件）
import { MIGRATED_ZHAKESI_FEAR_SOUL_KIT } from './migratedZhakesiFearSoulKit';
// 5031 六界神王 魂印「界」（DSH 20261018 讀法B；realmSecrets＝既有 random_branch/資源印記）
import { MIGRATED_LIUJIE_SOUL_KIT } from './migratedLiujieSoulKit';
// 5030 聖靈邁爾斯 魂印「聖」（DSH 20261018 第十三批；holyMiles 通用件）
import { MIGRATED_HOLY_MILES_SOUL_KIT } from './migratedHolyMilesKits';
// arena_12 無為龍者 魂印「無為之境」＋五技（DSH 20261018 第十六批）
import { MIGRATED_ARENA12_WUWEI_SOUL_KIT } from './migratedArena12SkillKits';
import { MIGRATED_HAMO_LIN_SOUL_KIT } from './migratedHamoLinSoulKit';
import { MIGRATED_FINAL_DELU_SOUL_KIT, MIGRATED_FINAL_BELIENTE_SOUL_KIT } from './migratedFinalOdinDeluBelienteKits';
import { MIGRATED_FINAL_DRAGON_SOUL_KIT } from './migratedFinalMarsLanDragonKits';
import { MIGRATED_ARENA16_DRAGON_HEALING_SOUL_KIT } from './migratedArena16DragonHealingSoulKit';
import { MIGRATED_ARENA14_WUJI_SOUL_KIT } from './migratedArena14WujiSoulKit';
import { MIGRATED_5028_LAN_SOUL_KIT } from './migrated5028LanSoulKit';
import { MIGRATED_5014_CAN_SOUL_KIT } from './migrated5014CanSoulKit';
import { MIGRATED_5007_BRINKK_SOUL_KIT } from './migrated5007BrinkkSoulKit';
import { MIGRATED_5019_TIWAZ_SOUL_KIT } from './migrated5019TiwazSoulKit';
import { MIGRATED_5016_MECH_SOUL_KIT } from './migrated5016MechSoulKit';
import { MIGRATED_FINAL_EXTRA_SOUL_KITS } from './migratedFinalExtraTraitKits';
// 5018 蟲后·奧佩婭 魂印「后」（DSH 20261018 第十三批·第一波；rosterStats 通用件）
import { MIGRATED_OPEIA_SOUL_KIT } from './migratedOpeiaSoulKit';
// 組 5（龍魂雜項；DSH 20261018 最後衝刺）
import { MIGRATED_GROUP5_SEA_SOUL_KIT } from './migratedGroup5SeaSoulKit';
import { MIGRATED_GROUP5_HOLY_PUNI_SOUL_KIT } from './migratedGroup5HolyPuniSoulKit';
import { MIGRATED_REY_SOUL_KIT } from './migratedReyKits';
const entry=(node:KitEntry['node'],trig:string,raw:string,body:any[],order:number):KitEntry=>({codeId:'effect_sequence',source:'soulmark',role:'innate',node,order,customText:raw,params:{clause:{raw,trig,parsed:true,body}}});
/** 整份魂印才切換；獨立命中查詢與一次性致死，不借舊handler。 */
export const REVIEWED_SOUL_KITS=[BAPHOMET_SOUL_KIT,MIGRATED_REY_SOUL_KIT,...MIGRATED_MARK_SOUL_KITS,...MIGRATED_RESOURCE_SOUL_KITS,MIGRATED_DIXIN_SOUL_KIT,MIGRATED_SOBIRAT_SOUL_KIT,
  MIGRATED_ASTRAL_AESFIA_SOUL_KIT,MIGRATED_ASTRAL_AESFIG_SOUL_KIT,MIGRATED_MOGOS_SOUL_KIT,MIGRATED_STAGE_KIND_SOUL_KIT,MIGRATED_STONE_SOUL_KIT,MIGRATED_KELD_SOUL_KIT,MIGRATED_KEERHODE_SOUL_KIT,MIGRATED_ARENA13_SOUL_KIT,MIGRATED_IMPERIAL_SHIELD_SOUL_KIT,MIGRATED_MOIRAI_SOUL_KIT,MIGRATED_NIGHT_SOUL_KIT,MIGRATED_LIUJIE_SOUL_KIT,MIGRATED_ZHAKESI_FEAR_SOUL_KIT,MIGRATED_OPEIA_SOUL_KIT,MIGRATED_HOLY_MILES_SOUL_KIT,MIGRATED_ARENA12_WUWEI_SOUL_KIT,MIGRATED_HAMO_LIN_SOUL_KIT,MIGRATED_FINAL_DELU_SOUL_KIT,MIGRATED_FINAL_BELIENTE_SOUL_KIT,MIGRATED_FINAL_DRAGON_SOUL_KIT,MIGRATED_ARENA16_DRAGON_HEALING_SOUL_KIT,MIGRATED_ARENA14_WUJI_SOUL_KIT,MIGRATED_5028_LAN_SOUL_KIT,MIGRATED_5014_CAN_SOUL_KIT,MIGRATED_5007_BRINKK_SOUL_KIT,MIGRATED_5019_TIWAZ_SOUL_KIT,MIGRATED_5016_MECH_SOUL_KIT,...MIGRATED_FINAL_EXTRA_SOUL_KITS,MIGRATED_GROUP5_SEA_SOUL_KIT,MIGRATED_GROUP5_HOLY_PUNI_SOUL_KIT,{
  kind:'soul' as const,elfIds:['300'],name:'聖',description:'天生免疫每次受到的異常狀態\n每回合結束時恢復最大體力25%與所有技能1點PP值',kit:[
    entry('before_status_apply','before_status','天生免疫每次受到的異常狀態',[{acts:[action('status_guard',{cls:''})]}],0),
    entry('round_end','round_end','每回合結束恢復最大體力25%與所有技能1點PP',[{acts:[action('heal',{side:'self',ratio:.25}),action('pp_op',{side:'self',mode:'add',amount:1})]}],1),
  ],
},{
  kind:'soul' as const,elfIds:['5020'],name:'無',description:'無特殊魂印',kit:[entry('battle_start','battle_start','無特殊魂印',[{acts:[action('noop',{})]}],0)],
}, {
  kind:'soul' as const,elfIds:['5005'],name:'魔',description:'> 造成的攻擊傷害提升50%\n> 100%閃避對手所有技能（對必中技能失效）\n本場戰鬥僅限一次，死亡時：\n> 保留1點體力\n> 消除對手回合類效果\n> 100%令對手害怕',kit:[
    entry('before_damage','outgoing_attack','造成的攻擊傷害提升50%',[{acts:[action('dmg_mod',{dir:'out',kind:'攻擊',boost:.5})]}],0),
    {codeId:'soul_property',source:'soulmark',role:'innate',node:'passive_always',order:1,customText:'100%閃避對手所有技能（對必中技能失效）',params:{property:'evade',chance:100,kind:'all'}} as KitEntry,
    entry('self_fatal','fatal','本場戰鬥僅限一次，死亡時保留1點體力並消除對手回合類效果，同時100%令對手害怕',[{acts:[action('once',{key:'first-fatal-resistance',body:[{acts:[
      action('survive',{}),action('clear_turn',{side:'opp'}),action('status',{side:'opp',status:'害怕',chance:100,turns:3}),
    ]}]})]}],2),
  ],
}, {
  kind:'soul' as const,elfIds:['5004'],name:'翎',description:'自身使用攻擊技能時：\n> 100%令對手麻痺\n> 對手處於能力下降狀態時額外附加對手最大體力1/3的百分比傷害\n回合結束時自身體力低於1/2：\n> 消除對手回合類效果\n> 令對手全屬性-1\n自身首次受到致命傷害時：\n> 保留1點體力\n> 令對手進入麻痺狀態\n自身被擊敗時：\n> 消除對手回合類效果\n> 依次令對手進入麻痺、害怕、癱瘓狀態（三種異常各消耗1次免疫次數）\n自身位於背包時：\n> 對方切換登場有100%機率進入麻痺',kit:[
    entry('on_skill_use','self_attack','自身使用攻擊技能時100%令對手麻痺',[{acts:[action('status',{side:'opp',status:'麻痺',chance:100,turns:3})]}],0),
    entry('on_skill_use','self_attack','對手處於能力下降狀態時額外附加對手最大體力1/3的百分比傷害',[{cond:[{c:'stage',p:{side:'opp',kind:'down'},label:'對手能力下降'}],acts:[action('dmg',{base:'最大體力',of:'opp',ratio:1/3,type:'百分比'})]}],1),
    {...entry('round_end','round_end','回合結束時自身體力低於1/2，消除對手回合類效果並令對手全屬性-1',[{acts:[action('clear_turn',{side:'opp'}),action('stat',{side:'opp',stats:['全屬性'],v:-1})]}],2),params:{clause:{raw:'回合結束時自身體力低於1/2，消除對手回合類效果並令對手全屬性-1',trig:'round_end',parsed:true,cond:[{c:'hp_ratio',p:{side:'self',op:'低於',ratio:.5},label:'自身體力低於1/2'}],body:[{acts:[action('clear_turn',{side:'opp'}),action('stat',{side:'opp',stats:['全屬性'],v:-1})]}]}}},
    entry('self_fatal','fatal','自身首次受到致命傷害時保留1點體力並令對手麻痺',[{acts:[action('once',{key:'first-fatal-resistance',body:[{acts:[action('survive',{}),action('status',{side:'opp',status:'麻痺',chance:100,turns:3})]}]})]}],3),
    entry('cthyaat_death','defeated','自身被擊敗時消除對手回合類效果，依次附加麻痺、害怕、癱瘓（三種各消耗1次免疫）',[{acts:[action('clear_turn',{side:'opp'}),action('status_seq',{list:['麻痺','害怕','癱瘓'],chance:100})]}],4),
    entry('opponent_entered','bench','自身位於背包時，對方切換登場100%令其麻痺',[{acts:[action('status',{side:'opp',status:'麻痺',chance:100,turns:3})]}],5),
  ],
}];
