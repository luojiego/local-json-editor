use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;

const DEFAULT_MAX_SCAN_DEPTH: u32 = 5;
const MAX_ALLOWED_SCAN_DEPTH: u32 = 20;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct JsonFileRecordPayload {
    name: String,
    relative_path: String,
    directory_path: String,
    depth: u32,
}

#[tauri::command]
fn select_workspace_dir() -> Result<Option<String>, String> {
    let selected = rfd::FileDialog::new().pick_folder();

    match selected {
        Some(path) => {
            let normalized = fs::canonicalize(&path).unwrap_or(path);
            Ok(Some(normalized.to_string_lossy().into_owned()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn scan_json_files(
    root_path: String,
    max_depth: Option<u32>,
) -> Result<Vec<JsonFileRecordPayload>, String> {
    let root = canonicalize_workspace_root(&root_path)?;
    let depth_limit = max_depth
        .unwrap_or(DEFAULT_MAX_SCAN_DEPTH)
        .min(MAX_ALLOWED_SCAN_DEPTH);

    let mut files = Vec::new();
    walk_directory(&root, &root, 0, depth_limit, &mut files)?;
    files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

    Ok(files)
}

#[tauri::command]
fn read_text_file(root_path: String, relative_path: String) -> Result<String, String> {
    let safe_path = resolve_existing_json_file_path(&root_path, &relative_path)?;
    fs::read_to_string(&safe_path).map_err(|error| format!("读取文件失败: {error}"))
}

#[tauri::command]
fn write_text_file(
    root_path: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    let safe_path = resolve_existing_json_file_path(&root_path, &relative_path)?;
    fs::write(&safe_path, content).map_err(|error| format!("写入文件失败: {error}"))
}

fn walk_directory(
    root: &Path,
    current: &Path,
    depth: u32,
    max_depth: u32,
    output: &mut Vec<JsonFileRecordPayload>,
) -> Result<(), String> {
    let entries = fs::read_dir(current).map_err(|error| format!("扫描目录失败: {error}"))?;

    for entry_result in entries {
        let entry = entry_result.map_err(|error| format!("扫描目录失败: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("读取文件类型失败: {error}"))?;

        if file_type.is_symlink() {
            continue;
        }

        let path = entry.path();

        if file_type.is_file() {
            if !is_json_file(&path) {
                continue;
            }

            let relative = path
                .strip_prefix(root)
                .map_err(|_| "扫描目录失败: 无法计算相对路径".to_string())?;
            let relative_path = normalize_relative_path(relative);
            let name = entry.file_name().to_string_lossy().into_owned();
            let directory_path = Path::new(&relative_path)
                .parent()
                .map(normalize_relative_path)
                .unwrap_or_default();

            output.push(JsonFileRecordPayload {
                name,
                relative_path,
                directory_path,
                depth,
            });
            continue;
        }

        if file_type.is_dir() && depth < max_depth {
            walk_directory(root, &path, depth + 1, max_depth, output)?;
        }
    }

    Ok(())
}

fn canonicalize_workspace_root(root_path: &str) -> Result<PathBuf, String> {
    let trimmed = root_path.trim();
    if trimmed.is_empty() {
        return Err("目录路径不能为空".to_string());
    }

    let root = Path::new(trimmed);
    if !root.exists() {
        return Err("目录不存在".to_string());
    }
    if !root.is_dir() {
        return Err("目标路径不是目录".to_string());
    }

    fs::canonicalize(root).map_err(|error| format!("目录不可访问: {error}"))
}

fn resolve_existing_json_file_path(
    root_path: &str,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let root = canonicalize_workspace_root(root_path)?;
    let safe_relative = parse_safe_relative_path(relative_path)?;
    if !is_json_file(&safe_relative) {
        return Err("仅支持读取和写入 .json / .jsonc 文件".to_string());
    }

    let candidate = root.join(&safe_relative);
    if !candidate.exists() {
        return Err("目标文件不存在".to_string());
    }
    if !candidate.is_file() {
        return Err("目标路径不是文件".to_string());
    }

    let canonical_file =
        fs::canonicalize(&candidate).map_err(|error| format!("访问文件失败: {error}"))?;
    ensure_path_within_root(&canonical_file, &root)?;

    if !is_json_file(&canonical_file) {
        return Err("仅支持读取和写入 .json / .jsonc 文件".to_string());
    }

    Ok(canonical_file)
}

fn parse_safe_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let normalized = relative_path.trim().replace('\\', "/");
    if normalized.is_empty() {
        return Err("文件路径不能为空".to_string());
    }

    let parsed = PathBuf::from(&normalized);
    if parsed.is_absolute() {
        return Err("文件路径必须为相对路径".to_string());
    }

    for component in parsed.components() {
        match component {
            Component::CurDir | Component::Normal(_) => {}
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("文件路径包含非法目录段".to_string())
            }
        }
    }

    Ok(parsed)
}

fn ensure_path_within_root(path: &Path, root: &Path) -> Result<(), String> {
    if path.starts_with(root) {
        return Ok(());
    }

    Err("拒绝访问工作区之外的路径".to_string())
}

fn normalize_relative_path(path: &Path) -> String {
    path.components()
        .filter_map(|component| match component {
            Component::Normal(segment) => Some(segment.to_string_lossy()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn is_json_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            let lower = ext.to_ascii_lowercase();
            lower == "json" || lower == "jsonc"
        })
        .unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            select_workspace_dir,
            scan_json_files,
            read_text_file,
            write_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
