FROM node:24-alpine AS frontend-build
WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ARG APP_VERSION
# If no build-arg provided, compute timestamp here so frontend and final image match.
RUN APP_VERSION=${APP_VERSION:-$(date +%Y_%m_%d.%H.%M.%S)} \
	&& VITE_APP_VERSION=$APP_VERSION npm run build

FROM golang:1.26-alpine AS go-build
WORKDIR /src

COPY api-go/go.mod api-go/go.sum ./
RUN go mod download

COPY api-go/ ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o /out/spending-tracker-api .

FROM alpine:3.20 AS runtime
WORKDIR /app

RUN addgroup -S appgroup \
	&& adduser -S appuser -G appgroup \
	&& mkdir -p /app/App_Data /app/public \
	&& chown -R appuser:appgroup /app

COPY --from=go-build /out/spending-tracker-api /app/spending-tracker-api
COPY --from=frontend-build /app/dist /app/public

# Allow build system to provide the build timestamp; do not use shell
# substitution in ENV (invalid Dockerfile syntax). Pass via
# `--build-arg APP_VERSION="$(date +%Y_%m_%d.%H.%M.%S)"` when building.
ARG APP_VERSION
ENV PORT=7004 \
	STATIC_DIR=/app/public \
	SPENDING_TRACKER_DB=/app/App_Data/spending-tracker.db \
	APP_VERSION=$APP_VERSION

EXPOSE 7004

USER appuser

ENTRYPOINT ["/app/spending-tracker-api"]