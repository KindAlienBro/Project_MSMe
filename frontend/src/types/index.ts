// frontend/src/types/index.ts

export interface Subject {
  id: number;
  subject_name: string;
  subject_code: string;
}

export interface Department {
  id: number;
  dept_name: string;
  subjects: Subject[];
}

export interface StudentProfile {
  dept_name: string;
  semester: number;
  year: number;
  register_number: string | null;
}