import React, { useState } from 'react';

interface Tab {
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: number;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ defaultTab = 0, tabs, className = '' }) => {
  const [activeTab, setActiveTab] = useState(defaultTab);

  if (!tabs || tabs.length === 0) {
    return null;
  }

  const handleTabClick = (e: React.MouseEvent<HTMLButtonElement>, index: number) => {
    e.preventDefault();
    if (!tabs[index].disabled) {
      setActiveTab(index);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex border-b border-gray-200" role="tablist">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={(e) => handleTabClick(e, index)}
            type="button"
            role="tab"
            aria-selected={activeTab === index}
            aria-controls={`tab-panel-${index}`}
            disabled={tab.disabled}
            className={`px-4 py-2 font-bold transition-colors duration-200 
              ${tab.disabled
              ? 'text-gray-100 cursor-not-allowed'
              : activeTab === index
                ? 'text-[#f414e6] border-b-2 border-[#f414e6] -mb-px'
                : 'text-gray-100 hover:text-[#f414e6]'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={index}
          role="tabpanel"
          id={`tab-panel-${index}`}
          className={`py-4 ${activeTab === index ? 'block' : 'hidden'}`}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
};
