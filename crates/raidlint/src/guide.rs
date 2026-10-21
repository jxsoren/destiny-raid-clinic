//! Minimal Markdoc guide reading: frontmatter `key: value` pairs and `##` headings.
//! Full frontmatter validation happens in the site's content collection; this only checks what
//! the template contract needs.

use std::collections::BTreeMap;

pub struct Guide {
    pub frontmatter: BTreeMap<String, String>,
    pub h1_count: usize,
    pub sections: Vec<String>,
    pub has_todo: bool,
}

pub fn parse(text: &str) -> Result<Guide, String> {
    let rest = text
        .strip_prefix("---\n")
        .ok_or("guide must start with a `---` frontmatter block")?;
    let end = rest
        .find("\n---\n")
        .ok_or("frontmatter block is missing its closing `---`")?;
    let (front, body) = (&rest[..end], &rest[end + 5..]);

    let mut frontmatter = BTreeMap::new();
    for line in front.lines().filter(|l| !l.trim().is_empty()) {
        let (k, v) = line
            .split_once(':')
            .ok_or_else(|| format!("frontmatter line isn't `key: value`: {line}"))?;
        let v = v.trim().trim_matches('"').trim_matches('\'');
        frontmatter.insert(k.trim().to_string(), v.to_string());
    }

    let (mut h1_count, mut sections, mut in_fence) = (0, Vec::new(), false);
    for line in body.lines() {
        if line.trim_start().starts_with("```") {
            in_fence = !in_fence;
            continue;
        }
        if in_fence {
            continue;
        }
        if let Some(h) = line.strip_prefix("## ") {
            sections.push(h.trim().to_string());
        } else if line.starts_with("# ") {
            h1_count += 1;
        }
    }

    Ok(Guide {
        frontmatter,
        h1_count,
        sections,
        has_todo: body.contains("TODO"),
    })
}

/// Describes the first difference between the required and actual section lists.
pub fn section_problem(required: &[&str], found: &[String]) -> Option<String> {
    for (i, want) in required.iter().enumerate() {
        match found.get(i) {
            Some(got) if got == want => {}
            Some(got) => {
                return Some(format!(
                    "section {} should be `## {want}` but is `## {got}` (required order: {})",
                    i + 1,
                    required.join(" → ")
                ));
            }
            None => return Some(format!("missing section `## {want}`")),
        }
    }
    found.get(required.len()).map(|extra| {
        format!("unexpected extra section `## {extra}` (use ### inside a required section)")
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_frontmatter_headings_and_skips_fences() {
        let g = parse("---\nraid: vog\nstatus: \"draft\"\n---\n\n# T\n\n## A\n```\n## not a heading\n```\n## B\n").unwrap();
        assert_eq!(g.frontmatter["raid"], "vog");
        assert_eq!(g.frontmatter["status"], "draft");
        assert_eq!(g.h1_count, 1);
        assert_eq!(g.sections, ["A", "B"]);
    }

    #[test]
    fn reports_first_section_difference() {
        let found = vec!["A".to_string(), "C".to_string()];
        assert!(
            section_problem(&["A", "B"], &found)
                .unwrap()
                .contains("should be `## B`")
        );
        assert!(
            section_problem(&["A", "C", "D"], &found)
                .unwrap()
                .contains("missing section `## D`")
        );
        assert!(
            section_problem(&["A"], &found)
                .unwrap()
                .contains("unexpected extra")
        );
        assert!(section_problem(&["A", "C"], &found).is_none());
    }
}
