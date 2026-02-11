# External Certificates - Admin Guide

## Overview

By default, OpenStad projects use cert-manager to automatically request and renew TLS certificates (HTTPS) via Let's Encrypt. The external certificates feature provides an alternative: certificates managed outside the cluster, for example by your organization's central IT team using a corporate certificate authority or wildcard certificates.

Use external certificates when:

- Your organization manages TLS certificates centrally
- You need to use a specific certificate authority (not Let's Encrypt)
- You have wildcard certificates that cover multiple project domains
- Compliance requirements mandate certificate management through a specific provider

## Configuring External Certificates

### Step 1: Navigate to certificate settings

Go to **Projects** and select your project. Then navigate to **Instellingen** (Settings) and click **TLS Certificaat** in the breadcrumb or sidebar.

The URL follows this pattern:
```
/projects/{projectId}/settings/certificates
```

### Step 2: Select the certificate method

Under **Certificaatmethode** (Certificate method), select one of:

- **cert-manager (standaard)** -- Default. Automatic Let's Encrypt certificates.
- **Extern certificaat** -- Use externally managed certificates.

### Step 3: View or customize the secret name

When you select "Extern certificaat", additional fields appear:

- **Secret naam** -- The auto-generated Kubernetes secret name. This is the name your operations team needs to provision the certificate under in the external secret store. Share this name with your operations team.
- **Certificaat slug (optioneel)** -- Override the auto-generated domain portion of the secret name. Only lowercase letters, numbers, and dashes are allowed. Leave empty for automatic naming based on the project domain.

### Step 4: Save

Click **Opslaan** (Save) to apply the certificate method change.

After saving, the system will create an ExternalSecret resource in the cluster. The certificate status will update once the external provider syncs the certificate.

## Understanding Certificate Status

After configuring external certificates, a status badge shows the current state:

| Status | Badge | Meaning |
|--------|-------|---------|
| **Gekoppeld** (Linked) | Green | Certificate is active and attached to the project Ingress. HTTPS is working. |
| **In afwachting** (Pending) | Yellow | ExternalSecret created, waiting for the certificate to be provisioned by the external provider. HTTP works, HTTPS is not yet available. |
| **Fout** (Error) | Red | Something went wrong during certificate synchronization. Contact your operations team. |
| **Niet geconfigureerd** | Gray | External certificates not yet configured for this project. |

### What to expect after switching

1. Immediately after saving: status will show **In afwachting** (Pending)
2. Once the operations team provisions the certificate: status changes to **Gekoppeld** (Linked)
3. If something goes wrong: status shows **Fout** (Error)

The system checks certificate status periodically. You can also trigger a manual check.

## Manual Retry

The **Certificaat opnieuw controleren** (Check certificate again) button allows you to manually trigger a certificate status re-check.

### When to use it

- Status is **In afwachting** and you know the certificate has been provisioned
- Status is **Fout** and the underlying issue has been resolved by your operations team
- You want to verify the current state without waiting for the automatic check

### How it works

1. Click **Certificaat opnieuw controleren**
2. The system re-checks the ExternalSecret sync status and Secret existence
3. If the certificate is now available, the Ingress is updated with TLS
4. The status badge updates to reflect the new state

### Cooldown

Manual retries are subject to a cooldown period (default: 60 seconds between retries). If you trigger a retry too quickly, you will see a message indicating how many seconds to wait.

The button shows **Bezig...** (Busy) while the check is in progress.

## FAQ

**When will my certificate become available?**

This depends on your operations team provisioning the certificate in the external secret store. After provisioning, the system typically picks it up within minutes (ESO refreshes every hour, but the manual retry button checks immediately).

**Can I switch back to cert-manager?**

Yes. Change the certificate method back to "cert-manager (standaard)" and save. The system will revert to using Let's Encrypt certificates. Note that cert-manager will need to issue a new certificate, which may take a few minutes.

**What happens to existing HTTPS when I switch certificate methods?**

The Ingress TLS configuration is replaced. If switching to external certificates, HTTPS will be unavailable until the external certificate is provisioned. If switching back to cert-manager, HTTPS will be unavailable until a new Let's Encrypt certificate is issued.

**The retry button shows a cooldown message**

Wait for the indicated number of seconds before trying again. This prevents overloading the system with repeated checks.

**The status stays "In afwachting" for a long time**

Contact your operations team. The certificate may not yet be provisioned in the external secret store, or there may be a configuration issue with the External Secrets Operator.

**The status shows "Fout" -- what should I do?**

This indicates a synchronization error. Contact your operations team with the secret name shown on the settings page. They can investigate the ExternalSecret status in the cluster for more details.

**What is the "slug" field for?**

The slug overrides the automatically generated portion of the secret name that is based on your project domain. This is useful if your operations team uses a different naming convention for certificates. Only use this if instructed by your operations team.
