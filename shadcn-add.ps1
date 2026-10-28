param([string]$Component)
docker run --rm -it `
    -v "${PWD}:/workspace" `
    -w /workspace `
    node:20-alpine `
    sh -c "npx shadcn@latest add $Component --yes"

