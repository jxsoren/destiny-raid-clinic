//! The template contract: required files, JSON keys and guide sections for every raid and
//! encounter. Keep `templates/` in sync with these lists; the tests scaffold from the real
//! templates and must pass `check`.

/// Files and folders a raid directory must contain (and may only contain, besides dotfiles).
pub const RAID_ENTRIES: &[&str] = &["raid.json", "guide.mdoc", "encounters"];

/// Files and folders an encounter directory must contain (and may only contain, besides dotfiles).
pub const ENCOUNTER_ENTRIES: &[&str] = &["encounter.json", "guide.mdoc", "sources.md", "replays"];

/// Top-level keys of `raid.json`, in order.
pub const RAID_KEYS: &[&str] = &[
    "id",
    "name",
    "released",
    "encounters",
    "glossary",
    "sources",
];

/// Top-level keys of `encounter.json`, in order.
pub const ENCOUNTER_KEYS: &[&str] = &[
    "id",
    "raid",
    "order",
    "name",
    "version",
    "arena",
    "markers",
    "roles",
    "enemies",
    "phases",
    "mechanics",
    "wipe_conditions",
    "damage",
    "drills",
    "difficulty",
    "sources",
];

/// Required `##` sections of a raid guide, in order.
pub const RAID_SECTIONS: &[&str] = &[
    "Overview",
    "Encounter flow",
    "Role matrix",
    "Shared glossary",
    "Loadout & builds",
    "Challenges, triumphs & secret chests",
    "Changelog",
];

/// Required `##` sections of an encounter guide, in order.
pub const ENCOUNTER_SECTIONS: &[&str] = &[
    "TL;DR",
    "Overview",
    "Roles & loadout",
    "Map & callouts",
    "Mechanics glossary",
    "Phase walkthrough",
    "Damage phase",
    "Wipe conditions",
    "Challenges & triumphs",
    "Master / Contest differences",
    "Common mistakes",
    "Practice drills",
];

/// Allowed guide statuses. A `reviewed` guide may not contain `TODO`.
pub const STATUSES: &[&str] = &["draft", "reviewed"];

/// Lowercase slug: `a-z`, `0-9` and single hyphens, not starting or ending with a hyphen.
pub fn is_slug(s: &str) -> bool {
    !s.is_empty()
        && !s.starts_with('-')
        && !s.ends_with('-')
        && !s.contains("--")
        && s.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Parses an encounter folder name `NN-slug` into `(order, slug)`.
pub fn parse_encounter_dir(name: &str) -> Option<(u8, &str)> {
    let (num, slug) = name.split_once('-')?;
    if num.len() != 2 || !num.chars().all(|c| c.is_ascii_digit()) || !is_slug(slug) {
        return None;
    }
    let order: u8 = num.parse().ok()?;
    (order >= 1).then_some((order, slug))
}

pub fn encounter_dir_name(order: u8, slug: &str) -> String {
    format!("{order:02}-{slug}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs() {
        assert!(is_slug("vault-of-glass"));
        assert!(is_slug("atheon"));
        assert!(!is_slug("Vault"));
        assert!(!is_slug("-a"));
        assert!(!is_slug("a--b"));
        assert!(!is_slug(""));
    }

    #[test]
    fn encounter_dirs() {
        assert_eq!(parse_encounter_dir("07-atheon"), Some((7, "atheon")));
        assert_eq!(parse_encounter_dir("7-atheon"), None);
        assert_eq!(parse_encounter_dir("00-atheon"), None);
        assert_eq!(parse_encounter_dir("07-Atheon"), None);
        assert_eq!(encounter_dir_name(7, "atheon"), "07-atheon");
    }
}
