import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Users, GraduationCap, HeartHandshake, Home } from 'lucide-react';

export function SocialImpactSlide({ onBack, onNext }: { onBack: () => void, onNext: () => void }) {
  return (
    <div className="flex flex-col h-full w-full p-8 lg:p-12 relative z-10 overflow-y-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <button 
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-900 mb-4 flex items-center transition-colors"
          >
            &larr; Back to Environment
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Community & Social Impact</h2>
          
        </div>
        <button 
          onClick={onNext}
          className="bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all shadow-lg shadow-rose-500/30 text-xs"
        >
          Next <ArrowRight size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-xl flex flex-col items-center text-center hover:bg-white/60 transition-colors"
        >
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-4 text-rose-600">
            <Users size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Job Creation</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Projected to create over 50,000 direct and indirect jobs by 2030 in manufacturing, installation, and maintenance.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-xl flex flex-col items-center text-center hover:bg-white/60 transition-colors"
        >
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-4 text-rose-600">
            <GraduationCap size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Education & Training</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Partnering with local universities to establish specialized renewable energy engineering and vocational programs.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-xl flex flex-col items-center text-center hover:bg-white/60 transition-colors"
        >
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-4 text-rose-600">
            <Home size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Rural Electrification</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Bringing reliable, off-grid solar power to remote mountainous villages, improving quality of life and healthcare access.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-white/40 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-xl flex flex-col items-center text-center hover:bg-white/60 transition-colors"
        >
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mb-4 text-rose-600">
            <HeartHandshake size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Energy Independence</h3>
          <p className="text-gray-600 text-sm leading-relaxed">
            Reducing reliance on imported electricity and diesel generators, empowering local communities with self-sufficient energy.
          </p>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="bg-white/30 backdrop-blur-xl border border-white/50 p-8 rounded-3xl shadow-xl"
      >
        <div className="flex flex-col md:flex-row gap-8 items-center">
          <div className="md:w-1/2">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">The Human Impact</h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              The transition to solar energy in the Kurdistan Region is not just an economic or environmental imperative; it is a profound social transformation. By democratizing energy access, we are laying the foundation for a more equitable society.
            </p>
            <p className="text-gray-700 leading-relaxed">
              Reliable electricity means schools can use modern technology, hospitals can refrigerate medicines without interruption, and small businesses can operate efficiently without the noise and pollution of diesel generators.
            </p>
          </div>
          <div className="md:w-1/2 w-full">
            <div className="aspect-video rounded-2xl overflow-hidden bg-gray-200 border-4 border-white shadow-lg relative">
              <img 
                src="https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=1000&auto=format&fit=crop" 
                alt="Solar panels and community" 
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                <p className="text-white font-medium">Empowering the next generation through sustainable energy.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
