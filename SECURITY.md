# Security Policy for Widgetry

Thank you for helping keep Widgetry and our community secure. We take security seriously and appreciate your efforts to responsibly disclose vulnerabilities.

## Supported Versions

We currently provide security updates for the following versions of the project. If a vulnerability is found, patches will be applied to the active branches.

| Version | Supported          | Notes                                      |
| ------- | ------------------ | ------------------------------------------ |
| v1.x.x  | :white_check_mark: | Active development and production version. |
| < 1.0   | :x:                | Deprecated. Please upgrade immediately.    |

## Reporting a Vulnerability

If you discover a potential security vulnerability in Widgetry, please **do not create a public GitHub issue**. Instead, follow this responsible disclosure process:

1. **Email the core maintainers directly:** Send an email to `security@widgetry.example.com` (placeholder) or contact the core maintainer (`@sandipanxd`) via private channels.
2. **Provide Detailed Information:** Include as much detail as possible in your report. Useful information includes:
   - A description of the vulnerability and its impact (e.g., XSS, CSRF, IDOR, RCE).
   - A Proof of Concept (PoC) script or steps to reproduce the issue.
   - Your environment details (Node version, Browser version).
   - Suggested mitigation if you have one.

### Our Response SLA

- **Acknowledgment:** We will acknowledge receipt of your vulnerability report within **48 hours**.
- **Triage:** We will triage the vulnerability and provide an estimated timeline for a fix within **7 days**.
- **Updates:** You will receive regular updates on our progress toward fixing the issue.

### Public Disclosure Embargo

We request a **90-day embargo** on public disclosure of reported vulnerabilities to allow sufficient time for our team to develop, test, and release a patch. Once a patch is released, we will publicly credit you for the discovery (unless you prefer to remain anonymous).

## PGP Communication

If you need to send sensitive information, please encrypt your email using our public PGP key. 

*(Key Block Placeholder)*
```
-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2
... (Maintainer PGP Key) ...
-----END PGP PUBLIC KEY BLOCK-----
```

Thank you for protecting Widgetry!
