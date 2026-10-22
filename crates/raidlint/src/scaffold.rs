//! `raidlint new-raid` and `raidlint new-encounter`: create content from `templates/`.

use crate::check::{file_name, visible_entries};
use crate::rules::*;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

pub fn new_raid(repo: &Path, id: &str, name: &str, location: &str) -> Result<PathBuf, String> {
    if !is_slug(id) {
        return Err(format!(
            "raid id `{id}` must be a lowercase slug, e.g. `vault-of-glass`"
        ));
    }
    require_name(name)?;
    require_name(location)?;
    let dest = repo.join("content/raids").join(id);
    if dest.exists() {
        return Err(format!("{} already exists", dest.display()));
    }
    let position = free_position(repo)?;
    copy_template(
        &repo.join("templates/raid"),
        &dest,
        &[
            ("{{raid_id}}", id),
            ("{{raid_name}}", name),
            ("{{raid_location}}", location),
        ],
    )?;
    update_json(&dest.join("raid.json"), |obj| {
        if let Some(Value::Object(planet)) = obj.get_mut("planet") {
            planet.insert("position".into(), Value::from(vec![position.0, position.1]));
        }
    })?;
    let encounters = dest.join("encounters");
    fs::create_dir_all(&encounters).map_err(io)?;
    fs::write(encounters.join(".gitkeep"), "").map_err(io)?;
    Ok(dest)
}

/// First spot on a coarse grid where a default-size planet keeps its minimum distance from
/// every existing planet. Coordinates are rounded to 2 decimals.
fn free_position(repo: &Path) -> Result<(f64, f64), String> {
    let taken = crate::check::planet_bodies(repo);
    let round = |v: f64| (v * 100.0).round() / 100.0;
    for row in 0..5 {
        for col in 0..8 {
            let p = (
                round(0.15 + col as f64 * 0.1),
                round(0.2 + row as f64 * 0.15),
            );
            let clear = taken.iter().all(|t| {
                ((t.0 - p.0).powi(2) + (t.1 - p.1).powi(2)).sqrt()
                    >= min_planet_distance(t.2, DEFAULT_PLANET_SIZE)
            });
            if clear {
                return Ok(p);
            }
        }
    }
    Err("no free Director position; set planet.position by hand".into())
}

pub fn new_encounter(
    repo: &Path,
    raid: &str,
    order: u8,
    id: &str,
    name: &str,
) -> Result<PathBuf, String> {
    if !is_slug(id) {
        return Err(format!(
            "encounter id `{id}` must be a lowercase slug, e.g. `atheon`"
        ));
    }
    if !(1..=99).contains(&order) {
        return Err("encounter order must be between 1 and 99".into());
    }
    require_name(name)?;
    let raid_dir = repo.join("content/raids").join(raid);
    if !raid_dir.join("raid.json").exists() {
        return Err(format!(
            "raid `{raid}` doesn't exist; run `just new-raid {raid} \"<name>\" \"<location>\"` first"
        ));
    }
    let enc_root = raid_dir.join("encounters");
    for existing in visible_entries(&enc_root).unwrap_or_default() {
        if let Some((o, s)) = parse_encounter_dir(&file_name(&existing)) {
            if o == order {
                return Err(format!("order {order:02} is already used by `{s}`"));
            }
            if s == id {
                return Err(format!("encounter `{id}` already exists at order {o:02}"));
            }
        }
    }

    let dest = enc_root.join(encounter_dir_name(order, id));
    copy_template(
        &repo.join("templates/encounter"),
        &dest,
        &[
            ("{{raid_id}}", raid),
            ("{{encounter_id}}", id),
            ("{{encounter_name}}", name),
        ],
    )?;
    update_json(&dest.join("encounter.json"), |obj| {
        obj.insert("order".into(), Value::from(order));
    })?;
    sync_raid_encounters(&raid_dir)?;
    Ok(dest)
}

/// Rewrites `raid.json`'s `encounters` list from the encounter folders, ordered by `NN`.
fn sync_raid_encounters(raid_dir: &Path) -> Result<(), String> {
    let mut found: Vec<(u8, String)> = visible_entries(&raid_dir.join("encounters"))
        .unwrap_or_default()
        .iter()
        .filter_map(|p| parse_encounter_dir(&file_name(p)).map(|(o, s)| (o, s.to_string())))
        .collect();
    found.sort();
    let ids: Vec<Value> = found.into_iter().map(|(_, s)| Value::from(s)).collect();
    update_json(&raid_dir.join("raid.json"), |obj| {
        obj.insert("encounters".into(), Value::Array(ids));
    })
}

fn update_json(
    path: &Path,
    f: impl FnOnce(&mut serde_json::Map<String, Value>),
) -> Result<(), String> {
    let text = fs::read_to_string(path).map_err(io)?;
    let mut value: Value =
        serde_json::from_str(&text).map_err(|e| format!("{}: {e}", path.display()))?;
    let obj = value
        .as_object_mut()
        .ok_or_else(|| format!("{} must be a JSON object", path.display()))?;
    f(obj);
    let out = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    fs::write(path, out + "\n").map_err(io)
}

/// Copies a template folder, filling `{{placeholders}}`. Values are JSON-escaped in `.json` files.
fn copy_template(src: &Path, dest: &Path, vars: &[(&str, &str)]) -> Result<(), String> {
    if !src.is_dir() {
        return Err(format!("template folder {} is missing", src.display()));
    }
    fs::create_dir_all(dest).map_err(io)?;
    let mut entries: Vec<PathBuf> = fs::read_dir(src)
        .map_err(io)?
        .filter_map(Result::ok)
        .map(|e| e.path())
        .collect();
    entries.sort();
    for entry in entries {
        let target = dest.join(file_name(&entry));
        if entry.is_dir() {
            copy_template(&entry, &target, vars)?;
            continue;
        }
        let mut text = fs::read_to_string(&entry).map_err(io)?;
        let is_json = entry.extension().is_some_and(|e| e == "json");
        for (key, value) in vars {
            let filled = if is_json {
                let quoted = serde_json::to_string(value).map_err(|e| e.to_string())?;
                quoted[1..quoted.len() - 1].to_string()
            } else {
                value.to_string()
            };
            text = text.replace(key, &filled);
        }
        fs::write(&target, text).map_err(io)?;
    }
    Ok(())
}

fn require_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() || name.contains("{{") || name.contains('\n') {
        return Err("name must be a single non-empty line".into());
    }
    Ok(())
}

fn io(e: std::io::Error) -> String {
    e.to_string()
}
