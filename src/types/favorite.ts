export type FavoriteType = 'choice' | 'school' | 'city';

export interface FavoriteItem {
  id: string; // schoolCode_majorCode for choice, schoolCode for school, cityName for city
  type: FavoriteType;
  schoolCode?: string;
  schoolName?: string;
  majorCode?: string;
  majorName?: string;
  cityName?: string;
  province?: string;
  city?: string;
  createdAt: string;
}
