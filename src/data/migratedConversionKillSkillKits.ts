import type {ReviewedSequenceSkill} from './reviewedSequenceSkillKits';
import {action,property,sequence} from './reviewedSequenceSkillKits';
const reverse='反轉自身能力下降狀態';
const pp='出手時自身不處於能力下降狀態則恢復自身所有技能2點PP值';
const convert='2回合內將受到的攻擊傷害轉化為自身體力';
const kill='15%秒殺對手，若對手處於燒傷狀態，則提升至30%概率秒殺對手';
const next='下次擊敗對手時，令對方下隻出戰精靈出戰時進入焚燼狀態。';
export const MIGRATED_CONVERSION_KILL_SKILL_KITS:ReviewedSequenceSkill[]=[{
  elfIds:['5006'],name:'星光·絕命火焰',description:['必中',reverse,pp,convert,kill,next].join('；'),
  kit:[
    property('必中','sure_hit',true,0),
    // 同次出手的前置快照：原有下降即使已反轉，也不能補發無下降的PP獎勵。
    sequence(reverse+'；'+pp,[
      {acts:[action('stat_reverse',{side:'self',kind:'down'})]},
      {cond:[{c:'stage',p:{side:'self',kind:'down',neg:true},label:'出手時自身無能力下降'}],acts:[action('pp_op',{side:'self',mode:'add',amount:2})]},
    ],1),
    sequence(convert,[{acts:[action('damage_to_heal_turns',{turns:2,kind:'攻擊',next:false})]}],2),
    {codeId:'effect_sequence',node:'on_hit',source:'skill',role:'attached',order:3,customText:kill,
      params:{clause:{raw:kill,trig:'after_hit',parsed:true,body:[
        {cond:[{c:'has_status',p:{side:'opp',status:'燒傷'},label:'對手處於燒傷'}],acts:[action('instant_kill',{chance:30})],elseActs:[action('instant_kill',{chance:15})]},
      ]}}},
    sequence(next,[{acts:[action('watch',{trig:'kill',body:[{acts:[action('next_entry_status',{status:'焚燼',turns:3})]}]})]}],4),
  ],
}];
