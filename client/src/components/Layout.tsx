import { Link, useLocation } from "wouter";
import { Home, Ticket, BarChart3, User, Users, HelpCircle, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/translations";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { path: "/", icon: Home, label: t('home') },
    { path: "/tickets", icon: Ticket, label: t('myTickets') },
    { path: "/results", icon: BarChart3, label: t('results') },
    { path: "/audit", icon: Search, label: 'Verify' },
    { path: "/account", icon: User, label: t('account') },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="pb-20">
        {children}
      </main>
      
      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40">
        <div className="flex justify-around py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            
            return (
              <Link key={item.path} href={item.path}>
                <button className={cn(
                  "flex flex-col items-center py-2 px-3 transition-colors",
                  isActive ? "text-green-800" : "text-gray-500"
                )}>
                  <Icon className="w-5 h-5 mb-1" />
                  <span className="text-xs">{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
