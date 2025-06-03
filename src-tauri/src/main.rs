// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod generators;

use generators::{
    password::{generate_password as gen_password, PasswordGeneratorRequest},
    passphrase::{generate_passphrase as gen_passphrase, PassphraseGeneratorRequest},
    username::{generate_username as gen_username, UsernameGeneratorRequest},
};
use serde::{Deserialize, Serialize};
use tauri::ClipboardManager;
use zxcvbn::zxcvbn;
use std::fs;
use tauri::api::path;
use chrono::Utc;

// Legacy struct for backward compatibility
#[derive(Debug, Serialize, Deserialize)]
struct PasswordConfig {
    length: u32,
    include_uppercase: bool,
    include_lowercase: bool,
    include_numbers: bool,
    include_symbols: bool,
    exclude_similar: bool,
    exclude_ambiguous: bool,
    custom_exclusions: String,
}

impl From<PasswordConfig> for PasswordGeneratorRequest {
    fn from(config: PasswordConfig) -> Self {
        Self {
            lowercase: config.include_lowercase,
            uppercase: config.include_uppercase,
            numbers: config.include_numbers,
            special: config.include_symbols,
            length: config.length as u8,
            avoid_ambiguous: config.exclude_similar,
            min_lowercase: None,
            min_uppercase: None,
            min_number: None,
            min_special: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct PasswordStrength {
    score: u8,
    crack_times_display: String,
    feedback: Vec<String>,
}

#[tauri::command]
async fn generate_password(request: PasswordGeneratorRequest) -> Result<String, String> {
    gen_password(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn generate_password_legacy(config: PasswordConfig) -> Result<String, String> {
    let request: PasswordGeneratorRequest = config.into();
    gen_password(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn generate_passphrase(request: PassphraseGeneratorRequest) -> Result<String, String> {
    gen_passphrase(request).map_err(|e| e.to_string())
}

#[tauri::command]
async fn generate_username(request: UsernameGeneratorRequest) -> Result<String, String> {
    let client = reqwest::Client::new();
    gen_username(request, &client).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn calculate_password_strength(password: String) -> Result<PasswordStrength, String> {
    let estimate = zxcvbn(&password, &[]).map_err(|e| e.to_string())?;
    
    let feedback: Vec<String> = estimate
        .feedback()
        .as_ref()
        .map(|f| {
            let mut suggestions = Vec::new();
            if let Some(warning) = &f.warning() {
                suggestions.push(warning.to_string());
            }
            suggestions.extend(f.suggestions().iter().map(|s| s.to_string()));
            suggestions
        })
        .unwrap_or_default();
    
    let crack_time_display = match estimate.score() {
        0 => "Very weak - could be cracked instantly".to_string(),
        1 => "Weak - could be cracked in minutes".to_string(), 
        2 => "Fair - could be cracked in hours to days".to_string(),
        3 => "Good - could take months to crack".to_string(),
        4 => "Strong - would take years to crack".to_string(),
        _ => "Unknown strength".to_string(),
    };
    
    Ok(PasswordStrength {
        score: (estimate.score() as f64 * 20.0 + 20.0) as u8, // Convert 0-4 scale to 20-100 (more realistic)
        crack_times_display: crack_time_display,
        feedback,
    })
}

#[tauri::command]
async fn copy_to_clipboard(app_handle: tauri::AppHandle, text: String) -> Result<bool, String> {
    app_handle
        .clipboard_manager()
        .write_text(text)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

#[tauri::command]
async fn save_password_to_file(password: String) -> Result<String, String> {
    // Get the documents directory using Tauri v1 API
    let documents_dir = path::document_dir()
        .ok_or("Could not find documents directory")?;
    
    // Create secgen directory path
    let secgen_dir = documents_dir.join("secgen");
    
    // Create the directory if it doesn't exist
    if !secgen_dir.exists() {
        fs::create_dir_all(&secgen_dir)
            .map_err(|e| format!("Failed to create secgen directory: {}", e))?;
    }
    
    // Generate timestamp filename
    let now = Utc::now();
    let timestamp = now.format("%Y-%m-%d-%H-%M");
    let filename = format!("{}-pw.txt", timestamp);
    let file_path = secgen_dir.join(&filename);
    
    // Write password to file
    fs::write(&file_path, &password)
        .map_err(|e| format!("Failed to write password to file: {}", e))?;
    
    // Return the full path as confirmation
    Ok(file_path.to_string_lossy().to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            generate_password,
            generate_password_legacy,
            generate_passphrase,
            generate_username,
            calculate_password_strength,
            copy_to_clipboard,
            save_password_to_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
