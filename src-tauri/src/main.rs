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

#[derive(Debug, Serialize, Deserialize)]
struct UsernameStrength {
    score: u8,
    security_level: String,
    feedback: Vec<String>,
    privacy_score: u8,
    uniqueness_score: u8,
}

#[derive(Debug, Serialize, Deserialize)]
struct IPResponse {
    ip: String,
    masked_ip: String,
    country: Option<String>,
    region: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SystemIdentityResponse {
    hardware_id: String,
    ip_address: String,
    masked_ip: String,
    platform: String,
    user_key: String,
    country: Option<String>,
    region: Option<String>,
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
async fn get_public_ip_address() -> Result<IPResponse, String> {
    // Create HTTP client with timeout
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("SecureGen/1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Try multiple reliable IP services in order of preference
    let ip_services = vec![
        "https://httpbin.org/ip",           // Reliable, returns JSON
        "https://api.ipify.org?format=json", // Fallback
        "https://ipinfo.io/json",           // Provides additional info
    ];

    for service_url in ip_services {
        match get_ip_from_service(&client, service_url).await {
            Ok(response) => return Ok(response),
            Err(e) => {
                eprintln!("Failed to get IP from {}: {}", service_url, e);
                continue;
            }
        }
    }

    // If all services fail, return a safe fallback
    Ok(IPResponse {
        ip: "Unknown".to_string(),
        masked_ip: "Not available".to_string(),
        country: None,
        region: None,
    })
}

async fn get_ip_from_service(client: &reqwest::Client, url: &str) -> Result<IPResponse, String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }

    let text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    // Parse different response formats
    let ip = if url.contains("httpbin.org") {
        // httpbin.org returns: {"origin": "1.2.3.4"}
        let json: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;
        json["origin"]
            .as_str()
            .ok_or("Missing origin field")?
            .to_string()
    } else if url.contains("ipinfo.io") {
        // ipinfo.io returns: {"ip": "1.2.3.4", "city": "...", "region": "...", "country": "..."}
        let json: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;
        
        let ip = json["ip"]
            .as_str()
            .ok_or("Missing ip field")?
            .to_string();
        
        let country = json["country"].as_str().map(|s| s.to_string());
        let region = json["region"].as_str().map(|s| s.to_string());
        
        return Ok(IPResponse {
            ip: ip.clone(),
            masked_ip: mask_ip_address(&ip),
            country,
            region,
        });
    } else {
        // api.ipify.org returns: {"ip": "1.2.3.4"}
        let json: serde_json::Value = serde_json::from_str(&text)
            .map_err(|e| format!("Failed to parse JSON: {}", e))?;
        json["ip"]
            .as_str()
            .ok_or("Missing ip field")?
            .to_string()
    };

    Ok(IPResponse {
        ip: ip.clone(),
        masked_ip: mask_ip_address(&ip),
        country: None,
        region: None,
    })
}

fn mask_ip_address(ip: &str) -> String {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() == 4 {
        format!("{}.{}.{}.xxx", parts[0], parts[1], parts[2])
    } else {
        // Handle IPv6 or malformed IPs
        if ip.contains(':') {
            // IPv6 - mask the last segment
            let segments: Vec<&str> = ip.split(':').collect();
            if segments.len() > 2 {
                let masked_segments = segments[..segments.len()-2].join(":");
                format!("{}::xxxx", masked_segments)
            } else {
                "xxxx::xxxx".to_string()
            }
        } else {
            "Not available".to_string()
        }
    }
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

#[tauri::command]
async fn get_system_identity() -> Result<SystemIdentityResponse, String> {
    // Get IP information
    let ip_response = get_public_ip_address().await?;
    
    // Generate hardware ID (simplified version - in production you'd want more sophisticated logic)
    let hardware_id = generate_hardware_id().await?;
    
    // Generate user storage key based on hardware ID
    let user_key = generate_user_storage_key(&hardware_id).await?;
    
    // Get platform information
    let platform = std::env::consts::OS.to_string();
    
    Ok(SystemIdentityResponse {
        hardware_id,
        ip_address: ip_response.ip,
        masked_ip: ip_response.masked_ip,
        platform,
        user_key,
        country: ip_response.country,
        region: ip_response.region,
    })
}

async fn generate_hardware_id() -> Result<String, String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    // Collect system information for hardware ID generation
    let mut hasher = DefaultHasher::new();
    
    // Add OS information
    std::env::consts::OS.hash(&mut hasher);
    std::env::consts::ARCH.hash(&mut hasher);
    
    // Add machine name if available
    if let Ok(hostname) = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .or_else(|_| std::env::var("HOST")) {
        hostname.hash(&mut hasher);
    }
    
    // Add user information if available
    if let Ok(username) = std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER")) {
        username.hash(&mut hasher);
    }
    
    let hash = hasher.finish();
    Ok(format!("HWID-{:X}-{:X}", hash >> 32, hash & 0xFFFFFFFF))
}

async fn generate_user_storage_key(hardware_id: &str) -> Result<String, String> {
    use sha2::{Sha256, Digest};
    
    let mut hasher = Sha256::new();
    hasher.update(hardware_id.as_bytes());
    let result = hasher.finalize();
    
    // Take first 8 bytes and convert to hex
    let short_key = result[..8]
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>();
    
    Ok(format!("securegen-store-{}", short_key))
}

#[tauri::command]
async fn calculate_username_strength(username: String) -> Result<UsernameStrength, String> {
    let result = evaluate_username_security(&username);
    Ok(result)
}

fn evaluate_username_security(username: &str) -> UsernameStrength {
    let mut feedback = Vec::new();
    let mut privacy_score = 0u8;
    let mut uniqueness_score = 0u8;
    
    // Length evaluation (different from passwords)
    let length = username.len();
    if length < 3 {
        feedback.push("Username is too short - minimum 3 characters recommended".to_string());
    } else if length >= 6 && length <= 20 {
        privacy_score += 20;
        uniqueness_score += 15;
    } else if length > 20 {
        feedback.push("Very long usernames may be memorable and stand out".to_string());
        privacy_score += 10;
    } else {
        privacy_score += 10;
    }
    
    // Check for common words/brands (major privacy concern for usernames)
    let common_words = [
        "admin", "administrator", "user", "guest", "test", "demo", "example",
        "facebook", "google", "apple", "microsoft", "amazon", "twitter", "instagram",
        "skype", "discord", "telegram", "whatsapp", "youtube", "netflix", "spotify",
        "password", "login", "email", "mail", "contact", "support", "help",
        "john", "jane", "mike", "sarah", "alex", "chris", "david", "mary",
        "2023", "2024", "123", "abc", "qwerty", "asdf"
    ];
    
    let username_lower = username.to_lowercase();
    let mut contains_common_word = false;
    
    for word in &common_words {
        if username_lower.contains(word) {
            contains_common_word = true;
            feedback.push(format!("Contains common word '{}' - reduces privacy", word));
            break;
        }
    }
    
    if contains_common_word {
        privacy_score = privacy_score.saturating_sub(30);
        uniqueness_score = uniqueness_score.saturating_sub(25);
    } else {
        privacy_score += 25;
        uniqueness_score += 20;
    }
    
    // Dictionary word check (simple implementation)
    if is_likely_dictionary_word(&username_lower) {
        feedback.push("Appears to be a dictionary word - easy to guess".to_string());
        privacy_score = privacy_score.saturating_sub(20);
        uniqueness_score = uniqueness_score.saturating_sub(15);
    } else {
        uniqueness_score += 15;
    }
    
    // Personal information patterns
    if contains_personal_info_patterns(&username_lower) {
        feedback.push("May contain personal information patterns".to_string());
        privacy_score = privacy_score.saturating_sub(25);
    } else {
        privacy_score += 15;
    }
    
    // Complexity evaluation (less important for usernames than passwords)
    let has_numbers = username.chars().any(|c| c.is_numeric());
    let has_letters = username.chars().any(|c| c.is_alphabetic());
    let has_special = username.chars().any(|c| !c.is_alphanumeric());
    
    if has_letters && has_numbers {
        uniqueness_score += 10;
        feedback.push("Good mix of letters and numbers".to_string());
    }
    
    if has_special {
        uniqueness_score += 5;
        feedback.push("Special characters add uniqueness".to_string());
    }
    
    // Sequential patterns (bad for usernames)
    if contains_sequential_patterns(&username_lower) {
        feedback.push("Contains sequential patterns - less secure".to_string());
        uniqueness_score = uniqueness_score.saturating_sub(15);
    }
    
    // Calculate overall score (weighted average)
    let overall_score = ((privacy_score as f32 * 0.6) + (uniqueness_score as f32 * 0.4)) as u8;
    let clamped_score = overall_score.min(100);
    
    // Add recommendations based on score
    if clamped_score < 30 {
        feedback.push("Consider using a more unique username".to_string());
        feedback.push("Avoid common words and personal information".to_string());
    } else if clamped_score < 60 {
        feedback.push("Username security could be improved".to_string());
        feedback.push("Consider adding numbers or making it more unique".to_string());
    } else if clamped_score < 80 {
        feedback.push("Good username security".to_string());
    } else {
        feedback.push("Excellent username security".to_string());
    }
    
    let security_level = match clamped_score {
        0..=25 => "Very Poor - High Risk",
        26..=45 => "Poor - Easily Guessable",
        46..=65 => "Fair - Some Privacy Concerns",
        66..=80 => "Good - Reasonably Secure",
        81..=100 => "Excellent - Highly Secure",
        _ => "Excellent - Highly Secure", // Fallback for any edge cases
    };
    
    UsernameStrength {
        score: clamped_score,
        security_level: security_level.to_string(),
        feedback,
        privacy_score,
        uniqueness_score,
    }
}

fn is_likely_dictionary_word(word: &str) -> bool {
    // Simple heuristic - real implementation would use a dictionary
    // Common English words that are often used as usernames
    let common_dict_words = [
        "account", "awesome", "amazing", "beautiful", "brilliant", "champion", "diamond",
        "excellent", "fantastic", "freedom", "golden", "happiness", "justice", "kindness",
        "liberty", "monster", "nature", "orange", "perfect", "quality", "rainbow", "silver",
        "thunder", "unique", "victory", "wisdom", "yellow", "zephyr", "animal", "bottle",
        "camera", "dragon", "engine", "flower", "garden", "hammer", "island", "jungle",
        "kitchen", "laptop", "mountain", "notebook", "ocean", "planet", "queen", "rocket",
        "summer", "table", "umbrella", "village", "winter", "guitar", "piano", "violin"
    ];
    
    // Check if it's a single common word
    if word.len() >= 4 && common_dict_words.contains(&word) {
        return true;
    }
    
    // Check if it's just a simple word pattern
    if word.len() <= 6 && word.chars().all(|c| c.is_alphabetic()) {
        return true;
    }
    
    false
}

fn contains_personal_info_patterns(username: &str) -> bool {
    // Check for birth year patterns
    if username.contains("199") || username.contains("200") || username.contains("201") {
        return true;
    }
    
    // Check for common age patterns
    let age_patterns = ["18", "19", "20", "21", "22", "23", "24", "25", "30", "40", "50"];
    for pattern in &age_patterns {
        if username.ends_with(pattern) {
            return true;
        }
    }
    
    // Check for common personal patterns
    let personal_patterns = ["name", "real", "official", "personal", "my", "the"];
    for pattern in &personal_patterns {
        if username.contains(pattern) {
            return true;
        }
    }
    
    false
}

fn contains_sequential_patterns(username: &str) -> bool {
    let sequential_patterns = ["123", "234", "345", "456", "567", "678", "789", "abc", "bcd", "cde"];
    for pattern in &sequential_patterns {
        if username.contains(pattern) {
            return true;
        }
    }
    false
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            generate_password,
            generate_password_legacy,
            generate_passphrase,
            generate_username,
            calculate_password_strength,
            calculate_username_strength,
            copy_to_clipboard,
            save_password_to_file,
            get_public_ip_address,
            get_system_identity
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_username_strength_skype() {
        let result = evaluate_username_security("Skype");
        
        // "Skype" should get a low score due to being a common brand name
        assert!(result.score < 40, "Skype should have low security score, got: {}", result.score);
        assert!(result.feedback.len() > 0, "Should have feedback for improvement");
        
        // Check that it identifies the brand name issue
        let has_brand_feedback = result.feedback.iter().any(|f| f.to_lowercase().contains("skype"));
        assert!(has_brand_feedback, "Should identify Skype as a problematic brand name");
        
        println!("Skype username analysis:");
        println!("Score: {}", result.score);
        println!("Security Level: {}", result.security_level);
        println!("Feedback: {:?}", result.feedback);
    }

    #[test]
    fn test_username_strength_good_username() {
        let result = evaluate_username_security("QuietRaven47");
        
        // This should get a reasonable score (adjusted for new wordlist)
        assert!(result.score >= 60, "QuietRaven47 should have good security score, got: {}", result.score);
        
        println!("QuietRaven47 username analysis:");
        println!("Score: {}", result.score);
        println!("Security Level: {}", result.security_level);
        println!("Feedback: {:?}", result.feedback);
    }
}
