# syntax=docker/dockerfile:1
# Build context: backend/ (not repository root). No production configuration at build time.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS publish
WORKDIR /src

# Restore independently of source edits to reuse the dependency layer.
COPY ["Directory.Build.props", "Directory.Packages.props", "global.json", "NuGet.Config", "./"]
COPY ["src/MisionLiderParis.Domain/MisionLiderParis.Domain.csproj", "src/MisionLiderParis.Domain/packages.lock.json", "src/MisionLiderParis.Domain/"]
COPY ["src/MisionLiderParis.Application/MisionLiderParis.Application.csproj", "src/MisionLiderParis.Application/packages.lock.json", "src/MisionLiderParis.Application/"]
COPY ["src/MisionLiderParis.Infrastructure/MisionLiderParis.Infrastructure.csproj", "src/MisionLiderParis.Infrastructure/packages.lock.json", "src/MisionLiderParis.Infrastructure/"]
COPY ["src/MisionLiderParis.Api/MisionLiderParis.Api.csproj", "src/MisionLiderParis.Api/packages.lock.json", "src/MisionLiderParis.Api/"]
RUN dotnet restore src/MisionLiderParis.Api/MisionLiderParis.Api.csproj --locked-mode

COPY src/ src/
# Required by the existing csproj for local inspection tools; never run this SQL.
COPY docs/reference/ministerial-reconstruction.sql.reference.txt docs/reference/
RUN dotnet publish src/MisionLiderParis.Api/MisionLiderParis.Api.csproj \
      --configuration Release --no-restore --output /out \
      --self-contained false -p:UseAppHost=false -p:DebugType=None -p:DebugSymbols=false \
    && rm -f /out/schema-reference.txt

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
# Structural public defaults only. Runtime secrets/configuration belong to Northflank.
ENV HOME=/home/app
RUN install -d -o app -g app -m 0700 \
      /home/app/.local/share/MisionLiderParis \
      /home/app/.local/share/MisionLiderParis/keys \
      /home/app/.local/share/MisionLiderParis/gmail
COPY --from=publish /out/ ./
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "MisionLiderParis.Api.dll"]
