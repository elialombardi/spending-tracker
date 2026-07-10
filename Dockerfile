FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# copy csproj and restore first for caching
COPY ["api/SpendingTracker.Api", "SpendingTracker.Api"]
RUN dotnet restore "SpendingTracker.Api/SpendingTracker.Api.csproj"

FROM node:24-alpine AS buildnode
WORKDIR /app

# Copy package files first for better caching
# Use a glob so both `package.json` and `package-lock.json` are included reliably
COPY ["frontend/package*.json", "."]
RUN npm ci

# Copy the rest of the source code
COPY ["frontend", "."]

# Build the app (output goes to /app/dist)
RUN npm run build

FROM build AS final
# Move files from dist to wwwroot
COPY --from=buildnode /app/dist /src/SpendingTracker.Api/wwwroot


# copy everything and publish
WORKDIR /src/SpendingTracker.Api
RUN dotnet publish "SpendingTracker.Api.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:80
EXPOSE 80
COPY --from=final /app/publish .

ENTRYPOINT ["dotnet", "SpendingTracker.Api.dll"]
