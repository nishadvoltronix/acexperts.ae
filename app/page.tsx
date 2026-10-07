import { getPage } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { PageContent } from "@/components/PageContent";
const page = getPage("/")!;
export const metadata = pageMetadata(page);
export default function Home() {
  return <PageContent page={page} />;
}
