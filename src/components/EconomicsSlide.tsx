import React, { useState } from 'react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { TrendingUp, DollarSign, Battery, ArrowRight } from 'lucide-react';

const scenarios = {
  conservative: {
    label: 'Conservative',
    payback: '4.5 Years',
    irr: '14.2%',
    lcoe: '$0.045',
    roiData: [
      { year: 'Year 1', cost: 1200, savings: 200 },
      { year: 'Year 3', cost: 1300, savings: 750 },
      { year: 'Year 5', cost: 1400, savings: 1300 },
      { year: 'Year 7', cost: 1500, savings: 1900 },
      { year: 'Year 10', cost: 1600, savings: 3000 },
    ],
    capacityData: [
      { year: '2024', mw: 30 },
      { year: '2025', mw: 80 },
      { year: '2026', mw: 150 },
      { year: '2027', mw: 300 },
      { year: '2028', mw: 500 },
    ]
  },
  expected: {
    label: 'Expected',
    payback: '3.2 Years',
    irr: '18.5%',
    lcoe: '$0.032',
    roiData: [
      { year: 'Year 1', cost: 1200, savings: 300 },
      { year: 'Year 3', cost: 1300, savings: 950 },
      { year: 'Year 5', cost: 1400, savings: 1700 },
      { year: 'Year 7', cost: 1500, savings: 2600 },
      { year: 'Year 10', cost: 1600, savings: 4200 },
    ],
    capacityData: [
      { year: '2024', mw: 50 },
      { year: '2025', mw: 120 },
      { year: '2026', mw: 300 },
      { year: '2027', mw: 650 },
      { year: '2028', mw: 1200 },
    ]
  },
  optimistic: {
    label: 'Optimistic',
    payback: '2.4 Years',
    irr: '24.1%',
    lcoe: '$0.025',
    roiData: [
      { year: 'Year 1', cost: 1200, savings: 450 },
      { year: 'Year 3', cost: 1300, savings: 1400 },
      { year: 'Year 5', cost: 1400, savings: 2500 },
      { year: 'Year 7', cost: 1500, savings: 3800 },
      { year: 'Year 10', cost: 1600, savings: 6000 },
    ],
    capacityData: [
      { year: '2024', mw: 80 },
      { year: '2025', mw: 200 },
      { year: '2026', mw: 500 },
      { year: '2027', mw: 1100 },
      { year: '2028', mw: 2000 },
    ]
  }
};

type ScenarioKey = keyof typeof scenarios;

export function EconomicsSlide({ onNext, onBack }: { onNext: () => void, onBack: () => void }) {
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('expected');
  const currentData = scenarios[activeScenario];

  return (
    <div className="flex flex-col h-full w-full p-8 lg:p-12 overflow-y-auto relative z-10">
      <div className="flex justify-between items-center mb-10">
        <div>
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center transition-colors">
            &larr; Back to Atlas
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Economic Viability</h2>
          
        </div>
        <button onClick={onNext} className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/30 text-xs">
          Next <ArrowRight size={14} />
        </button>
      </div>

      <div className="flex justify-center mb-8">
        <div className="bg-white/40 backdrop-blur-md border border-white/60 p-1 rounded-xl inline-flex shadow-sm">
          {(Object.keys(scenarios) as ScenarioKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setActiveScenario(key)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                activeScenario === key 
                  ? 'bg-white shadow-md text-amber-600' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}
            >
              {scenarios[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <motion.div 
          key={`payback-${activeScenario}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl p-6 rounded-3xl flex items-center gap-4"
        >
          <div className="bg-green-100/80 p-4 rounded-full text-green-600 shadow-sm">
            <DollarSign size={32} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Est. Payback Period</p>
            <p className="text-3xl font-bold text-gray-900">{currentData.payback}</p>
          </div>
        </motion.div>
        
        <motion.div 
          key={`irr-${activeScenario}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl p-6 rounded-3xl flex items-center gap-4"
        >
          <div className="bg-blue-100/80 p-4 rounded-full text-blue-600 shadow-sm">
            <TrendingUp size={32} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">IRR (20 Years)</p>
            <p className="text-3xl font-bold text-gray-900">{currentData.irr}</p>
          </div>
        </motion.div>

        <motion.div 
          key={`lcoe-${activeScenario}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl p-6 rounded-3xl flex items-center gap-4"
        >
          <div className="bg-amber-100/80 p-4 rounded-full text-amber-600 shadow-sm">
            <Battery size={32} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">LCOE</p>
            <p className="text-3xl font-bold text-gray-900">{currentData.lcoe}<span className="text-lg text-gray-500 font-normal">/kWh</span></p>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 min-h-[400px]">
        <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl p-6 rounded-3xl flex flex-col">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Cumulative Costs vs. Savings ($M)</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currentData.roiData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} stroke="#64748b" />
                <YAxis axisLine={false} tickLine={false} stroke="#64748b" />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.4)'}} contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                <Legend />
                <Bar dataKey="cost" name="Cumulative Cost" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="savings" name="Cumulative Savings" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl p-6 rounded-3xl flex flex-col">
          <h3 className="text-lg font-semibold text-gray-800 mb-6">Projected Capacity Growth (MW)</h3>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentData.capacityData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} stroke="#64748b" />
                <YAxis axisLine={false} tickLine={false} stroke="#64748b" />
                <Tooltip contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                <Line type="monotone" dataKey="mw" name="Capacity (MW)" stroke="#f59e0b" strokeWidth={4} dot={{r: 6, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 8}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
