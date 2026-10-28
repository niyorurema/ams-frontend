# Script pour builder en production
Write-Host "🏗️  Build de production..." -ForegroundColor Cyan

docker run --rm -it `
    -v "${PWD}:/workspace" `
    -w /workspace `
    node:20-alpine `
    sh -c "npm run build"