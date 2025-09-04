import React, { useState, useEffect } from "react";
import { WorkflowComponentProps } from "../types/workflow";
import "./SearchInterface.css";

interface SearchResult {
  id: string;
  name: string;
  description?: string;
}

export const SearchInterface: React.FC<WorkflowComponentProps> = ({
  workflow,
  searchValue,
  selectedIndex,
  onNavigate,
  onBack,
  onClose,
  onUpdateSearch,
}) => {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock search function - in real implementation, this would call an API
  const performSearch = async (query: string): Promise<SearchResult[]> => {
    if (!query.trim()) return [];

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Mock results based on workflow type
    if (workflow.id === "search-users") {
      return [
        { id: "1", name: "John Doe", description: "Software Engineer" },
        { id: "2", name: "Jane Smith", description: "Product Manager" },
        { id: "3", name: "Bob Johnson", description: "Designer" },
      ].filter(
        (user) =>
          user.name.toLowerCase().includes(query.toLowerCase()) ||
          user.description?.toLowerCase().includes(query.toLowerCase())
      );
    }

    return [];
  };

  useEffect(() => {
    const searchQuery = searchValue.trim();
    if (!searchQuery) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    performSearch(searchQuery)
      .then(setResults)
      .finally(() => setIsLoading(false));
  }, [searchValue, workflow.id]);

  const handleResultSelect = (result: SearchResult) => {
    if (workflow.nextWorkflow) {
      onNavigate(workflow.nextWorkflow, {
        userId: result.id,
        displayName: result.name,
        userData: result,
      });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent, result: SearchResult) => {
    if (event.key === "Enter") {
      handleResultSelect(result);
    }
  };

  if (isLoading) {
    return (
      <div className="search-interface">
        <div className="search-loading">
          <div className="search-loading-spinner"></div>
          <span>Searching...</span>
        </div>
      </div>
    );
  }

  if (!searchValue.trim()) {
    return (
      <div className="search-interface">
        <div className="search-placeholder">Start typing to search...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="search-interface">
        <div className="search-no-results">
          No results found for "{searchValue}"
        </div>
      </div>
    );
  }

  return (
    <div className="search-interface" data-testid="search-interface">
      <div className="search-results" data-testid="search-results">
        {results.map((result, index) => (
          <div
            key={result.id}
            className={`search-result-item ${
              index === selectedIndex ? "search-result-selected" : ""
            }`}
            data-testid="search-result-item"
            onClick={() => handleResultSelect(result)}
            onKeyDown={(event) => handleKeyDown(event, result)}
            tabIndex={0}
            role="button"
            aria-selected={index === selectedIndex}
          >
            <div className="search-result-name">{result.name}</div>
            {result.description && (
              <div className="search-result-description">
                {result.description}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
