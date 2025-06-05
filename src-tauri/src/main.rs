// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod generators;

use generators::{
    password::{generate_password as gen_password, PasswordGeneratorRequest},
    passphrase::{generate_passphrase as gen_passphrase, PassphraseGeneratorRequest},
    username::{generate_username as gen_username, UsernameGeneratorRequest},
};
use serde::{Deserialize, Serialize};
use tauri::{ClipboardManager, Manager, SystemTray, SystemTrayMenu, SystemTrayMenuItem, CustomMenuItem, SystemTrayEvent};
use zxcvbn::zxcvbn;
use std::fs;
use tauri::api::path;
use chrono::Utc;
use std::net::{Ipv4Addr, UdpSocket};
use std::process::Command;

// Cross-platform network interface detection

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
    // Try multiple approaches in order of reliability for production use
    
    // 1. Get routable IP using optimized UDP socket method
    if let Ok(ip) = get_routable_ip() {
        return Ok(IPResponse {
            ip: ip.clone(),
            masked_ip: mask_ip_address(&ip),
            country: None,
            region: None,
        });
    }

    // 2. Get active network interface IP (most reliable fallback)
    if let Ok(ip) = get_active_network_interface_ip() {
        return Ok(IPResponse {
            ip: ip.clone(),
            masked_ip: mask_ip_address(&ip),
            country: None,
            region: None,
        });
    }

    // 3. Platform-specific system commands
    if let Ok(ip) = get_network_interface_ip() {
        return Ok(IPResponse {
            ip: ip.clone(),
            masked_ip: mask_ip_address(&ip),
            country: None,
            region: None,
        });
    }

    // Final production fallback - return system identifier instead of mock data
    Ok(IPResponse {
        ip: format!("SYS-{}", std::env::consts::OS.to_uppercase()),
        masked_ip: "System IP".to_string(),
        country: None,
        region: None,
    })
}

/// Get the routable IP address by testing connectivity to well-known servers
/// This method determines which local IP would be used for internet communication
/// without actually sending data - production-ready and reliable
fn get_routable_ip() -> Result<String, String> {
    // Try multiple reliable servers to determine the routable IP
    let test_servers = [
        ("1.1.1.1", 53),      // Cloudflare DNS - very reliable
        ("8.8.8.8", 53),      // Google DNS - fallback
        ("208.67.222.222", 53), // OpenDNS - second fallback
    ];

    for (server, port) in &test_servers {
        match UdpSocket::bind("0.0.0.0:0") {
            Ok(socket) => {
                // Set a timeout for production reliability
                if let Err(_) = socket.set_read_timeout(Some(std::time::Duration::from_secs(2))) {
                    continue;
                }
                
                match socket.connect(format!("{}:{}", server, port)) {
                    Ok(_) => {
                        match socket.local_addr() {
                            Ok(addr) => {
                                let ip = addr.ip().to_string();
                                // Ensure we got a routable IP, not localhost or link-local
                                if let Ok(parsed_ip) = ip.parse::<Ipv4Addr>() {
                                    if !parsed_ip.is_loopback() && 
                                       !parsed_ip.is_link_local() && 
                                       !parsed_ip.is_unspecified() {
                                        return Ok(ip);
                                    }
                                }
                            }
                            Err(_) => continue,
                        }
                    }
                    Err(_) => continue,
                }
            }
            Err(_) => continue,
        }
    }
    
    Err("Could not determine routable IP address".to_string())
}

/// Get IP from the active network interface using system APIs
/// This is a reliable fallback that doesn't require network connectivity
fn get_active_network_interface_ip() -> Result<String, String> {
    use std::net::IpAddr;
    
    // Get all network interfaces
    match get_if_addrs::get_if_addrs() {
        Ok(interfaces) => {
            let mut best_ip = None;
            let mut fallback_ip = None;
            
            for interface in interfaces {
                let ip = interface.ip();
                
                // Skip loopback and inactive interfaces
                if interface.is_loopback() {
                    continue;
                }
                
                match ip {
                    IpAddr::V4(ipv4) => {
                        // Skip link-local and other special addresses
                        if ipv4.is_link_local() || ipv4.is_unspecified() || ipv4.is_broadcast() {
                            continue;
                        }
                        
                        // Prefer public IPs over private IPs
                        if !ipv4.is_private() {
                            best_ip = Some(ipv4.to_string());
                            break; // Found a public IP, use it immediately
                        } else if fallback_ip.is_none() {
                            // Keep the first private IP as fallback
                            fallback_ip = Some(ipv4.to_string());
                        }
                    }
                    IpAddr::V6(ipv6) => {
                        // For IPv6, prefer global addresses
                        if !ipv6.is_loopback() && !ipv6.is_unspecified() {
                            // IPv6 global addresses start with 2000::/3
                            let segments = ipv6.segments();
                            if segments[0] & 0xe000 == 0x2000 {
                                best_ip = Some(ipv6.to_string());
                                break;
                            }
                        }
                    }
                }
            }
            
            // Return the best IP found, or fallback to private IP
            if let Some(ip) = best_ip {
                return Ok(ip);
            } else if let Some(ip) = fallback_ip {
                return Ok(ip);
            }
        }
        Err(_) => {}
    }
    
    Err("Could not determine active network interface IP".to_string())
}

/// Get IP from network interfaces using platform-specific commands
fn get_network_interface_ip() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        get_windows_network_ip()
    }
    
    #[cfg(target_os = "macos")]
    {
        get_macos_network_ip()
    }
    
    #[cfg(target_os = "linux")]
    {
        get_linux_network_ip()
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported platform for network interface detection".to_string())
    }
}

#[cfg(target_os = "windows")]
fn get_windows_network_ip() -> Result<String, String> {
    // Use ipconfig to get network information
    match Command::new("ipconfig").output() {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            
            // Look for IPv4 addresses that are not loopback or link-local
            for line in output_str.lines() {
                if line.contains("IPv4 Address") {
                    if let Some(ip_part) = line.split(':').nth(1) {
                        let ip = ip_part.trim();
                        if let Ok(parsed_ip) = ip.parse::<Ipv4Addr>() {
                            // Exclude loopback (127.x.x.x) and link-local (169.254.x.x)
                            if !parsed_ip.is_loopback() && !parsed_ip.is_link_local() {
                                return Ok(ip.to_string());
                            }
                        }
                    }
                }
            }
        }
        Err(_) => {}
    }
    
    Err("Could not get Windows network IP".to_string())
}

#[cfg(target_os = "macos")]
fn get_macos_network_ip() -> Result<String, String> {
    // Use route command to get the default route interface, then get its IP
    match Command::new("route").args(&["get", "default"]).output() {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            
            // Extract interface name
            let mut interface = None;
            for line in output_str.lines() {
                if line.trim().starts_with("interface:") {
                    interface = line.split(':').nth(1).map(|s| s.trim());
                    break;
                }
            }
            
            if let Some(iface) = interface {
                // Get IP for this interface
                match Command::new("ifconfig").arg(iface).output() {
                    Ok(ifconfig_output) => {
                        let ifconfig_str = String::from_utf8_lossy(&ifconfig_output.stdout);
                        
                        for line in ifconfig_str.lines() {
                            if line.contains("inet ") && !line.contains("inet6") {
                                let parts: Vec<&str> = line.split_whitespace().collect();
                                if parts.len() > 1 {
                                    let ip = parts[1];
                                    if let Ok(parsed_ip) = ip.parse::<Ipv4Addr>() {
                                        if !parsed_ip.is_loopback() && !parsed_ip.is_link_local() {
                                            return Ok(ip.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(_) => {}
                }
            }
        }
        Err(_) => {}
    }
    
    Err("Could not get macOS network IP".to_string())
}

#[cfg(target_os = "linux")]
fn get_linux_network_ip() -> Result<String, String> {
    // Use ip route to get the default route, then extract the source IP
    match Command::new("ip").args(&["route", "get", "8.8.8.8"]).output() {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            
            // Look for "src" followed by an IP address
            for part in output_str.split_whitespace() {
                if let Ok(parsed_ip) = part.parse::<Ipv4Addr>() {
                    if !parsed_ip.is_loopback() && !parsed_ip.is_link_local() {
                        return Ok(part.to_string());
                    }
                }
            }
        }
        Err(_) => {}
    }
    
    // Fallback: use hostname -I
    match Command::new("hostname").arg("-I").output() {
        Ok(output) => {
            let output_str = String::from_utf8_lossy(&output.stdout);
            let ip = output_str.trim().split_whitespace().next().unwrap_or("");
            
            if let Ok(parsed_ip) = ip.parse::<Ipv4Addr>() {
                if !parsed_ip.is_loopback() && !parsed_ip.is_link_local() {
                    return Ok(ip.to_string());
                }
            }
        }
        Err(_) => {}
    }
    
    Err("Could not get Linux network IP".to_string())
}



fn mask_ip_address(ip: &str) -> String {
    let parts: Vec<&str> = ip.split('.').collect();
    if parts.len() == 4 {
        // IPv4 - show only first 2 octets for enhanced privacy
        format!("{}.{}.xxx.xxx", parts[0], parts[1])
    } else {
        // Handle IPv6 or malformed IPs
        if ip.contains(':') {
            // IPv6 - show only first segment for maximum privacy
            let segments: Vec<&str> = ip.split(':').collect();
            if !segments.is_empty() && !segments[0].is_empty() {
                format!("{}::xxxx:xxxx:xxxx:xxxx", segments[0])
            } else {
                "xxxx::xxxx:xxxx:xxxx:xxxx".to_string()
            }
        } else {
            "Not available".to_string()
        }
    }
}

/// Calculate password/passphrase strength using zxcvbn library.
/// 
/// This function provides a consistent strength scoring system across all generators:
/// - Uses industry-standard zxcvbn library for cryptographic strength analysis
/// - Converts zxcvbn's 0-4 scale to consistent 0-100 scale: score * 25
/// - Mapping: 0→0, 1→25, 2→50, 3→75, 4→100
/// - Thresholds: Very Weak<25, Weak<50, Fair<75, Good<100, Strong=100
/// 
/// This ensures identical zxcvbn scores always produce identical strength ratings
/// across passwords, passphrases, and any future zxcvbn-based generators.
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
        score: (estimate.score() as f64 * 25.0) as u8, // Convert 0-4 scale to 0-100 scale consistently
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
    // First attempt: Use machine-uid crate for secure hardware identification
    match machine_uid::get() {
        Ok(machine_id) => {
            // Successfully obtained machine UID - format it consistently
            let formatted_id = format_machine_id(&machine_id);
            return Ok(formatted_id);
        }
        Err(e) => {
            // Log the error for debugging but continue with fallback
            eprintln!("Failed to get machine UID: {}, falling back to environment-based method", e);
        }
    }
    
    // Fallback method: Use environment variables and system information
    // This is less secure but ensures the function always returns a value
    generate_fallback_hardware_id()
}

/// Format machine ID into a consistent HWID format
fn format_machine_id(machine_id: &str) -> String {
    use sha2::{Sha256, Digest};
    
    // Hash the machine ID to create a consistent format and length
    let mut hasher = Sha256::new();
    hasher.update(machine_id.as_bytes());
    let result = hasher.finalize();
    
    // Take first 16 bytes and format as HWID-XXXX-XXXX-XXXX-XXXX
    let hex_string: String = result[..8]
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect();
    
    format!("HWID-{}-{}-{}-{}", 
        &hex_string[0..4], 
        &hex_string[4..8], 
        &hex_string[8..12], 
        &hex_string[12..16])
}

/// Fallback hardware ID generation using environment variables and system info
/// This method is less secure but provides compatibility when machine-uid fails
fn generate_fallback_hardware_id() -> Result<String, String> {
    use sha2::{Sha256, Digest};
    
    let mut components = Vec::new();
    
    // Collect system information for hardware ID generation
    components.push(std::env::consts::OS.to_string());
    components.push(std::env::consts::ARCH.to_string());
    
    // Add machine name if available (more reliable than username)
    if let Ok(hostname) = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .or_else(|_| std::env::var("HOST")) {
        components.push(hostname);
    }
    
    // Add additional system identifiers if available
    if let Ok(processor_id) = std::env::var("PROCESSOR_IDENTIFIER") {
        components.push(processor_id);
    }
    
    if let Ok(processor_arch) = std::env::var("PROCESSOR_ARCHITECTURE") {
        components.push(processor_arch);
    }
    
    // Create a more robust hash using SHA-256 instead of DefaultHasher
    let combined_info = components.join("|");
    let mut hasher = Sha256::new();
    hasher.update(combined_info.as_bytes());
    
    // Add a static salt to make the hash less predictable
    hasher.update(b"SecureGen-HardwareID-Salt-2024");
    
    let result = hasher.finalize();
    
    // Format as HWID with fallback indicator
    let hex_string: String = result[..8]
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect();
    
    Ok(format!("HWID-FB-{}-{}-{}", 
        &hex_string[0..4], 
        &hex_string[4..8], 
        &hex_string[8..12]))
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

/// Calculate username security strength using custom algorithm.
/// 
/// Username security differs from password security and requires specialized evaluation:
/// - Focuses on privacy, uniqueness, and guessability rather than cryptographic strength
/// - Uses direct 0-100 scale calculation (no conversion needed)
/// - Considers username-specific factors: dictionary usage, personal info, common patterns
/// - Thresholds: Very Poor≤25, Poor≤45, Fair≤65, Good≤80, Excellent≥81
/// 
/// This custom approach is necessary because username security concerns (privacy, 
/// uniqueness, non-attribution) differ significantly from password security concerns
/// (resistance to brute force, dictionary attacks, cryptographic strength).
#[tauri::command]
async fn calculate_username_strength(username: String) -> Result<UsernameStrength, String> {
    let result = evaluate_username_security(&username);
    Ok(result)
}

fn evaluate_username_security(username: &str) -> UsernameStrength {
    let mut feedback = Vec::new();
    let mut privacy_score = 0u8;
    let mut uniqueness_score = 0u8;
    
    let username_lower = username.to_lowercase();
    
    // First check if this is likely a generated username - this affects how we score
    let is_generated = is_likely_generated_username(&username_lower);
    
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
    
    // Enhanced dictionary word analysis - distinguish between secure and weak dictionary usage
    // BUT: Apply length-based constraints to ensure consistent Basic username ratings
    let dict_analysis = analyze_dictionary_usage(&username_lower);
    match dict_analysis {
        DictionaryUsage::SecureEFFWord { word_length } => {
            // EFF words are cryptographically selected - they're GOOD for usernames
            // However, for Basic strength (3-4 chars), we need consistent Poor ratings
            if length <= 4 {
                // Basic usernames (3-4 chars) should be consistently Poor regardless of EFF status
                // Give minimal bonus to maintain some distinction but keep in Poor range
                privacy_score += 5;  // Reduced from 10 to keep Basic usernames in Poor category
                uniqueness_score += 10; // Reduced from 15
                feedback.push("Short word from secure wordlist - consider longer username".to_string());
            } else if word_length >= 7 {
                privacy_score += 20;
                uniqueness_score += 25;
                feedback.push("Uses cryptographically strong word - excellent choice".to_string());
            } else if word_length >= 5 {
                privacy_score += 15;
                uniqueness_score += 20;
                feedback.push("Uses secure word from cryptographic wordlist".to_string());
            } else {
                // This case should be covered by the length <= 4 check above, but keeping for safety
                privacy_score += 10;
                uniqueness_score += 15;
                feedback.push("Uses word from secure wordlist".to_string());
            }
        }
        DictionaryUsage::WeakDictionary => {
            // Non-EFF dictionary words or obvious patterns
            privacy_score = privacy_score.saturating_sub(15);
            uniqueness_score = uniqueness_score.saturating_sub(10);
            feedback.push("Contains easily guessable dictionary pattern".to_string());
        }
        DictionaryUsage::CompoundWords => {
            // Multiple dictionary words - depends on context
            privacy_score = privacy_score.saturating_sub(10);
            uniqueness_score += 5; // Compound can be more unique
            feedback.push("Contains compound words - moderate security".to_string());
        }
        DictionaryUsage::NonDictionary => {
            // Not a dictionary word - good for uniqueness, but for Basic length still weak
            if length <= 4 {
                // Basic non-dictionary usernames are still weak due to short length
                uniqueness_score += 10; // Reduced from 15 to keep Basic usernames in Poor range
                feedback.push("Short username - consider adding length for better security".to_string());
            } else {
                uniqueness_score += 15;
            }
        }
    }
    
    // Check for common words/brands - but be more lenient for generated usernames
    if !is_generated {
        let common_words = [
            "admin", "administrator", "user", "guest", "test", "demo", "example",
            "facebook", "google", "apple", "microsoft", "amazon", "twitter", "instagram",
            "skype", "discord", "telegram", "whatsapp", "youtube", "netflix", "spotify",
            "password", "login", "email", "mail", "contact", "support", "help",
            "john", "jane", "mike", "sarah", "alex", "chris", "david", "mary",
            "2023", "2024", "abc", "qwerty", "asdf"
        ];
        
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
            // Apply length-based bonus scaling for consistency
            if length <= 4 {
                // Basic usernames get reduced bonus to stay in Poor category
                privacy_score += 20; // Reduced from 25
                uniqueness_score += 15; // Reduced from 20
            } else {
                privacy_score += 25;
                uniqueness_score += 20;
            }
        }
    } else {
        // For generated usernames, give a privacy bonus since they're designed to be secure
        privacy_score += 25;
        uniqueness_score += 20;
    }
    
    // Personal information patterns
    if contains_personal_info_patterns(&username_lower) {
        feedback.push("May contain personal information patterns".to_string());
        privacy_score = privacy_score.saturating_sub(25);
    } else {
        // Apply length-based bonus scaling
        if length <= 4 {
            // Basic usernames get reduced bonus to maintain Poor rating
            privacy_score += 10; // Reduced from 15
        } else {
            privacy_score += 15;
        }
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
    
    // Sequential patterns - be more lenient for generated usernames with intentional sequences
    if !is_generated && contains_sequential_patterns(&username_lower) {
        feedback.push("Contains sequential patterns - less secure".to_string());
        uniqueness_score = uniqueness_score.saturating_sub(15);
    }
    
    // Boost score for patterns that indicate strong generation
    if is_generated {
        privacy_score += 15; // Increased bonus for generated usernames
        uniqueness_score += 15;
        feedback.push("Appears to be securely generated".to_string());
    }
    
    // Calculate overall score (weighted average)
    let overall_score = ((privacy_score as f32 * 0.6) + (uniqueness_score as f32 * 0.4)) as u8;
    let mut clamped_score = overall_score.min(100);
    
    // Hard cap for very short usernames - they should never exceed "Very Poor" regardless of other factors
    // 3-4 character usernames are fundamentally insecure due to small namespace and easy guessing
    if length <= 4 {
        clamped_score = clamped_score.min(25);  // Cap at 25 to ensure "Very Poor" rating
        if !feedback.iter().any(|f| f.contains("too short") || f.contains("Short")) {
            feedback.insert(0, "Very short username - highly vulnerable to guessing attacks".to_string());
        }
    }
    
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

#[derive(Debug, PartialEq)]
enum DictionaryUsage {
    SecureEFFWord { word_length: usize },
    WeakDictionary,
    CompoundWords,
    NonDictionary,
}

fn analyze_dictionary_usage(username: &str) -> DictionaryUsage {
    use crate::generators::wordlist::EFF_LONG_WORD_LIST;
    
    let username_lower = username.to_lowercase();
    
    // First check if it's a pure EFF word (these are cryptographically secure)
    if EFF_LONG_WORD_LIST.contains(&username_lower.as_str()) {
        return DictionaryUsage::SecureEFFWord { 
            word_length: username_lower.len() 
        };
    }
    
    // Extract base word by removing numbers from the end
    let base_word = username_lower.trim_end_matches(|c: char| c.is_numeric());
    let has_numbers = base_word != username_lower;
    
    if has_numbers && base_word.len() >= 3 {
        // Check if base word is a pure EFF word
        if EFF_LONG_WORD_LIST.contains(&base_word) {
            return DictionaryUsage::SecureEFFWord { 
                word_length: base_word.len() 
            };
        }
        
        // Check if base word is compound EFF words
        if is_compound_eff_word(&base_word) {
            return DictionaryUsage::SecureEFFWord { 
                word_length: base_word.len() 
            };
        }
    }
    
    // Check for compound EFF words (like from our generator)
    if is_compound_eff_word(&username_lower) {
        return DictionaryUsage::SecureEFFWord { 
            word_length: username_lower.len() 
        };
    }
    
    // Check for compound words (multiple dictionary words)
    if is_compound_word(&username_lower) {
        return DictionaryUsage::CompoundWords;
    }
    
    // Check for weak dictionary patterns
    if is_weak_dictionary_pattern(&username_lower) {
        return DictionaryUsage::WeakDictionary;
    }
    
    DictionaryUsage::NonDictionary
}

fn is_compound_eff_word(word: &str) -> bool {
    use crate::generators::wordlist::EFF_LONG_WORD_LIST;
    
    // Only check reasonable length words to avoid performance issues
    if word.len() < 6 || word.len() > 20 {
        return false;
    }
    
    // Try splitting the word at different positions
    for i in 3..=(word.len() - 3) {
        let (first_part, second_part) = word.split_at(i);
        
        // Both parts must be at least 3 characters and in the EFF list
        if first_part.len() >= 3 && second_part.len() >= 3 {
            if EFF_LONG_WORD_LIST.contains(&first_part) && EFF_LONG_WORD_LIST.contains(&second_part) {
                return true;
            }
        }
    }
    
    false
}

fn is_weak_dictionary_pattern(word: &str) -> bool {
    // Check for common dictionary word variations that are NOT in EFF list
    if is_word_variation(word) || is_word_with_common_suffix(word) {
        return true;
    }
    
    // Check for common weak patterns
    let weak_patterns = [
        "password", "username", "account", "profile", "login",
        "admin", "user", "guest", "test", "demo", "temp"
    ];
    
    for pattern in &weak_patterns {
        if word.contains(pattern) {
            return true;
        }
    }
    
    false
}

fn is_likely_generated_username(username: &str) -> bool {
    use crate::generators::wordlist::EFF_LONG_WORD_LIST;
    
    let username_lower = username.to_lowercase();
    
    // Pattern 1: EFF word + numbers (our generator pattern)
    let base_word = username_lower.trim_end_matches(|c: char| c.is_numeric());
    if base_word.len() >= 3 && base_word != username_lower {
        if EFF_LONG_WORD_LIST.contains(&base_word) {
            let number_part = &username_lower[base_word.len()..];
            // Check if it's exactly 4 digits (our generator uses 4-digit numbers)
            if number_part.len() == 4 && number_part.chars().all(|c| c.is_numeric()) {
                return true;
            }
        }
    }
    
    // Pattern 2: Single EFF word with good length (7+ chars indicates Strong/Maximum generation)
    if username_lower.len() >= 7 && EFF_LONG_WORD_LIST.contains(&username_lower.as_str()) {
        return true;
    }
    
    // Pattern 3: Two EFF words combined (compound generation)
    if is_compound_eff_word(&username_lower) {
        return true;
    }
    
    false
}

fn is_word_variation(word: &str) -> bool {
    use crate::generators::wordlist::EFF_LONG_WORD_LIST;
    
    // Check common variations: plurals, past tense, etc.
    let variations = [
        // Remove common suffixes to find root word
        word.strip_suffix("s"),
        word.strip_suffix("es"),
        word.strip_suffix("ed"),
        word.strip_suffix("ing"),
        word.strip_suffix("er"),
        word.strip_suffix("est"),
        word.strip_suffix("ly"),
        word.strip_suffix("tion"),
        word.strip_suffix("sion"),
        word.strip_suffix("ness"),
        word.strip_suffix("ment"),
        word.strip_suffix("able"),
        word.strip_suffix("ible"),
    ];
    
    for variation in variations.iter().flatten() {
        if variation.len() >= 3 && EFF_LONG_WORD_LIST.contains(variation) {
            return true;
        }
    }
    
    // Check if adding common prefixes creates a dictionary word
    let prefixes = ["un", "re", "pre", "dis", "mis", "over", "under", "out"];
    for prefix in &prefixes {
        if word.starts_with(prefix) {
            let root = &word[prefix.len()..];
            if root.len() >= 3 && EFF_LONG_WORD_LIST.contains(&root) {
                return true;
            }
        }
    }
    
    false
}

fn is_compound_word(word: &str) -> bool {
    use crate::generators::wordlist::EFF_LONG_WORD_LIST;
    
    // Only check reasonable length words to avoid performance issues
    if word.len() < 6 || word.len() > 20 {
        return false;
    }
    
    // Try splitting the word at different positions
    for i in 3..=(word.len() - 3) {
        let (first_part, second_part) = word.split_at(i);
        
        // Both parts must be at least 3 characters and in the dictionary
        if first_part.len() >= 3 && second_part.len() >= 3 {
            if EFF_LONG_WORD_LIST.contains(&first_part) && EFF_LONG_WORD_LIST.contains(&second_part) {
                return true;
            }
        }
    }
    
    false
}

fn is_word_with_common_suffix(word: &str) -> bool {
    use crate::generators::wordlist::EFF_LONG_WORD_LIST;
    
    // Check for dictionary words with common numeric or simple suffixes
    let numeric_suffixes = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", 
                           "12", "123", "01", "02", "03", "99", "00"];
    
    for suffix in &numeric_suffixes {
        if word.ends_with(suffix) {
            let root = &word[..word.len() - suffix.len()];
            if root.len() >= 3 && EFF_LONG_WORD_LIST.contains(&root) {
                return true;
            }
        }
    }
    
    // Check for words with year suffixes (common in usernames)
    if word.len() >= 7 {
        let potential_year_suffixes = ["1990", "1991", "1992", "1993", "1994", "1995", 
                                     "1996", "1997", "1998", "1999", "2000", "2001", 
                                     "2002", "2003", "2004", "2005", "2006", "2007", 
                                     "2008", "2009", "2010", "2011", "2012", "2013", 
                                     "2014", "2015", "2016", "2017", "2018", "2019", 
                                     "2020", "2021", "2022", "2023", "2024"];
        
        for year in &potential_year_suffixes {
            if word.ends_with(year) {
                let root = &word[..word.len() - 4];
                if root.len() >= 3 && EFF_LONG_WORD_LIST.contains(&root) {
                    return true;
                }
            }
        }
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

fn create_system_tray() -> SystemTray {
    let show = CustomMenuItem::new("show".to_string(), "Show SecureGen");
    let hide = CustomMenuItem::new("hide".to_string(), "Hide to Tray");
    let generate_password = CustomMenuItem::new("generate_password".to_string(), "Generate Password");
    let generate_passphrase = CustomMenuItem::new("generate_passphrase".to_string(), "Generate Passphrase");
    let generate_username = CustomMenuItem::new("generate_username".to_string(), "Generate Username");
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(generate_password)
        .add_item(generate_passphrase)
        .add_item(generate_username)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(hide)
        .add_item(quit);

    SystemTray::new().with_menu(tray_menu)
}

fn handle_system_tray_event(app: &tauri::AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick {
            position: _,
            size: _,
            ..
        } => {
            // Left click shows/focuses the window
            if let Some(window) = app.get_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.set_focus();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
        SystemTrayEvent::RightClick {
            position: _,
            size: _,
            ..
        } => {
            // Right click shows the context menu (handled automatically)
        }
        SystemTrayEvent::DoubleClick {
            position: _,
            size: _,
            ..
        } => {
            // Double click shows the window
            if let Some(window) = app.get_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        SystemTrayEvent::MenuItemClick { id, .. } => {
            match id.as_str() {
                "show" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                }
                "hide" => {
                    if let Some(window) = app.get_window("main") {
                        let _ = window.hide();
                    }
                }
                "generate_password" => {
                    // Show window and trigger password generation
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        // Emit an event to the frontend to generate a password
                        let _ = window.emit("tray-generate-password", ());
                    }
                }
                "generate_passphrase" => {
                    // Show window and trigger passphrase generation
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        // Emit an event to the frontend to generate a passphrase
                        let _ = window.emit("tray-generate-passphrase", ());
                    }
                }
                "generate_username" => {
                    // Show window and trigger username generation
                    if let Some(window) = app.get_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                        // Emit an event to the frontend to generate a username
                        let _ = window.emit("tray-generate-username", ());
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        }
        _ => {}
    }
}

fn main() {
    let system_tray = create_system_tray();
    
    tauri::Builder::default()
        .system_tray(system_tray)
        .on_system_tray_event(handle_system_tray_event)
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
        .setup(|app| {
            // Handle window close event to hide to tray instead of closing
            let window = app.get_window("main").unwrap();
            let app_handle = app.handle();
            
            window.on_window_event(move |event| {
                match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        // Prevent the window from closing and hide it instead
                        api.prevent_close();
                        if let Some(window) = app_handle.get_window("main") {
                            let _ = window.hide();
                        }
                    }
                    _ => {}
                }
            });
            
            Ok(())
        })
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
    }

    #[test]
    fn test_username_strength_good_username() {
        let result = evaluate_username_security("QuietRaven47");
        
        // This should get a high score - it's a compound EFF word with numbers (generated pattern)
        // Actual calculation: Privacy 80, Uniqueness 70 -> (80*0.6 + 70*0.4) = 76
        assert!(result.score >= 75, "QuietRaven47 should have excellent security score, got: {}", result.score);
    }

    #[test]
    fn test_username_strength_basic_usernames() {
        // Test that Basic usernames (3-4 characters) are consistently rated as Very Poor due to hard cap
        let basic_usernames = ["ace", "act", "add", "age", "aid", "aim", "air", "all", "and", "any"];
        
        for username in &basic_usernames {
            let result = evaluate_username_security(username);
            
            // Basic usernames should be capped at Very Poor (≤25) regardless of other factors
            assert!(result.score <= 25, 
                "Basic username '{}' should be Very Poor (≤25) due to hard cap, got: {} ({})", 
                username, result.score, result.security_level);
            
            // Should have feedback about being very short
            let has_short_feedback = result.feedback.iter().any(|f| 
                f.contains("Very short") || f.contains("Short") || f.contains("too short"));
            assert!(has_short_feedback, 
                "Basic username '{}' should have feedback about being too short", username);
        }
    }

    #[test]
    fn test_username_strength_eff_words() {
        // Test single EFF words of different lengths (using actual EFF words not in common_words list)
        let weak_eff = evaluate_username_security("able"); // 4 chars - Basic strength (hard capped)
        let standard_eff = evaluate_username_security("abide"); // 5 chars - Standard strength  
        let strong_eff = evaluate_username_security("outcome"); // 7 chars - Strong strength
        let maximum_eff = evaluate_username_security("transport"); // 9 chars - Maximum strength
        
        // EFF words should get reasonable scores, with longer words scoring higher
        // Updated expectations with hard cap for basic length:
        // - 4 char word is capped at 25 (Very Poor due to fundamental length vulnerability)
        // - 5 char word gets ~55-65 points (better length + EFF bonus)
        // - 7+ char words get ~75+ points (good length + strong EFF bonus)
        assert!(weak_eff.score <= 25, "Short EFF word should be capped at Very Poor due to length, got: {}", weak_eff.score);
        assert!(standard_eff.score >= 50, "Standard EFF word should be good, got: {}", standard_eff.score);
        assert!(strong_eff.score >= 70, "Strong EFF word should be very good, got: {}", strong_eff.score);
        assert!(maximum_eff.score >= 75, "Maximum EFF word should be excellent, got: {}", maximum_eff.score);
        
        // Longer words should be better than shorter ones
        assert!(standard_eff.score > weak_eff.score, "Standard should beat Basic (hard cap applies)");
        assert!(strong_eff.score > standard_eff.score, "Strong should beat Standard");
        assert!(maximum_eff.score >= strong_eff.score, "Maximum should be at least as good as Strong");
        
        // Verify that Basic EFF words are now in Very Poor category due to hard cap
        assert!(weak_eff.score <= 25, 
            "Basic EFF word should be in Very Poor category (≤25) due to hard cap, got: {}", weak_eff.score);
    }

    #[test]
    fn test_username_strength_generated_patterns() {
        // Test patterns that our generator creates (using actual EFF words not in common_words)
        let word_with_numbers = evaluate_username_security("outcome1234"); // EFF word + 4 digits (11 chars total)
        let capitalized_word = evaluate_username_security("Outcome");      // Capitalized EFF word (7 chars)
        let compound_words = evaluate_username_security("outcomeabide");   // Two EFF words (12 chars total)
        
        // Generated patterns should score well since they're all longer than 4 characters:
        // - EFF word + numbers: long enough to avoid hard cap, gets EFF bonus + numbers + generated bonus
        // - Single EFF word (capitalized): 7 chars, same as lowercase EFF word, good score
        // - Compound EFF words: very long, gets strong EFF bonus for compound word
        assert!(word_with_numbers.score >= 60, "EFF word + numbers should be good (long enough), got: {}", word_with_numbers.score);
        assert!(capitalized_word.score >= 70, "Capitalized EFF word should be very good, got: {}", capitalized_word.score);
        assert!(compound_words.score >= 75, "Compound EFF words should be excellent, got: {}", compound_words.score);
    }


}
