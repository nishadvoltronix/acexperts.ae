"use client";
import { useState } from "react";
import Link from "next/link";
import { QualityImage as Image } from "./QualityImage";
import { projectCategories, projectMatchesCategory, type ProjectCategory } from "@/lib/project-categories";

export type FilterableProject = {
  route: string;
  title: string;
  excerpt?: string;
  image?: { src: string; alt: string; width: number; height: number };
};

export function ProjectFilters({ projects = [] }: { projects?: FilterableProject[] }) {
  const [category, setCategory] = useState<ProjectCategory>("all");
  const visible = projects.filter((project) => projectMatchesCategory(project.route, category));
  const label = projectCategories.find((item) => item.id === category)!.label;
  return (
    <div className="project-listing">
      <nav className="project-filters" aria-label="Project categories">
        {projectCategories.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={category === item.id}
            aria-controls="project-results"
            onClick={() => setCategory(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <p className="filter-status" role="status" aria-atomic="true">
        {visible.length} {visible.length === 1 ? "project" : "projects"}{category === "all" ? "" : ` in ${label}`}
      </p>
      <div id="project-results" className="project-results">
        {visible.length ? visible.map((project) => (
          <article className="content-card" key={project.route}>
            <Link href={project.route}>
              {project.image && (
                <Image src={project.image.src} alt={project.image.alt}
                  width={project.image.width} height={project.image.height}
                  sizes="(max-width: 767px) calc(100vw - 40px), 680px" />
              )}
              <div className="card-copy">
                <p className="eyebrow">Residential · AC Installation</p>
                <h2>{project.title}</h2>
                {project.excerpt && <p>{project.excerpt}</p>}
                <span className="text-link">View project <span aria-hidden="true">→</span></span>
              </div>
            </Link>
          </article>
        )) : (
          <div className="project-empty">
            <p>No projects published in this category yet.</p>
            <Link className="text-link" href="/contact-us/">Discuss your AC project</Link>
          </div>
        )}
      </div>
    </div>
  );
}
