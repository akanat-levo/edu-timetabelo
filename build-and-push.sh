#!/usr/bin/env bash
# Build both images and push them to Docker Hub (public).
# Usage: DOCKERHUB_USER=yourname TAG=v1 ./build-and-push.sh
set -euo pipefail

: "${DOCKERHUB_USER:?Set DOCKERHUB_USER to your Docker Hub username}"
TAG="${TAG:-latest}"

BACKEND_IMAGE="${DOCKERHUB_USER}/edu-timetabelo-backend:${TAG}"
FRONTEND_IMAGE="${DOCKERHUB_USER}/edu-timetabelo-frontend:${TAG}"

echo ">> Logging in to Docker Hub"
docker login

echo ">> Building backend: ${BACKEND_IMAGE}"
docker build -t "${BACKEND_IMAGE}" ./backend

echo ">> Building frontend: ${FRONTEND_IMAGE}"
docker build -t "${FRONTEND_IMAGE}" ./frontend

echo ">> Pushing images"
docker push "${BACKEND_IMAGE}"
docker push "${FRONTEND_IMAGE}"

echo ">> Done."
echo "Point your k8s manifests at:"
echo "   ${BACKEND_IMAGE}"
echo "   ${FRONTEND_IMAGE}"
