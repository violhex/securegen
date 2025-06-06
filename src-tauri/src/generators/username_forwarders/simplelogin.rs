use reqwest::{header::CONTENT_TYPE, StatusCode};

use crate::generators::username::UsernameError;

pub async fn generate(
    http: &reqwest::Client,
    api_key: String,
    base_url: String,
    website: Option<String>,
) -> Result<String, UsernameError> {
    generate_internal(http, api_key, base_url, website).await
}

#[allow(dead_code)]
pub async fn generate_with_api_url(
    http: &reqwest::Client,
    api_key: String,
    api_url: String,
    website: Option<String>,
) -> Result<String, UsernameError> {
    generate_internal(http, api_key, api_url, website).await
}

async fn generate_internal(
    http: &reqwest::Client,
    api_key: String,
    api_url: String,
    website: Option<String>,
) -> Result<String, UsernameError> {
    let query = website
        .as_ref()
        .map(|w| format!("?hostname={}", urlencoding::encode(w)))
        .unwrap_or_default();

    #[derive(serde::Serialize)]
    struct Request {
        note: String,
    }

    let response = http
        .post(format!("{api_url}/api/alias/random/new{query}"))
        .header(CONTENT_TYPE, "application/json")
        .header("Authentication", api_key)
        .json(&Request {
            note: "Generated by SecureGen".to_string(),
        })
        .send()
        .await?;

    if response.status() == StatusCode::UNAUTHORIZED {
        return Err(UsernameError::InvalidApiKey);
    }

    // Throw any other errors
    response.error_for_status_ref()?;

    #[derive(serde::Deserialize)]
    struct Response {
        alias: String,
    }
    let response: Response = response.json().await?;

    Ok(response.alias)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::generators::username::UsernameError;
    
    #[tokio::test]
    async fn test_mock_server() {
        use wiremock::{matchers, Mock, ResponseTemplate};

        let server = wiremock::MockServer::start().await;

        // Mock the request to the SimpleLogin API, and verify that the correct request is made
        server
            .register(
                Mock::given(matchers::path("/api/alias/random/new"))
                    .and(matchers::method("POST"))
                    .and(matchers::header("Content-Type", "application/json"))
                    .and(matchers::header("Authentication", "MY_TOKEN"))
                    .and(matchers::body_json(json!({
                        "note": "Generated by SecureGen"
                    })))
                    .respond_with(ResponseTemplate::new(201).set_body_json(json!({
                        "alias": "test-alias@example.com"
                    })))
                    .expect(1),
            )
            .await;

        // Mock an invalid API key request
        server
            .register(
                Mock::given(matchers::path("/api/alias/random/new"))
                    .and(matchers::method("POST"))
                    .and(matchers::header("Content-Type", "application/json"))
                    .and(matchers::header("Authentication", "MY_FAKE_TOKEN"))
                    .and(matchers::body_json(json!({
                        "note": "Generated by SecureGen"
                    })))
                    .respond_with(ResponseTemplate::new(401))
                    .expect(1),
            )
            .await;

        let address = super::generate_with_api_url(
            &reqwest::Client::new(),
            "MY_TOKEN".into(),
            format!("http://{}", server.address()),
            None,
        )
        .await
        .unwrap();
        assert_eq!(address, "test-alias@example.com");

        let fake_token_error = super::generate_with_api_url(
            &reqwest::Client::new(),
            "MY_FAKE_TOKEN".into(),
            format!("http://{}", server.address()),
            None,
        )
        .await
        .unwrap_err();

        assert_eq!(
            fake_token_error.to_string(),
            UsernameError::InvalidApiKey.to_string()
        );

        server.verify().await;
    }
} 