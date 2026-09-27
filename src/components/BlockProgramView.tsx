// 積木模式（唯讀）：把描述解析出的積木以堆疊方塊顯示
import React from "react";
import type { Act, Clause, Cond, Program, Stmt } from "../blocks/model";
import { TRIG_LABEL } from "../blocks/parse";

const OP_TONE: Record<string, string> = {
  status: "bg-fuchsia-600/80", status_seq: "bg-fuchsia-600/80", status_random: "bg-fuchsia-600/80", status_chance_turns: "bg-fuchsia-600/80", convert_status: "bg-fuchsia-600/80",
  cure_status: "bg-emerald-600/80", immune_status_turns: "bg-emerald-600/80", immune_status_count: "bg-emerald-600/80", immune_status_perm: "bg-emerald-600/80", immune_statdown_turns: "bg-emerald-600/80",
  stat: "bg-sky-600/80", stat_clear: "bg-sky-600/80", stat_steal: "bg-sky-600/80", stat_reverse: "bg-sky-600/80", stat_transfer: "bg-sky-600/80",
  heal: "bg-green-600/80", heal_flat: "bg-green-600/80", heal_equal: "bg-green-600/80", vampire: "bg-green-600/80", drain: "bg-green-700/80", maxhp: "bg-green-700/80",
  dmg: "bg-rose-600/80", dmg_equal: "bg-rose-600/80", boost: "bg-orange-600/80", dmg_mod_turns: "bg-orange-600/80", dmg_mod_uses: "bg-orange-600/80", dmg_taken_x2: "bg-orange-600/80", boost_turns_x2: "bg-orange-600/80", dmg_mod: "bg-orange-600/80", dmg_cap_turns: "bg-teal-600/80",
  prio_turns: "bg-amber-600/80", prio_next: "bg-amber-600/80", first_turns: "bg-amber-600/80",
  clear_turn: "bg-indigo-600/80", clear_shield: "bg-indigo-600/80", shield: "bg-teal-600/80",
  pp_zero: "bg-violet-600/80", pp_zero_random: "bg-violet-600/80", pp_drain: "bg-violet-600/80", pp_restore: "bg-violet-600/80", pp_zero_all: "bg-violet-600/80",
  invalid_next: "bg-red-700/80", invalid_turns: "bg-red-700/80", add_invalid_turns: "bg-red-700/80", add_invalid_next: "bg-red-700/80", no_switch: "bg-red-700/80", no_heal: "bg-red-700/80",
  immune_attack_count: "bg-teal-600/80", immune_attack_turns: "bg-teal-600/80", block_attack: "bg-teal-600/80",
  mark: "bg-yellow-600/80", mark_turns: "bg-yellow-600/80", note: "bg-slate-600/70", noop: "bg-slate-600/70",
};

const ActBlock: React.FC<{ a: Act }> = ({ a }) => {
  if (a.op === "timed") {
    const p = a.p;
    return (
      <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 overflow-hidden">
        <div className="px-2 py-1 text-[12px] font-semibold text-amber-200 bg-amber-600/30">⏱ {a.label}</div>
        <div className="p-1.5 space-y-1 border-l-4 border-amber-500/60 ml-1.5"><StmtList body={p.body || []} /></div>
      </div>
    );
  }
  return <div className={`rounded-md px-2 py-1 text-[12px] font-medium text-white shadow-sm ${OP_TONE[a.op] || "bg-slate-600/80"}`}>{a.label || a.op}</div>;
}

const CondChip: React.FC<{ c: Cond }> = ({ c }) => {
  return <span className="rounded-md bg-cyan-600/80 px-1.5 py-0.5 text-[11.5px] font-semibold text-white">{c.label}</span>;
}

function StmtList({ body }: { body: Stmt[] }) {
  return (
    <>
      {body.map((s, i) => {
        const head = s.chain === "success" ? "成功則" : s.chain === "fail" ? "未觸發則" : null;
        if (!s.cond?.length && !head) return <div key={i} className="space-y-1">{s.acts.map((a, j) => <ActBlock key={j} a={a} />)}</div>;
        return (
          <div key={i} className="rounded-lg border border-cyan-500/30 bg-cyan-500/5">
            <div className="flex flex-wrap items-center gap-1 px-1.5 py-1 text-[11.5px] text-cyan-200">
              {head && <span className="font-bold">{head}</span>}
              {s.cond?.map((c, j) => <React.Fragment key={j}><span>若</span><CondChip c={c} /></React.Fragment>)}
            </div>
            <div className="space-y-1 border-l-4 border-cyan-500/50 ml-1.5 p-1.5">{s.acts.map((a, j) => <ActBlock key={j} a={a} />)}</div>
          </div>
        );
      })}
    </>
  );
}

const ClauseBlock: React.FC<{ c: Clause }> = ({ c }) => {
  const trig = TRIG_LABEL[c.trig] || c.trig;
  const showTrig = c.trig !== "use" && c.trig !== "custom";
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-2 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] leading-snug text-slate-400 whitespace-pre-wrap">{c.raw.replace(/^\s*>+\s*/, "")}</div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${c.parsed ? "bg-emerald-500/15 text-emerald-300" : c.marker === "§" ? "bg-slate-500/15 text-slate-400" : "bg-rose-500/15 text-rose-300"}`}
          title={c.parsed ? "已轉成積木" : c.marker === "§" ? "名詞說明" : `未轉成積木：${(c.rest || []).join("、")}`}>
          {c.parsed ? "積木" : c.marker === "§" ? "說明" : "未解析"}
        </span>
      </div>
      {(showTrig || c.cond?.length) && (
        <div className="flex flex-wrap items-center gap-1">
          {showTrig && <span className="rounded-t-lg rounded-br-lg bg-amber-500/90 px-2 py-0.5 text-[11.5px] font-bold text-slate-900">▶ {trig}</span>}
          {c.cond?.map((x, i) => <CondChip key={i} c={x} />)}
        </div>
      )}
      {c.body.length > 0 && <div className="space-y-1"><StmtList body={c.body} /></div>}
      {!c.parsed && (c.rest || []).length > 0 && c.marker !== "§" && (
        <div className="space-y-1">{(c.rest || []).map((r, i) => <div key={i} className="rounded-md border border-dashed border-rose-400/40 px-2 py-1 text-[11.5px] text-rose-200">{r}</div>)}</div>
      )}
    </div>
  );
}

export function BlockProgramView({ program, source }: { program: Program; source?: string }) {
  const total = program.clauses.filter(c => c.marker !== "§").length;
  const ok = program.clauses.filter(c => c.parsed).length;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span>{source}</span>
        <span title="已轉成積木的子句數">{ok}/{total}</span>
      </div>
      {program.clauses.map((c, i) => <ClauseBlock key={i} c={c} />)}
    </div>
  );
}
