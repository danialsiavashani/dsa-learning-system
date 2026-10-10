import LessonExperience from "@/components/lesson/LessonExperience";
import { arraysLesson } from "@/curriculum/lessons/arrays";

export default function Home() {
  return <LessonExperience lesson={arraysLesson} />;
}
