default:
    @just --list

dev:
    bun run dev

build:
    bun run build

deploy: build
    aws s3 sync dist/ s3://schaerweb

invalidate-cache DIST_ID +PATHS:
    aws cloudfront create-invalidation --distribution-id {{DIST_ID}} --paths "{{PATHS}}"
