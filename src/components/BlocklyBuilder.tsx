import React, { useEffect, useRef, useState, useCallback } from "react";
import type * as Blockly from "blockly/core";
import * as ModularBlockly from '../vendor/blockly/index.js';
import * as BlocklyMessages from "blockly/msg/en";
import { SEER_TYPES } from '../utils/statCalculator';
import { KitEntry, Node } from "../effects/effectSystem.schema";
import { validateKit } from '../effects/kitValidation';
import { Puzzle, Play, Code2, Trash2, RefreshCw, Layers, Sparkles, Check, Copy, BookmarkPlus, Download, Plus, Search } from "lucide-react";

// Ensure custom blocks are defined once
// 固定版本官方來源的 ESM 群組；保留公開 API、事件名稱與 JSON 存檔。
const Core = ModularBlockly as unknown as Pick<typeof Blockly, 'inject'|'setLocale'|'defineBlocksWithJsonArray'|'Events'|'svgResize'|'Theme'|'Themes'|'Workspace'|'serialization'>;
let blocksDefined = false;
// 畫布只使用本檔的精靈效果積木，不載入未使用的通用程式積木庫。
Core.setLocale(Object.fromEntries(
  Object.entries(BlocklyMessages).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
));

export function defineCustomBlocks() {
  if (blocksDefined) return;
  blocksDefined = true;

  Core.defineBlocksWithJsonArray([
    { type: 'native_effect_reference', message0: '🔒 保留原機制 %1', args0: [{type: 'field_label_serializable', name: 'LABEL', text: '專屬效果'}], previousStatement: null, nextStatement: null, colour: 280,
      tooltip: '這項機制目前沒有可編輯欄位，原資料完整保留；移動不會改變參數，刪除才會移除。' },
    // ==========================================
    // 1. 時點槽積木 (Timing Node Blocks)
    // ==========================================
    {
      "type": "node_on_hit",
      "message0": "⚡ [時點槽] 技能命中時 (on_hit) %1 %2",
      "args0": [
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 190,
      "tooltip": "當技能命中對手時發動的效果"
    },
    {
      "type": "node_round_start",
      "message0": "⏰ [時點槽] 回合開始時 (round_start) %1 %2",
      "args0": [
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 210,
      "tooltip": "每回合開始階段觸發"
    },
    {
      "type": "node_round_end",
      "message0": "🌙 [時點槽] 回合結束時 (round_end) %1 %2",
      "args0": [
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 230,
      "tooltip": "每回合結束結算時觸發"
    },
    {
      "type": "node_battle_start",
      "message0": "⚔️ [時點槽] 戰鬥開始時 (battle_start) %1 %2",
      "args0": [
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 260,
      "tooltip": "整場對戰開始時觸發"
    },
    {
      "type": "node_on_entered",
      "message0": "🚀 [時點槽] 登場切換時 (on_entered) %1 %2",
      "args0": [
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 280,
      "tooltip": "精靈切換進入戰場時觸發"
    },
    {
      "type": "node_before_action",
      "message0": "🏃 [時點槽] 出手流程前 (before_action) %1 %2",
      "args0": [
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 300,
      "tooltip": "雙方選擇行動後、出手前發動"
    },
    {
      "type": "node_before_skill",
      "message0": "🎯 [時點槽] 使用技能前 (before_skill) %1 %2",
      "args0": [
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 320,
      "tooltip": "自身選擇釋放技能前發動"
    },
    {
      "type": "node_on_damaged",
      "message0": "🛡️ [時點槽] 受到傷害時 (on_damaged) %1 %2",
      "args0": [
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 340,
      "tooltip": "遭對手攻擊扣血時觸發"
    },
    {
      "type": "node_before_damage",
      "message0": "🧮 [時點槽] 傷害計算時 (before_damage) %1 %2",
      "args0": [
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 10,
      "tooltip": "傷害倍率／減傷／必定致命一擊／無視減傷請放這裡（自身攻擊時算加成，受到攻擊時算減傷）"
    },
    {
      "type": "node_modify_priority",
      "message0": "🚀 [時點槽] 先制判定時 (modify_priority) %1 %2",
      "args0": [
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 10,
      "tooltip": "先制加成請放這裡"
    },
    {
      "type": "node_on_kill",
      "message0": "☠️ [時點槽] 擊敗對手時 (on_kill) %1 %2",
      "args0": [
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 10,
      "tooltip": "擊敗對方時觸發"
    },
    {
      "type": "custom_node_slot",
      "message0": "📂 [自訂槽位] 名稱: %1 對應時點: %2 %3 %4",
      "args0": [
        { "type": "field_input", "name": "SLOT_NAME", "text": "護盾防禦模組" },
        {
          "type": "field_dropdown",
          "name": "TARGET_NODE",
          "options": [
            ["技能命中時 (on_hit)", "on_hit"],
            ["回合開始時 (round_start)", "round_start"],
            ["回合結束時 (round_end)", "round_end"],
            ["登場切換時 (on_entered)", "on_entered"],
            ["出手流程前 (before_action)", "before_action"],
            ["使用技能前 (before_skill)", "before_skill"],
            ["受到傷害時 (on_damaged)", "on_damaged"],
            ["擊敗對手時 (on_kill)", "on_kill"],
            ["傷害計算時 (before_damage)", "before_damage"],
            ["先制判定時 (modify_priority)", "modify_priority"],
            ["行動結束後 (after_action)", "after_action"]
          ]
        },
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "STACK" }
      ],
      "colour": 45,
      "tooltip": "自訂具名分組槽，純組織整理用途，底層對應戰鬥時點"
    },

    // ==========================================
    // 2. 容器與具名印記積木 (Containers & Custom Marks)
    // ==========================================
    {
      "type": "turn_effect_apply",
      "message0": "⏳ [容器/印記] 具名: %1 印記字: %2 持續: %3 回合 %4 模式: %5 可消除: %6 %7 內部包裹效果: %8",
      "args0": [
        { "type": "field_input", "name": "TIMER_NAME", "text": "黯痕印記" },
        { "type": "field_input", "name": "DISPLAY_CHAR", "text": "黯" },
        { "type": "field_number", "name": "DURATION", "value": 3, "min": 1, "max": 10 },
        { "type": "input_dummy" },
        {
          "type": "field_dropdown",
          "name": "APPLY_MODE",
          "options": [
            ["🛡️ 閘門被動 (gate)", "gate"],
            ["🔄 每回合觸發 (per_tick)", "per_tick"],
            ["💥 到期發動 (on_expire)", "on_expire"]
          ]
        },
        { "type": "field_checkbox", "name": "CLEARABLE", "checked": true },
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "WRAPS_STACK" }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 180,
      "tooltip": "把一個或多個原子效果包裝為具名持續效果/印記包"
    },
    {
      "type": "condition_gate",
      "message0": "🔀 [容器] 條件閘門: 當 %1 數值: %2 %3 執行內部效果: %4",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "COND_TYPE",
          "options": [
            ["自身體力低於 N%", "hp_below"],
            ["自身體力高於 N%", "hp_above"],
            ["自身擁有護盾屏障", "has_shield"],
            ["先出手時", "is_first"],
            ["後出手時", "is_second"]
          ]
        },
        { "type": "field_number", "name": "COND_VAL", "value": 50, "min": 0, "max": 100 },
        { "type": "input_dummy" },
        { "type": "input_statement", "name": "INNER_STACK" }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 30,
      "tooltip": "滿足指定戰鬥條件時，才會觸發內部的效果"
    },

    // ==========================================
    // 3. 傷害類原子積木 (Red / Damage)
    // ==========================================
    {
      "type": "atom_extra_damage",
      "message0": "💥 [原子] 追加傷害: 對 %1 數值 %2 類型 %3 取值 %4 屬性 %5",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["對手", "opponent"], ["自身", "self"]]
        },
        { "type": "field_number", "name": "AMOUNT", "value": 150, "min": 0, "max": 5000 },
        {
          "type": "field_dropdown",
          "name": "DAMAGE_TYPE",
          "options": [["固定傷害 (fixed)", "fixed"], ["最大HP%% (percent)", "percent"], ["X系技能傷害 (skill)", "skill"], ["真實傷害 (true)", "true"]]
        },
        { "type": "field_dropdown", "name": "AMOUNT_MODE", "options": [["點數", "flat"], ["目標最大體力%%", "max_hp_percent"]] },
        { "type": "field_dropdown", "name": "ELEMENT", "options": SEER_TYPES.map(type => [type, type]) }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 0,
      "tooltip": "類別與取值分開：固定／百分比由護罩承受，X系技能由護盾承受，真實穿透兩者。直接命中附加走攻擊傷害節點，延遲觸發走技能效果節點。"
    },
    {
      "type": "atom_damage_multiplier",
      "message0": "⚔️ [原子] 傷害倍率: 乘以 %1 倍 類別(JSON): %2",
      "args0": [
        { "type": "field_number", "name": "MULTIPLICITY", "value": 1.5, "min": 0, "max": 1000, "precision": 0.1 },
        { "type": "field_input", "name": "DAMAGE_TYPES", "text": "[\"non_true\"]" }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 0,
      "tooltip": "依類別(JSON)提升造成的傷害。skill：普通攻擊、X系及額外行動；attack：普通攻擊子類；non_true：技能、固定、百分比，排除真傷與體力調整。"
    },
    {
      "type": "atom_damage_reduce",
      "message0": "🛡️ [原子] 減傷: 減少 %1 %% 傷害 類別(JSON): %2",
      "args0": [
        { "type": "field_number", "name": "PERCENT", "value": 50, "min": 0, "max": 100 },
        { "type": "field_input", "name": "DAMAGE_TYPES", "text": "[\"non_true\"]" }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 0,
      "tooltip": "依類別(JSON)減少受到的傷害。skill包含普通攻擊、X系及額外行動；attack只限攻擊；non_true排除真傷與體力調整。真實傷害不受一般減傷。"
    },
    {
      "type": "atom_damage_reflect",
      "message0": "🪞 [原子] 傷害反彈: 將受到的傷害 %1 %% 反彈給 %2 類型 %3 屬性 %4",
      "args0": [
        { "type": "field_number", "name": "PERCENT", "value": 50, "min": 0, "max": 200 },
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["對手", "opponent"], ["自身", "self"]]
        },
        { "type": "field_dropdown", "name": "DAMAGE_TYPE", "options": [["固定", "fixed"], ["百分比", "percent"], ["技能", "skill"], ["真實", "true"]] },
        { "type": "field_dropdown", "name": "ELEMENT", "options": SEER_TYPES.map(type => [type, type]) }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 0,
      "tooltip": "將受到的攻擊傷害按比例反彈"
    },
    {
      "type": "atom_drain_hp",
      "message0": "🩸 [原子] 吸取體力: 吸取 %1 %2 類型 %3 取值 %4 屬性 %5 補充自身",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["對手", "opponent"], ["自身", "self"]]
        },
        { "type": "field_number", "name": "AMOUNT", "value": 100, "min": 0, "max": 1000000 },
        { "type": "field_dropdown", "name": "DAMAGE_TYPE", "options": [["固定", "fixed"], ["百分比", "percent"], ["技能", "skill"], ["真實", "true"]] },
        { "type": "field_dropdown", "name": "AMOUNT_MODE", "options": [["點數", "flat"], ["目標最大體力%%", "max_hp_percent"]] },
        { "type": "field_dropdown", "name": "ELEMENT", "options": SEER_TYPES.map(type => [type, type]) }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 0,
      "tooltip": "吸取對手 HP 補充自身"
    },

    // ==========================================
    // 4. 資源與恢復原子積木 (Green / Resource)
    // ==========================================
    {
      "type": "atom_heal",
      "message0": "💚 [原子] 恢復體力: 為 %1 恢復 %2 %3",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["自身", "self"], ["對手", "opponent"]]
        },
        { "type": "field_number", "name": "AMOUNT", "value": 50, "min": 1, "max": 2000 },
        {
          "type": "field_dropdown",
          "name": "MODE",
          "options": [["百分比 (%%)", "percent"], ["固定值 (HP)", "fixed"]]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 120,
      "tooltip": "恢復指定體力"
    },
    {
      "type": "atom_shield",
      "message0": "🛡️ [原子] 護盾屏障: 獲得 %1 點護盾",
      "args0": [
        { "type": "field_number", "name": "AMOUNT", "value": 200, "min": 10, "max": 5000 }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 120,
      "tooltip": "吸收接下來受到的傷害"
    },
    {
      "type": "atom_pp_op",
      "message0": "⚡ [原子] PP操作: 使 %1 %2 %3 點 PP",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["對手所有技能", "opponent"], ["自身當前技能", "self"]]
        },
        {
          "type": "field_dropdown",
          "name": "MODE",
          "options": [["扣除/減少", "reduce"], ["吸取", "drain"], ["恢復", "recover"]]
        },
        { "type": "field_number", "name": "AMOUNT", "value": 1, "min": 1, "max": 10 }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 120,
      "tooltip": "減少或恢復技能 PP 值"
    },
    {
      "type": "atom_maxhp_change",
      "message0": "❤️ [原子] 最大體力變更: 使 %1 最大體力 %2 %3 點",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["自身", "self"], ["對手", "opponent"]]
        },
        {
          "type": "field_dropdown",
          "name": "MODE",
          "options": [["增加", "add"], ["減少", "reduce"]]
        },
        { "type": "field_number", "name": "AMOUNT", "value": 100, "min": 10, "max": 2000 }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 120,
      "tooltip": "動態擴展或扣減精靈最大 HP 上限"
    },

    // ==========================================
    // 5. 狀態與能力原子積木 (Purple / Status & Stats)
    // ==========================================
    {
      "type": "atom_apply_status",
      "message0": "💫 [原子] 施加異常: 對 %1 施加 %2 %3 回合 (概率 %4 %%)",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["對手", "opponent"], ["自身", "self"]]
        },
        {
          "type": "field_dropdown",
          "name": "STATUS_NAME",
          "options": [
            ["麻痺", "麻痺"], ["中毒", "中毒"], ["燒傷", "燒傷"],
            ["害怕", "害怕"], ["凍傷", "凍傷"], ["衰弱", "衰弱"],
            ["睡眠", "睡眠"], ["混亂", "混亂"], ["流血", "流血"]
          ]
        },
        { "type": "field_number", "name": "DURATION", "value": 2, "min": 1, "max": 10 },
        { "type": "field_number", "name": "CHANCE", "value": 100, "min": 1, "max": 100 }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 270,
      "tooltip": "施加具名的控制或異常狀態"
    },
    {
      "type": "atom_cure_status",
      "message0": "🩹 [原子] 解除異常: 解除 %1 的所有異常狀態",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["自身", "self"], ["對手", "opponent"]]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 270,
      "tooltip": "淨化並解除異常狀態"
    },
    {
      "type": "atom_stat_change",
      "message0": "📈 [原子] 屬性強化: 使 %1 的 %2 %3 階",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["自身", "self"], ["對手", "opponent"]]
        },
        {
          "type": "field_dropdown",
          "name": "STAT_NAME",
          "options": [
            ["全屬性", "all"], ["攻擊", "atk"], ["防禦", "def"],
            ["特攻", "spAtk"], ["特防", "spDef"], ["速度", "speed"], ["命中", "accuracy"]
          ]
        },
        {
          "type": "field_dropdown",
          "name": "STAGES",
          "options": [["+1", "1"], ["+2", "2"], ["+3", "3"], ["-1", "-1"], ["-2", "-2"], ["-3", "-3"]]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 270,
      "tooltip": "提升或降低能力等級"
    },
    {
      "type": "atom_clear_stat",
      "message0": "✨ [原子] 能力消除: 清除 %1 的 %2",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["對手", "opponent"], ["自身", "self"]]
        },
        {
          "type": "field_dropdown",
          "name": "STAT_TYPE",
          "options": [["能力提升 (boost)", "boost"], ["能力下降 (drop)", "drop"], ["所有能力等級 (all)", "all"]]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 270,
      "tooltip": "消除對手或自身的增益/減益能力等級"
    },
    {
      "type": "atom_immune",
      "message0": "🔰 [原子] 技能免疫: 獲得 %1 免疫",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "IMMUNE_TYPE",
          "options": [["技能效果", "all"]]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 270,
      "tooltip": "免疫對方技能或異常"
    },

    // ==========================================
    // 6. 控制與特殊原子積木 (Blue / Control & Special)
    // ==========================================
    {
      "type": "atom_priority",
      "message0": "🚀 [原子] 先制加成: 技能先制 %1",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "LEVEL",
          "options": [["+1", "1"], ["+2", "2"], ["+3", "3"], ["+4", "4"], ["-1", "-1"]]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "提升或降低技能先制等階"
    },
    {
      "type": "atom_accuracy",
      "message0": "🎯 [原子] 必中/命中率: 修正為 %1",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "MODE",
          "options": [["必中技能 (sure_hit)", "sure_hit"], ["命中提升 (boost)", "boost"], ["命中降低 (drop)", "drop"]]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "修改技能命中率或強制必中"
    },
    {
      "type": "atom_crit",
      "message0": "💥 [原子] 致命一擊: %1",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "MODE",
          "options": [["必定致命一擊", "must_crit"]]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "確保或提高技能觸發致命一擊"
    },
    {
      "type": "atom_pierce",
      "message0": "🗡️ [原子] 無視防禦/護盾: 攻擊無視 %1",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "PIERCE_TYPE",
          "options": [["減傷與護盾（轉真實傷害）", "all"]]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "無視敵方防禦狀態或護盾"
    },
    {
      "type": "atom_extra_action",
      "message0": "⏩ [原子] 連動行動: 本回合再獲一次額外行動",
      "args0": [],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "觸發連擊或額外行動輪"
    },
    {
      "type": "atom_vanish",
      "message0": "👻 [原子] 消逝: 自身離場",
      "args0": [],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "自身精靈消逝離場"
    },
    {
      "type": "atom_rebirth",
      "message0": "🐣 [原子] 免死: %1 回合內受到致命傷害時殘留1點體力",
      "args0": [
        { "type": "field_number", "name": "TURNS", "value": 2, "min": 1, "max": 10 }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "期間內體力不會因傷害降至0"
    },
    {
      "type": "atom_summon_extra",
      "message0": "👥 [原子] 召喚助戰: 召喚助戰精靈: %1",
      "args0": [
        { "type": "field_input", "name": "ELF_NAME", "text": "靈獸幻影" }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "召喚副精靈或影子助戰"
    },
    {
      "type": "atom_mark_op",
      "message0": "🏷️ [原子] 印記變更: 使 %1 的印記 %2 %3 層",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["自身", "self"], ["對手", "opponent"]]
        },
        {
          "type": "field_dropdown",
          "name": "MODE",
          "options": [["增加", "add"], ["減少", "reduce"], ["清空", "clear"]]
        },
        { "type": "field_number", "name": "COUNT", "value": 1, "min": 1, "max": 10 }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "增減或清空特定印記層數"
    },
    {
      "type": "atom_turn_effect_clear",
      "message0": "🧹 [原子] 消除回合類效果: 清除 %1 的所有回合類效果",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["對手", "opponent"], ["自身", "self"]]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "主動洗去敵方的回合類未命名持續狀態"
    },
    {
      "type": "atom_copy_stat_sum",
      "message0": "📊 [原子] 複製能力總和: 繼承或複製主體的能力等級總和",
      "args0": [],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "助戰精靈繼承主體的能力總和"
    },
    {
      "type": "atom_force_switch",
      "message0": "🔄 [原子] 強制換人: 強制 %1 換下當前精靈",
      "args0": [
        {
          "type": "field_dropdown",
          "name": "TARGET",
          "options": [["對手", "opponent"], ["自身", "self"]]
        }
      ],
      "previousStatement": null,
      "nextStatement": null,
      "colour": 210,
      "tooltip": "驅逐或強制切換在場精靈"
    }
  ]);
}

const TOOLBOX_CONFIG = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "⚡ 時點觸發槽 (Triggers)",
      colour: "#06b6d4",
      contents: [
        { kind: "block", type: "node_on_hit" },
        { kind: "block", type: "node_round_start" },
        { kind: "block", type: "node_round_end" },
        { kind: "block", type: "node_on_entered" },
        { kind: "block", type: "node_before_action" },
        { kind: "block", type: "node_before_skill" },
        { kind: "block", type: "node_on_damaged" },
        { kind: "block", type: "node_on_kill" },
        { kind: "block", type: "node_before_damage" },
        { kind: "block", type: "node_modify_priority" },
        { kind: "block", type: "custom_node_slot" }
      ]
    },
    {
      kind: "category",
      name: "📦 容器與印記 (Containers & Marks)",
      colour: "#f59e0b",
      contents: [
        { kind: "block", type: "turn_effect_apply" },
        { kind: "block", type: "condition_gate" }
      ]
    },
    {
      kind: "category",
      name: "⚔️ 傷害類 (Damage)",
      colour: "#ef4444",
      contents: [
        { kind: "block", type: "atom_extra_damage" },
        { kind: "block", type: "atom_damage_multiplier" },
        { kind: "block", type: "atom_damage_reduce" },
        { kind: "block", type: "atom_damage_reflect" },
        { kind: "block", type: "atom_drain_hp" }
      ]
    },
    {
      kind: "category",
      name: "💚 資源與恢復 (Resource & Healing)",
      colour: "#10b981",
      contents: [
        { kind: "block", type: "atom_heal" },
        { kind: "block", type: "atom_shield" },
        { kind: "block", type: "atom_pp_op" },
        { kind: "block", type: "atom_maxhp_change" }
      ]
    },
    {
      kind: "category",
      name: "🟣 狀態與能力 (Status & Stats)",
      colour: "#a855f7",
      contents: [
        { kind: "block", type: "atom_apply_status" },
        { kind: "block", type: "atom_cure_status" },
        { kind: "block", type: "atom_stat_change" },
        { kind: "block", type: "atom_clear_stat" },
        { kind: "block", type: "atom_immune" }
      ]
    },
    {
      kind: "category",
      name: "🔵 控制與特殊 (Control & Special)",
      colour: "#3b82f6",
      contents: [
        { kind: "block", type: "atom_priority" },
        { kind: "block", type: "atom_accuracy" },
        { kind: "block", type: "atom_crit" },
        { kind: "block", type: "atom_pierce" },
        { kind: "block", type: "atom_extra_action" },
        { kind: "block", type: "atom_vanish" },
        { kind: "block", type: "atom_rebirth" },
        { kind: "block", type: "atom_turn_effect_clear" }
      ]
    }
  ]
};

const STAT_TEXT: Record<string, string> = { all: "全屬性", atk: "攻擊", def: "防禦", spAtk: "特攻", spDef: "特防", speed: "速度", accuracy: "命中" };
const COND_TEXT: Record<string, (v: number) => string> = {
  hp_below: v => `自身體力低於${v}%`, hp_above: v => `自身體力高於${v}%`, has_shield: () => "自身擁有護盾",
  is_first: () => "先出手", is_second: () => "後出手",
};

export interface CustomMacro {
  id: string;
  name: string;
  kit: KitEntry[];
}

export function createKitBlockParser(currentSource: KitEntry['source']) {
  const parseBlockToEntry = (block: Blockly.Block, node: Node, order: number = 0): KitEntry | null => {
    const metadata = block.data ? JSON.parse(block.data) : null;
    if (metadata?.opaqueEntry) return { ...metadata.opaqueEntry, node, order, source: currentSource };
    const result = parseVisible(block, node, order);
    if (result && metadata) {
      const unchanged = metadata.fields && Object.entries(metadata.fields).every(([name, value]) => block.getFieldValue(name) === value);
      result.params = unchanged ? { ...metadata.params } : { ...metadata.params, ...result.params };
      if (!unchanged && ['atom_extra_damage', 'atom_damage_reflect', 'atom_drain_hp'].includes(block.type)) {
        delete result.params.ratio; delete result.params.dmgType;
      }
      if (unchanged && metadata.customText) result.customText = metadata.customText;
    }
    return result;
    function parseVisible(block: Blockly.Block, node: Node, order: number): KitEntry | null {
    const type = block.type;
    const parseAtomBlock = (b: Blockly.Block) => {
      const e = parseBlockToEntry(b, node, 0);
      return e ? { atom: e.codeId, params: e.params || {}, text: e.customText || "" } : null;
    };

    if (type === "turn_effect_apply") {
      const timerName = block.getFieldValue("TIMER_NAME") || "具名印記";
      const displayChar = block.getFieldValue("DISPLAY_CHAR") || "印";
      const duration = Number(block.getFieldValue("DURATION") || 3);
      const applyMode = block.getFieldValue("APPLY_MODE") || "gate";
      const clearable = block.getFieldValue("CLEARABLE") === "TRUE";

      // Inner wrapped block
      const wrapBlock = block.getInputTargetBlock("WRAPS_STACK");
      let wraps: string[] = [];
      let wrapParams: Record<string, any> = {};

      const wrapItems: { atom: string; params: Record<string, any>; text: string }[] = [];
      let curr: Blockly.Block | null = wrapBlock;
      while (curr) {
        const inner = parseAtomBlock(curr);
        if (inner) { wraps.push(inner.atom); wrapItems.push(inner); wrapParams = { ...wrapParams, ...inner.params }; }
        curr = curr.getNextBlock();
      }
      const wrapText = wrapItems.map(w => w.text).join("、");

      return {
        codeId: "turn_effect_apply",
        node,
        source: currentSource,
        order,
        customText: `${duration}回合內【${timerName}】：${applyMode === "per_tick" ? "每回合" : applyMode === "on_expire" ? "結束時" : ""}${wrapText || "（無效果）"}`,
        params: {
          duration,
          applyMode,
          clearable,
          wraps,
          wrapParams,
          wrapItems,
          timerName,
          displayChar
        }
      };
    }

    if (type === "condition_gate") {
      const condType = block.getFieldValue("COND_TYPE") || "hp_below";
      const condVal = Number(block.getFieldValue("COND_VAL") || 50);

      const innerBlock = block.getInputTargetBlock("INNER_STACK");
      const innerParsed = innerBlock ? parseAtomBlock(innerBlock) : null;
      const innerItems: { atom: string; params: Record<string, any>; text: string }[] = [];
      for (let current = innerBlock; current; current = current.getNextBlock()) {
        const parsed = parseAtomBlock(current); if (parsed) innerItems.push(parsed);
      }
      const innerAtom = innerParsed?.atom || "";
      const innerParams: Record<string, any> = innerParsed?.params || {};

      const paramsObj: Record<string, any> = {
        [condType]: condType === "has_shield" || condType === "is_first" || condType === "is_second" ? true : (condType.includes("hp") ? condVal / 100 : condVal),
        inner: innerAtom,
        innerParams,
        innerItems
      };

      return {
        codeId: "condition_gate",
        node,
        source: currentSource,
        order,
        customText: `${COND_TEXT[condType]?.(condVal) || condType}時：${innerItems.map(i => i.text).join('、') || "（無效果）"}`,
        params: paramsObj
      };
    }

    // Atomic blocks mapping
    if (type === "atom_extra_damage") {
      const target = block.getFieldValue("TARGET");
      const amount = Number(block.getFieldValue("AMOUNT") ?? 150);
      const damageType = block.getFieldValue("DAMAGE_TYPE");
      const amountMode = block.getFieldValue('AMOUNT_MODE') || 'flat';
      const elem = block.getFieldValue('ELEMENT') || '普通';
      return {
        codeId: "extra_damage",
        node,
        source: currentSource,
        order,
        customText: `${target === 'opponent' ? '對手' : '自身'}受到${damageType === 'percent' || amountMode === 'max_hp_percent' ? `最大體力${amount}%` : `${amount}點`}${damageType === 'percent' ? '百分比' : damageType === 'true' ? '真實' : damageType === 'skill' ? `${elem}系技能` : '固定'}傷害`,
        params: { target, amount, damageType, amountMode, elem }
      };
    }

    if (type === "atom_damage_multiplier") {
      const mult = Number(block.getFieldValue("MULTIPLICITY") ?? 1.5);
      return {
        codeId: "damage_multiplier",
        node,
        source: currentSource,
        order,
        customText: `造成的傷害乘以 ${mult} 倍`,
        params: { multiplier: mult, damageTypes: JSON.parse(block.getFieldValue('DAMAGE_TYPES') || '["non_true"]') }
      };
    }

    if (type === "atom_damage_reduce") {
      const percent = Number(block.getFieldValue("PERCENT") ?? 50);
      return {
        codeId: "damage_reduce",
        node,
        source: currentSource,
        order,
        customText: `受到的傷害減少 ${percent}%`,
        params: { percent, damageTypes: JSON.parse(block.getFieldValue('DAMAGE_TYPES') || '["non_true"]') }
      };
    }

    if (type === "atom_damage_reflect") {
      const percent = Number(block.getFieldValue("PERCENT") ?? 50);
      const target = block.getFieldValue("TARGET");
      return {
        codeId: "damage_reflect",
        node,
        source: currentSource,
        order,
        customText: `將受到的傷害 ${percent}% 反彈給 ${target === "opponent" ? "對手" : "自身"}`,
        params: { percent, target, damageType: block.getFieldValue('DAMAGE_TYPE'), elem: block.getFieldValue('ELEMENT') }
      };
    }

    if (type === "atom_drain_hp") {
      const target = block.getFieldValue("TARGET");
      const amount = Number(block.getFieldValue("AMOUNT") ?? 100);
      return {
        codeId: "drain_hp",
        node,
        source: currentSource,
        order,
        customText: `吸取 ${target === "opponent" ? "對手" : "自身"} ${amount} 點體力補充自身`,
        params: { target, amount, damageType: block.getFieldValue('DAMAGE_TYPE'), amountMode: block.getFieldValue('AMOUNT_MODE'), elem: block.getFieldValue('ELEMENT') }
      };
    }

    if (type === "atom_heal") {
      const target = block.getFieldValue("TARGET");
      const amount = Number(block.getFieldValue("AMOUNT") || 50);
      const mode = block.getFieldValue("MODE");
      return {
        codeId: "heal",
        node,
        source: currentSource,
        order,
        customText: `${target === "opponent" ? "對手" : "自身"}恢復${mode === "percent" ? `最大體力${amount}%` : `${amount}點體力`}`,
        params: { target, amount, mode }
      };
    }

    if (type === "atom_shield") {
      const amount = Number(block.getFieldValue("AMOUNT") || 200);
      return {
        codeId: "shield",
        node,
        source: currentSource,
        order,
        customText: `獲得 ${amount} 點護盾屏障`,
        params: { amount }
      };
    }

    if (type === "atom_pp_op") {
      const target = block.getFieldValue("TARGET");
      const mode = block.getFieldValue("MODE");
      const amount = Number(block.getFieldValue("AMOUNT") || 1);
      return {
        codeId: "pp_op",
        node,
        source: currentSource,
        order,
        customText: `${mode === "reduce" ? "扣除" : mode === "drain" ? "吸取" : "恢復"} ${target === "opponent" ? "對手" : "自身"} ${amount} 點 PP`,
        params: { target, mode, amount }
      };
    }

    if (type === "atom_maxhp_change") {
      const target = block.getFieldValue("TARGET");
      const mode = block.getFieldValue("MODE");
      const amount = Number(block.getFieldValue("AMOUNT") || 100);
      return {
        codeId: "maxhp_change",
        node,
        source: currentSource,
        order,
        customText: `使 ${target === "opponent" ? "對手" : "自身"} 最大體力 ${mode === "add" ? "增加" : "減少"} ${amount} 點`,
        params: { target, mode, amount }
      };
    }

    if (type === "atom_apply_status") {
      const target = block.getFieldValue("TARGET");
      const status = block.getFieldValue("STATUS_NAME");
      const duration = Number(block.getFieldValue("DURATION") || 2);
      const chance = Number(block.getFieldValue("CHANCE") || 100);
      return {
        codeId: "apply_status",
        node,
        source: currentSource,
        order,
        customText: `${chance < 100 ? `${chance}%` : ""}令${target === "opponent" ? "對手" : "自身"}${status}${duration}回合`,
        params: { target, status, duration, chance }
      };
    }

    if (type === "atom_cure_status") {
      const target = block.getFieldValue("TARGET");
      return {
        codeId: "cure_status",
        node,
        source: currentSource,
        order,
        customText: `解除 ${target === "opponent" ? "對手" : "自身"} 的所有異常狀態`,
        params: { target }
      };
    }

    if (type === "atom_stat_change") {
      const target = block.getFieldValue("TARGET");
      const stat = block.getFieldValue("STAT_NAME");
      const stages = Number(block.getFieldValue("STAGES") || 1);
      return {
        codeId: "stat_change",
        node,
        source: currentSource,
        order,
        customText: `${target === "opponent" ? "對手" : "自身"}${STAT_TEXT[stat] || stat}等級${stages > 0 ? "+" : ""}${stages}`,
        params: { target, stat, stages }
      };
    }

    if (type === "atom_clear_stat") {
      const target = block.getFieldValue("TARGET");
      const statType = block.getFieldValue("STAT_TYPE");
      return {
        codeId: "clear_stat",
        node,
        source: currentSource,
        order,
        customText: `消除 ${target === "opponent" ? "對手" : "自身"} 的 ${statType === "boost" ? "能力提升" : statType === "drop" ? "能力下降" : "能力等級"}`,
        params: { target, statType }
      };
    }

    if (type === "atom_immune") {
      const immuneType = block.getFieldValue("IMMUNE_TYPE");
      return {
        codeId: "immune",
        node,
        source: currentSource,
        order,
        customText: `獲得技能免疫`,
        params: { type: immuneType }
      };
    }

    if (type === "atom_priority") {
      const level = Number(block.getFieldValue("LEVEL") || 1);
      return {
        codeId: "priority",
        node,
        source: currentSource,
        order,
        customText: `技能先制${level >= 0 ? "+" : ""}${level}`,
        params: { level }
      };
    }

    if (type === "atom_accuracy") {
      const mode = block.getFieldValue("MODE");
      return {
        codeId: "accuracy",
        node,
        source: currentSource,
        order,
        customText: mode === "boost" ? "自身命中等級+1" : mode === "drop" ? "對手命中等級-1" : "技能必中",
        params: { mode }
      };
    }

    if (type === "atom_crit") {
      const mode = block.getFieldValue("MODE");
      return {
        codeId: "crit",
        node,
        source: currentSource,
        order,
        customText: `技能必定致命一擊`,
        params: { mode }
      };
    }

    if (type === "atom_pierce") {
      const pierceType = block.getFieldValue("PIERCE_TYPE");
      return {
        codeId: "pierce",
        node,
        source: currentSource,
        order,
        customText: `本次傷害轉為真實傷害（無視減傷與護盾）`,
        params: { type: pierceType }
      };
    }

    if (type === "atom_extra_action") {
      return {
        codeId: "extra_action",
        node,
        source: currentSource,
        order,
        customText: `獲取連擊/額外行動`,
        params: {}
      };
    }

    if (type === "atom_vanish") {
      return {
        codeId: "vanish",
        node,
        source: currentSource,
        order,
        customText: `自身消逝離場`,
        params: {}
      };
    }

    if (type === "atom_rebirth") {
      const turns = Number(block.getFieldValue("TURNS") || 2);
      return {
        codeId: "rebirth",
        node,
        source: currentSource,
        order,
        customText: `${turns}回合內受到致命傷害時殘留1點體力`,
        params: { turns }
      };
    }

    if (type === "atom_summon_extra") {
      const elfName = block.getFieldValue("ELF_NAME") || "靈獸";
      return {
        codeId: "summon_extra",
        node,
        source: currentSource,
        order,
        customText: `召喚助戰精靈: ${elfName}`,
        params: { elfName }
      };
    }

    if (type === "atom_mark_op") {
      const target = block.getFieldValue("TARGET");
      const mode = block.getFieldValue("MODE");
      const count = Number(block.getFieldValue("COUNT") || 1);
      return {
        codeId: "mark_op",
        node,
        source: currentSource,
        order,
        customText: `使 ${target === "opponent" ? "對手" : "自身"} 印記 ${mode} ${count} 層`,
        params: { target, mode, count }
      };
    }

    if (type === "atom_turn_effect_clear") {
      const target = block.getFieldValue("TARGET");
      return {
        codeId: "turn_effect_clear",
        node,
        source: currentSource,
        order,
        customText: `清除 ${target === "opponent" ? "對手" : "自身"} 的所有回合類效果`,
        params: { target }
      };
    }

    if (type === "atom_copy_stat_sum") {
      return {
        codeId: "copy_stat_sum",
        node,
        source: currentSource,
        order,
        customText: `複製/繼承能力總和`,
        params: {}
      };
    }

    if (type === "atom_force_switch") {
      const target = block.getFieldValue("TARGET");
      return {
        codeId: "force_switch",
        node,
        source: currentSource,
        order,
        customText: `強制 ${target === "opponent" ? "對手" : "自身"} 換人`,
        params: { target }
      };
    }

    return null;
    }
  };
  return parseBlockToEntry;
}

  const FIELD_MAP: Record<string, Record<string, string>> = {
    atom_extra_damage: { TARGET: "target", AMOUNT: "amount", DAMAGE_TYPE: "damageType", AMOUNT_MODE: 'amountMode', ELEMENT: 'elem' },
    atom_damage_multiplier: { MULTIPLICITY: "multiplier", DAMAGE_TYPES: 'damageTypes' },
    atom_damage_reduce: { PERCENT: "percent", DAMAGE_TYPES: 'damageTypes' },
    atom_damage_reflect: { PERCENT: "percent", TARGET: "target", DAMAGE_TYPE: 'damageType', ELEMENT: 'elem' },
    atom_drain_hp: { TARGET: "target", AMOUNT: "amount", DAMAGE_TYPE: 'damageType', AMOUNT_MODE: 'amountMode', ELEMENT: 'elem' },
    atom_heal: { TARGET: "target", AMOUNT: "amount", MODE: "mode" },
    atom_shield: { AMOUNT: "amount" },
    atom_pp_op: { TARGET: "target", MODE: "mode", AMOUNT: "amount" },
    atom_maxhp_change: { TARGET: "target", MODE: "mode", AMOUNT: "amount" },
    atom_apply_status: { TARGET: "target", STATUS_NAME: "status", DURATION: "duration", CHANCE: "chance" },
    atom_cure_status: { TARGET: "target" },
    atom_stat_change: { TARGET: "target", STAT_NAME: "stat", STAGES: "stages" },
    atom_clear_stat: { TARGET: "target", STAT_TYPE: "statType" },
    atom_immune: { IMMUNE_TYPE: "type" },
    atom_priority: { LEVEL: "level" },
    atom_accuracy: { MODE: "mode" },
    atom_crit: { MODE: "mode" },
    atom_pierce: { PIERCE_TYPE: "type" },
    atom_extra_action: {},
    atom_vanish: {},
    atom_rebirth: { TURNS: "turns" },
    atom_summon_extra: { ELF_NAME: "elfName" },
    atom_mark_op: { TARGET: "target", MODE: "mode", COUNT: "count" },
    atom_turn_effect_clear: { TARGET: "target" },
    atom_copy_stat_sum: {},
    atom_force_switch: { TARGET: "target" },
  };
  const NODE_BLOCK: Record<string, string> = {
    on_hit: "node_on_hit", round_start: "node_round_start", round_end: "node_round_end", battle_start: "node_battle_start",
    on_entered: "node_on_entered", before_action: "node_before_action", before_skill: "node_before_skill",
    on_damaged: "node_on_damaged", on_kill: "node_on_kill", before_damage: "node_before_damage", modify_priority: "node_modify_priority",
  };

  const setFieldSafe = (b: Blockly.Block, field: string, v: any) => {
    if (v === undefined || v === null || !b.getField(field)) return;
    let val = field === 'DAMAGE_TYPES' ? JSON.stringify(v) : String(v);
    if (field === "STAGES" || field === "LEVEL") val = val.replace(/^\+/, "");
    if (field === "CLEARABLE") val = v === false || v === "FALSE" ? "FALSE" : "TRUE";
    try { b.setFieldValue(val, field); } catch { /* 選項不存在時保持預設 */ }
  };

  /** 依原子名與參數建立積木（不支援者回傳 null） */
  const buildAtomBlock = (ws: Blockly.WorkspaceSvg, atom: string, params: Record<string, any> = {}): Blockly.BlockSvg | null => {
    const type = `atom_${atom}`;
    const map = FIELD_MAP[type];
    if (!map) return null;
    const b = ws.newBlock(type) as Blockly.BlockSvg;
    const preserved = { ...params };
    if (params.damageType === undefined && params.dmgType !== undefined) setFieldSafe(b, 'DAMAGE_TYPE', params.dmgType === 'skill_attribute' ? 'skill' : params.dmgType);
    if ((atom === 'drain_hp' || atom === 'damage_reflect') && params.damageType === undefined && params.dmgType === undefined) setFieldSafe(b, 'DAMAGE_TYPE', 'true');
    if (params.ratio !== undefined) setFieldSafe(b, atom === 'damage_reflect' ? 'PERCENT' : 'AMOUNT', params.ratio * 100);
    if (params.damageTypes === undefined) setFieldSafe(b, 'DAMAGE_TYPES', ['attack','skill','fixed','percent','true']);
    for (const [field, key] of Object.entries(map)) setFieldSafe(b, field, params[key]);
    if (params.damageType === 'skill_attribute') setFieldSafe(b, 'DAMAGE_TYPE', 'skill');
    if (atom === 'drain_hp' && params.ratio !== undefined) setFieldSafe(b, 'AMOUNT_MODE', 'max_hp_percent');
    b.data = JSON.stringify({ params: preserved, fields: Object.fromEntries(Object.keys(map).filter(name => b.getField(name)).map(name => [name, b.getFieldValue(name)])) });
    (b as any).initSvg?.(); (b as any).render?.();
    return b;
  };

  export const buildEntryBlock = (ws: Blockly.WorkspaceSvg, item: KitEntry): Blockly.BlockSvg | null => {
    const p = item.params || {};
    const conditionKeys = Object.keys(p).filter(key => !['inner', 'innerParams', 'innerItems', 'template', 'target'].includes(key));
    const opaque = () => {
      const b = ws.newBlock('native_effect_reference') as Blockly.BlockSvg;
      b.data = JSON.stringify({ opaqueEntry: item });
      setFieldSafe(b, 'LABEL', item.customText || item.codeId);
      (b as any).initSvg?.(); (b as any).render?.(); return b;
    };
    if (item.codeId === 'condition_gate' && (conditionKeys.length !== 1 || !['hp_below','hp_above','has_shield','is_first','is_second'].includes(conditionKeys[0]))) return opaque();
    if (item.codeId === "turn_effect_apply") {
      const b = ws.newBlock("turn_effect_apply") as Blockly.BlockSvg;
      b.data = JSON.stringify({ params: p });
      setFieldSafe(b, "DURATION", p.duration); setFieldSafe(b, "APPLY_MODE", p.applyMode);
      setFieldSafe(b, "TIMER_NAME", p.timerName); setFieldSafe(b, "DISPLAY_CHAR", p.displayChar);
      setFieldSafe(b, "CLEARABLE", p.clearable !== false);
      (b as any).initSvg?.(); (b as any).render?.();
      const items: { atom: string; params: any }[] = Array.isArray(p.wrapItems) ? p.wrapItems
        : (Array.isArray(p.wraps) ? p.wraps.map((w: string) => ({ atom: w, params: p.wrapParams || {} })) : []);
      let conn = b.getInput("WRAPS_STACK")?.connection;
      for (const w of items) {
        const wb = buildEntryBlock(ws, { codeId: w.atom, params: w.params, node: item.node, source: item.source, order: 0 });
        if (wb && conn && wb.previousConnection) { conn.connect(wb.previousConnection); conn = wb.nextConnection; }
      }
      return b;
    }
    if (item.codeId === "condition_gate") {
      const b = ws.newBlock("condition_gate") as Blockly.BlockSvg;
      b.data = JSON.stringify({ params: p });
      const cond = ["hp_below", "hp_above", "has_shield", "is_first", "is_second"].find(k => p[k] !== undefined);
      if (cond) {
        setFieldSafe(b, "COND_TYPE", cond);
        if (cond.startsWith("hp")) setFieldSafe(b, "COND_VAL", Math.round(Number(p[cond]) * 100));
      }
      (b as any).initSvg?.(); (b as any).render?.();
      const items = p.innerItems ?? (p.inner ? [{ atom: p.inner, params: p.innerParams || {} }] : []);
      let conn = b.getInput('INNER_STACK')?.connection;
      for (const item of items) {
        const ib = buildEntryBlock(ws, { codeId: item.atom, params: item.params, node: 'on_hit', source: item.source, order: 0 });
        if (ib && conn && ib.previousConnection) { conn.connect(ib.previousConnection); conn = ib.nextConnection; }
      }
      return b;
    }
    const atom = buildAtomBlock(ws, item.codeId, p);
    return atom || opaque();
  };


interface BlocklyBuilderProps {
  initialKit?: KitEntry[];
  onChange?: (kit: KitEntry[]) => void;
  source?: "skill" | "soulmark" | "mechanic" | "item";
  onInsertDescription?: (text: string) => void;
  fullPageMode?: boolean;
  initialElfId?: string;
  onClose?: () => void;
}

export const BlocklyBuilder: React.FC<BlocklyBuilderProps> = ({
  initialKit = [],
  onChange,
  source = "skill",
  onInsertDescription,
  fullPageMode = false,
  initialElfId,
  onClose,
}) => {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const blocklyWorkspace = useRef<Blockly.WorkspaceSvg | null>(null);
  const [jsonOutput, setJsonOutput] = useState<string>("[]");
  const [autoSync, setAutoSync] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [savedMacros, setSavedMacros] = useState<CustomMacro[]>([]);

  const currentSource = (source || "skill") as "skill" | "soulmark" | "mechanic" | "item";

  // Load saved custom macros on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("blockly_custom_macros");
      if (stored) {
        setSavedMacros(JSON.parse(stored));
      }
    } catch {
      setSavedMacros([]);
    }
  }, []);

  // Save macro to localStorage
  const handleSaveMacro = () => {
    const kit = convertWorkspaceToKit();
    if (kit.length === 0) {
      alert("⚠️ 當前畫布沒有任何積木可儲存！");
      return;
    }
    const macroName = prompt("請輸入此自訂效果/巨集的名稱：", "自訂複合效果");
    if (!macroName) return;

    const newMacro: CustomMacro = {
      id: "macro_" + Date.now(),
      name: macroName,
      kit
    };

    const updated = [newMacro, ...savedMacros];
    setSavedMacros(updated);
    try {
      localStorage.setItem("blockly_custom_macros", JSON.stringify(updated));

    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMacro = (id: string) => {
    const updated = savedMacros.filter(m => m.id !== id);
    setSavedMacros(updated);
    try { localStorage.setItem("blockly_custom_macros", JSON.stringify(updated)); } catch { /* 儲存失敗時僅更新畫面 */ }
  };

  // Helper to parse block to KitEntry/code params
  const parseBlockToEntry = useCallback(createKitBlockParser(currentSource), [currentSource]);

  // Convert workspace to KitEntry[] JSON
  const convertWorkspaceToKit = useCallback(() => {
    if (!blocklyWorkspace.current) return [];
    const topBlocks = blocklyWorkspace.current.getTopBlocks(true);
    const resultKit: KitEntry[] = [];

    for (const topBlock of topBlocks) {
      let node: Node = "on_hit";
      if (topBlock.type === "node_on_hit") node = "on_hit";
      else if (topBlock.type === "node_round_start") node = "round_start";
      else if (topBlock.type === "node_round_end") node = "round_end";
      else if (topBlock.type === "node_battle_start") node = "battle_start";
      else if (topBlock.type === "node_on_entered") node = "on_entered";
      else if (topBlock.type === "node_before_action") node = "before_action";
      else if (topBlock.type === "node_before_skill") node = "before_skill";
      else if (topBlock.type === "node_on_damaged") node = "on_damaged";
      else if (topBlock.type === "node_on_kill") node = "on_kill";
      else if (topBlock.type === "node_before_damage") node = "before_damage";
      else if (topBlock.type === "node_modify_priority") node = "modify_priority";
      else if (topBlock.type === "custom_node_slot") {
        node = (topBlock.getFieldValue("TARGET_NODE") || "on_hit") as Node;
      }

      let curr: Blockly.Block | null = topBlock.getInputTargetBlock("STACK");
      let itemOrder = 0;
      while (curr) {
        const entry = parseBlockToEntry(curr, node, itemOrder++);
        if (entry) {
          resultKit.push(entry);
        }
        curr = curr.getNextBlock();
      }
    }

    return resultKit;
  }, [parseBlockToEntry]);

  // ── 積木欄位 ↔ 參數 對照表（載入時用，確保可完整還原） ──
  // Load KitEntry[] onto Blockly workspace（完整還原所有積木與欄位）
  const loadingRef = useRef(false);
  const loadKitToWorkspace = useCallback((kit: KitEntry[]) => {
    const ws = blocklyWorkspace.current;
    if (!ws) return;
    loadingRef.current = true;
    ws.clear();
    try {
      if (!kit || kit.length === 0) return;
      const grouped: Record<string, KitEntry[]> = {};
      for (const entry of kit) (grouped[entry.node || "on_hit"] ||= []).push(entry);
      let startY = 20;
      for (const [node, entries] of Object.entries(grouped)) {
        let nodeBlock: Blockly.BlockSvg;
        if (NODE_BLOCK[node]) nodeBlock = ws.newBlock(NODE_BLOCK[node]) as Blockly.BlockSvg;
        else { nodeBlock = ws.newBlock("custom_node_slot") as Blockly.BlockSvg; setFieldSafe(nodeBlock, "TARGET_NODE", node); }
        nodeBlock.initSvg(); nodeBlock.render(); nodeBlock.moveBy(20, startY);
        let conn = nodeBlock.getInput("STACK")?.connection;
        let count = 0;
        for (const item of entries.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
          const child = buildEntryBlock(ws, item);
          if (child && conn && child.previousConnection) { conn.connect(child.previousConnection); conn = child.nextConnection; count++; }
        }
        startY += 90 + count * 50;
      }
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // Handle workspace updates（防抖：拖曳中不連續回寫）
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const autoSyncRef = useRef(autoSync);
  autoSyncRef.current = autoSync;
  const syncTimer = useRef<number | null>(null);
  const handleWorkspaceChange = useCallback((immediate = false) => {
    const run = () => {
      try {
      const kit = convertWorkspaceToKit();
      validateKit(kit);
      setJsonOutput(JSON.stringify(kit, null, 2));
      if (autoSyncRef.current && onChangeRef.current) onChangeRef.current(kit);
      } catch (error) { setJsonOutput(`未回寫：${(error as Error).message}`); }
    };
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    if (immediate) run(); else syncTimer.current = window.setTimeout(run, 250);
  }, [convertWorkspaceToKit]);

  // Preset workspace setups
  const loadPreset = useCallback((presetType: "combo" | "shield" | "control" | "clear") => {
    if (!blocklyWorkspace.current) return;
    const presets: Record<string, KitEntry[]> = {
      clear: [],
      combo: [
        { codeId: "turn_effect_apply", node: "on_hit", source: currentSource, order: 0, customText: "", params: { duration: 3, applyMode: "gate", clearable: true, timerName: "負岳護盾", displayChar: "岳", wraps: ["damage_reduce"], wrapParams: { percent: 40 } } },
        { codeId: "stat_change", node: "on_hit", source: currentSource, order: 1, customText: "", params: { target: "self", stat: "atk", stages: 1 } },
      ],
      shield: [
        { codeId: "shield", node: "round_start", source: currentSource, order: 0, customText: "", params: { amount: 250 } },
        { codeId: "damage_reduce", node: "round_start", source: currentSource, order: 1, customText: "", params: { percent: 40 } },
      ],
      control: [
        { codeId: "apply_status", node: "on_hit", source: currentSource, order: 0, customText: "", params: { target: "opponent", status: "麻痺", duration: 2, chance: 100 } },
        { codeId: "clear_stat", node: "on_hit", source: currentSource, order: 1, customText: "", params: { target: "opponent", statType: "boost" } },
      ],
    };
    if (presetType !== "clear" && blocklyWorkspace.current.getTopBlocks(false).length > 0 && !window.confirm("以預設範例取代目前畫布？")) return;
    loadKitToWorkspace(presets[presetType] || []);
    handleWorkspaceChange(true);
  }, [handleWorkspaceChange, loadKitToWorkspace, currentSource]);

  // Initialize Blockly Workspace（只建立一次；之後 props 變動不重建）
  const initialKitRef = useRef(initialKit);
  useEffect(() => {
    defineCustomBlocks();
    if (!workspaceRef.current || blocklyWorkspace.current) return;
    const SKILL_HIDDEN = new Set(["atom_damage_multiplier", "atom_damage_reduce", "atom_crit", "atom_pierce", "atom_priority"]);
    const toolbox = currentSource === "skill"
      ? { ...TOOLBOX_CONFIG, contents: TOOLBOX_CONFIG.contents.map((c: any) => ({ ...c, contents: c.contents.filter((b: any) => c.name.includes("Triggers") ? b.type === "node_on_hit" : !SKILL_HIDDEN.has(b.type)) })) }
      : TOOLBOX_CONFIG;
    const ws = Core.inject(workspaceRef.current, {
      toolbox,
      media: "/blockly-media/", // 本機素材，不依賴 static.blockly.com
      sounds: false,
      grid: { spacing: 20, length: 3, colour: "#1e293b", snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.4, scaleSpeed: 1.1 },
      theme: Core.Theme.defineTheme("custom_dark", {
        name: "custom_dark",
        base: Core.Themes.Classic,
        componentStyles: {
          workspaceBackgroundColour: "#090d16",
          toolboxBackgroundColour: "#0f172a",
          toolboxForegroundColour: "#94a3b8",
          flyoutBackgroundColour: "#1e293b",
          flyoutOpacity: 0.95,
          scrollbarColour: "#334155"
        }
      })
    });
    blocklyWorkspace.current = ws;
    let resizeFrame = 0;
    const resize = () => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(() => Core.svgResize(ws)); };
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(workspaceRef.current);
    window.addEventListener('resize', resize);
    loadKitToWorkspace(initialKitRef.current || []);
    setJsonOutput(JSON.stringify(convertWorkspaceToKit(), null, 2));
    ws.addChangeListener((event) => {
      if (loadingRef.current || (event as any).isUiEvent) return;
      if (
        event.type === Core.Events.BLOCK_MOVE ||
        event.type === Core.Events.BLOCK_CHANGE ||
        event.type === Core.Events.BLOCK_CREATE ||
        event.type === Core.Events.BLOCK_DELETE
      ) {
        handleWorkspaceChange();
      }
    });
    return () => {
      resizeObserver?.disconnect(); window.removeEventListener('resize', resize); cancelAnimationFrame(resizeFrame);
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
      ws.dispose();
      blocklyWorkspace.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyJsonToClipboard = () => {
    navigator.clipboard.writeText(jsonOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const presetBtn = "px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 rounded-lg transition";

  return (
    <div className={`flex flex-col bg-slate-950 text-slate-100 overflow-hidden ${fullPageMode ? "h-full w-full" : "min-h-[620px] rounded-2xl border border-white/10"}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-900/80 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <Puzzle className="w-5 h-5 text-cyan-400" />
          <h3 className="font-semibold text-[15px] text-slate-100">積木編輯</h3>
          <span className="text-[12px] text-slate-500" title="技能積木只在「技能命中時」執行；魂印積木依觸發時點執行">
            {currentSource === "skill" ? "技能：命中時執行" : currentSource === "soulmark" ? "魂印：依時點觸發" : "依時點觸發"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <button type="button" onClick={() => loadPreset("combo")} className={presetBtn} title="回合效果＋能力提升範例">範例：連招</button>
          <button type="button" onClick={() => loadPreset("shield")} className={presetBtn} title="護盾＋減傷範例">範例：護盾</button>
          <button type="button" onClick={() => loadPreset("control")} className={presetBtn} title="異常＋消強範例">範例：控制</button>
          <button type="button" onClick={() => { if (window.confirm("清空畫布？")) { loadKitToWorkspace([]); handleWorkspaceChange(true); } }}
            className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-lg transition flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" /> 清空
          </button>
          <button type="button" onClick={handleSaveMacro} className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-lg transition flex items-center gap-1" title="存到本機巨集清單，之後可在任何積木編輯器載入">
            <BookmarkPlus className="w-3.5 h-3.5" /> 存為巨集
          </button>
          {onClose && (
            <button type="button" onClick={() => { handleWorkspaceChange(true); onClose(); }}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition">
              完成
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-grow flex flex-col md:flex-row relative min-h-[480px]">
        <div className="flex-grow relative min-h-[480px]">
          <div ref={workspaceRef} className="absolute inset-0 w-full h-full" />
        </div>

        <div className="w-full md:w-80 bg-slate-900/80 border-t md:border-t-0 md:border-l border-white/10 flex flex-col p-3 gap-3">
          {savedMacros.length > 0 && (
            <div className="rounded-xl bg-black/30 p-2.5 flex flex-col gap-2">
              <div className="text-[13px] font-semibold text-amber-300">巨集（{savedMacros.length}）</div>
              <div className="max-h-40 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {savedMacros.map(macro => (
                  <div key={macro.id} className="flex items-center justify-between bg-white/[0.04] px-2.5 py-1.5 rounded-lg text-[13px]">
                    <span className="text-slate-200 truncate max-w-[150px]" title={macro.name}>{macro.name}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { loadKitToWorkspace(macro.kit.map(k => ({ ...k, source: currentSource }))); handleWorkspaceChange(true); }}
                        className="px-2 py-0.5 bg-amber-500/25 text-amber-200 hover:bg-amber-500/40 rounded text-[12px]">載入</button>
                      <button type="button" onClick={() => handleDeleteMacro(macro.id)} className="p-1 text-slate-500 hover:text-rose-400" title="刪除巨集">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[13px]">
            {onChange ? (
              <label className="flex items-center gap-2 cursor-pointer text-slate-300" title="關閉後編輯不會寫回精靈">
                <input type="checkbox" checked={autoSync} onChange={(e) => { setAutoSync(e.target.checked); if (e.target.checked) { autoSyncRef.current = true; handleWorkspaceChange(true); } }}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0" />
                即時寫回精靈
              </label>
            ) : <span className="text-slate-500">未綁定精靈（僅預覽）</span>}
            <button type="button" onClick={copyJsonToClipboard}
              className="px-2.5 py-1 bg-white/[0.06] hover:bg-white/[0.12] text-cyan-300 rounded-lg flex items-center gap-1 transition">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code2 className="w-3.5 h-3.5" />}
              {copied ? "已複製" : "複製 JSON"}
            </button>
          </div>

          <div className="rounded-xl bg-black/30 p-2.5 space-y-1.5 max-h-48 overflow-y-auto">
            <div className="text-[12px] text-slate-500">效果預覽</div>
            {(() => { try { const k = JSON.parse(jsonOutput) as KitEntry[]; return k.length ? k.map((e, i) => (
              <div key={i} className="text-[13px] text-slate-200 leading-snug"><span className="text-slate-500 mr-1">{NODE_LABEL[e.node] || e.node}</span>{e.customText}</div>
            )) : <div className="text-[13px] text-slate-500">從左側拖入「觸發時點」，再把效果積木接在裡面</div>; } catch { return null; } })()}
          </div>

          <details className="flex-grow flex flex-col rounded-xl bg-black/30 p-2.5 overflow-hidden">
            <summary className="text-[12px] text-slate-500 cursor-pointer">KitEntry JSON</summary>
            <textarea readOnly value={jsonOutput}
              className="w-full h-56 mt-1 bg-transparent text-cyan-300 font-mono text-[11px] resize-none focus:outline-none overflow-y-auto leading-relaxed" />
          </details>

          {onInsertDescription && (
            <button type="button"
              onClick={() => {
                const kit = convertWorkspaceToKit();
                const textSummary = kit.map(k => k.customText).join("；");
                if (textSummary) onInsertDescription(textSummary);
              }}
              className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-[13px] font-semibold rounded-lg transition flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4" /> {currentSource === "soulmark" ? "填入魂印描述" : "填入技能描述"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const NODE_LABEL: Record<string, string> = {
  on_hit: "命中時", round_start: "回合開始", round_end: "回合結束", battle_start: "戰鬥開始", on_entered: "登場時",
  before_action: "出手前", before_skill: "使用技能前", on_damaged: "受傷時", on_kill: "擊敗時",
  before_damage: "傷害計算時", modify_priority: "先制判定時", after_action: "行動後", self_fatal: "受致命傷時", battle_phase_end: "戰鬥階段結束",
};
