{{/*
Labels communs Club Quisine
*/}}
{{- define "cuisine.labels" -}}
app.kubernetes.io/part-of: cuisine
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "cuisine.namespace" -}}
{{- .Values.namespace | default "quisine" -}}
{{- end -}}

{{- define "cuisine.frontend.selectorLabels" -}}
app: cuisine-frontend
{{- end -}}

{{- define "cuisine.backend.selectorLabels" -}}
app: cuisine-backend
{{- end -}}
