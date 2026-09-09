# ── Optional: internal Application Load Balancer in front of Cloud Run ───────
# Enabled with internal_alb_enabled = true (pair it with
# ingress = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER" and set gateway.yaml
# public_url to https://<lb_hostname>). Everything here is skipped by default,
# so the internal-only deployment is unchanged.
#
# Client (VPC) ──HTTPS──> forwarding rule (static internal IP, :443)
#   ──> target HTTPS proxy (regional cert) ──> URL map
#   ──> backend service ──> serverless NEG ──> Cloud Run
# A VPC-scoped private Cloud DNS zone resolves lb_hostname to the LB IP.
#
# Remember to add the proxy-only subnet CIDR to gateway.yaml trusted_proxies
# (see the template's listen.trusted_proxies comment) so X-Forwarded-For from
# the ALB is honored for rate limiting and audit IPs.

locals {
  # Zone domain defaults to the hostname minus its first label
  # (gateway.gw.example.com -> gw.example.com).
  lb_zone_domain = var.lb_dns_zone_domain != "" ? var.lb_dns_zone_domain : replace(var.lb_hostname, "/^[^.]+\\./", "")
}

# Proxy-only subnet — required once per VPC/region for regional managed proxies.
resource "google_compute_subnetwork" "proxy_only" {
  count         = var.internal_alb_enabled ? 1 : 0
  project       = var.project_id
  name          = "${var.subnet}-proxy-only"
  region        = var.region
  network       = google_compute_network.vpc.id
  ip_cidr_range = var.proxy_only_subnet_range
  purpose       = "REGIONAL_MANAGED_PROXY"
  role          = "ACTIVE"
}

resource "google_compute_region_network_endpoint_group" "gateway" {
  count                 = var.internal_alb_enabled ? 1 : 0
  project               = var.project_id
  name                  = "${var.service_name}-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"
  cloud_run {
    service = google_cloud_run_v2_service.gateway.name
  }
}

# Self-signed cert for the internal hostname. Key and cert live in Terraform
# state (see the README's remote-state note). Clients trust the cert
# explicitly (curl --cacert / NODE_EXTRA_CA_CERTS with the lb_ca_cert_pem
# output); swap in a CA-issued regional certificate for anything longer-lived.
resource "tls_private_key" "lb" {
  count       = var.internal_alb_enabled ? 1 : 0
  algorithm   = "ECDSA"
  ecdsa_curve = "P256"
}

resource "tls_self_signed_cert" "lb" {
  count           = var.internal_alb_enabled ? 1 : 0
  private_key_pem = tls_private_key.lb[0].private_key_pem
  subject {
    common_name = var.lb_hostname
  }
  dns_names             = [var.lb_hostname]
  validity_period_hours = 24 * 90
  # Rotate on any apply within the last 30 days of validity — without this the
  # cert only regenerates on an apply AFTER it has already expired. Clients
  # must re-fetch lb_ca_cert_pem after a rotation.
  early_renewal_hours = 24 * 30
  allowed_uses        = ["key_encipherment", "digital_signature", "server_auth"]

  lifecycle {
    precondition {
      condition     = strcontains(var.lb_hostname, ".")
      error_message = "internal_alb_enabled requires lb_hostname with at least two labels, e.g. claude-gateway.gw.example.com (it must match gateway.yaml public_url, and the private DNS zone is derived from everything after the first label)."
    }
    precondition {
      condition     = var.ingress == "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
      error_message = "internal_alb_enabled requires ingress = \"INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER\" — with internal-only ingress Cloud Run rejects traffic arriving via the ALB."
    }
  }
}

resource "google_compute_region_ssl_certificate" "lb" {
  count       = var.internal_alb_enabled ? 1 : 0
  project     = var.project_id
  region      = var.region
  name_prefix = "${var.service_name}-lb-cert-"
  private_key = tls_private_key.lb[0].private_key_pem
  certificate = tls_self_signed_cert.lb[0].cert_pem
  lifecycle {
    create_before_destroy = true
  }
}

# timeout_sec is not configurable for serverless-NEG backends; Cloud Run's own
# 3600s request timeout (main.tf) governs long streaming responses.
resource "google_compute_region_backend_service" "gateway" {
  count                 = var.internal_alb_enabled ? 1 : 0
  project               = var.project_id
  name                  = "${var.service_name}-backend"
  region                = var.region
  load_balancing_scheme = "INTERNAL_MANAGED"
  protocol              = "HTTPS"
  backend {
    group           = google_compute_region_network_endpoint_group.gateway[0].id
    balancing_mode  = "UTILIZATION"
    capacity_scaler = 1.0
  }
}

resource "google_compute_region_url_map" "gateway" {
  count           = var.internal_alb_enabled ? 1 : 0
  project         = var.project_id
  name            = "${var.service_name}-urlmap"
  region          = var.region
  default_service = google_compute_region_backend_service.gateway[0].id
}

resource "google_compute_region_target_https_proxy" "gateway" {
  count            = var.internal_alb_enabled ? 1 : 0
  project          = var.project_id
  name             = "${var.service_name}-https-proxy"
  region           = var.region
  url_map          = google_compute_region_url_map.gateway[0].id
  ssl_certificates = [google_compute_region_ssl_certificate.lb[0].id]
}

resource "google_compute_address" "lb" {
  count        = var.internal_alb_enabled ? 1 : 0
  project      = var.project_id
  name         = "${var.service_name}-lb-ip"
  region       = var.region
  subnetwork   = google_compute_subnetwork.subnet.id
  address_type = "INTERNAL"
}

resource "google_compute_forwarding_rule" "gateway" {
  count                 = var.internal_alb_enabled ? 1 : 0
  project               = var.project_id
  name                  = "${var.service_name}-fr"
  region                = var.region
  load_balancing_scheme = "INTERNAL_MANAGED"
  network               = google_compute_network.vpc.id
  subnetwork            = google_compute_subnetwork.subnet.id
  ip_address            = google_compute_address.lb[0].id
  port_range            = "443"
  target                = google_compute_region_target_https_proxy.gateway[0].id
  # Reachable from every region of the VPC (and cross-region hybrid
  # attachments), not just var.region.
  allow_global_access = true
  # The proxy-only subnet must exist before any INTERNAL_MANAGED forwarding rule.
  depends_on = [google_compute_subnetwork.proxy_only]
}

# Private DNS: lb_hostname -> LB IP, visible only inside this VPC.
resource "google_dns_managed_zone" "lb" {
  count      = var.internal_alb_enabled ? 1 : 0
  project    = var.project_id
  name       = "${var.service_name}-lb-zone"
  dns_name   = "${local.lb_zone_domain}."
  visibility = "private"
  private_visibility_config {
    networks {
      network_url = google_compute_network.vpc.id
    }
  }
  depends_on = [google_project_service.apis]
}

resource "google_dns_record_set" "gateway" {
  count        = var.internal_alb_enabled ? 1 : 0
  project      = var.project_id
  managed_zone = google_dns_managed_zone.lb[0].name
  name         = "${var.lb_hostname}."
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_address.lb[0].address]
}
