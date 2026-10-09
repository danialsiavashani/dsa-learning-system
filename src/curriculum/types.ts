export type ArrayItem = {
  id: string;
  value: number;
};

export type PredictionOption = {
  id: string;
  label: string;
};

export type Prediction = {
  question: string;
  options: PredictionOption[];
  correctOptionId: string;
};

export type LessonStep = {
  id: string;
  title: string;
  explanation?: string;

  visual?: {
    type: "array";
    items: ArrayItem[];
    activeId?: string;
  };

  prediction?: Prediction;
};

export type Lesson = {
  id: string;
  title: string;
  subtitle?: string;
  steps: LessonStep[];
};