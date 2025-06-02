use crate::generators::eff_wordlist::EFF_LONG_WORD_LIST;
use rand::{seq::SliceRandom, Rng, RngCore};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PassphraseError {
    #[error("'num_words' must be between {minimum} and {maximum}")]
    InvalidNumWords { minimum: u8, maximum: u8 },
}

/// Passphrase generator request options.
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "snake_case", deny_unknown_fields)]
pub struct PassphraseGeneratorRequest {
    /// Number of words in the generated passphrase.
    /// This value must be between 3 and 20.
    pub num_words: u8,
    /// Character separator between words in the generated passphrase. The value cannot be empty.
    pub word_separator: String,
    /// When set to true, capitalize the first letter of each word in the generated passphrase.
    pub capitalize: bool,
    /// When set to true, include a number at the end of one of the words in the generated
    /// passphrase.
    pub include_number: bool,
}

impl Default for PassphraseGeneratorRequest {
    fn default() -> Self {
        Self {
            num_words: 3,
            word_separator: " ".to_string(),
            capitalize: false,
            include_number: false,
        }
    }
}

const MINIMUM_PASSPHRASE_NUM_WORDS: u8 = 3;
const MAXIMUM_PASSPHRASE_NUM_WORDS: u8 = 20;

/// Represents a set of valid options to generate a passphrase with.
/// To get an instance of it, use
/// [`PassphraseGeneratorRequest::validate_options`](PassphraseGeneratorRequest::validate_options)
#[derive(Clone)]
struct ValidPassphraseGeneratorOptions {
    pub(super) num_words: u8,
    pub(super) word_separator: String,
    pub(super) capitalize: bool,
    pub(super) include_number: bool,
}

impl PassphraseGeneratorRequest {
    /// Validates the request and returns an immutable struct with valid options to use with the
    /// passphrase generator.
    fn validate_options(self) -> Result<ValidPassphraseGeneratorOptions, PassphraseError> {
        if !(MINIMUM_PASSPHRASE_NUM_WORDS..=MAXIMUM_PASSPHRASE_NUM_WORDS).contains(&self.num_words)
        {
            return Err(PassphraseError::InvalidNumWords {
                minimum: MINIMUM_PASSPHRASE_NUM_WORDS,
                maximum: MAXIMUM_PASSPHRASE_NUM_WORDS,
            });
        }

        Ok(ValidPassphraseGeneratorOptions {
            num_words: self.num_words,
            word_separator: self.word_separator,
            capitalize: self.capitalize,
            include_number: self.include_number,
        })
    }
}

/// Implementation of the random passphrase generator.
pub fn generate_passphrase(request: PassphraseGeneratorRequest) -> Result<String, PassphraseError> {
    let options = request.validate_options()?;
    Ok(passphrase_with_rng(rand::thread_rng(), options))
}

fn passphrase_with_rng(mut rng: impl RngCore, options: ValidPassphraseGeneratorOptions) -> String {
    let mut passphrase_words = gen_words(&mut rng, options.num_words);
    if options.include_number {
        include_number_in_words(&mut rng, &mut passphrase_words);
    }
    if options.capitalize {
        capitalize_words(&mut passphrase_words);
    }
    passphrase_words.join(&options.word_separator)
}

fn gen_words(mut rng: impl RngCore, num_words: u8) -> Vec<String> {
    (0..num_words)
        .map(|_| {
            EFF_LONG_WORD_LIST
                .choose(&mut rng)
                .expect("slice is not empty")
                .to_string()
        })
        .collect()
}

fn include_number_in_words(mut rng: impl RngCore, words: &mut [String]) {
    let number_idx = rng.gen_range(0..words.len());
    words[number_idx].push_str(&rng.gen_range(0..=9).to_string());
}

fn capitalize_words(words: &mut [String]) {
    words
        .iter_mut()
        .for_each(|w| *w = capitalize_first_letter(w));
}

fn capitalize_first_letter(s: &str) -> String {
    // Unicode case conversion can change the length of the string, so we can't capitalize in place.
    // Instead we extract the first character and convert it to uppercase. This returns
    // an iterator which we collect into a string, and then append the rest of the input.
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::SeedableRng;

    #[test]
    fn test_gen_words() {
        let mut rng = rand_chacha::ChaCha8Rng::from_seed([0u8; 32]);
        let words = gen_words(&mut rng, 4);
        assert_eq!(words.len(), 4);
        // All words should be from the EFF wordlist
        for word in &words {
            assert!(EFF_LONG_WORD_LIST.contains(&word.as_str()));
        }
        
        // Test with deterministic seed for specific output
        let mut rng = rand_chacha::ChaCha8Rng::from_seed([0u8; 32]);
        let words = gen_words(&mut rng, 2);
        assert_eq!(words.len(), 2);
        // First two words should be consistent with the seed
        assert!(!words[0].is_empty());
        assert!(!words[1].is_empty());
    }

    #[test]
    fn test_capitalize() {
        assert_eq!(capitalize_first_letter("hello"), "Hello");
        assert_eq!(capitalize_first_letter("1ello"), "1ello");
        assert_eq!(capitalize_first_letter("Hello"), "Hello");
        assert_eq!(capitalize_first_letter("h"), "H");
        assert_eq!(capitalize_first_letter(""), "");

        // Also supports non-ascii, though the EFF list doesn't have any
        assert_eq!(capitalize_first_letter("áéíóú"), "Áéíóú");
    }

    #[test]
    fn test_capitalize_words() {
        let mut words = vec!["hello".into(), "world".into()];
        capitalize_words(&mut words);
        assert_eq!(words, &["Hello", "World"]);
    }

    #[test]
    fn test_include_number() {
        let mut rng = rand_chacha::ChaCha8Rng::from_seed([0u8; 32]);

        let mut words = vec!["hello".into(), "world".into()];
        include_number_in_words(&mut rng, &mut words);
        
        // One of the words should have a number appended
        let has_number = words.iter().any(|word| word.chars().any(|c| c.is_ascii_digit()));
        assert!(has_number);
        
        // Test deterministic behavior
        let mut rng = rand_chacha::ChaCha8Rng::from_seed([42u8; 32]);
        let mut words = vec!["test".into(), "word".into()];
        include_number_in_words(&mut rng, &mut words);
        
        // Should have exactly one number in the entire passphrase
        let digit_count = words.iter()
            .flat_map(|word| word.chars())
            .filter(|c| c.is_ascii_digit())
            .count();
        assert_eq!(digit_count, 1);
    }

    #[test]
    fn test_separator_unicode() {
        let mut rng = rand_chacha::ChaCha8Rng::from_seed([0u8; 32]);

        let input = PassphraseGeneratorRequest {
            num_words: 3,
            // Test with unicode separator
            word_separator: "🔒".into(),
            capitalize: false,
            include_number: false,
        }
        .validate_options()
        .unwrap();
        
        let result = passphrase_with_rng(&mut rng, input);
        assert_eq!(result.matches('🔒').count(), 2); // Should have 2 separators for 3 words
    }

    #[test]
    fn test_passphrase_generation() {
        let request = PassphraseGeneratorRequest {
            num_words: 4,
            word_separator: "-".to_string(),
            capitalize: true,
            include_number: true,
        };

        let passphrase = generate_passphrase(request).unwrap();
        
        // Should have 3 separators for 4 words
        assert_eq!(passphrase.matches('-').count(), 3);
        
        // Should have at least one number
        assert!(passphrase.chars().any(|c| c.is_ascii_digit()));
        
        // Should have capitalized words
        let words: Vec<&str> = passphrase.split('-').collect();
        for word in words {
            if !word.is_empty() {
                let first_char = word.chars().next().unwrap();
                if first_char.is_alphabetic() {
                    assert!(first_char.is_uppercase());
                }
            }
        }
    }

    #[test]
    fn test_deterministic_generation() {
        // Test that same seed produces same result
        let mut rng1 = rand_chacha::ChaCha8Rng::from_seed([100u8; 32]);
        let mut rng2 = rand_chacha::ChaCha8Rng::from_seed([100u8; 32]);
        
        let options = ValidPassphraseGeneratorOptions {
            num_words: 4,
            word_separator: "-".to_string(),
            capitalize: true,
            include_number: true,
        };
        
        let result1 = passphrase_with_rng(&mut rng1, options.clone());
        let result2 = passphrase_with_rng(&mut rng2, options);
        
        assert_eq!(result1, result2);
    }

    #[test]
    fn test_validation() {
        // Valid request
        let valid_request = PassphraseGeneratorRequest {
            num_words: 5,
            word_separator: " ".to_string(),
            capitalize: false,
            include_number: false,
        };
        assert!(valid_request.validate_options().is_ok());

        // Test minimum boundary
        let min_request = PassphraseGeneratorRequest {
            num_words: MINIMUM_PASSPHRASE_NUM_WORDS,
            word_separator: " ".to_string(),
            capitalize: false,
            include_number: false,
        };
        assert!(min_request.validate_options().is_ok());

        // Test maximum boundary
        let max_request = PassphraseGeneratorRequest {
            num_words: MAXIMUM_PASSPHRASE_NUM_WORDS,
            word_separator: " ".to_string(),
            capitalize: false,
            include_number: false,
        };
        assert!(max_request.validate_options().is_ok());

        // Invalid - too few words
        let invalid_request = PassphraseGeneratorRequest {
            num_words: 2,
            word_separator: " ".to_string(),
            capitalize: false,
            include_number: false,
        };
        assert!(invalid_request.validate_options().is_err());

        // Invalid - too many words
        let invalid_request = PassphraseGeneratorRequest {
            num_words: 25,
            word_separator: " ".to_string(),
            capitalize: false,
            include_number: false,
        };
        assert!(invalid_request.validate_options().is_err());
    }

    #[test]
    fn test_serde_compatibility() {
        // Test that our struct can be serialized/deserialized with snake_case
        let request = PassphraseGeneratorRequest {
            num_words: 5,
            word_separator: "-".to_string(),
            capitalize: true,
            include_number: false,
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: PassphraseGeneratorRequest = serde_json::from_str(&json).unwrap();
        
        assert_eq!(request.num_words, deserialized.num_words);
        assert_eq!(request.word_separator, deserialized.word_separator);
        assert_eq!(request.capitalize, deserialized.capitalize);
        assert_eq!(request.include_number, deserialized.include_number);
        
        // Verify snake_case serialization
        assert!(json.contains("num_words"));
        assert!(json.contains("word_separator"));
        assert!(json.contains("include_number"));
    }

    #[test]
    fn test_empty_separator() {
        let request = PassphraseGeneratorRequest {
            num_words: 3,
            word_separator: "".to_string(), // Empty separator
            capitalize: false,
            include_number: false,
        };

        let passphrase = generate_passphrase(request).unwrap();
        
        // Should work with empty separator (words concatenated)
        assert!(!passphrase.is_empty());
        assert!(!passphrase.contains(' ')); // No spaces since separator is empty
    }
} 