import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Leaf, Wind, Droplets, Home, ArrowRight } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const baseMetrics = {
  co2: 2.4, // Million tons
  homes: 450, // Thousand
  trees: 11, // Million
  water: 1.2 // Billion liters
};

export function EnvironmentSlide({ onBack, onNext }: { onBack: () => void, onNext: () => void }) {
  const [years, setYears] = useState(1);

  // Generate chart data based on years
  const chartData = Array.from({ length: years }, (_, i) => ({
    year: `Year ${i + 1}`,
    co2: parseFloat((baseMetrics.co2 * (i + 1)).toFixed(1)),
  }));

  return (
    <div className="flex flex-col h-full w-full p-8 lg:p-12 overflow-y-auto relative z-10">
      <div className="flex justify-between items-center mb-8">
        <div>
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center transition-colors">
            &larr; Back to Economics
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Environmental Impact</h2>
          
        </div>
        <button onClick={onNext} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/30 text-xs">
          Next <ArrowRight size={14} />
        </button>
      </div>

      <div className="max-w-6xl mx-auto w-full flex flex-col gap-8">
        {/* Interactive Slider Section */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl rounded-3xl p-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="w-full md:w-1/2">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Projected Impact Over Time</h3>
              <p className="text-gray-600 mb-6">Adjust the slider to see the cumulative environmental benefits over the lifespan of the solar projects.</p>
              
              <div className="flex items-center gap-4">
                <span className="text-gray-500 font-medium">1 Year</span>
                <input 
                  type="range" 
                  min="1" 
                  max="25" 
                  value={years} 
                  onChange={(e) => setYears(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <span className="text-gray-500 font-medium">25 Years</span>
              </div>
              <div className="mt-4 text-center">
                <span className="text-3xl font-bold text-emerald-600">{years}</span>
                <span className="text-gray-500 ml-2">Years of Operation</span>
              </div>
            </div>

            <div className="w-full md:w-1/2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCo2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="year" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.5)', color: '#111827', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ color: '#10b981', fontWeight: 600 }}
                    formatter={(value: number) => [`${value}M Tons`, 'Cumulative CO₂ Offset']}
                  />
                  <Area type="monotone" dataKey="co2" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCo2)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl p-8 rounded-3xl flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 bg-emerald-100/80 backdrop-blur-sm rounded-full flex items-center justify-center text-emerald-600 mb-6 shadow-sm">
              <Wind size={32} />
            </div>
            <h3 className="text-4xl font-black text-gray-900 mb-2">{(baseMetrics.co2 * years).toFixed(1)}M</h3>
            <p className="text-md font-medium text-gray-800 mb-2">Tons of CO₂ Offset</p>
            <p className="text-sm text-gray-500">Reduction in carbon emissions compared to fossil fuels.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl p-8 rounded-3xl flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 bg-blue-100/80 backdrop-blur-sm rounded-full flex items-center justify-center text-blue-600 mb-6 shadow-sm">
              <Home size={32} />
            </div>
            <h3 className="text-4xl font-black text-gray-900 mb-2">{Math.round(baseMetrics.homes * years)}K</h3>
            <p className="text-md font-medium text-gray-800 mb-2">Homes Powered</p>
            <p className="text-sm text-gray-500">Equivalent households supplied with clean energy.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl p-8 rounded-3xl flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 bg-green-100/80 backdrop-blur-sm rounded-full flex items-center justify-center text-green-600 mb-6 shadow-sm">
              <Leaf size={32} />
            </div>
            <h3 className="text-4xl font-black text-gray-900 mb-2">{Math.round(baseMetrics.trees * years)}M</h3>
            <p className="text-md font-medium text-gray-800 mb-2">Trees Planted</p>
            <p className="text-sm text-gray-500">Carbon sequestration equivalent to a mature forest.</p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl p-8 rounded-3xl flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 bg-cyan-100/80 backdrop-blur-sm rounded-full flex items-center justify-center text-cyan-600 mb-6 shadow-sm">
              <Droplets size={32} />
            </div>
            <h3 className="text-4xl font-black text-gray-900 mb-2">{(baseMetrics.water * years).toFixed(1)}B</h3>
            <p className="text-md font-medium text-gray-800 mb-2">Liters of Water Saved</p>
            <p className="text-sm text-gray-500">Water conserved compared to thermal power cooling.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
