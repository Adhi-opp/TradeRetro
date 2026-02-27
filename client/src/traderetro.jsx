import React, { useState } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  DollarSign, 
  BarChart3, 
  Settings, 
  Database, 
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Play,
  Loader2,
  Calendar,
  Shield,
  PieChart
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

// Mock data for demonstration
const generateEquityCurve = () => {
  const data = [];
  let equity = 10000;
  let buyHold = 10000;
  
  for (let i = 0; i < 60; i++) {
    equity += (Math.random() - 0.45) * 200;
    buyHold += (Math.random() - 0.48) * 150;
    data.push({
      date: `Day ${i + 1}`,
      strategy: Math.round(equity),
      buyHold: Math.round(buyHold)
    });
  }
  return data;
};

const tradeHistory = [
  { date: '2024-01-15', type: 'BUY', price: 182.50, shares: 50, pnl: null },
  { date: '2024-01-18', type: 'SELL', price: 186.20, shares: 50, pnl: 185.00 },
  { date: '2024-01-22', type: 'BUY', price: 184.10, shares: 60, pnl: null },
  { date: '2024-01-25', type: 'SELL', price: 188.90, shares: 60, pnl: 288.00 },
  { date: '2024-02-01', type: 'BUY', price: 190.20, shares: 45, pnl: null },
  { date: '2024-02-05', type: 'SELL', price: 187.50, shares: 45, pnl: -121.50 },
  { date: '2024-02-10', type: 'BUY', price: 185.80, shares: 55, pnl: null },
  { date: '2024-02-14', type: 'SELL', price: 192.40, shares: 55, pnl: 363.00 },
];

const Tooltip_Component = ({ children, text }) => {
  const [show, setShow] = useState(false);
  
  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-900 border border-amber-500/30 rounded-lg text-xs text-zinc-300 whitespace-nowrap shadow-xl backdrop-blur-sm">
          {text}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-amber-500/30"></div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, change, trend, tooltip }) => {
  const isPositive = trend === 'up';
  
  return (
    <div className="relative group bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 border border-zinc-800/50 rounded-xl p-6 hover:border-amber-500/30 transition-all duration-300 overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-zinc-400 text-sm font-medium tracking-wide">{title}</h3>
            {tooltip && (
              <Tooltip_Component text={tooltip}>
                <Info className="w-4 h-4 text-zinc-600 hover:text-amber-500 transition-colors" />
              </Tooltip_Component>
            )}
          </div>
          {trend && (
            <div className={`p-1.5 rounded-lg ${isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-end gap-3">
          <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
          {change && (
            <div className={`text-sm font-semibold mb-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{change}
            </div>
          )}
        </div>
      </div>
      
      {/* Decorative corner accent */}
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-bl-full"></div>
    </div>
  );
};

const TradeRetro = () => {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [strategyType, setStrategyType] = useState('ma-crossover');
  const [selectedAsset, setSelectedAsset] = useState('AAPL');
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // Strategy parameters
  const [shortMA, setShortMA] = useState(50);
  const [longMA, setLongMA] = useState(200);
  const [rsiPeriod, setRsiPeriod] = useState(14);
  const [rsiOverbought, setRsiOverbought] = useState(70);
  const [rsiOversold, setRsiOversold] = useState(30);
  const [initialCapital, setInitialCapital] = useState(10000);
  const [brokerageFees, setBrokerageFees] = useState(0.1);
  
  const equityData = generateEquityCurve();
  
  const handleBacktest = () => {
    setIsBacktesting(true);
    setTimeout(() => {
      setIsBacktesting(false);
      setShowResults(true);
    }, 2000);
  };
  
  const navItems = [
    { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
    { id: 'builder', icon: Zap, label: 'Strategy Builder' },
    { id: 'data', icon: Database, label: 'Historical Data' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];
  
  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        
        * {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
        }
        
        .font-mono {
          font-family: 'JetBrains Mono', monospace;
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
        
        .animate-slide-down {
          animation: slideDown 0.4s ease-out;
        }
        
        .animate-fade-in {
          animation: fadeIn 0.6s ease-out;
        }
        
        .shimmer {
          background: linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.1), transparent);
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
        
        .glow-border {
          box-shadow: 0 0 20px rgba(251, 191, 36, 0.2);
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #18181b;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
        
        /* Gradient text */
        .gradient-text {
          background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>
      
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-zinc-900/50 backdrop-blur-xl border-r border-zinc-800/50 z-50">
        {/* Logo area */}
        <div className="p-6 border-b border-zinc-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Activity className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-bold gradient-text">TradeRetro</h1>
              <p className="text-xs text-zinc-500 font-medium">Backtest Engine</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-400 border border-amber-500/30'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={2} />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>
        
        {/* Bottom accent */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-amber-500">STUDY PROJECT</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Event-driven validation for retail algorithmic trading strategies
            </p>
          </div>
        </div>
      </aside>
      
      {/* Main content */}
      <main className="ml-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800/50">
          <div className="px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Event-Driven Validation Engine</h2>
                <p className="text-sm text-zinc-400 mt-1">Quantitative backtesting with historical market data</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <span className="text-xs font-mono font-semibold text-amber-400">Phase: Study Project</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        {/* Content area */}
        <div className="p-8 space-y-6">
          {/* Strategy Builder Section */}
          <div className="animate-slide-down">
            <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 border border-zinc-800/50 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-b border-zinc-800/50 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/20 rounded-lg">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Strategy Builder</h3>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Strategy Type Selection */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-zinc-400 mb-2">Strategy Type</label>
                    <select
                      value={strategyType}
                      onChange={(e) => setStrategyType(e.target.value)}
                      className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                    >
                      <option value="ma-crossover">Moving Average Crossover</option>
                      <option value="rsi-momentum">RSI Momentum</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-zinc-400 mb-2">Select Asset</label>
                    <select
                      value={selectedAsset}
                      onChange={(e) => setSelectedAsset(e.target.value)}
                      className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                    >
                      <option value="AAPL">AAPL - Apple Inc.</option>
                      <option value="TSLA">TSLA - Tesla Inc.</option>
                      <option value="INFY">INFY - Infosys Ltd.</option>
                      <option value="NIFTY50">NIFTY50 - Index</option>
                    </select>
                  </div>
                </div>
                
                {/* Strategy-specific parameters */}
                {strategyType === 'ma-crossover' && (
                  <div className="grid grid-cols-2 gap-6 p-6 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-400 mb-2">Short MA Period</label>
                      <input
                        type="number"
                        value={shortMA}
                        onChange={(e) => setShortMA(Number(e.target.value))}
                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white font-mono focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-zinc-400 mb-2">Long MA Period</label>
                      <input
                        type="number"
                        value={longMA}
                        onChange={(e) => setLongMA(Number(e.target.value))}
                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white font-mono focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
                
                {strategyType === 'rsi-momentum' && (
                  <div className="grid grid-cols-3 gap-6 p-6 bg-zinc-800/30 rounded-xl border border-zinc-700/30">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-400 mb-2">RSI Period</label>
                      <input
                        type="number"
                        value={rsiPeriod}
                        onChange={(e) => setRsiPeriod(Number(e.target.value))}
                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white font-mono focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-zinc-400 mb-2">Overbought Level</label>
                      <input
                        type="number"
                        value={rsiOverbought}
                        onChange={(e) => setRsiOverbought(Number(e.target.value))}
                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white font-mono focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-zinc-400 mb-2">Oversold Level</label>
                      <input
                        type="number"
                        value={rsiOversold}
                        onChange={(e) => setRsiOversold(Number(e.target.value))}
                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white font-mono focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}
                
                {/* Date Range */}
                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Historical Lookback Period
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="date"
                      defaultValue="2024-01-01"
                      className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                    />
                    <input
                      type="date"
                      defaultValue="2024-12-31"
                      className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                    />
                  </div>
                </div>
                
                {/* Risk Settings */}
                <div className="p-6 bg-gradient-to-br from-orange-500/5 to-amber-500/5 rounded-xl border border-amber-500/20">
                  <h4 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Risk Settings
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-400 mb-2">Initial Capital (USD)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-zinc-500" />
                        <input
                          type="number"
                          value={initialCapital}
                          onChange={(e) => setInitialCapital(Number(e.target.value))}
                          className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg pl-10 pr-4 py-3 text-white font-mono focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-zinc-400 mb-2">Brokerage Fees (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={brokerageFees}
                        onChange={(e) => setBrokerageFees(Number(e.target.value))}
                        className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg px-4 py-3 text-white font-mono focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Execute Button */}
                <button
                  onClick={handleBacktest}
                  disabled={isBacktesting}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 ${
                    isBacktesting
                      ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 glow-border'
                  }`}
                >
                  {isBacktesting ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Running Backtest...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Play className="w-5 h-5" />
                      Execute Backtest
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Performance Dashboard */}
          {showResults && (
            <div className="animate-fade-in space-y-6">
              {/* Performance Stats */}
              <div className="grid grid-cols-4 gap-6">
                <StatCard
                  title="Net Profit"
                  value="+12.4%"
                  change="+$1,240"
                  trend="up"
                  tooltip="Total return on investment after fees"
                />
                <StatCard
                  title="Max Drawdown"
                  value="-8.2%"
                  change="-$820"
                  trend="down"
                  tooltip="Largest peak-to-trough decline"
                />
                <StatCard
                  title="Sharpe Ratio"
                  value="1.85"
                  tooltip="Risk-adjusted return (>1 is good, >2 is excellent)"
                />
                <StatCard
                  title="Win Ratio"
                  value="62.5%"
                  change="5/8 trades"
                  trend="up"
                  tooltip="Percentage of profitable trades"
                />
              </div>
              
              {/* Equity Curve Chart */}
              <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/5 border-b border-zinc-800/50 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/20 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white">Equity Curve Analysis</h3>
                        <p className="text-sm text-zinc-400">Strategy vs. Buy & Hold Benchmark</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                        <span className="text-sm text-zinc-400">Strategy</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
                        <span className="text-sm text-zinc-400">Buy & Hold</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={equityData}>
                      <defs>
                        <linearGradient id="colorStrategy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorBuyHold" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#71717a"
                        tick={{ fill: '#a1a1aa', fontSize: 12 }}
                      />
                      <YAxis 
                        stroke="#71717a"
                        tick={{ fill: '#a1a1aa', fontSize: 12 }}
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#18181b',
                          border: '1px solid #3f3f46',
                          borderRadius: '8px',
                          color: '#fff'
                        }}
                        formatter={(value) => [`$${value.toLocaleString()}`, '']}
                      />
                      <Area
                        type="monotone"
                        dataKey="strategy"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        fill="url(#colorStrategy)"
                        name="Strategy"
                      />
                      <Area
                        type="monotone"
                        dataKey="buyHold"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        fill="url(#colorBuyHold)"
                        name="Buy & Hold"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Trade History Table */}
              <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 border border-zinc-800/50 rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-violet-500/10 to-purple-500/5 border-b border-zinc-800/50 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-500/20 rounded-lg">
                      <PieChart className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Trade History</h3>
                      <p className="text-sm text-zinc-400">Detailed execution log</p>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800/50 bg-zinc-900/30">
                        <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-400 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider">Price</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider">Shares</th>
                        <th className="px-6 py-4 text-right text-xs font-semibold text-zinc-400 uppercase tracking-wider">P&L</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/30">
                      {tradeHistory.map((trade, index) => (
                        <tr key={index} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="px-6 py-4 text-sm text-zinc-300 font-mono">{trade.date}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                              trade.type === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                              {trade.type === 'BUY' ? (
                                <ArrowUpRight className="w-3 h-3" />
                              ) : (
                                <ArrowDownRight className="w-3 h-3" />
                              )}
                              {trade.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-300 text-right font-mono">${trade.price.toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm text-zinc-300 text-right font-mono">{trade.shares}</td>
                          <td className="px-6 py-4 text-sm text-right font-mono">
                            {trade.pnl !== null ? (
                              <span className={trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-zinc-600">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TradeRetro;
