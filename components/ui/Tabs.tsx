import React, { createContext, useContext, useState } from 'react';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

// FIX: Changed from a const arrow function to a function declaration to resolve component typing errors.
// FIX: Made children optional to resolve a TypeScript error where it was incorrectly reported as missing.
export function Tabs({ defaultValue, onValueChange, children, className }: { defaultValue: string, onValueChange?: (value: string) => void, children?: React.ReactNode, className?: string }) {
  const [activeTab, setActiveTabState] = useState(defaultValue);

  const setActiveTab = (value: string) => {
    setActiveTabState(value);
    if (onValueChange) {
      onValueChange(value);
    }
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

// FIX: Changed from a const arrow function to a function declaration for consistency.
function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tabs components must be used within a Tabs component');
  return context;
}

// FIX: Changed from a const arrow function to a function declaration to resolve component typing errors.
// FIX: Made children optional to resolve a TypeScript error where it was incorrectly reported as missing.
export function TabsList({ children, className }: { children?: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-brand-dark-900 p-1 rounded-lg flex items-center ${className}`}>
      {children}
    </div>
  );
}

// FIX: Changed from a const arrow function to a function declaration to resolve component typing errors.
// FIX: Made children optional to resolve a TypeScript error where it was incorrectly reported as missing.
export function TabsTrigger({ value, children, className }: { value: string, children?: React.ReactNode, className?: string }) {
  const { activeTab, setActiveTab } = useTabs();
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-brand-dark-950 ${
        isActive ? 'bg-brand-blue-500/20 text-brand-blue-500 shadow-none' : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
      } ${className}`}
    >
      {children}
    </button>
  );
}

// FIX: Changed from a const arrow function to a function declaration to resolve component typing errors.
// FIX: Made children optional to resolve a TypeScript error where it was incorrectly reported as missing.
export function TabsContent({ value, children, className }: { value: string, children?: React.ReactNode, className?: string }) {
  const { activeTab } = useTabs();
  const isActive = activeTab === value;
  return isActive ? <div className={`mt-4 ${className}`}>{children}</div> : null;
}
