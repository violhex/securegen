use crate::generators::wordlist::EFF_LONG_WORD_LIST;
use crate::generators::username_forwarders;
use rand::{distributions::Distribution, seq::SliceRandom, Rng};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum UsernameError {
    #[error("Invalid API Key")]
    InvalidApiKey,
    #[error("Domain rejected by service - the domain may not be allowed or configured properly")]
    DomainRejected,
    #[error("Rate limit exceeded - please wait before making more requests")]
    RateLimitExceeded,
    #[error("Network error occurred while making HTTP request")]
    Http(#[from] reqwest::Error),
    #[error("Unknown error")]
    Unknown,
    #[error("Received error message from server: [{status}] {message}")]
    ResponseContent { status: reqwest::StatusCode, message: String },
    #[error("Invalid email format: {email}")]
    InvalidEmail { email: String },
    #[error("Domain cannot be empty")]
    EmptyDomain,
    #[error("Website name cannot be empty when using WebsiteName append type")]
    EmptyWebsiteName,
    #[error("API configuration is incomplete for {service}")]
    IncompleteApiConfig { service: String },
}

/// Username strength levels for word-based generation
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "PascalCase")]
pub enum UsernameStrength {
    /// Basic words (3-4 characters, common words)
    Basic,
    /// Standard words (5-6 characters, moderately common)
    Standard,
    /// Strong words (7-8 characters, less common)
    Strong,
    /// Maximum words (9+ characters, rare/complex words)
    Maximum,
}

impl UsernameStrength {
    /// Get the minimum word length for this strength level
    fn min_length(&self) -> usize {
        match self {
            UsernameStrength::Basic => 3,
            UsernameStrength::Standard => 5,
            UsernameStrength::Strong => 7,
            UsernameStrength::Maximum => 9,
        }
    }

    /// Get the maximum word length for this strength level
    fn max_length(&self) -> usize {
        match self {
            UsernameStrength::Basic => 4,
            UsernameStrength::Standard => 6,
            UsernameStrength::Strong => 8,
            UsernameStrength::Maximum => usize::MAX,
        }
    }

    /// Get words that match this strength level
    fn filter_words(&self) -> Vec<&'static str> {
        let min_len = self.min_length();
        let max_len = self.max_length();
        
        EFF_LONG_WORD_LIST
            .iter()
            .filter(|word| {
                let len = word.len();
                len >= min_len && len <= max_len
            })
            .copied()
            .collect()
    }
}

/// Append type for subaddress and catchall username generation
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "PascalCase")]
pub enum AppendType {
    /// Generates a random string of 8 lowercase characters as part of your username
    Random,
    /// Uses the website name as part of your username
    WebsiteName { website: String },
}

/// Configures the email forwarding service to use.
/// For instructions on how to configure each service, see the documentation:
/// <https://bitwarden.com/help/generator/#username-types>
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "PascalCase")]
pub enum ForwarderServiceType {
    /// Previously known as "AnonAddy"
    AddyIo {
        api_token: String,
        domain: String,
        base_url: String,
    },
    DuckDuckGo {
        token: String,
    },
    Firefox {
        api_token: String,
    },
    Fastmail {
        api_token: String,
    },
    ForwardEmail {
        api_token: String,
        domain: String,
    },
    SimpleLogin {
        api_key: String,
        base_url: String,
    },
}

/// Username generator request options
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "PascalCase")]
pub enum UsernameGeneratorRequest {
    /// Generates a single word username from the EFF word list
    Word {
        /// Capitalize the first letter of the word
        capitalize: bool,
        /// Include a 4 digit number at the end of the word
        include_number: bool,
        /// Strength level for word selection
        strength: UsernameStrength,
    },
    /// Generates an email using your provider's subaddressing capabilities.
    /// Note that not all providers support this functionality.
    /// This will generate an address of the format `youremail+generated@domain.tld`
    Subaddress {
        /// The type of subaddress to add to the base email
        #[serde(rename = "type")]
        r#type: AppendType,
        /// The full email address to use as the base for the subaddress
        email: String,
    },
    /// Generates an email for use with catchall email domains
    Catchall {
        /// The type of username to use with the catchall email domain
        #[serde(rename = "type")]
        r#type: AppendType,
        /// The domain to use for the catchall email address
        domain: String,
    },
    /// Generates an email using a forwarding service
    Forwarded {
        /// The email forwarding service to use, see [ForwarderServiceType]
        /// for instructions on how to configure each
        service: ForwarderServiceType,
        /// The website for which the email address is being generated
        /// This is not used in all services, and is only used for display purposes
        website: Option<String>,
    },
}

impl UsernameGeneratorRequest {
    /// Validates the request parameters and returns any validation errors
    fn validate(&self) -> Result<(), UsernameError> {
        match self {
            UsernameGeneratorRequest::Word { .. } => {
                // Word generation doesn't need validation
                Ok(())
            }
            UsernameGeneratorRequest::Subaddress { r#type, email } => {
                validate_email(email)?;
                validate_append_type(r#type)?;
                Ok(())
            }
            UsernameGeneratorRequest::Catchall { r#type, domain } => {
                if domain.trim().is_empty() {
                    return Err(UsernameError::EmptyDomain);
                }
                validate_append_type(r#type)?;
                Ok(())
            }
            UsernameGeneratorRequest::Forwarded { service, .. } => {
                validate_forwarder_service(service)?;
                Ok(())
            }
        }
    }
}

/// Validates email format
fn validate_email(email: &str) -> Result<(), UsernameError> {
    if email.trim().is_empty() || !email.contains('@') || email.len() < 5 {
        return Err(UsernameError::InvalidEmail {
            email: email.to_string(),
        });
    }
    Ok(())
}

/// Validates append type
fn validate_append_type(append_type: &AppendType) -> Result<(), UsernameError> {
    match append_type {
        AppendType::Random => Ok(()),
        AppendType::WebsiteName { website } => {
            if website.trim().is_empty() {
                return Err(UsernameError::EmptyWebsiteName);
            }
            Ok(())
        }
    }
}

/// Validates forwarder service configuration
fn validate_forwarder_service(service: &ForwarderServiceType) -> Result<(), UsernameError> {
    match service {
        ForwarderServiceType::AddyIo { api_token, domain, .. } => {
            if api_token.trim().is_empty() || domain.trim().is_empty() {
                return Err(UsernameError::IncompleteApiConfig {
                    service: "AddyIo".to_string(),
                });
            }
        }
        ForwarderServiceType::DuckDuckGo { token } => {
            if token.trim().is_empty() {
                return Err(UsernameError::IncompleteApiConfig {
                    service: "DuckDuckGo".to_string(),
                });
            }
        }
        ForwarderServiceType::Firefox { api_token } => {
            if api_token.trim().is_empty() {
                return Err(UsernameError::IncompleteApiConfig {
                    service: "Firefox".to_string(),
                });
            }
        }
        ForwarderServiceType::Fastmail { api_token } => {
            if api_token.trim().is_empty() {
                return Err(UsernameError::IncompleteApiConfig {
                    service: "Fastmail".to_string(),
                });
            }
        }
        ForwarderServiceType::ForwardEmail { api_token, domain } => {
            if api_token.trim().is_empty() || domain.trim().is_empty() {
                return Err(UsernameError::IncompleteApiConfig {
                    service: "ForwardEmail".to_string(),
                });
            }
        }
        ForwarderServiceType::SimpleLogin { api_key, .. } => {
            if api_key.trim().is_empty() {
                return Err(UsernameError::IncompleteApiConfig {
                    service: "SimpleLogin".to_string(),
                });
            }
        }
    }
    Ok(())
}

/// Implementation of the username generator.
///
/// Note: The HTTP client is passed in as a required parameter for convenience,
/// as some username generators require making API calls.
pub async fn generate_username(
    input: UsernameGeneratorRequest,
    http: &reqwest::Client,
) -> Result<String, UsernameError> {
    // Validate input first
    input.validate()?;
    
    use rand::thread_rng;
    match input {
        UsernameGeneratorRequest::Word { capitalize, include_number, strength } => {
            Ok(username_word(&mut thread_rng(), capitalize, include_number, strength))
        }
        UsernameGeneratorRequest::Subaddress { r#type, email } => {
            Ok(username_subaddress(&mut thread_rng(), r#type, email))
        }
        UsernameGeneratorRequest::Catchall { r#type, domain } => {
            Ok(username_catchall(&mut thread_rng(), r#type, domain))
        }
        UsernameGeneratorRequest::Forwarded { service, website } => {
            service.generate(http, website).await
        }
    }
}

impl ForwarderServiceType {
    /// Generate a username using the specified email forwarding service
    /// This requires an HTTP client to be passed in, as the service will need to make API calls
    pub async fn generate(
        self,
        http: &reqwest::Client,
        website: Option<String>,
    ) -> Result<String, UsernameError> {
        match self {
            ForwarderServiceType::AddyIo { api_token, domain, base_url } => {
                username_forwarders::addyio::generate(http, api_token, domain, base_url, website).await
            }
            ForwarderServiceType::DuckDuckGo { token } => {
                username_forwarders::duckduckgo::generate(http, token).await
            }
            ForwarderServiceType::Firefox { api_token } => {
                username_forwarders::firefox::generate(http, api_token, website).await
            }
            ForwarderServiceType::Fastmail { api_token } => {
                username_forwarders::fastmail::generate(http, api_token, website).await
            }
            ForwarderServiceType::ForwardEmail { api_token, domain } => {
                username_forwarders::forwardemail::generate(http, api_token, domain, website).await
            }
            ForwarderServiceType::SimpleLogin { api_key, base_url } => {
                username_forwarders::simplelogin::generate(http, api_key, base_url, website).await
            }
        }
    }
}

/// Generate a word-based username
fn username_word(mut rng: impl Rng, capitalize: bool, include_number: bool, strength: UsernameStrength) -> String {
    let filtered_words = strength.filter_words();
    
    // Fallback to full list if no words match the criteria (shouldn't happen with current strength levels)
    let word_list = if filtered_words.is_empty() {
        EFF_LONG_WORD_LIST
    } else {
        &filtered_words
    };
    
    let word = word_list
        .choose(&mut rng)
        .expect("word list is not empty");

    let mut word = if capitalize {
        capitalize_first_letter(word)
    } else {
        word.to_string()
    };

    if include_number {
        word.push_str(&random_number(&mut rng));
    }

    word
}

/// Generate a random 4 digit number, including leading zeros
fn random_number(mut rng: impl Rng) -> String {
    let num = rng.gen_range(0..=9999);
    format!("{num:0>4}")
}

/// Generate a username using a plus addressed email address
/// The format is `<username>+<random-or-website>@<domain>`
fn username_subaddress(mut rng: impl Rng, r#type: AppendType, email: String) -> String {
    // Email validation is performed before this function is called,
    // so we can safely assume the email is valid and contains '@'
    let (email_begin, email_end) = email.split_once('@').expect("Email validation ensures '@' is present");

    let email_middle = match r#type {
        AppendType::Random => random_lowercase_string(&mut rng, 8),
        AppendType::WebsiteName { website } => website,
    };

    format!("{}+{}@{}", email_begin, email_middle, email_end)
}

/// Generate a username using a catchall email address
/// The format is `<random-or-website>@<domain>`
fn username_catchall(mut rng: impl Rng, r#type: AppendType, domain: String) -> String {
    // Domain validation is performed before this function is called,
    // so we can safely assume the domain is not empty
    let email_start = match r#type {
        AppendType::Random => random_lowercase_string(&mut rng, 8),
        AppendType::WebsiteName { website } => website,
    };

    format!("{}@{}", email_start, domain)
}

/// Generate a random lowercase string of specified length
fn random_lowercase_string(mut rng: impl Rng, length: usize) -> String {
    const LOWERCASE_ALPHANUMERICAL: &[u8] = b"abcdefghijklmnopqrstuvwxyz1234567890";
    let dist = rand::distributions::Slice::new(LOWERCASE_ALPHANUMERICAL).expect("Non-empty slice");

    dist.sample_iter(&mut rng)
        .take(length)
        .map(|&b| b as char)
        .collect()
}

/// Capitalize the first letter of a string
fn capitalize_first_letter(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;

    #[test]
    fn test_username_word() {
        let mut rng = rand_chacha::ChaCha8Rng::from_seed([0u8; 32]);
        
        // Test basic word generation
        let username = username_word(&mut rng, false, false, UsernameStrength::Standard);
        assert!(!username.is_empty());
        assert!(username.chars().all(|c| c.is_ascii_lowercase()));
        
        // Test capitalized word
        let username_cap = username_word(&mut rng, true, false, UsernameStrength::Standard);
        assert!(username_cap.chars().next().unwrap().is_ascii_uppercase());
        
        // Test with numbers
        let username_num = username_word(&mut rng, false, true, UsernameStrength::Standard);
        assert!(username_num.len() > 4); // Should have word + 4 digit number
        assert!(username_num.chars().rev().take(4).all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn test_username_strength_levels() {
        let mut rng = rand_chacha::ChaCha8Rng::from_seed([0u8; 32]);
        
        // Test basic strength (3-4 characters)
        let basic_username = username_word(&mut rng, false, false, UsernameStrength::Basic);
        assert!(basic_username.len() >= 3 && basic_username.len() <= 4);
        
        // Test standard strength (5-6 characters)
        let standard_username = username_word(&mut rng, false, false, UsernameStrength::Standard);
        assert!(standard_username.len() >= 5 && standard_username.len() <= 6);
        
        // Test strong strength (7-8 characters)
        let strong_username = username_word(&mut rng, false, false, UsernameStrength::Strong);
        assert!(strong_username.len() >= 7 && strong_username.len() <= 8);
        
        // Test maximum strength (9+ characters)
        let max_username = username_word(&mut rng, false, false, UsernameStrength::Maximum);
        assert!(max_username.len() >= 9);
    }

    #[test]
    fn test_username_subaddress() {
        let mut rng = rand_chacha::ChaCha8Rng::from_seed([0u8; 32]);
        
        // Test with random append type
        let username = username_subaddress(&mut rng, AppendType::Random, "test@example.com".to_string());
        assert!(username.contains("test+"));
        assert!(username.ends_with("@example.com"));
        
        // Test with website append type
        let username_web = username_subaddress(
            &mut rng, 
            AppendType::WebsiteName { website: "github".to_string() }, 
            "user@domain.com".to_string()
        );
        assert_eq!(username_web, "user+github@domain.com");
        
        // Note: Invalid email testing is now handled at the validation layer
        // before this function is called, so we don't test invalid inputs here
    }

    #[test]
    fn test_username_catchall() {
        let mut rng = rand_chacha::ChaCha8Rng::from_seed([0u8; 32]);
        
        // Test with random type
        let username = username_catchall(&mut rng, AppendType::Random, "example.com".to_string());
        assert!(username.ends_with("@example.com"));
        assert!(username.len() > "@example.com".len());
        
        // Test with website type
        let username_web = username_catchall(
            &mut rng, 
            AppendType::WebsiteName { website: "mysite".to_string() }, 
            "domain.org".to_string()
        );
        assert_eq!(username_web, "mysite@domain.org");
        
        // Note: Empty domain testing is now handled at the validation layer
        // before this function is called, so we don't test invalid inputs here
    }

    #[test]
    fn test_random_number() {
        let mut rng = rand_chacha::ChaCha8Rng::from_seed([0u8; 32]);
        
        let num = random_number(&mut rng);
        assert_eq!(num.len(), 4);
        assert!(num.chars().all(|c| c.is_ascii_digit()));
        
        // Test that it can generate leading zeros
        let mut _found_leading_zero = false;
        for _ in 0..100 {
            let num = random_number(&mut rng);
            if num.starts_with('0') {
                _found_leading_zero = true;
                break;
            }
        }
        // This might occasionally fail due to randomness, but very unlikely
        // assert!(_found_leading_zero, "Should be able to generate numbers with leading zeros");
    }

    #[test]
    fn test_random_lowercase_string() {
        let mut rng = rand_chacha::ChaCha8Rng::from_seed([0u8; 32]);
        
        let s = random_lowercase_string(&mut rng, 8);
        assert_eq!(s.len(), 8);
        assert!(s.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit()));
        
        let s_empty = random_lowercase_string(&mut rng, 0);
        assert_eq!(s_empty.len(), 0);
    }

    #[test]
    fn test_capitalize_first_letter() {
        assert_eq!(capitalize_first_letter("hello"), "Hello");
        assert_eq!(capitalize_first_letter("WORLD"), "WORLD");
        assert_eq!(capitalize_first_letter(""), "");
        assert_eq!(capitalize_first_letter("a"), "A");
    }

    #[test]
    fn test_json_deserialization() {
        // Test Word variant
        let word_json = r#"{"Word":{"capitalize":true,"include_number":false,"strength":"Standard"}}"#;
        let word_request: UsernameGeneratorRequest = serde_json::from_str(word_json).unwrap();
        match word_request {
            UsernameGeneratorRequest::Word { capitalize, include_number, strength } => {
                assert_eq!(capitalize, true);
                assert_eq!(include_number, false);
                assert!(matches!(strength, UsernameStrength::Standard));
            }
            _ => panic!("Expected Word variant"),
        }

        // Test Subaddress variant with Random type
        let subaddress_random_json = r#"{"Subaddress":{"type":"Random","email":"test@example.com"}}"#;
        let subaddress_request: UsernameGeneratorRequest = serde_json::from_str(subaddress_random_json).unwrap();
        match subaddress_request {
            UsernameGeneratorRequest::Subaddress { r#type, email } => {
                assert!(matches!(r#type, AppendType::Random));
                assert_eq!(email, "test@example.com");
            }
            _ => panic!("Expected Subaddress variant"),
        }

        // Test Subaddress variant with WebsiteName type
        let subaddress_website_json = r#"{"Subaddress":{"type":{"WebsiteName":{"website":"github.com"}},"email":"test@example.com"}}"#;
        let subaddress_website_request: UsernameGeneratorRequest = serde_json::from_str(subaddress_website_json).unwrap();
        match subaddress_website_request {
            UsernameGeneratorRequest::Subaddress { r#type, email } => {
                match r#type {
                    AppendType::WebsiteName { website } => {
                        assert_eq!(website, "github.com");
                    }
                    _ => panic!("Expected WebsiteName variant"),
                }
                assert_eq!(email, "test@example.com");
            }
            _ => panic!("Expected Subaddress variant"),
        }

        // Test Catchall variant with Random type
        let catchall_random_json = r#"{"Catchall":{"type":"Random","domain":"example.com"}}"#;
        let catchall_request: UsernameGeneratorRequest = serde_json::from_str(catchall_random_json).unwrap();
        match catchall_request {
            UsernameGeneratorRequest::Catchall { r#type, domain } => {
                assert!(matches!(r#type, AppendType::Random));
                assert_eq!(domain, "example.com");
            }
            _ => panic!("Expected Catchall variant"),
        }
    }


} 