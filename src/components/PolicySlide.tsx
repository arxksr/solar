import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Landmark, FileText, Scale, ArrowRight, ShieldCheck } from 'lucide-react';

const policyData = {
  fit: {
    title: 'Feed-in Tariffs (FiT)',
    icon: Landmark,
    description: 'Guarantees a fixed premium price for solar energy fed back into the grid, ensuring long-term investment security for developers and homeowners.',
    impact: 'High immediate adoption',
    chartData: [
      { year: '2024', adoption: 10, funding: 50 },
      { year: '2025', adoption: 25, funding: 80 },
      { year: '2026', adoption: 45, funding: 120 },
      { year: '2027', adoption: 70, funding: 100 },
      { year: '2028', adoption: 90, funding: 60 },
    ]
  },
  tax: {
    title: 'Tax Incentives',
    icon: FileText,
    description: 'Reduces the upfront cost of solar installations through significant tax credits and rebates, making solar accessible to a broader demographic.',
    impact: 'Steady, sustainable growth',
    chartData: [
      { year: '2024', adoption: 15, funding: 100 },
      { year: '2025', adoption: 30, funding: 110 },
      { year: '2026', adoption: 50, funding: 120 },
      { year: '2027', adoption: 75, funding: 130 },
      { year: '2028', adoption: 105, funding: 140 },
    ]
  },
  netMetering: {
    title: 'Net Metering',
    icon: Scale,
    description: 'Allows consumers to offset their electricity bills by exporting excess solar power to the grid, paying only for their "net" energy use.',
    impact: 'Empowers residential users',
    chartData: [
      { year: '2024', adoption: 5, funding: 20 },
      { year: '2025', adoption: 20, funding: 25 },
      { year: '2026', adoption: 40, funding: 30 },
      { year: '2027', adoption: 80, funding: 35 },
      { year: '2028', adoption: 130, funding: 40 },
    ]
  }
};

type PolicyKey = keyof typeof policyData;

export function PolicySlide({ onNext, onBack }: { onNext: () => void, onBack: () => void }) {
  const [activePolicy, setActivePolicy] = useState<PolicyKey>('fit');

  return (
    <div className="flex flex-col h-full w-full p-8 lg:p-12 overflow-y-auto relative z-10">
      <div className="flex justify-between items-center mb-10">
        <div>
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center transition-colors">
            &larr; Back to Technology
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Policy & Incentives</h2>
          
        </div>
        <button onClick={onNext} className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-blue-500/30 text-xs">
          Next <ArrowRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
        {/* Left Column: Policy Selection */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {(Object.keys(policyData) as PolicyKey[]).map((key) => {
            const isActive = activePolicy === key;
            const PolicyIcon = policyData[key].icon;
            return (
              <button
                key={key}
                onClick={() => setActivePolicy(key)}
                className={`p-6 rounded-3xl border transition-all text-left flex flex-col gap-3 ${
                  isActive 
                    ? 'bg-white/80 border-blue-400 shadow-xl scale-[1.02]' 
                    : 'bg-white/40 backdrop-blur-2xl border-white/60 shadow-sm hover:bg-white/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-white/50 text-gray-600'}`}>
                    <PolicyIcon size={24} />
                  </div>
                  <h3 className={`text-xl font-semibold ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                    {policyData[key].title}
                  </h3>
                </div>
                {isActive && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="text-gray-600 text-sm leading-relaxed"
                  >
                    {policyData[key].description}
                    <div className="mt-3 flex items-center gap-2 text-blue-700 font-medium bg-blue-50/50 p-2 rounded-lg">
                      <ShieldCheck size={16} />
                      {policyData[key].impact}
                    </div>
                  </motion.div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Column: Impact Chart */}
        <div className="lg:col-span-8 bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl rounded-3xl p-8 flex flex-col">
          <div className="mb-6">
            <h3 className="text-2xl font-light text-gray-900 mb-2">Projected Market Impact</h3>
            <p className="text-gray-600">Analyzing the correlation between policy funding and solar adoption rates.</p>
          </div>
          
          <div className="flex-1 w-full min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={policyData[activePolicy].chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                <XAxis dataKey="year" axisLine={false} tickLine={false} stroke="#64748b" />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} stroke="#64748b" />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} stroke="#64748b" />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.4)'}} 
                  contentStyle={{backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)'}} 
                />
                <Legend />
                <Bar yAxisId="left" dataKey="adoption" name="Adoption Rate (GW)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar yAxisId="right" dataKey="funding" name="Policy Funding ($M)" fill="#94a3b8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
