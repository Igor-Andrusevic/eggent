# SendForSign API — Full Reference

Base URL: `https://api.sendforsign.com/api`
Auth header: `X-Sendforsign-Key: {API_KEY}`
Content-Type: `application/json` (unless uploading files)

All POST endpoints use a `data` envelope with an `action` field.

---

## CLIENTS — POST /api/client

### Create client
```json
{
  "data": {
    "action": "create",
    "client": {
      "fullname": "John Doe",
      "email": "john@example.com",
      "organization": "Acme Corp",
      "customKey": "optional-your-own-id",
      "users": [
        { "fullname": "Jane Doe", "email": "jane@example.com", "customKey": "optional" }
      ]
    }
  }
}
```
Response 201: `{ clientKey, createTime, users: [{ userKey }] }`

### List clients
```json
{ "data": { "action": "list" } }
```
Response 200: array of `{ clientKey, fullname, email, organization, customKey, createTime, changeTime }`

### Read client
```json
{
  "data": {
    "action": "read",
    "client": { "clientKey": "..." }
  }
}
```
Can also identify by: `fullname`, `email`, `organization`, or `customKey`.

### Update client
```json
{
  "data": {
    "action": "update",
    "client": {
      "clientKey": "...",
      "fullname": "New Name",
      "email": "new@email.com",
      "organization": "New Org",
      "customKey": "new-custom-key"
    }
  }
}
```
Response 201: updated client with `changeTime`.

---

## USERS — POST /api/user

### Create user
```json
{
  "data": {
    "action": "create",
    "clientKey": "...",
    "user": { "fullname": "Jane", "email": "jane@example.com", "customKey": "optional" }
  }
}
```
Response 201: `{ userKey, createTime }`

### List users
```json
{ "data": { "action": "list", "clientKey": "..." } }
```
Response 200: array of users with `userKey, fullname, email, customKey, createTime, changeTime`

### Read user
```json
{
  "data": {
    "action": "read",
    "clientKey": "...",
    "user": { "userKey": "..." }
  }
}
```
Can also identify by: `fullname`, `email`, `customKey`.

### Update user
```json
{
  "data": {
    "action": "update",
    "clientKey": "...",
    "user": { "userKey": "...", "fullname": "...", "email": "...", "customKey": "..." }
  }
}
```

---

## CONTRACTS — POST /api/contract

### Create from HTML
```json
{
  "data": {
    "action": "create",
    "clientKey": "...",
    "userKey": "... (optional)",
    "contract": {
      "name": "My Contract",
      "value": "<p>Contract content in HTML</p>"
    }
  }
}
```
Response 201: `{ contractKey, createTime }`

### Create from template
```json
{
  "data": {
    "action": "create",
    "clientKey": "...",
    "contract": { "templateKey": "...", "name": "My Contract" }
  }
}
```

### Create from template + fill placeholders
```json
{
  "data": {
    "action": "create",
    "clientKey": "...",
    "contract": { "templateKey": "...", "name": "My Contract" },
    "placeholders": [
      { "placeholderKey": "...", "value": "filled value" },
      { "name": "placeholder_name", "value": "filled value" }
    ]
  }
}
```

### Create and send in one step
```json
{
  "data": {
    "action": "create",
    "clientKey": "...",
    "contract": { "name": "My Contract", "value": "<p>HTML content</p>" },
    "recipients": [
      {
        "email": "signer@example.com",
        "action": "sign",
        "fullname": "John Signer",
        "position": 1,
        "customMessage": "Please sign this document"
      }
    ]
  }
}
```
Recipient `action` values: `"view"` | `"sign"` | `"approve"` | `"lock"`

### List contracts
```json
{ "data": { "action": "list", "clientKey": "..." } }
```
Response 200: array of `{ contractKey, name, status, createTime, changeTime }`

### Read contract
```json
{
  "data": {
    "action": "read",
    "clientKey": "...",
    "contract": { "contractKey": "..." }
  }
}
```
Can also identify by `name`. Response includes `value` (HTML content) and `status`.

### Update contract
```json
{
  "data": {
    "action": "update",
    "clientKey": "...",
    "contract": { "contractKey": "...", "name": "New Name", "value": "<p>New HTML</p>" }
  }
}
```

### Archive contract
```json
{
  "data": {
    "action": "archive",
    "clientKey": "...",
    "contract": { "contractKey": "..." }
  }
}
```

### Get contract timeline / audit trail
```
GET /api/contract_event?clientKey=CLIENT_KEY&contractKey=CONTRACT_KEY
```
Response 200: array of events with status changes, timestamps, recipient info.

---

## TEMPLATES — POST /api/template

### Create template
```json
{
  "data": {
    "action": "create",
    "clientKey": "...",
    "template": {
      "name": "My Template",
      "value": "<p>Hello {{recipient_name}}, this agreement...</p>"
    },
    "placeholders": [
      { "name": "recipient_name", "value": "Default Value" }
    ]
  }
}
```
Response 201: `{ templateKey, createTime }`

### List templates
```json
{ "data": { "action": "list", "clientKey": "..." } }
```

### Read template
```json
{
  "data": {
    "action": "read",
    "clientKey": "...",
    "template": { "templateKey": "..." }
  }
}
```

### Update template
```json
{
  "data": {
    "action": "update",
    "clientKey": "...",
    "template": { "templateKey": "...", "name": "New Name", "value": "<p>New HTML</p>" }
  }
}
```

### Delete template
```json
{
  "data": {
    "action": "delete",
    "clientKey": "...",
    "template": { "templateKey": "..." }
  }
}
```

### Convert contract to template
```json
{
  "data": {
    "action": "convert",
    "clientKey": "...",
    "template": { "name": "Template Name", "contractKey": "..." }
  }
}
```
Note: Content and placeholders are copied; placeholder values are cleared.

---

## PLACEHOLDERS — POST /api/placeholder

### Create placeholder
```json
{
  "data": {
    "action": "create",
    "clientKey": "...",
    "contractKey": "...",
    "placeholder": { "name": "client_name", "value": "John Doe" }
  }
}
```
Response 201: `{ placeholderKey, id, createTime, changeTime, type, position }`

### List placeholders
```json
{
  "data": {
    "action": "list",
    "clientKey": "...",
    "contractKey": "..."
  }
}
```
Use `templateKey` instead of `contractKey` for template placeholders.
Response: array of `{ id, name, value, placeholderKey, position, createTime, changeTime }`

### Update placeholder (basic)
```json
{
  "data": {
    "action": "update",
    "clientKey": "...",
    "contractKey": "...",
    "placeholder": { "placeholderKey": "...", "name": "new_name", "value": "new value" }
  }
}
```

### Place basic placeholder on PDF ("pdfbasic")

CRITICAL: All values inside `insertion` must be **strings**. `id` starts from `"1"`, not `"0"`. `action` and `clientKey` are required inside each insertion item. Violations cause silent failure (201 response but field not placed).

```json
{
  "data": {
    "action": "update",
    "clientKey": "...",
    "contractKey": "...",
    "placeholders": [
      {
        "placeholderKey": "...",
        "insertion": [
          {
            "action": "update",
            "clientKey": "...",
            "id": "1",
            "pageId": "0",
            "width": "100",
            "height": "100",
            "positionX": "1",
            "positionY": "1"
          }
        ]
      }
    ]
  }
}
```

### Place special placeholder on PDF ("pdfspecial")
Special types: `1` = date signed, `2` = fullname, `3` = email, `4` = signature

The `placeholderKey` for special placeholders comes from the placeholder list response (fetched with `X-Sendforsign-Component: true`). Special placeholders are auto-created when a recipient is added. Their keys follow the pattern `{recipientKey}_{specialType}`.

Same rules as basic: all `insertion` values must be **strings**, `id` starts from `"1"`, and `action`+`clientKey` are required inside insertion.

```json
{
  "data": {
    "action": "update",
    "clientKey": "...",
    "contractKey": "...",
    "placeholders": [
      {
        "placeholderKey": "e8c68d6e-27b8-4388-b90d-47f7b3853c4c_4",
        "isSpecial": true,
        "specialType": 4,
        "insertion": [
          {
            "action": "update",
            "clientKey": "...",
            "id": "1",
            "pageId": "0",
            "positionX": "56",
            "positionY": "79",
            "width": "100",
            "height": "50"
          }
        ]
      }
    ]
  }
}
```

### Update placeholder — Table
```json
{
  "data": {
    "action": "update",
    "clientKey": "...",
    "contractKey": "...",
    "placeholder": {
      "placeholderKey": "...",
      "table": {
        "columns": ["Item", "Qty", "Price"],
        "rows": [
          ["Widget A", 10, 9.99],
          ["Widget B", 5, 19.99]
        ]
      }
    }
  }
}
```
Note: `placeholderKey` and `table` are nested inside `placeholder` (singular), not at the top `data` level.

### Delete placeholder
```json
{
  "data": {
    "action": "delete",
    "clientKey": "...",
    "contractKey": "...",
    "placeholder": { "placeholderKey": "..." }
  }
}
```

---

## RECIPIENTS — POST /api/recipient

### Create recipient
```json
{
  "data": {
    "action": "create",
    "clientKey": "...",
    "contractKey": "...",
    "userKey": "... (optional)",
    "recipients": [
      {
        "action": "sign",
        "fullname": "John Signer",
        "email": "signer@example.com",
        "position": 1,
        "customMessage": "Please review and sign"
      }
    ]
  }
}
```
Note: `recipients` is an ARRAY — even for a single recipient, wrap it in `[]`.
Response 200: `{ result: true, recipientKey }`

### List recipients
```json
{
  "data": {
    "action": "list",
    "clientKey": "...",
    "contractKey": "... (optional)"
  }
}
```
Response: array of `{ id, recipientKey, email, fullname, customMessage, position, action, createTime, changeTime }`

### Update recipient
```json
{
  "data": {
    "action": "update",
    "clientKey": "...",
    "contractKey": "...",
    "recipient": {
      "recipientKey": "...",
      "action": "approve",
      "fullname": "New Name",
      "email": "new@email.com",
      "position": 2,
      "customMessage": "Updated message"
    }
  }
}
```

### Delete recipient
```json
{
  "data": {
    "action": "delete",
    "clientKey": "...",
    "contractKey": "...",
    "recipient": { "recipientKey": "..." }
  }
}
```

### Send contract to recipients
```json
{
  "data": {
    "action": "send",
    "clientKey": "...",
    "contractKey": "...",
    "recipients": [
      {
        "email": "signer@example.com",
        "action": "sign",
        "fullname": "John Signer",
        "position": 1,
        "customMessage": "Please sign"
      },
      {
        "email": "viewer@example.com",
        "action": "view",
        "position": 2
      }
    ]
  }
}
```
To update existing recipient while sending, include `recipientKey` in the recipient object.

---

## DOCUMENTS

### Download PDF
```
GET /api/download_pdf?clientKey=CLIENT_KEY&contractKey=CONTRACT_KEY
Header: X-Sendforsign-Key: API_KEY
```
Response: binary PDF (ArrayBuffer / file stream). Save with `--output file.pdf` in curl.

### Download Word (DOCX)
```
GET /api/download_docx?clientKey=CLIENT_KEY&contractKey=CONTRACT_KEY
```
Save with `--output file.docx`.

### Upload PDF
First create contract with `contractType: "pdf"`, then:
```
POST /api/upload_pdf?clientKey=CLIENT_KEY&contractKey=CONTRACT_KEY
Content-Type: multipart/form-data
Field name: "pdf", MIME type: application/pdf
```
```bash
curl -X POST "https://api.sendforsign.com/api/upload_pdf?clientKey=...&contractKey=..." \
  -H "X-Sendforsign-Key: $API_KEY" \
  -F "pdf=@document.pdf;type=application/pdf"
```

---

## WEBHOOKS — POST /api/webhook

Event types: `Contract.created`, `Contract.sent`, `Contract.seen`, `Contract.approved`, `Contract.signed`, `Contract.fully_signed`

Webhook payloads include: `clientKey`, `contractKey`, `createTime`, `status`, recipient info (email, fullname, recipientKey), contract name.

### Create webhook
```json
{
  "data": {
    "action": "create",
    "clientKey": "...",
    "webhooks": [
      {
        "url": "https://yourapp.com/webhook",
        "created": true,
        "seen": true,
        "sent": true,
        "approved": true,
        "signed": true,
        "fullySigned": true
      }
    ]
  }
}
```
Response 201: `{ webhookKey, url, secret (whsec_...), createTime }`

### List webhooks
```json
{ "data": { "action": "list", "clientKey": "..." } }
```

### Read webhook
```json
{
  "data": {
    "action": "read",
    "clientKey": "...",
    "webhooks": [{ "webhookKey": "..." }]
  }
}
```

### Update webhook
```json
{
  "data": {
    "action": "update",
    "clientKey": "...",
    "webhooks": [
      {
        "webhookKey": "...",
        "url": "https://new-url.com/webhook",
        "signed": false,
        "fullySigned": true
      }
    ]
  }
}
```

### Delete webhook
```json
{
  "data": {
    "action": "delete",
    "clientKey": "...",
    "webhooks": [{ "webhookKey": "..." }]
  }
}
```

---

## SETTINGS — POST /api/settings

### Custom branding
```json
{
  "data": {
    "type": "brandings",
    "clientKey": "...",
    "branding": {
      "emailSenderName": "My Company",
      "emailExplainer": "Custom email footer text",
      "emailLogo": "https://example.com/logo.png",
      "buttonColor": "#FF5733",
      "emailDomain": "mail.mycompany.com",
      "recipientLinkDomain": "sign.mycompany.com"
    }
  }
}
```
Note: `emailDomain` and `recipientLinkDomain` require Business plan.

### Email notifications
```json
{
  "data": {
    "type": "email_notifications",
    "clientKey": "...",
    "notification": {
      "approved": true,
      "signed": true
    }
  }
}
```

---

## TOKENS — POST /api/token

Tokens are short-lived (1800 seconds / 30 min). Use for OAuth 2.0 compliant flows.

### Generate platform token
```json
{
  "apiKey": "...",
  "apiSecret": "..."
}
```
No auth header needed for this endpoint.

### Generate client token
```json
{
  "apiKey": "...",
  "apiSecret": "...",
  "clientKey": "..."
}
```

### Revoke token
```json
{
  "action": "revoke",
  "token": "..."
}
```
Returns 401 on expired tokens — handle with token refresh logic.

---

## AI API (Beta) — POST https://aiapi.sendforsign.com/webhook/aiapi

```bash
curl -X POST https://aiapi.sendforsign.com/webhook/aiapi \
  -H "X-Sendforsign-Key: $API_KEY" \
  -H "clientKey: $CLIENT_KEY" \
  -H "secretKey: $SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Create a non-disclosure agreement between TechCorp and John Doe"}'
```

Capabilities:
1. Generate contracts in free format with legal best practices
2. Create contracts from existing templates
3. Populate template placeholders with provided data
4. List available templates
5. View placeholder fields for templates

Response: AI-generated text + contract details including unique identifier and 30-minute preview URL.
