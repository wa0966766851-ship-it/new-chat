import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Elf } from '../types';
import { getTypeMatchup } from '../utils/statCalculator';

interface Props {
  p1Team: Elf[];
  p2Team: Elf[];
}

export default function PostMatchAnalysis({ p1Team, p2Team }: Props) {
  const chartData = useMemo(() => {
    let p1Hp = 0, p1Atk = 0, p1Def = 0, p1SpAtk = 0, p1SpDef = 0, p1Speed = 0;
    let p2Hp = 0, p2Atk = 0, p2Def = 0, p2SpAtk = 0, p2SpDef = 0, p2Speed = 0;
    
    let p1Advantage = 0;
    let p2Advantage = 0;

    p1Team.forEach(e1 => {
      if (e1.calculatedStats) {
        p1Hp += e1.calculatedStats.hp || 0;
        p1Atk += e1.calculatedStats.atk || 0;
        p1Def += e1.calculatedStats.def || 0;
        p1SpAtk += e1.calculatedStats.spatk || 0;
        p1SpDef += e1.calculatedStats.spdef || 0;
        p1Speed += e1.calculatedStats.speed || 0;
      }
      
      p2Team.forEach(e2 => {
        const m1 = getTypeMatchup(e1.type, e2.type);
        const m2 = getTypeMatchup(e2.type, e1.type);
        if (m1 > 1) p1Advantage += (m1 - 1);
        if (m2 > 1) p2Advantage += (m2 - 1);
      });
    });

    p2Team.forEach(e2 => {
      if (e2.calculatedStats) {
        p2Hp += e2.calculatedStats.hp || 0;
        p2Atk += e2.calculatedStats.atk || 0;
        p2Def += e2.calculatedStats.def || 0;
        p2SpAtk += e2.calculatedStats.spatk || 0;
        p2SpDef += e2.calculatedStats.spdef || 0;
        p2Speed += e2.calculatedStats.speed || 0;
      }
    });
    
    // Normalize properties for radar chart
    const maxHp = Math.max(p1Hp, p2Hp, 1);
    const maxAtk = Math.max(p1Atk, p2Atk, 1);
    const maxDef = Math.max(p1Def, p2Def, 1);
    const maxSpAtk = Math.max(p1SpAtk, p2SpAtk, 1);
    const maxSpDef = Math.max(p1SpDef, p2SpDef, 1);
    const maxSpeed = Math.max(p1Speed, p2Speed, 1);
    const maxAdvantage = Math.max(p1Advantage, p2Advantage, 1);

    return [
      { subject: '體力', P1: Math.round((p1Hp / maxHp) * 100), P2: Math.round((p2Hp / maxHp) * 100), fullMark: 100 },
      { subject: '攻擊', P1: Math.round((p1Atk / maxAtk) * 100), P2: Math.round((p2Atk / maxAtk) * 100), fullMark: 100 },
      { subject: '防禦', P1: Math.round((p1Def / maxDef) * 100), P2: Math.round((p2Def / maxDef) * 100), fullMark: 100 },
      { subject: '特攻', P1: Math.round((p1SpAtk / maxSpAtk) * 100), P2: Math.round((p2SpAtk / maxSpAtk) * 100), fullMark: 100 },
      { subject: '特防', P1: Math.round((p1SpDef / maxSpDef) * 100), P2: Math.round((p2SpDef / maxSpDef) * 100), fullMark: 100 },
      { subject: '速度', P1: Math.round((p1Speed / maxSpeed) * 100), P2: Math.round((p2Speed / maxSpeed) * 100), fullMark: 100 },
      { subject: '屬性優勢', P1: Math.round((p1Advantage / maxAdvantage) * 100), P2: Math.round((p2Advantage / maxAdvantage) * 100), fullMark: 100 }
    ];
  }, [p1Team, p2Team]);

  return (
    <div className="w-full h-64 mt-4 bg-slate-900/50 rounded-xl p-4 flex flex-col items-center">
      <h4 className="text-slate-300 font-bold text-xs mb-2">戰局能力分析與預測</h4>
      <div className="w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', fontSize: '11px', color: '#e2e8f0' }} 
              itemStyle={{ fontSize: '11px' }}
            />
            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
            <Radar name="Player 1" dataKey="P1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
            <Radar name="Player 2" dataKey="P2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
