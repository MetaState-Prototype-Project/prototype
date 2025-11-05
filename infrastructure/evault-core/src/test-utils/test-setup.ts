// Import reflect-metadata for TypeORM decorators
import "reflect-metadata";

// Configure testcontainers to use Docker socket directly (avoids SSH which requires ssh2 native module)
// This prevents native module crashes in CI environments
process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE = process.env.TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE || "/var/run/docker.sock";

