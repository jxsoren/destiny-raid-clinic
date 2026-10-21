//! raidlint: keeps every raid and encounter on the same template.
//!
//! - `raidlint check`: validate `content/raids/` against the template contract (CI gate)
//! - `raidlint new-raid <id> --name "<Name>"`: scaffold a raid from `templates/raid`
//! - `raidlint new-encounter <raid> <order> <id> --name "<Name>"`: scaffold an encounter

mod check;
mod guide;
mod rules;
mod scaffold;

use clap::{Parser, Subcommand};
use std::path::PathBuf;
use std::process::ExitCode;

#[derive(Parser)]
#[command(name = "raidlint", about = "Validate and scaffold raid content")]
struct Cli {
    /// Repository root (the folder containing `content/` and `templates/`).
    #[arg(long, default_value = ".")]
    repo: PathBuf,
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Check all raids and encounters against the template.
    Check,
    /// Create a raid from the template.
    NewRaid {
        /// Lowercase slug, e.g. `vault-of-glass`.
        id: String,
        /// Display name, e.g. "Vault of Glass".
        #[arg(long)]
        name: String,
    },
    /// Create an encounter inside an existing raid.
    NewEncounter {
        /// Raid slug, e.g. `vault-of-glass`.
        raid: String,
        /// Position in the raid, 1–99.
        order: u8,
        /// Lowercase slug, e.g. `atheon`.
        id: String,
        /// Display name, e.g. "Atheon, Time's Conflux".
        #[arg(long)]
        name: String,
    },
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Command::Check => {
            let report = check::check(&cli.repo);
            for p in &report.problems {
                let path = p.path.strip_prefix(&cli.repo).unwrap_or(&p.path);
                eprintln!("{}: {}", path.display(), p.message);
            }
            if report.problems.is_empty() {
                println!(
                    "content OK: {} raid(s), {} encounter(s)",
                    report.raids, report.encounters
                );
                ExitCode::SUCCESS
            } else {
                eprintln!("\n{} problem(s)", report.problems.len());
                ExitCode::FAILURE
            }
        }
        Command::NewRaid { id, name } => done(scaffold::new_raid(&cli.repo, &id, &name)),
        Command::NewEncounter {
            raid,
            order,
            id,
            name,
        } => done(scaffold::new_encounter(&cli.repo, &raid, order, &id, &name)),
    }
}

fn done(result: Result<PathBuf, String>) -> ExitCode {
    match result {
        Ok(path) => {
            println!("created {}", path.display());
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    /// A throwaway repo containing a copy of the real `templates/`.
    struct TempRepo(PathBuf);

    impl TempRepo {
        fn new(name: &str) -> Self {
            let root = std::env::temp_dir().join(format!("raidlint-{}-{name}", std::process::id()));
            let _ = fs::remove_dir_all(&root);
            let templates = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../templates");
            copy_dir(&templates, &root.join("templates"));
            TempRepo(root)
        }
        fn problems(&self) -> Vec<String> {
            check::check(&self.0)
                .problems
                .into_iter()
                .map(|p| p.message)
                .collect()
        }
    }

    impl Drop for TempRepo {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn copy_dir(src: &Path, dest: &Path) {
        fs::create_dir_all(dest).unwrap();
        for e in fs::read_dir(src).unwrap() {
            let p = e.unwrap().path();
            let t = dest.join(p.file_name().unwrap());
            if p.is_dir() {
                copy_dir(&p, &t)
            } else {
                fs::copy(&p, &t).unwrap();
            }
        }
    }

    fn scaffolded(name: &str) -> TempRepo {
        let repo = TempRepo::new(name);
        scaffold::new_raid(&repo.0, "vault-of-glass", "Vault of Glass").unwrap();
        // Added out of order on purpose: raid.json must still list them by order.
        scaffold::new_encounter(
            &repo.0,
            "vault-of-glass",
            7,
            "atheon",
            "Atheon, Time's Conflux",
        )
        .unwrap();
        scaffold::new_encounter(&repo.0, "vault-of-glass", 4, "templar", "The Templar").unwrap();
        repo
    }

    #[test]
    fn scaffolded_content_passes_check() {
        let repo = scaffolded("pass");
        assert_eq!(repo.problems(), Vec::<String>::new());
        let raid: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(repo.0.join("content/raids/vault-of-glass/raid.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(raid["encounters"], serde_json::json!(["templar", "atheon"]));
        let enc = fs::read_to_string(
            repo.0
                .join("content/raids/vault-of-glass/encounters/07-atheon/encounter.json"),
        )
        .unwrap();
        assert!(enc.contains("\"name\": \"Atheon, Time's Conflux\""));
        assert!(enc.contains("\"order\": 7"));
    }

    #[test]
    fn rejects_duplicate_order_and_bad_ids() {
        let repo = scaffolded("dupes");
        assert!(
            scaffold::new_encounter(&repo.0, "vault-of-glass", 7, "oracles", "Oracles").is_err()
        );
        assert!(
            scaffold::new_encounter(&repo.0, "vault-of-glass", 3, "atheon", "Atheon again")
                .is_err()
        );
        assert!(
            scaffold::new_encounter(&repo.0, "vault-of-glass", 3, "Oracles", "Oracles").is_err()
        );
        assert!(scaffold::new_encounter(&repo.0, "kings-fall", 1, "totems", "Totems").is_err());
    }

    #[test]
    fn flags_template_drift() {
        let repo = scaffolded("drift");
        let enc = repo
            .0
            .join("content/raids/vault-of-glass/encounters/07-atheon");

        let guide = enc.join("guide.mdoc");
        let text = fs::read_to_string(&guide)
            .unwrap()
            .replace("## Damage phase", "## DPS");
        fs::write(&guide, text).unwrap();

        let json = enc.join("encounter.json");
        let text = fs::read_to_string(&json).unwrap().replacen(
            "\"version\": 1,",
            "\"version\": 1,\n  \"boss_hp\": 5,",
            1,
        );
        fs::write(&json, text).unwrap();

        fs::write(enc.join("notes.txt"), "scratch").unwrap();

        let problems = repo.problems().join("\n");
        assert!(
            problems.contains("should be `## Damage phase` but is `## DPS`"),
            "{problems}"
        );
        assert!(problems.contains("unknown key `boss_hp`"), "{problems}");
        assert!(problems.contains("not part of the template"), "{problems}");
    }

    #[test]
    fn reviewed_guides_cannot_have_todos() {
        let repo = scaffolded("review");
        let guide = repo.0.join("content/raids/vault-of-glass/guide.mdoc");
        let text = fs::read_to_string(&guide)
            .unwrap()
            .replace("status: draft", "status: reviewed");
        fs::write(&guide, text).unwrap();
        assert!(
            repo.problems()
                .iter()
                .any(|p| p.contains("can't contain TODO"))
        );
    }
}
