// This file contains only the SchoolMetadata type.
// Full school metadata is loaded asynchronously from /data/school_metadata.json.

export interface SchoolMetadata {
  schoolCode?: string;
  schoolName: string;
  province?: string;
  city?: string;
  cityConfirmed?: boolean;
  educationLevel?: string;
  department?: string;
  schoolTypeTags?: string[];
  sourceName?: string;
  sourceUrl?: string;
  tagSources?: Record<string, string>;
  confidence?: 'confirmed' | 'unknown';
  updatedAt?: string;
  note?: string;
  officialWebsiteUrl?: string;
  admissionWebsiteUrl?: string;
  baikeUrl?: string;
  wikipediaUrl?: string;
  linkSources?: {
    officialWebsiteUrl?: string;
    admissionWebsiteUrl?: string;
    baikeUrl?: string;
    wikipediaUrl?: string;
  };
  linkConfidence?: {
    officialWebsiteUrl?: 'confirmed' | 'unknown';
    admissionWebsiteUrl?: 'confirmed' | 'unknown';
    baikeUrl?: 'confirmed' | 'unknown';
    wikipediaUrl?: 'confirmed' | 'unknown';
  };
  linkUpdatedAt?: string;
}

export const schoolMetadataList: SchoolMetadata[] = []; // Intentionally empty; data is fetched at runtime.

export const SCHOOL_FILTER_TAGS = [
  '985',
  '211',
  '双一流',
  '公办',
  '民办',
  '本科',
  '专科',
  '高职专科',
  '本科层次职业大学',
  '军校',
  '港澳高校',
];
