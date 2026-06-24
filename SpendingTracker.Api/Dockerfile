FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# copy csproj and restore first for caching
COPY . .
RUN dotnet restore "SpendingTracker.Api.csproj"

# copy everything and publish
COPY . .
WORKDIR /src/SpendingTracker.Api
RUN dotnet publish "SpendingTracker.Api.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:80
EXPOSE 80
COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "SpendingTracker.Api.dll"]
