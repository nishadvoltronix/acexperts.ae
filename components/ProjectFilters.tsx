"use client";
import { useState } from "react";
/** The source's single villa project belongs to both Civil and MEP. */
export function ProjectFilters() {
  const [category, setCategory] = useState("All");
  return (
    <div>
      <nav className="project-filters" aria-label="Project categories">
        {["Civil", "MEP", "All"].map((label) => (
          <button
            key={label}
            aria-pressed={category === label}
            onClick={() => setCategory(label)}
          >
            {label}
          </button>
        ))}
      </nav>
      <p className="filter-status" role="status">
        1 project{category === "All" ? "" : ` in ${category}`}
      </p>
    </div>
  );
}
