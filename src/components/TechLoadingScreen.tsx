import React from 'react';
import { motion } from 'motion/react';
import { Cpu, Zap, Shield, Database } from 'lucide-react';

export default function TechLoadingScreen() {
  return (
    <div className="fixed inset-0 z-[1000] bg-[#05070A]/70 backdrop-blur-xl flex flex-col items-center justify-center overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute inset-0 bg-radial-gradient(ellipse_at_center,rgba(6,182,212,0.1),transparent) pointer-events-none" />

      {/* Central Animation */}
      <div className="relative mb-12">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="w-48 h-48 border-2 border-dashed border-cyan-500/30 rounded-full flex items-center justify-center"
        >
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="w-32 h-32 border-2 border-cyan-500/50 rounded-full flex items-center justify-center border-t-cyan-400"
          />
        </motion.div>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="bg-cyan-600 p-4 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.4)]"
          >
            <Cpu className="w-8 h-8 text-white" />
          </motion.div>
        </div>

        {/* Orbiting Icons */}
        {[Shield, Zap, Database].map((Icon, idx) => (
          <motion.div
            key={idx}
            animate={{ 
              rotate: 360,
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              rotate: { duration: 10 + idx * 2, repeat: Infinity, ease: "linear" },
              scale: { duration: 2, repeat: Infinity, delay: idx * 0.5 }
            }}
            className="absolute top-1/2 left-1/2 -ml-3 -mt-3 w-6 h-6"
            style={{ originX: "100px", originY: "100px" }}
          >
            <div className="bg-slate-900 border border-cyan-500/50 p-1 rounded-md">
              <Icon className="w-3 h-3 text-cyan-400" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Text Info */}
      <div className="text-center space-y-3 relative z-10">
        <h2 className="text-2xl font-black text-white tracking-[0.2em] uppercase">
          系統初始化中
        </h2>
        <div className="flex items-center justify-center gap-4 text-cyan-400 font-mono text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse" />
            核心引擎啟動
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse [animation-delay:0.2s]" />
            戰鬥協議同步
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1 h-1 bg-cyan-400 rounded-full animate-pulse [animation-delay:0.4s]" />
            全息投影渲染
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-8 w-64 h-1 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
        <motion.div 
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 3, repeat: Infinity }}
          className="h-full bg-gradient-to-r from-cyan-600 to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
        />
      </div>

      {/* Bottom Data Streams */}
      <div className="absolute bottom-8 left-8 right-8 flex justify-between text-[8px] font-mono text-slate-700 uppercase tracking-widest">
        <span>Kernel_Initialize: OK</span>
        <span>Secure_Protocol: Active</span>
        <span>Render_Buffer: 1024MB</span>
      </div>
    </div>
  );
}
