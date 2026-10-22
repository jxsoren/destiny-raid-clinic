//! `raidlint check`: verifies that every raid and encounter under `content/raids/` follows the
//! template contract in `rules.rs`.

use crate::guide;
use crate::rules::*;
use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};

pub struct Problem {
    pub path: PathBuf,
    pub message: String,
}

#[derive(Default)]
pub struct Report {
    pub raids: usize,
    pub encounters: usize,
    /// (raid.json path, x, y, size)
    pub planets: Vec<(PathBuf, f64, f64, f64)>,
    pub problems: Vec<Problem>,
}

impl Report {
    fn add(&mut self, path: &Path, message: impl Into<String>) {
        self.problems.push(Problem {
            path: path.to_path_buf(),
            message: message.into(),
        });
    }
}

pub fn check(repo: &Path) -> Report {
    let mut report = Report::default();
    let raids_dir = repo.join("content/raids");
    let Ok(raids) = visible_entries(&raids_dir) else {
        return report; // no content yet
    };
    for raid_dir in raids {
        check_raid(&raid_dir, &mut report);
    }
    for i in 0..report.planets.len() {
        for j in i + 1..report.planets.len() {
            let (a, b) = (&report.planets[i], &report.planets[j]);
            let d = ((a.1 - b.1).powi(2) + (a.2 - b.2).powi(2)).sqrt();
            let min = min_planet_distance(a.3, b.3);
            if d < min {
                let msg = format!(
                    "planet is too close to {} (distance {d:.3}, minimum {min:.3})",
                    b.0.display()
                );
                let path = a.0.clone();
                report.add(&path, msg);
            }
        }
    }
    report
}

/// Returns `(x, y, size)` when the position is valid (size falls back to the default if invalid).
fn check_planet(value: Option<&Value>, path: &Path, r: &mut Report) -> Option<(f64, f64, f64)> {
    let Some(Value::Object(p)) = value else {
        r.add(path, "`planet` must be an object");
        return None;
    };
    for k in PLANET_KEYS.iter().filter(|k| !p.contains_key(**k)) {
        r.add(path, format!("missing key `planet.{k}`"));
    }
    for k in p.keys().filter(|k| !PLANET_KEYS.contains(&k.as_str())) {
        r.add(path, format!("unknown key `planet.{k}`"));
    }
    if !p
        .get("surface")
        .and_then(Value::as_str)
        .is_some_and(|s| SURFACES.contains(&s))
    {
        r.add(
            path,
            format!("`planet.surface` must be one of {SURFACES:?}"),
        );
    }
    for key in ["tint", "atmosphere"] {
        if !p.get(key).and_then(Value::as_str).is_some_and(is_hex_color) {
            r.add(path, format!("`planet.{key}` must be a #rrggbb color"));
        }
    }
    if !p.get("ring").is_some_and(Value::is_boolean) {
        r.add(path, "`planet.ring` must be true or false");
    }
    let (lo, hi) = PLANET_SIZE;
    let size = p
        .get("size")
        .and_then(Value::as_f64)
        .filter(|s| (lo..=hi).contains(s));
    if size.is_none() {
        r.add(path, format!("`planet.size` must be between {lo} and {hi}"));
    }
    let size = size.unwrap_or(DEFAULT_PLANET_SIZE);
    if p.get("location")
        .and_then(Value::as_str)
        .is_none_or(|s| s.trim().is_empty())
    {
        r.add(path, "`planet.location` must be a non-empty string");
    }
    if !p.get("tagline").is_some_and(Value::is_string) {
        r.add(path, "`planet.tagline` must be a string");
    }
    let position = p
        .get("position")
        .and_then(Value::as_array)
        .and_then(|a| match a.as_slice() {
            [x, y] => Some((x.as_f64()?, y.as_f64()?)),
            _ => None,
        });
    match position {
        Some((x, y)) if (0.0..=1.0).contains(&x) && (0.0..=1.0).contains(&y) => Some((x, y, size)),
        _ => {
            r.add(
                path,
                "`planet.position` must be [x, y] with both between 0 and 1",
            );
            None
        }
    }
}

/// `(x, y, size)` of every valid raid planet (used by the scaffolder to pick a free spot).
pub fn planet_bodies(repo: &Path) -> Vec<(f64, f64, f64)> {
    check(repo)
        .planets
        .into_iter()
        .map(|(_, x, y, size)| (x, y, size))
        .collect()
}

fn check_raid(dir: &Path, r: &mut Report) {
    let name = file_name(dir);
    if !dir.is_dir() {
        r.add(dir, "only raid folders belong in content/raids");
        return;
    }
    if !is_slug(&name) {
        r.add(
            dir,
            "raid folder name must be a lowercase slug, e.g. `vault-of-glass`",
        );
        return;
    }
    r.raids += 1;
    check_entries(dir, RAID_ENTRIES, r);

    // encounters/: NN-slug folders, unique orders and ids
    let mut found: Vec<(u8, String)> = Vec::new();
    for enc_dir in visible_entries(&dir.join("encounters")).unwrap_or_default() {
        let dir_name = file_name(&enc_dir);
        match parse_encounter_dir(&dir_name) {
            Some((order, slug)) if enc_dir.is_dir() => {
                if found.iter().any(|(o, _)| *o == order) {
                    r.add(
                        &enc_dir,
                        format!("encounter order {order:02} is used twice"),
                    );
                }
                if found.iter().any(|(_, s)| s == slug) {
                    r.add(&enc_dir, format!("encounter id `{slug}` is used twice"));
                }
                found.push((order, slug.to_string()));
                check_encounter(&enc_dir, &name, order, slug, r);
            }
            _ => r.add(
                &enc_dir,
                "encounter folders must be named `NN-slug`, e.g. `07-atheon`",
            ),
        }
    }
    found.sort();

    // raid.json
    let path = dir.join("raid.json");
    if let Some(obj) = read_json_object(&path, RAID_KEYS, r) {
        expect_str(&obj, "id", &name, &path, r);
        non_empty_str(&obj, "name", &path, r);
        let listed: Vec<String> = obj
            .get("encounters")
            .and_then(Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();
        let on_disk: Vec<String> = found.iter().map(|(_, s)| s.clone()).collect();
        if listed != on_disk {
            r.add(
                &path,
                format!("`encounters` must list the encounter folders in order: {on_disk:?} (found {listed:?})"),
            );
        }
        // A missing `planet` is already reported by `read_json_object`.
        if obj.contains_key("planet")
            && let Some((x, y, size)) = check_planet(obj.get("planet"), &path, r)
        {
            r.planets.push((path.clone(), x, y, size));
        }
    }

    check_guide(
        &dir.join("guide.mdoc"),
        RAID_SECTIONS,
        &[("raid", name.as_str())],
        r,
    );
}

fn check_encounter(dir: &Path, raid: &str, order: u8, slug: &str, r: &mut Report) {
    r.encounters += 1;
    check_entries(dir, ENCOUNTER_ENTRIES, r);
    if !dir.join("replays").is_dir() && dir.join("replays").exists() {
        r.add(&dir.join("replays"), "`replays` must be a folder");
    }

    let path = dir.join("encounter.json");
    if let Some(obj) = read_json_object(&path, ENCOUNTER_KEYS, r) {
        expect_str(&obj, "id", slug, &path, r);
        expect_str(&obj, "raid", raid, &path, r);
        non_empty_str(&obj, "name", &path, r);
        if obj.get("order").and_then(Value::as_u64) != Some(u64::from(order)) {
            r.add(
                &path,
                format!("`order` must be {order} to match the folder name"),
            );
        }
        if obj
            .get("version")
            .and_then(Value::as_u64)
            .is_none_or(|v| v < 1)
        {
            r.add(&path, "`version` must be an integer ≥ 1");
        }
    }

    check_guide(
        &dir.join("guide.mdoc"),
        ENCOUNTER_SECTIONS,
        &[("encounter", slug), ("raid", raid)],
        r,
    );
    check_placeholders(&dir.join("sources.md"), r);
}

fn check_guide(path: &Path, sections: &[&str], expect: &[(&str, &str)], r: &mut Report) {
    let Some(text) = read(path, r) else { return };
    check_placeholder_text(path, &text, r);
    let g = match guide::parse(&text) {
        Ok(g) => g,
        Err(e) => return r.add(path, e),
    };
    for (key, want) in expect {
        match g.frontmatter.get(*key) {
            Some(v) if v == want => {}
            Some(v) => r.add(
                path,
                format!("frontmatter `{key}` is `{v}`, expected `{want}`"),
            ),
            None => r.add(path, format!("frontmatter is missing `{key}: {want}`")),
        }
    }
    let status = g
        .frontmatter
        .get("status")
        .map(String::as_str)
        .unwrap_or("");
    if !STATUSES.contains(&status) {
        r.add(
            path,
            format!("frontmatter `status` must be one of {STATUSES:?}"),
        );
    }
    if status == "reviewed" && g.has_todo {
        r.add(path, "a reviewed guide can't contain TODO");
    }
    if g.h1_count != 1 {
        r.add(
            path,
            format!(
                "guide must have exactly one `# Title` (found {})",
                g.h1_count
            ),
        );
    }
    if let Some(msg) = guide::section_problem(sections, &g.sections) {
        r.add(path, msg);
    }
}

fn check_entries(dir: &Path, required: &[&str], r: &mut Report) {
    for want in required {
        if !dir.join(want).exists() {
            r.add(&dir.join(want), "required by the template but missing");
        }
    }
    for entry in visible_entries(dir).unwrap_or_default() {
        let n = file_name(&entry);
        if !required.contains(&n.as_str()) {
            r.add(
                &entry,
                format!(
                    "not part of the template (allowed: {})",
                    required.join(", ")
                ),
            );
        }
    }
}

fn read_json_object(path: &Path, keys: &[&str], r: &mut Report) -> Option<Map<String, Value>> {
    let text = read(path, r)?;
    check_placeholder_text(path, &text, r);
    let obj = match serde_json::from_str::<Value>(&text) {
        Ok(Value::Object(o)) => o,
        Ok(_) => {
            r.add(path, "must be a JSON object");
            return None;
        }
        Err(e) => {
            r.add(path, format!("invalid JSON: {e}"));
            return None;
        }
    };
    let actual: Vec<&str> = obj
        .keys()
        .map(String::as_str)
        .filter(|k| *k != "$schema")
        .collect();
    for k in keys.iter().filter(|k| !actual.contains(k)) {
        r.add(path, format!("missing key `{k}`"));
    }
    for k in actual.iter().filter(|k| !keys.contains(k)) {
        r.add(
            path,
            format!("unknown key `{k}` (allowed: {})", keys.join(", ")),
        );
    }
    Some(obj)
}

fn expect_str(obj: &Map<String, Value>, key: &str, want: &str, path: &Path, r: &mut Report) {
    if obj.get(key).and_then(Value::as_str) != Some(want) {
        r.add(
            path,
            format!("`{key}` must be \"{want}\" to match the folder"),
        );
    }
}

fn non_empty_str(obj: &Map<String, Value>, key: &str, path: &Path, r: &mut Report) {
    if obj
        .get(key)
        .and_then(Value::as_str)
        .is_none_or(|s| s.trim().is_empty())
    {
        r.add(path, format!("`{key}` must be a non-empty string"));
    }
}

fn check_placeholders(path: &Path, r: &mut Report) {
    if let Some(text) = read(path, r) {
        check_placeholder_text(path, &text, r);
    }
}

fn check_placeholder_text(path: &Path, text: &str, r: &mut Report) {
    if text.contains("{{") {
        r.add(path, "contains an unfilled template placeholder `{{…}}`");
    }
}

fn read(path: &Path, r: &mut Report) -> Option<String> {
    if !path.exists() {
        return None; // already reported by check_entries
    }
    fs::read_to_string(path)
        .map_err(|e| r.add(path, format!("can't read: {e}")))
        .ok()
}

/// Sorted directory entries, skipping dotfiles such as `.gitkeep`.
pub fn visible_entries(dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    let mut v: Vec<PathBuf> = fs::read_dir(dir)?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| !file_name(p).starts_with('.'))
        .collect();
    v.sort();
    Ok(v)
}

pub fn file_name(p: &Path) -> String {
    p.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default()
}
