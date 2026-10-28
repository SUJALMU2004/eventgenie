# Security policy

## Reporting a vulnerability

Do not post credentials, private event records, or exploit details in public issues. Use GitHub private vulnerability reporting when available, or contact the repository maintainer privately. Include the affected revision, safe reproduction steps, impact, and a proposed mitigation if you have one. Use synthetic data and redact sensitive values.

The repository does not publish a guaranteed response time or long-term support policy. Security fixes are maintained on `main`.

## Security boundaries

| Area           | Controls                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credentials    | Server-only Google adapter; ignored `.env*` files except placeholder `.env.example`; no public credential variable                                                  |
| Requests       | Strict bounded schemas, JSON content type, actual 16 KiB body limit, upload/generation deadlines, origin context checks, and cancellation                           |
| AI processing  | Trusted instructions separate from JSON inputs, minimized follow-up context, no executable tools, output validation, and reviewed mutations                         |
| Rendering      | Generated content rendered as text; no interpretation of model-provided HTML                                                                                        |
| Storage        | Validated owned records, additive compatibility, atomic transactions, expected revisions, and safe backup imports                                                   |
| Browser policy | CSP blocks event-handler attributes, frame loading, and base changes; frame ancestors denied; HTTPS-only one-year HSTS; restricted permissions and content sniffing |
| Logging        | Sanitized operational error classes/status, duration, and token counts; no raw prompts, provider errors, or event data                                              |
| Supply chain   | Committed lockfile, dependency audit, pinned CI action revisions, read-only CI permissions, source/history/bundle credential checks                                 |

## Operational responsibilities

Keep local environment files and private backups out of version control. Treat a disclosed credential as compromised and rotate it through the provider. Credential-pattern scanning is a supporting control, not a guarantee that every possible secret will be detected.

Origin checks are not authentication or distributed rate limiting. A public deployment needs hosting-level abuse protection and appropriate provider quotas. Browser storage can be cleared and does not provide application-level encryption or automatic remote backup. Avoid entering sensitive personal information in AI text fields.

Static Next.js hydration retains inline bootstrap script permission. The CSP specifically blocks inline event-handler attributes; it is not a strict nonce-based policy. The trusted TLS proxy must set/overwrite protocol metadata for HTTPS header handling.

See [AI integration](docs/ai-integration.md), [privacy and storage](docs/privacy-and-storage.md), and [deployment](docs/deployment.md) for the complete data flow and operating requirements. [Verification](docs/verification.md) records tested behavior and external checks that remain separate.
