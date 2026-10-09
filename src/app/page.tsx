import LessonRunner from "@/components/lesson/LessonRunner";
import { arraysLesson } from "@/curriculum/lessons/arrays";

export default function Home() {
  return <LessonRunner lesson={arraysLesson} />;
}