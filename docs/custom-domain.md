# Garments custom domain

Production URL: https://gss.addsmint.com

Connected on 5 November 2026 to the existing Garments Vercel project. Cloudflare remains authoritative for addsmint.com. A DNS-only CNAME for `gss` points to the project-specific destination returned by Vercel, `1133d06216434828.vercel-dns-017.com`. The TTL is automatic. The required ownership-verification TXT record was added alongside the existing `_vercel` records.

Vercel verified ownership and reports the domain configuration as correct, with no conflicting DNS records. HTTPS was verified by fetching the custom domain through the Vercel integration (HTTP 200 with the Garments app). Existing domains and unrelated Cloudflare DNS records remain in place. No redeploy was required for this domain connection.
