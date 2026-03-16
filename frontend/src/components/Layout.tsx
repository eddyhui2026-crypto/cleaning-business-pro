import { useState } from 'react';
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Users, 
  Settings, 
  Menu, 
  X, 
  LogOut,
  Sparkles
} from 'lucide-react';
// 1. 匯入 supabase
import { supabase } from '../lib/supabaseClient';

interface Props {
  children: React.ReactNode;
}

export const Layout = ({ children }: Props) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard', active: true },
    { name: 'Jobs & Calendar', icon: CalendarIcon, href: '/calendar', active: false },
    { name: 'Staff Members', icon: Users, href: '/staff', active: false },
    { name: 'Settings', icon: Settings, href: '/settings', active: false },
  ];

  // 2. 定義登出函式
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error.message);
    }
    // 注意：這裡不需要寫跳轉邏輯，App.tsx 會自動處理
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* 1. Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-slate-200">
        <div className="p-8 flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <Sparkles className="text-white" size={24} />
          </div>
          <span className="font-bold text-xl text-slate-900 tracking-tight">CleaningPro</span>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                item.active 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon size={20} />
              {item.name}
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          {/* 3. 綁定登出事件 */}
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all font-medium"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* 2. Mobile Header */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-indigo-600" size={24} />
            <span className="font-bold text-lg text-slate-900">CleaningPro</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <Menu size={24} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* 4. Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          
          <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-white shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-6 flex items-center justify-between border-b border-slate-100">
              <span className="font-bold text-xl text-indigo-600">Menu</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400">
                <X size={24} />
              </button>
            </div>
            
            <nav className="flex-1 p-4 space-y-2">
              {navigation.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-4 rounded-xl font-bold text-slate-600 active:bg-indigo-50 active:text-indigo-700"
                >
                  <item.icon size={22} />
                  {item.name}
                </a>
              ))}
              {/* 5. 手機版也補上登出按鈕 */}
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-4 rounded-xl font-bold text-rose-500 active:bg-rose-50"
              >
                <LogOut size={22} />
                Logout
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
};