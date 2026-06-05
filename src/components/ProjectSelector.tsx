import { useState } from "react";
import { Kanban, CheckSquare, Square, ChevronRight, Search } from "lucide-react";
import type { JiraProject } from "@/utils/jira";

interface ProjectSelectorProps {
  projects: JiraProject[];
  onSelect: (selectedKeys: string[]) => void;
  onCancel: () => void;
  initialSelected?: string[];
}

export function ProjectSelector({
  projects,
  onSelect,
  onCancel,
  initialSelected,
}: ProjectSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (initialSelected && initialSelected.length > 0) {
      return new Set(initialSelected);
    }
    // Default to first project if none selected
    return new Set(projects.length > 0 ? [projects[0].key] : []);
  });
  const [search, setSearch] = useState("");

  const toggleProject = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Allow deselecting, but we will block analyzing if none are selected
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.key.toLowerCase().includes(search.toLowerCase())
  );

  const toggleAll = () => {
    const allFilteredKeys = filteredProjects.map((p) => p.key);
    const allFilteredAreSelected = allFilteredKeys.every((key) => selected.has(key));

    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredAreSelected) {
        // Deselect all filtered
        allFilteredKeys.forEach((key) => next.delete(key));
      } else {
        // Select all filtered
        allFilteredKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  };

  const allFilteredSelected =
    filteredProjects.length > 0 &&
    filteredProjects.every((p) => selected.has(p.key));
  const noneSelected = selected.size === 0;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="fixed inset-x-4 top-[10%] z-50 mx-auto max-w-md rounded-lg border bg-card shadow-2xl animate-fade-in flex flex-col max-h-[80vh]">
        <div className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Select Jira Projects</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select one or more projects/spaces to fetch and analyze together.
          </p>
        </div>

        {/* Search Input */}
        <div className="px-5 py-2.5 border-b relative">
          <Search className="absolute left-8 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search projects by name or key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-4 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Select All */}
        {filteredProjects.length > 1 && (
          <div className="border-b px-5 py-2.5">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2.5 text-sm font-medium text-foreground hover:text-primary transition-colors w-full"
            >
              {allFilteredSelected ? (
                <CheckSquare className="h-4.5 w-4.5 text-primary" />
              ) : (
                <Square className="h-4.5 w-4.5 text-muted-foreground" />
              )}
              Select All Filtered ({filteredProjects.length} projects)
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 min-h-[220px]">
          {filteredProjects.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No projects match your search.
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isSelected = selected.has(project.key);
              return (
                <button
                  key={project.key}
                  onClick={() => toggleProject(project.key)}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors border ${
                    isSelected
                      ? "bg-primary/10 border-primary/30"
                      : "hover:bg-muted border-transparent"
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="h-4.5 w-4.5 shrink-0 text-primary" />
                  ) : (
                    <Square className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                  )}
                  <Kanban
                    className={`h-5 w-5 shrink-0 ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isSelected ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {project.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Key: {project.key}
                    </p>
                  </div>
                  {isSelected && <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t px-5 py-3 bg-muted/20">
          <span className="text-xs text-muted-foreground">
            {selected.size} of {projects.length} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="rounded-md border bg-card px-4 py-2 text-sm text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const selectedKeys = Array.from(selected);
                if (selectedKeys.length > 0) onSelect(selectedKeys);
              }}
              disabled={noneSelected}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              Analyze {selected.size > 1 ? `${selected.size} Projects` : "Project"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
