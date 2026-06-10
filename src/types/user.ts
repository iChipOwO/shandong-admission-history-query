export interface UserProfile {
  province: string;
  examYear: number;
  rank: number | null;
  subjects: string[];
}

export const defaultProfile: UserProfile = {
  province: '山东',
  examYear: 2026,
  rank: null,
  subjects: [],
};
