{{/*
Chart helpers — namespaced as "app.*" so renaming Chart.yaml does not
require rewriting every template. Resource names derive from global.namePrefix.
*/}}

{{- define "app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "app.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "app.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/environment: {{ .Values.global.environment | quote }}
{{- end }}

{{- define "app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/* KSA — defaults to {namePrefix}-app */}}
{{- define "app.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (printf "%s-app" .Values.global.namePrefix) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/* SecretProviderClass — defaults to {namePrefix}-app-secrets */}}
{{- define "app.secretProviderClassName" -}}
{{- default (printf "%s-app-secrets" .Values.global.namePrefix) .Values.secrets.providerClassName }}
{{- end }}

{{/* Synced / native K8s Secret — defaults to {namePrefix}-app-env */}}
{{- define "app.syncSecretName" -}}
{{- default (printf "%s-app-env" .Values.global.namePrefix) .Values.secrets.syncSecretName }}
{{- end }}

{{/* secrets.provider: kubernetes | csi (ignored when secrets.enabled=false) */}}
{{- define "app.secretsKubernetes" -}}
{{- if and .Values.secrets.enabled (eq .Values.secrets.provider "kubernetes") }}true{{- end -}}
{{- end }}

{{- define "app.secretsCsi" -}}
{{- if and .Values.secrets.enabled (eq .Values.secrets.provider "csi") }}true{{- end -}}
{{- end }}

{{/* App ConfigMap — defaults to {namePrefix}-app-config */}}
{{- define "app.configMapName" -}}
{{- default (printf "%s-app-config" .Values.global.namePrefix) .Values.configMap.name }}
{{- end }}

{{/* Ingress — defaults to {namePrefix}-ingress */}}
{{- define "app.ingressName" -}}
{{- default (printf "%s-ingress" .Values.global.namePrefix) .Values.ingress.name }}
{{- end }}

{{/* TLS secret — defaults to {namePrefix}-tls */}}
{{- define "app.tlsSecretName" -}}
{{- default (printf "%s-tls" .Values.global.namePrefix) .Values.ingress.tls.secretName }}
{{- end }}

{{/*
Secret Manager resource name for a logical env key.
projects/{projectId}/secrets/{namePrefix}-{kebab-key}/versions/latest
*/}}
{{- define "app.secretResourceName" -}}
{{- $root := index . 0 -}}
{{- $key := index . 1 -}}
{{- $explicit := index $root.Values.secrets.secretKeys $key | default "" -}}
{{- if $explicit -}}
{{- $explicit -}}
{{- else -}}
{{- $kebab := lower (replace "_" "-" $key) -}}
{{- printf "projects/%s/secrets/%s-%s/versions/latest" $root.Values.global.projectId $root.Values.global.namePrefix $kebab -}}
{{- end -}}
{{- end }}
