import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Milestone, Flag, Target, ArrowRight, Sun, Zap, Globe, Landmark } from 'lucide-react';

const roadmapData = [
  {
    year: '2025',
    title: 'Foundation & Infrastructure',
    icon: Milestone,
    description: 'Establishing the core grid infrastructure and initial large-scale solar farms to support future growth.',
    metrics: { capacity: '5 GW', investment: '$2B', jobs: '15,000' },
    color: 'from-blue-400 to-blue-600'
  },
  {
    year: '2030',
    title: 'Mass Adoption & Storage',
    icon: Flag,
    description: 'Widespread residential adoption coupled with utility-scale battery storage solutions for grid stability.',
    metrics: { capacity: '25 GW', investment: '$10B', jobs: '50,000' },
    color: 'from-emerald-400 to-emerald-600'
  },
  {
    year: '2040',
    title: 'Grid Parity & Export',
    icon: Target,
    description: 'Solar energy becomes the dominant source, achieving grid parity and enabling energy export to neighboring regions.',
    metrics: { capacity: '80 GW', investment: '$35B', jobs: '120,000' },
    color: 'from-amber-400 to-amber-600'
  },
  {
    year: '2050',
    title: 'Net Zero & Innovation',
    icon: Globe,
    description: 'Achieving a fully decarbonized energy sector with advanced photovoltaic materials and smart grid integration.',
    metrics: { capacity: '150 GW', investment: '$70B', jobs: '250,000' },
    color: 'from-purple-400 to-purple-600'
  }
];

export function RoadmapSlide({ onRestart, onBack }: { onRestart: () => void, onBack: () => void }) {
  const [activeYear, setActiveYear] = useState(0);

  return (
    <div className="flex flex-col h-full w-full p-8 lg:p-12 overflow-y-auto relative z-10">
      <div className="flex justify-between items-center mb-10">
        <div>
          <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-900 mb-2 flex items-center transition-colors">
            &larr; Back to Policy
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Future Outlook</h2>
          
        </div>
        <button onClick={onRestart} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/30 text-xs">
          Restart <ArrowRight size={14} />
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-12 items-center justify-center">
        
        {/* Timeline Navigation */}
        <div className="w-full lg:w-1/3 flex flex-row lg:flex-col justify-between relative">
          {/* Connecting Line */}
          <div className="absolute top-1/2 left-0 w-full h-1 bg-white/50 lg:w-1 lg:h-full lg:left-1/2 lg:top-0 -translate-y-1/2 lg:-translate-x-1/2 lg:translate-y-0 rounded-full z-0"></div>
          
          {roadmapData.map((step, index) => {
            const isActive = activeYear === index;
            const StepIcon = step.icon;
            return (
              <button
                key={step.year}
                onClick={() => setActiveYear(index)}
                className={`relative z-10 flex flex-col items-center gap-4 transition-all duration-300 ${
                  isActive ? 'scale-110' : 'opacity-60 hover:opacity-100'
                }`}
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl border-4 ${
                  isActive ? 'bg-white border-emerald-500 text-emerald-600' : 'bg-white/80 border-white/50 text-gray-500'
                }`}>
                  <StepIcon size={28} />
                </div>
                <div className={`text-xl font-bold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                  {step.year}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Step Details */}
        <div className="w-full lg:w-2/3 h-full flex items-center">
          <motion.div 
            key={activeYear}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full bg-white/40 backdrop-blur-2xl border border-white/60 shadow-2xl rounded-[2rem] p-10 lg:p-14 relative overflow-hidden"
          >
            {/* Decorative Gradient Blob */}
            <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full bg-gradient-to-br ${roadmapData[activeYear].color} opacity-20 blur-3xl`}></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-6xl font-black text-gray-200 tracking-tighter">{roadmapData[activeYear].year}</span>
                <h3 className="text-3xl font-semibold text-gray-900 leading-tight">{roadmapData[activeYear].title}</h3>
              </div>
              
              <p className="text-xl text-gray-700 leading-relaxed mb-10">
                {roadmapData[activeYear].description}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white/50 border border-white/60 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
                  <Sun className="w-8 h-8 text-amber-500 mb-3" />
                  <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-1">Target Capacity</div>
                  <div className="text-3xl font-bold text-gray-900">{roadmapData[activeYear].metrics.capacity}</div>
                </div>
                
                <div className="bg-white/50 border border-white/60 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
                  <Landmark className="w-8 h-8 text-blue-500 mb-3" />
                  <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-1">Investment</div>
                  <div className="text-3xl font-bold text-gray-900">{roadmapData[activeYear].metrics.investment}</div>
                </div>
                
                <div className="bg-white/50 border border-white/60 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
                  <Zap className="w-8 h-8 text-emerald-500 mb-3" />
                  <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-1">Green Jobs</div>
                  <div className="text-3xl font-bold text-gray-900">{roadmapData[activeYear].metrics.jobs}</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
