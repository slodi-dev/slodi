"use client";

export type TabId = "overview" | "instructions" | "materials" | "comments" | "related";

interface ProgramTabsProps {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}

export default function ProgramTabs({ activeTab, onChange }: ProgramTabsProps) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "instructions", label: "Instructions" },
    { id: "materials", label: "Materials" },
    { id: "comments", label: "Comments" },
    { id: "related", label: "Related" },
  ];

  return (
    <div className="program-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
