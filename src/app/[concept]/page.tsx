import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConceptNav from "@/components/lesson/ConceptNav";
import LessonExperience from "@/components/lesson/LessonExperience";
import { concepts, findConcept } from "@/curriculum";

export const dynamicParams = false;

export function generateStaticParams() {
  return concepts.map((concept) => ({ concept: concept.slug }));
}

export async function generateMetadata(props: PageProps<"/[concept]">): Promise<Metadata> {
  const { concept: slug } = await props.params;
  const concept = findConcept(slug);
  return { title: concept ? `${concept.label} · DSA Learning System` : "DSA Learning System" };
}

export default async function ConceptPage(props: PageProps<"/[concept]">) {
  const { concept: slug } = await props.params;
  const concept = findConcept(slug);
  if (!concept) notFound();

  return (
    <LessonExperience
      key={concept.slug}
      lesson={concept.lesson}
      nav={
        <ConceptNav
          concepts={concepts.map(({ slug, label }) => ({ slug, label }))}
          active={concept.slug}
        />
      }
    />
  );
}
