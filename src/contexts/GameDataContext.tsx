import React, { createContext, useContext, useState, useEffect } from "react";
import { Elf, Skill } from "../types";
import { GLOBAL_ELVES } from "../data/gameData";
import { ELF_ID_MAPPING } from "../data/elfRegistry";

interface GameDataContextProps {
  allElves: Elf[];
  customElves: Elf[];
  addCustomElf: (elf: Elf) => void;
  updateElf: (elf: Elf, oldId?: string) => void;
  deleteCustomElf: (id: string) => void;
  restoreDeletedElves: () => void;
  deletedCount: number;
  clearLocalCache: () => void;
  forceReloadData: () => void;
}

const GameDataContext = createContext<GameDataContextProps | null>(null);

const migrateTeamArray = (team: any[]) => {
  if (!Array.isArray(team)) return team;
  return team.map((member: any) => {
    if (member && member.id) {
      const nextId = ELF_ID_MAPPING[member.id] || member.id;
      if (nextId !== member.id) {
        return { ...member, id: nextId };
      }
    }
    return member;
  });
};

export const GameDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customElves, setCustomElves] = useState<Elf[]>(() => {
    const stored = localStorage.getItem("seer_custom_elves");
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored) as Elf[];
      const migrated = parsed.map(elf => {
        let updatedElf = { ...elf };
        if (elf.id && ELF_ID_MAPPING[elf.id]) {
          updatedElf.id = ELF_ID_MAPPING[elf.id];
        }
        if (updatedElf.inscriptions) {
          updatedElf.inscriptions = updatedElf.inscriptions.map(insc => {
            if (insc && insc.id === "wuxu_qianghua") {
              return { ...insc, id: "liuren_qianghua" };
            }
            return insc;
          });
        }
        return updatedElf;
      });

      // Filter out duplicate system elf remnants that are completely identical to system defaults
      return migrated.filter(elf => {
        if (elf.id && elf.id.startsWith("custom_")) {
          return true;
        }
        const systemElf = GLOBAL_ELVES.find(ge => ge.id === elf.id);
        if (!systemElf) return true;

        // Compare skills, inscriptions, and base stats
        const hasCustomSkills = JSON.stringify(elf.skills) !== JSON.stringify(systemElf.skills);
        const hasCustomInsc = JSON.stringify(elf.inscriptions) !== JSON.stringify(systemElf.inscriptions);
        const hasCustomStats = JSON.stringify(elf.baseStats) !== JSON.stringify(systemElf.baseStats);

        const isIdentical = !hasCustomSkills && !hasCustomInsc && !hasCustomStats;
        if (isIdentical) {
          console.log(`[ID Migration] Cleaned up duplicate system elf remnant: ${elf.name} (${elf.id})`);
          return false;
        }
        return true;
      });
    } catch (e) {
      return [];
    }
  });

  const [defaultElvesOverrides, setDefaultElvesOverrides] = useState<Record<string, Elf>>(() => {
    const stored = localStorage.getItem("seer_default_elves_overrides");
    if (!stored) return {};
    try {
      const parsed = JSON.parse(stored) as Record<string, Elf>;
      const next: Record<string, Elf> = {};
      Object.entries(parsed).forEach(([key, elf]) => {
        const nextKey = ELF_ID_MAPPING[key] || key;
        const nextId = elf.id ? (ELF_ID_MAPPING[elf.id] || elf.id) : undefined;
        next[nextKey] = { ...elf, id: nextId };
      });
      return next;
    } catch (e) {
      return {};
    }
  });

  const [deletedElves, setDeletedElves] = useState<Elf[]>([]);

  // One-time team and preset migrations
  useEffect(() => {
    try {
      // 1. Last used team
      const lastUsed = localStorage.getItem("seer_last_used_p1_team");
      if (lastUsed) {
        const parsed = JSON.parse(lastUsed);
        let changed = false;
        if (parsed) {
          if (parsed.team && Array.isArray(parsed.team)) {
            const nextTeam = migrateTeamArray(parsed.team);
            if (JSON.stringify(nextTeam) !== JSON.stringify(parsed.team)) {
              parsed.team = nextTeam;
              changed = true;
            }
          }
          if (parsed.starterId && ELF_ID_MAPPING[parsed.starterId]) {
            parsed.starterId = ELF_ID_MAPPING[parsed.starterId];
            changed = true;
          }
          if (changed) {
            localStorage.setItem("seer_last_used_p1_team", JSON.stringify(parsed));
          }
        }
      }

      // 2. Presets P1
      const presetsP1 = localStorage.getItem("seer_p1_backpack_presets");
      if (presetsP1) {
        const parsed = JSON.parse(presetsP1);
        let changed = false;
        if (parsed) {
          for (const key in parsed) {
            if (parsed[key]) {
              if (parsed[key].team && Array.isArray(parsed[key].team)) {
                const nextTeam = migrateTeamArray(parsed[key].team);
                if (JSON.stringify(nextTeam) !== JSON.stringify(parsed[key].team)) {
                  parsed[key].team = nextTeam;
                  changed = true;
                }
              }
              if (parsed[key].starterId && ELF_ID_MAPPING[parsed[key].starterId]) {
                parsed[key].starterId = ELF_ID_MAPPING[parsed[key].starterId];
                changed = true;
              }
            }
          }
          if (changed) {
            localStorage.setItem("seer_p1_backpack_presets", JSON.stringify(parsed));
          }
        }
      }

      // 3. Presets P2
      const presetsP2 = localStorage.getItem("seer_p2_backpack_presets");
      if (presetsP2) {
        const parsed = JSON.parse(presetsP2);
        let changed = false;
        if (parsed) {
          for (const key in parsed) {
            if (parsed[key]) {
              if (parsed[key].team && Array.isArray(parsed[key].team)) {
                const nextTeam = migrateTeamArray(parsed[key].team);
                if (JSON.stringify(nextTeam) !== JSON.stringify(parsed[key].team)) {
                  parsed[key].team = nextTeam;
                  changed = true;
                }
              }
              if (parsed[key].starterId && ELF_ID_MAPPING[parsed[key].starterId]) {
                parsed[key].starterId = ELF_ID_MAPPING[parsed[key].starterId];
                changed = true;
              }
            }
          }
          if (changed) {
            localStorage.setItem("seer_p2_backpack_presets", JSON.stringify(parsed));
          }
        }
      }
    } catch (e) {
      console.error("ID migration failed:", e);
    }
  }, []);

  // 資料遷移：同步預設精靈的身高、體重、性別到現有的自訂精靈與覆蓋資料中
  useEffect(() => {
    let changed = false;

    // 1. 同步自訂精靈
    const nextCustomElves = customElves.map(elf => {
      let name = elf.name;

      // 正規化名稱以便匹配 (處理 . 與 · 與 ・ 的差異)
      const normalize = (s: string) => s.replace(/[·.・]/g, '');
      const normalizedName = normalize(name);

      // 尋找對應的預設精靈
      const globalMatch = GLOBAL_ELVES.find(ge => 
        normalize(ge.name) === normalizedName || 
        (ge.id === elf.id && !elf.id?.startsWith('custom_'))
      );
      
      if (globalMatch) {
        const needsUpdate = name !== elf.name || 
                           (!elf.height && globalMatch.height) || 
                           (!elf.weight && globalMatch.weight) || 
                           (!elf.gender && globalMatch.gender);
        
        if (needsUpdate) {
          changed = true;
          return {
            ...elf,
            name: (name === elf.name && globalMatch.name !== name) ? globalMatch.name : name,
            height: elf.height || globalMatch.height,
            weight: elf.weight || globalMatch.weight,
            gender: elf.gender || globalMatch.gender,
          };
        }
      }
      return name !== elf.name ? { ...elf, name } : elf;
    });

    // 2. 同步覆蓋資料
    const nextOverrides = { ...defaultElvesOverrides };
    Object.keys(nextOverrides).forEach(id => {
      const override = nextOverrides[id];
      const globalMatch = GLOBAL_ELVES.find(ge => ge.id === id);
      if (globalMatch) {
        // 同步名稱格式 (處理點號)
        if (globalMatch.name !== override.name && override.name.replace(/[·.]/g, '') === globalMatch.name.replace(/[·.]/g, '')) {
          override.name = globalMatch.name;
          changed = true;
        }
        if ((!override.height && globalMatch.height) || 
            (!override.weight && globalMatch.weight) || 
            (!override.gender && globalMatch.gender)) {
          nextOverrides[id] = {
            ...override,
            height: override.height || globalMatch.height,
            weight: override.weight || globalMatch.weight,
            gender: override.gender || globalMatch.gender,
          };
          changed = true;
        }
      }
    });

    if (changed) {
      setCustomElves(nextCustomElves);
      setDefaultElvesOverrides(nextOverrides);
    }
  }, []); // 僅在初次載入時執行一次

  useEffect(() => {
    localStorage.setItem("seer_custom_elves", JSON.stringify(customElves));
  }, [customElves]);

  useEffect(() => {
    localStorage.setItem("seer_default_elves_overrides", JSON.stringify(defaultElvesOverrides));
  }, [defaultElvesOverrides]);

  const allElves = React.useMemo(() => {
    // 優先使用自訂精靈數據 (customElves)，其後才是系統預設精靈 (GLOBAL_ELVES)，並且套用 override
    const overriddenGlobalElves = GLOBAL_ELVES.map(elf => {
      const override = defaultElvesOverrides[elf.id!];
      return override ? { ...elf, ...override } : elf;
    });
    const combined = [...customElves, ...overriddenGlobalElves];
    const uniqueMap = new Map();
    combined.forEach(elf => {
      const key = elf.id || elf.name; // id優先，只有真的沒有id時才退回用名字
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, elf);
      }
    });
    return Array.from(uniqueMap.values());
  }, [customElves, defaultElvesOverrides]);

  const addCustomElf = (elf: Elf) => {
    setCustomElves(prev => [...prev, { ...elf, id: `custom_${Date.now()}` }]);
  };

  const updateElf = (updated: Elf, oldId?: string) => {
    const lookupId = oldId || updated.id;
    const nextId = updated.id ? (ELF_ID_MAPPING[updated.id] || updated.id) : undefined;
    const finalElf = nextId !== updated.id ? { ...updated, id: nextId } : updated;

    if (lookupId?.startsWith("custom_")) {
      setCustomElves(prev => {
        const exists = prev.some(e => e.id === lookupId);
        if (exists) {
          return prev.map(e => e.id === lookupId ? finalElf : e);
        } else {
          return [...prev, finalElf];
        }
      });
    } else if (lookupId) {
      setDefaultElvesOverrides(prev => {
        const nextOverrides = { ...prev };
        if (oldId && oldId !== finalElf.id) {
          delete nextOverrides[oldId];
        }
        nextOverrides[finalElf.id!] = finalElf;
        return nextOverrides;
      });
    }
  };

  const deleteCustomElf = (id: string) => {
    const elf = customElves.find(e => e.id === id);
    if (elf) {
      setDeletedElves(prev => [...prev, elf]);
      setCustomElves(prev => prev.filter(e => e.id !== id));
    }
  };

  const restoreDeletedElves = () => {
    setCustomElves(prev => [...prev, ...deletedElves]);
    setDeletedElves([]);
  };

  const clearLocalCache = () => {
    localStorage.removeItem("seer_custom_elves");
    localStorage.removeItem("seer_default_elves_overrides");
    setCustomElves([]);
    setDefaultElvesOverrides({});
  };

  const forceReloadData = () => {
    const stored = localStorage.getItem("seer_custom_elves");
    let nextCustom: Elf[] = [];
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Elf[];
        const migrated = parsed.map(elf => {
          let updatedElf = { ...elf };
          if (elf.id && ELF_ID_MAPPING[elf.id]) {
            updatedElf.id = ELF_ID_MAPPING[elf.id];
          }
          if (updatedElf.inscriptions) {
            updatedElf.inscriptions = updatedElf.inscriptions.map(insc => {
              if (insc && insc.id === "wuxu_qianghua") {
                return { ...insc, id: "liuren_qianghua" };
              }
              return insc;
            });
          }
          return updatedElf;
        });

        nextCustom = migrated.filter(elf => {
          if (elf.id && elf.id.startsWith("custom_")) {
            return true;
          }
          const systemElf = GLOBAL_ELVES.find(ge => ge.id === elf.id);
          if (!systemElf) return true;

          const hasCustomSkills = JSON.stringify(elf.skills) !== JSON.stringify(systemElf.skills);
          const hasCustomInsc = JSON.stringify(elf.inscriptions) !== JSON.stringify(systemElf.inscriptions);
          const hasCustomStats = JSON.stringify(elf.baseStats) !== JSON.stringify(systemElf.baseStats);

          const isIdentical = !hasCustomSkills && !hasCustomInsc && !hasCustomStats;
          return !isIdentical;
        });
      } catch (e) {
        nextCustom = [];
      }
    }
    setCustomElves(nextCustom);

    const storedOverrides = localStorage.getItem("seer_default_elves_overrides");
    let nextOverrides: Record<string, Elf> = {};
    if (storedOverrides) {
      try {
        const parsed = JSON.parse(storedOverrides) as Record<string, Elf>;
        Object.entries(parsed).forEach(([key, elf]) => {
          const nextKey = ELF_ID_MAPPING[key] || key;
          const nextId = elf.id ? (ELF_ID_MAPPING[elf.id] || elf.id) : undefined;
          nextOverrides[nextKey] = { ...elf, id: nextId };
        });
      } catch (e) {
        nextOverrides = {};
      }
    }
    setDefaultElvesOverrides(nextOverrides);
  };

  return (
    <GameDataContext.Provider value={{
      allElves,
      customElves,
      addCustomElf,
      updateElf,
      deleteCustomElf,
      restoreDeletedElves,
      deletedCount: deletedElves.length,
      clearLocalCache,
      forceReloadData
    }}>
      {children}
    </GameDataContext.Provider>
  );
};

export const useGameData = () => {
  const context = useContext(GameDataContext);
  if (!context) throw new Error("useGameData must be used within GameDataProvider");
  return context;
};
