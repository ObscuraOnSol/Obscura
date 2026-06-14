# Obscura Mock GPU Server

This directory contains the Docker configuration for a mock GPU compute node. It is designed to act as a target instance for local development and testing.

## Overview

When compute orders clear and settle, the Obscura API returns SSH credentials allowing developers and programmatic agents to connect to the allocated GPU node. 

In development:
* The backend matches and settles mock orders.
* It returns connection credentials pointing to this local container.
* You can connect to this container to test the terminal emulator integration or verify SSH access scripts.

## Services

This container runs:
1. **SSH Server**: Running on port `22` (mapped to port `2222` on the host machine).
2. **ttyd (Web Terminal)**: Exposing a web-accessible bash terminal on port `7681`.

## Local Credentials

For convenience, the default development credentials configured inside the container are:
* **Username**: `root`
* **Password**: `obscura`

## Usage

This container is automatically managed by the root `docker-compose.yml` file.

To start the infrastructure:
```bash
docker compose up -d
```

To test SSH connection manually:
```bash
ssh root@localhost -p 2222
# Password: obscura
```

To access the web terminal:
Open [http://localhost:7681](http://localhost:7681) in your browser.
