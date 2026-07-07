# Integrations
> **Project:** Midevela
>
> **Document:** Dashboard Integrations
>
> **Version:** 1.0.0
>
> **Status:** Approved ✅
>
> **Owner:** Platform Team
>
> **Last Updated:** 2026-06-29
---
# Purpose
The Integrations dashboard allows businesses to connect, configure, monitor, and troubleshoot every external service connected to Midevela.
It serves as the central integration management console.
---
# Mission
Give businesses complete visibility into every connected platform.
---
# Layout
```text
------------------------------------------------------
Installed Integrations
|
Integration Details
|
Health & Activity
------------------------------------------------------
```
---
# Installed Integrations
Display
- Integration Name
- Category
- Status
- Connected Account
- Last Sync
- Health
- Version
Categories
- Ecommerce
- CRM
- Payments
- Communication
- Marketing
- ERP
- Analytics
- Developer
---
# Marketplace
Businesses can browse
- Shopify
- WooCommerce
- Stripe
- Paystack
- Flutterwave
- HubSpot
- Salesforce
- Mailchimp
- Klaviyo
- Slack
Future marketplace supports third-party plugins.
---
# Integration Details
Each integration includes
- Connected account
- Permissions granted
- Authentication type
- Sync direction
- Sync frequency
- Data mapping
- Webhook status
---
# Sync Monitor
Display
- Last successful sync
- Pending sync jobs
- Failed jobs
- Retry queue
- Sync duration
---
# Connection Health
Health indicators
🟢 Healthy
🟡 Warning
🔴 Error
Issues include
- Authentication expired
- API limit exceeded
- Webhook failures
- Sync conflicts
- Invalid credentials
---
# Logs
Businesses can inspect
- API requests
- Responses
- Errors
- Retries
- Webhook deliveries
---
# Actions
Businesses can
- Connect
- Disconnect
- Reauthenticate
- Force Sync
- Pause Sync
- View Logs
- Edit Settings
---
# AI Recommendations
Examples
- Shopify inventory hasn't synced in 2 hours.
- Paystack webhook failed 3 times.
- HubSpot customer mapping is incomplete.
- Stripe API key expires soon.
---
# Events
- IntegrationInstalled
- IntegrationUpdated
- SyncCompleted
- SyncFailed
- AuthenticationExpired
---
# Success Metrics
- Integration uptime
- Sync success rate
- API latency
- Installation completion
- Marketplace adoption
---
# Future Roadmap
- Plugin marketplace
- Custom connectors
- AI integration builder
- Integration templates
- Cross-platform workflows
---
# Related Documents
- features/integrations.md
- architecture/api.md
- architecture/events.md
---
**Status:** Approved ✅
