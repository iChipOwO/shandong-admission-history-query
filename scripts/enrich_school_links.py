import json
import re
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests


PROCESSED_METADATA_PATH = Path("data/processed/school_metadata.json")
PUBLIC_METADATA_PATH = Path("public/data/school_metadata.json")
ADMISSIONS_PATH = Path("data/processed/admissions_shandong_2023_2025.json")
MANUAL_REFERENCE_PATH = Path("data/processed/reference/manually_verified_school_links.json")
WIKIDATA_CACHE_PATH = Path("data/processed/reference/wikidata_school_link_cache.json")
MISSING_PATH = Path("data/processed/school_link_missing.json")
REPORT_PATH = Path("data/processed/school_link_report.json")
TS_PATH = Path("src/data/schoolMetadata.ts")

LINK_FIELDS = [
    "officialWebsiteUrl",
    "admissionWebsiteUrl",
    "baikeUrl",
    "wikipediaUrl",
]

USER_AGENT = "GaokaoInsightLinkEnricher/0.1 (local data enrichment; dev@example.com)"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
MAX_WIKIDATA_QUERIES = 0
ENABLE_NETWORK_URL_VALIDATION = False


def normalize_name(value):
    text = str(value or "").strip()
    text = text.replace("（", "(").replace("）", ")")
    text = re.sub(r"\s+", "", text)
    return text


def load_json(path, default):
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def url_is_well_formed(url):
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def url_is_reachable(url):
    if not url or not url_is_well_formed(url):
        return False
    if not ENABLE_NETWORK_URL_VALIDATION:
        return True
    try:
        response = requests.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=(1, 1.5),
            allow_redirects=True,
            stream=True,
        )
        response.close()
        return response.status_code < 500
    except requests.RequestException:
        return False


def add_confirmed_link(item, field, url, source, checked_cache, force=False):
    if not url or not url_is_well_formed(url):
        return False

    confidence = item.setdefault("linkConfidence", {})
    if confidence.get(field) == "confirmed" and item.get(field) and not force:
        return False

    if url not in checked_cache:
        checked_cache[url] = url_is_reachable(url)
    if not checked_cache[url]:
        return False

    item[field] = url
    item.setdefault("linkSources", {})[field] = source
    confidence[field] = "confirmed"
    return True


def ensure_unknowns(item):
    item.setdefault("linkSources", {})
    confidence = item.setdefault("linkConfidence", {})
    for field in LINK_FIELDS:
        item.setdefault(field, "")
        confidence.setdefault(field, "unknown" if not item[field] else "confirmed")


def load_record_counts():
    records = load_json(ADMISSIONS_PATH, [])
    counts = Counter()
    for record in records:
        code = record.get("schoolCode")
        if code:
            counts[code] += 1
    return counts


def should_query_wikidata(item, record_counts):
    tags = set(item.get("schoolTypeTags") or [])
    if tags & {"985", "211", "双一流", "军校", "港澳高校"}:
        return True
    if item.get("province") == "山东" and item.get("educationLevel") == "本科":
        return True
    return record_counts.get(item.get("schoolCode"), 0) >= 180


def get_entity_claim_value(entity, prop):
    claims = entity.get("claims", {}).get(prop, [])
    for claim in claims:
        mainsnak = claim.get("mainsnak", {})
        datavalue = mainsnak.get("datavalue", {})
        value = datavalue.get("value")
        if isinstance(value, str):
            return value
    return ""


def wikidata_lookup(name, cache):
    normalized = normalize_name(name)
    if normalized in cache:
        return cache[normalized]

    result = {}
    try:
        search_response = requests.get(
            WIKIDATA_API,
            params={
                "action": "wbsearchentities",
                "search": name,
                "language": "zh",
                "format": "json",
                "limit": 5,
            },
            headers={"User-Agent": USER_AGENT},
            timeout=(2, 4),
        )
        if search_response.status_code != 200:
            cache[normalized] = result
            return result
        entity_id = ""
        for candidate in search_response.json().get("search", []):
            candidate_id = candidate.get("id")
            if not candidate_id:
                continue
            entity_response = requests.get(
                WIKIDATA_API,
                params={
                    "action": "wbgetentities",
                    "ids": candidate_id,
                    "props": "labels|aliases|claims|sitelinks",
                    "languages": "zh|en",
                    "format": "json",
                },
                headers={"User-Agent": USER_AGENT},
                timeout=(2, 4),
            )
            if entity_response.status_code != 200:
                continue
            entity = entity_response.json().get("entities", {}).get(candidate_id, {})
            labels = {
                normalize_name(label.get("value", ""))
                for label in entity.get("labels", {}).values()
            }
            aliases = {
                normalize_name(alias.get("value", ""))
                for values in entity.get("aliases", {}).values()
                for alias in values
            }
            if normalized not in labels and normalized not in aliases:
                continue

            official = get_entity_claim_value(entity, "P856")
            sitelinks = entity.get("sitelinks", {})
            wikipedia = ""
            if "zhwiki" in sitelinks:
                title = sitelinks["zhwiki"]["title"].replace(" ", "_")
                wikipedia = f"https://zh.wikipedia.org/wiki/{title}"
            elif "enwiki" in sitelinks:
                title = sitelinks["enwiki"]["title"].replace(" ", "_")
                wikipedia = f"https://en.wikipedia.org/wiki/{title}"

            result = {
                "entityId": candidate_id,
                "officialWebsiteUrl": official,
                "wikipediaUrl": wikipedia,
            }
            entity_id = candidate_id
            break
        if not entity_id:
            result = {}
    except requests.RequestException:
        result = {}

    cache[normalized] = result
    time.sleep(0.12)
    return result


def update_typescript_interface():
    content = """// This file contains only the SchoolMetadata type.
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
"""
    TS_PATH.write_text(content, encoding="utf-8", newline="\n")


def coverage_for_tag(metadata, tag):
    tagged = [item for item in metadata if tag in set(item.get("schoolTypeTags") or [])]
    if not tagged:
        return {"total": 0, "anyLink": 0, "officialWebsiteUrl": 0, "admissionWebsiteUrl": 0, "baikeUrl": 0, "wikipediaUrl": 0}
    return {
        "total": len(tagged),
        "anyLink": sum(1 for item in tagged if any(item.get(field) for field in LINK_FIELDS)),
        **{field: sum(1 for item in tagged if item.get(field)) for field in LINK_FIELDS},
    }


def main():
    generated_at = datetime.now(timezone.utc).isoformat()
    metadata = load_json(PROCESSED_METADATA_PATH, [])
    manual_reference = load_json(MANUAL_REFERENCE_PATH, {"schools": {}})
    manual_schools = {
        normalize_name(name): data
        for name, data in manual_reference.get("schools", {}).items()
    }
    wikidata_cache = load_json(WIKIDATA_CACHE_PATH, {})
    record_counts = load_record_counts()
    checked_urls = {}
    warnings = []
    if not ENABLE_NETWORK_URL_VALIDATION:
        warnings.append("本轮未进行全量实时 URL 连通性校验；人工参考表链接仅做 URL 格式校验并保留来源。")
    if MAX_WIKIDATA_QUERIES == 0:
        warnings.append("本轮关闭 Wikidata 批量查询以避免网络超时；未人工核验的学校链接保留 missing。")
    wikidata_queries = 0

    for item in metadata:
        ensure_unknowns(item)
        item["linkUpdatedAt"] = generated_at
        normalized = normalize_name(item.get("schoolName"))

        manual = manual_schools.get(normalized)
        if manual:
            for field in LINK_FIELDS:
                if manual.get(field):
                    add_confirmed_link(
                        item,
                        field,
                        manual[field],
                        f"{manual_reference.get('sources', {}).get('manual', '人工核验')}: {item['schoolName']}",
                        checked_urls,
                        force=item.get("linkConfidence", {}).get(field) != "confirmed",
                    )
            if manual.get("note"):
                existing_note = item.get("note", "")
                if manual["note"] not in existing_note:
                    item["note"] = "；".join(part for part in [existing_note, manual["note"]] if part)

        if should_query_wikidata(item, record_counts) and wikidata_queries < MAX_WIKIDATA_QUERIES:
            lookup_name = item.get("schoolName", "")
            if "(" in normalize_name(lookup_name):
                # Campus links are handled by manual references to avoid mixing up campuses.
                lookup_name = ""
            if lookup_name:
                wikidata_queries += 1
                wikidata = wikidata_lookup(lookup_name, wikidata_cache)
                source = f"Wikidata 精确实体匹配 {wikidata.get('entityId', '')}".strip()
                if wikidata.get("officialWebsiteUrl"):
                    add_confirmed_link(item, "officialWebsiteUrl", wikidata["officialWebsiteUrl"], source, checked_urls)
                if wikidata.get("wikipediaUrl"):
                    add_confirmed_link(item, "wikipediaUrl", wikidata["wikipediaUrl"], source, checked_urls)
    if MAX_WIKIDATA_QUERIES > 0 and wikidata_queries >= MAX_WIKIDATA_QUERIES:
        warnings.append(f"Wikidata 查询达到本轮上限 {MAX_WIKIDATA_QUERIES}，其余学校链接保留 missing。")

        for field in LINK_FIELDS:
            if not item.get(field):
                item[field] = ""
                item["linkConfidence"][field] = "unknown"

    missing = []
    for item in metadata:
        missing_links = [field for field in LINK_FIELDS if not item.get(field)]
        if missing_links:
            missing.append(
                {
                    "schoolCode": item.get("schoolCode", ""),
                    "schoolName": item.get("schoolName", ""),
                    "province": item.get("province", ""),
                    "city": item.get("city", ""),
                    "missingLinks": missing_links,
                    "reason": "本轮未从人工核验参考表或 Wikidata 精确匹配中可靠确认这些链接",
                }
            )

    counts = {field: sum(1 for item in metadata if item.get(field)) for field in LINK_FIELDS}
    fully_completed = sum(1 for item in metadata if all(item.get(field) for field in LINK_FIELDS))
    partially_completed = sum(1 for item in metadata if any(item.get(field) for field in LINK_FIELDS) and not all(item.get(field) for field in LINK_FIELDS))
    missing_all = sum(1 for item in metadata if not any(item.get(field) for field in LINK_FIELDS))

    coverage_tags = ["985", "211", "双一流", "军校", "港澳高校", "山东省内高校", "公办", "民办", "本科层次职业大学"]
    coverage = {}
    for tag in coverage_tags:
        if tag == "山东省内高校":
            tagged = [item for item in metadata if item.get("province") == "山东"]
            coverage[tag] = {
                "total": len(tagged),
                "anyLink": sum(1 for item in tagged if any(item.get(field) for field in LINK_FIELDS)),
                **{field: sum(1 for item in tagged if item.get(field)) for field in LINK_FIELDS},
            }
        else:
            coverage[tag] = coverage_for_tag(metadata, tag)

    report = {
        "generatedAt": generated_at,
        "totalSchools": len(metadata),
        "officialWebsiteConfirmedCount": counts["officialWebsiteUrl"],
        "admissionWebsiteConfirmedCount": counts["admissionWebsiteUrl"],
        "baikeConfirmedCount": counts["baikeUrl"],
        "wikipediaConfirmedCount": counts["wikipediaUrl"],
        "fullyCompletedCount": fully_completed,
        "partiallyCompletedCount": partially_completed,
        "missingAllLinksCount": missing_all,
        "coverageBySchoolTag": coverage,
        "sampleConfirmed": [item for item in metadata if any(item.get(field) for field in LINK_FIELDS)][:12],
        "sampleMissing": missing[:12],
        "warnings": warnings,
        "dataSources": {
            "manualReference": str(MANUAL_REFERENCE_PATH).replace("\\", "/"),
            "wikidataCache": str(WIKIDATA_CACHE_PATH).replace("\\", "/"),
            "wikidataApi": WIKIDATA_API,
        },
    }

    write_json(PROCESSED_METADATA_PATH, metadata)
    write_json(PUBLIC_METADATA_PATH, metadata)
    write_json(MISSING_PATH, missing)
    write_json(REPORT_PATH, report)
    write_json(WIKIDATA_CACHE_PATH, wikidata_cache)
    update_typescript_interface()

    print(f"Processed {len(metadata)} schools.")
    print(f"officialWebsiteUrl confirmed: {counts['officialWebsiteUrl']}")
    print(f"admissionWebsiteUrl confirmed: {counts['admissionWebsiteUrl']}")
    print(f"baikeUrl confirmed: {counts['baikeUrl']}")
    print(f"wikipediaUrl confirmed: {counts['wikipediaUrl']}")
    print(f"Missing all links: {missing_all}")


if __name__ == "__main__":
    main()
