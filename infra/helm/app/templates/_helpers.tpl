{{/*
Expand the name of the chart.
*/}}
{{- define "turnkey-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "turnkey-app.fullname" -}}
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

{{/*
Common labels
*/}}
{{- define "turnkey-app.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "turnkey-app.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/environment: {{ .Values.global.environment | quote }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "turnkey-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "turnkey-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
ServiceAccount name
*/}}
{{- define "turnkey-app.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (printf "%s-app" .Values.global.namePrefix) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Resolve Secret Manager resource name for a logical key.
Uses explicit value when set; otherwise derives from projectId + namePrefix.
*/}}
{{- define "turnkey-app.secretResourceName" -}}
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
