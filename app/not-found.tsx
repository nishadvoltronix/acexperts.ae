import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container not-found">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page you are looking for is unavailable.</p>
      <Link className="button" href="/">
        Return home
      </Link>
      <Link className="text-link" href="/services/">
        Explore our services
      </Link>
    </div>
  );
}
