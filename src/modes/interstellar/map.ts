export const generateLayerMap = (layer: number): any[] => {
    const isBossLayer = layer === 6;
    const nodes: any[] = [
      { id: `L${layer}-start`, type: "heal", status: "current", name: "起始空間站", x: 8, y: 50, connections: [`L${layer}-1a`, `L${layer}-1b`, `L${layer}-1c`] },
      
      // Column 1
      { id: `L${layer}-1a`, type: "combat", status: "unvisited", name: "前哨守衛", x: 22, y: 25, connections: [`L${layer}-2a`, `L${layer}-2b`] },
      { id: `L${layer}-1b`, type: "event_chance", status: "unvisited", name: "機會信號", x: 22, y: 50, connections: [`L${layer}-2b`, `L${layer}-2c`] },
      { id: `L${layer}-1c`, type: "bank", status: "unvisited", name: "琪斯克銀行", x: 22, y: 75, connections: [`L${layer}-2c`, `L${layer}-2d`] },
      
      // Column 2
      { id: `L${layer}-2a`, type: "combat", status: "unvisited", name: "星海礦區", x: 42, y: 20, connections: [`L${layer}-3a`] },
      { id: `L${layer}-2b`, type: "growth", status: "unvisited", name: "基因成長艙", x: 42, y: 40, connections: [`L${layer}-3a`, `L${layer}-3b`] },
      { id: `L${layer}-2c`, type: "event_destiny", status: "unvisited", name: "命運歧路", x: 42, y: 60, connections: [`L${layer}-3b`, `L${layer}-3c`] },
      { id: `L${layer}-2d`, type: "elite", status: "unvisited", name: "帝國精英哨所", x: 42, y: 80, connections: [`L${layer}-3c`] },
      
      // Column 3
      { id: `L${layer}-3a`, type: "shop", status: "unvisited", name: "星際交易所", x: 68, y: 25, connections: [`L${layer}-boss`] },
      { id: `L${layer}-3b`, type: "event_chance", status: "unvisited", name: "虛空奇遇", x: 68, y: 50, connections: [`L${layer}-boss`] },
      { id: `L${layer}-3c`, type: "heal", status: "unvisited", name: "行星安息所", x: 68, y: 75, connections: [`L${layer}-boss`] },
      
      { id: `L${layer}-boss`, type: "boss", status: "unvisited", name: isBossLayer ? "最終毀滅者" : `第 ${layer} 星區守護者`, x: 90, y: 50, connections: [] },
    ];
    return nodes;
  };
