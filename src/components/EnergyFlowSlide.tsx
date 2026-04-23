import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Sun, Zap, Building2, Users, MapPin, TrendingUp, Globe, Battery, Plug } from 'lucide-react';
import Xarrow, { Xwrapper } from 'react-xarrows';

const Node = ({ id, label, icon: Icon, className = "", subtitle, size = "md" }: { 
  id: string, 
  label: string, 
  icon: any, 
  className?: string, 
  subtitle?: string,
  size?: "sm" | "md" | "lg"
}) => {
  const sizeClasses = {
    sm: "w-32 p-2",
    md: "w-40 p-3",
    lg: "w-48 p-4"
  };
  
  return (
    <div 
      id={id}
      className={`bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center text-center transition-all hover:shadow-lg hover:border-blue-200 group ${sizeClasses[size]} ${className}`}
    >
      <div className="p-1.5 bg-slate-50 rounded-lg mb-1.5 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
        <Icon size={size === "lg" ? 24 : 16} />
      </div>
      <div className="font-bold text-slate-900 text-[11px] leading-tight">{label}</div>
      {subtitle && <div className="text-[9px] font-medium text-slate-400 mt-0.5">{subtitle}</div>}
    </div>
  );
};

const FlowBox = ({ id, label, icon: Icon, className = "" }: { 
  id: string, 
  label: string, 
  icon: any, 
  className?: string
}) => (
  <div 
    id={id}
    className={`bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex flex-col items-center text-center shadow-md ${className}`}
  >
    <div className="p-2 bg-amber-100 rounded-lg mb-2 text-amber-600">
      <Icon size={20} />
    </div>
    <div className="font-black text-slate-900 text-xs">{label}</div>
  </div>
);

export function EnergyFlowSlide({ onBack, onNext }: { onBack: () => void, onNext: () => void }) {
  const [arrowsLoaded, setArrowsLoaded] = useState(true);

  return (
    <div className="flex flex-col h-full w-full p-8 lg:p-12 relative z-10 overflow-hidden bg-slate-50 font-sans">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 shrink-0">
        <div>
          <button 
            onClick={onBack}
            className="text-sm font-bold text-slate-400 hover:text-slate-900 mb-2 flex items-center transition-all"
          >
            &larr; Back
          </button>
          <h2 className="text-2xl font-bold text-slate-900 mb-1 tracking-tight">Energy Value Chain</h2>
          <p className="text-amber-600 font-black tracking-[0.2em] uppercase text-[10px]">From Sun to End User</p>
        </div>
        
        <button 
          onClick={onNext}
          className="bg-slate-900 hover:bg-black text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-slate-900/30 text-xs"
        >
          Next
          <ArrowRight size={14} />
        </button>
      </div>

      <Xwrapper>
        <div className="flex-1 grid grid-cols-5 gap-4 items-center justify-center">
          {/* Column 1: Solar Resource */}
          <div className="flex flex-col items-center gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <FlowBox id="solar-resource" label="Solar Resource" icon={Sun} className="border-2 border-amber-300" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <FlowBox id="pv-output" label="PV Generation" icon={Zap} />
            </motion.div>
          </div>

          {/* Column 2: Infrastructure */}
          <div className="flex flex-col items-center gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Node id="inverter" label="Inverters" icon={Plug} subtitle="DC to AC" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Node id="transformer" label="Transformers" icon={TrendingUp} subtitle="Voltage Step-up" />
            </motion.div>
          </div>

          {/* Column 3: Grid */}
          <div className="flex flex-col items-center gap-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div 
                id="transmission-grid"
                className="bg-blue-600 text-white border-2 border-blue-400 rounded-xl p-4 flex flex-col items-center text-center shadow-lg w-44"
              >
                <Globe size={24} className="mb-2" />
                <div className="font-black text-sm">Transmission Grid</div>
                <div className="text-[10px] text-blue-200 mt-1">400kV / 132kV</div>
              </div>
            </motion.div>
          </div>

          {/* Column 4: Distribution */}
          <div className="flex flex-col items-center gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Node id="substation" label="Substations" icon={Battery} subtitle="33kV / 11kV" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Node id="distribution" label="Distribution" icon={MapPin} subtitle="Low Voltage" />
            </motion.div>
          </div>

          {/* Column 5: End Users */}
          <div className="flex flex-col items-center gap-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
            >
              <div 
                id="end-users"
                className="bg-emerald-500 text-white border-2 border-emerald-400 rounded-xl p-4 flex flex-col items-center text-center shadow-lg w-40"
              >
                <Users size={24} className="mb-2" />
                <div className="font-black text-sm">End Users</div>
                <div className="text-[10px] text-emerald-100 mt-1">Residential / Industrial</div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Connection Arrows */}
        {arrowsLoaded && (
          <>
            <Xarrow start="solar-resource" end="pv-output" strokeWidth={2} color="#f59e0b" headSize={6} />
            <Xarrow start="pv-output" end="inverter" strokeWidth={2} color="#f59e0b" headSize={6} />
            <Xarrow start="inverter" end="transformer" strokeWidth={2} color="#f59e0b" headSize={6} />
            <Xarrow start="transformer" end="transmission-grid" strokeWidth={2.5} color="#3b82f6" headSize={8} />
            <Xarrow start="transmission-grid" end="substation" strokeWidth={2.5} color="#3b82f6" headSize={8} />
            <Xarrow start="substation" end="distribution" strokeWidth={2} color="#3b82f6" headSize={6} />
            <Xarrow start="distribution" end="end-users" strokeWidth={2.5} color="#10b981" headSize={8} />
          </>
        )}
      </Xwrapper>

      {/* Legend */}
      <div className="mt-6 flex items-center justify-center gap-8 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-amber-400 rounded" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">Generation</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-blue-500 rounded" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">Transmission & Distribution</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-emerald-500 rounded" />
          <span className="text-[10px] font-bold text-slate-500 uppercase">Consumption</span>
        </div>
      </div>
    </div>
  );
}
