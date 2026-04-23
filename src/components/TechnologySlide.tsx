import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Cpu, Sun, Shield, Thermometer, ArrowRight, ArrowLeft } from 'lucide-react';

const techData = {
  monocrystalline: {
    name: 'Monocrystalline',
    description: 'Highest efficiency and space-efficient, but comes at a higher initial cost. Best for residential and commercial rooftops with limited space.',
    efficiency: 22,
    cost: 40, // Lower is better in radar, but we'll map it: 100 - cost
    durability: 90,
    tempTolerance: 75,
    color: '#f59e0b'
  },
  polycrystalline: {
    name: 'Polycrystalline',
    description: 'Cost-effective with moderate efficiency. Good for large-scale solar farms where space is not a primary constraint.',
    efficiency: 17,
    cost: 70,
    durability: 85,
    tempTolerance: 65,
    color: '#3b82f6'
  },
  thinFilm: {
    name: 'Thin-Film',
    description: 'Flexible and lightweight with the best temperature tolerance, but requires the most space due to lower efficiency.',
    efficiency: 12,
    cost: 90,
    durability: 70,
    tempTolerance: 95,
    color: '#10b981'
  }
};

type TechKey = keyof typeof techData;

export function TechnologySlide({ onNext, onBack }: { onNext: () => void, onBack: () => void }) {
  const [activeTech, setActiveTech] = useState<TechKey>('monocrystalline');

  const radarData = [
    { subject: 'Efficiency', A: techData.monocrystalline.efficiency * 4.5, B: techData.polycrystalline.efficiency * 4.5, C: techData.thinFilm.efficiency * 4.5, fullMark: 100 },
    { subject: 'Affordability', A: techData.monocrystalline.cost, B: techData.polycrystalline.cost, C: techData.thinFilm.cost, fullMark: 100 },
    { subject: 'Durability', A: techData.monocrystalline.durability, B: techData.polycrystalline.durability, C: techData.thinFilm.durability, fullMark: 100 },
    { subject: 'Heat Tolerance', A: techData.monocrystalline.tempTolerance, B: techData.polycrystalline.tempTolerance, C: techData.thinFilm.tempTolerance, fullMark: 100 },
  ];

  return (
    <div className="flex flex-col h-full w-full p-8 lg:p-12 overflow-y-auto relative z-10">
      <div className="flex justify-between items-center mb-10">
        <div>
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center transition-colors">
            &larr; Back to Environment
          </button>
          <h2 className="text-2xl font-bold text-gray-900">PV Technologies</h2>
          
        </div>
        <button onClick={onNext} className="bg-white/60 hover:bg-white/80 backdrop-blur-md border border-white/50 text-gray-900 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg text-xs">
          Next <ArrowRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        {/* Left Column: Selection & Details */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl rounded-3xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Select Technology</h3>
            <div className="flex flex-col gap-3">
              {(Object.keys(techData) as TechKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveTech(key)}
                  className={`p-4 rounded-2xl border transition-all text-left flex items-center justify-between ${
                    activeTech === key 
                      ? 'bg-white/80 border-amber-400 shadow-md' 
                      : 'bg-white/20 border-white/40 hover:bg-white/40'
                  }`}
                >
                  <span className="font-medium text-gray-800">{techData[key].name}</span>
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: techData[key].color }} />
                </button>
              ))}
            </div>
          </div>

          <motion.div 
            key={activeTech}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl rounded-3xl p-8 flex-1"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-white/60 shadow-sm" style={{ color: techData[activeTech].color }}>
                <Cpu size={32} />
              </div>
              <h3 className="text-3xl font-light text-gray-900">{techData[activeTech].name}</h3>
            </div>
            <p className="text-gray-600 leading-relaxed mb-8 text-lg">
              {techData[activeTech].description}
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/50 rounded-2xl p-4 border border-white/40">
                <div className="flex items-center gap-2 text-amber-600 mb-1">
                  <Sun size={18} />
                  <span className="text-sm font-semibold uppercase">Efficiency</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{techData[activeTech].efficiency}%</span>
              </div>
              <div className="bg-white/50 rounded-2xl p-4 border border-white/40">
                <div className="flex items-center gap-2 text-red-500 mb-1">
                  <Thermometer size={18} />
                  <span className="text-sm font-semibold uppercase">Heat Tol.</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">{techData[activeTech].tempTolerance}/100</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Column: Radar Chart */}
        <div className="lg:col-span-7 bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl rounded-3xl p-8 flex flex-col items-center justify-center min-h-[400px]">
          <h3 className="text-xl font-semibold text-gray-800 mb-2 w-full text-center">Performance Matrix</h3>
          <p className="text-gray-500 text-sm mb-8 text-center">Comparing key characteristics of photovoltaic cells</p>
          
          <div className="w-full h-full max-h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="#cbd5e1" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 14, fontWeight: 500 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}
                />
                <Radar name="Monocrystalline" dataKey="A" stroke={techData.monocrystalline.color} strokeWidth={3} fill={techData.monocrystalline.color} fillOpacity={activeTech === 'monocrystalline' ? 0.5 : 0.1} />
                <Radar name="Polycrystalline" dataKey="B" stroke={techData.polycrystalline.color} strokeWidth={3} fill={techData.polycrystalline.color} fillOpacity={activeTech === 'polycrystalline' ? 0.5 : 0.1} />
                <Radar name="Thin-Film" dataKey="C" stroke={techData.thinFilm.color} strokeWidth={3} fill={techData.thinFilm.color} fillOpacity={activeTech === 'thinFilm' ? 0.5 : 0.1} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
