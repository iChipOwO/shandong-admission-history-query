export interface ReportItem {
  id: string; // schoolCode_majorCode (or just unique generated ID, but school+major makes sense)
  schoolCode?: string;
  schoolName: string;
  majorCode?: string;
  majorName: string;
  note?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdmissionReport {
  id: string;
  name: string;
  note?: string;
  items: ReportItem[];
  createdAt: string;
  updatedAt: string;
}
