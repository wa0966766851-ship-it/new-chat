import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { Settings, RotateCcw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  pos: { x: number, y: number };
  setPos: (pos: { x: number, y: number }) => void;
  size: { width: number, height: number };
  setSize: (size: { width: number, height: number }) => void;
  opacity: number;
  setOpacity: (opacity: number) => void;
  scale: number;
  setScale: (scale: number) => void;
  onReset: () => void;
  className?: string;
  animate?: any;
}

export function DraggableResizablePanel({ 
  children, pos, setPos, size, setSize, opacity, setOpacity, scale, setScale, onReset, className,
  animate: customAnimate
}: Props) {
  const startResizing = (e: React.PointerEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent drag start
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;
    const startPosX = pos.x;
    const startPosY = pos.y;

    const onPointerMove = (moveEvent: PointerEvent) => {
      let newWidth = startW;
      let newHeight = startH;
      let newPosX = startPosX;
      let newPosY = startPosY;

      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      // Handle horizontal resizing
      if (direction.includes('r')) {
        newWidth = Math.max(150, startW + deltaX);
      } else if (direction.includes('l')) {
        newWidth = Math.max(150, startW - deltaX);
        newPosX = startPosX + (startW - newWidth);
      }

      // Handle vertical resizing
      if (direction.includes('b')) {
        newHeight = Math.max(100, startH + deltaY);
      } else if (direction.includes('t')) {
        newHeight = Math.max(100, startH - deltaY);
        newPosY = startPosY + (startH - newHeight);
      }

      setSize({ width: newWidth, height: newHeight });
      setPos({ x: newPosX, y: newPosY });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={pos}
      animate={{
        x: pos.x,
        y: pos.y,
        ...customAnimate
      }}
      onDragEnd={(_, info) => setPos({ x: pos.x + info.offset.x, y: pos.y + info.offset.y })}
      className={`absolute bg-[#0A0D14]/95 backdrop-blur-xl border border-gray-700 rounded-lg overflow-hidden shadow-xl pointer-events-auto group/panel ${className}`}
      style={{ width: size.width, height: size.height, opacity, zIndex: 40 }}
    >
      <div className="absolute top-2 right-2 z-50 flex items-center gap-1 opacity-0 group-hover/panel:opacity-100 transition-opacity">
        <button 
          onClick={onReset} 
          className="p-1.5 rounded-md hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
          title="重置佈局"
        >
          <RotateCcw size={12}/>
        </button>
        <div className="p-1.5 rounded-md hover:bg-white/10 cursor-move transition-colors">
          <Settings size={12} className="text-gray-500" />
        </div>
      </div>
      <div className="h-full overflow-auto" style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: `${100 / scale}%`, height: `${100 / scale}%` }}>
        {children}
      </div>

      {/* Resize Handles - Invisible but active zones */}
      {/* Sides */}
      <div className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-cyan-500/30 z-[60]" onPointerDown={(e) => startResizing(e, 't')} />
      <div className="absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-cyan-500/30 z-[60]" onPointerDown={(e) => startResizing(e, 'b')} />
      <div className="absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize hover:bg-cyan-500/30 z-[60]" onPointerDown={(e) => startResizing(e, 'l')} />
      <div className="absolute top-0 bottom-0 right-0 w-1 cursor-ew-resize hover:bg-cyan-500/30 z-[60]" onPointerDown={(e) => startResizing(e, 'r')} />
      
      {/* Corners */}
      <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize hover:bg-cyan-500/50 z-[70]" onPointerDown={(e) => startResizing(e, 'tl')} />
      <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize hover:bg-cyan-500/50 z-[70]" onPointerDown={(e) => startResizing(e, 'tr')} />
      <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize hover:bg-cyan-500/50 z-[70]" onPointerDown={(e) => startResizing(e, 'bl')} />
      <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-cyan-500/50 z-[70]" onPointerDown={(e) => startResizing(e, 'br')} />
      
      {/* Decorative handle corner */}
      <div className="absolute bottom-1 right-1 w-2 h-2 border-r border-b border-gray-600/30 pointer-events-none" />
    </motion.div>
  );
}
