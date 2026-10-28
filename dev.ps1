# Script pour lancer le serveur de dev dans Docker
Write-Host "🚀 Démarrage du serveur Next.js..." -ForegroundColor Cyan
Write-Host "📍 http://localhost:3000" -ForegroundColor Yellow
Write-Host ""

docker run --rm -it `
    -v "${PWD}:/workspace" `
    -w /workspace `
    -p 3000:3000 `
    node:20-alpine `
    sh -c "npm run dev"